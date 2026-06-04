"""KARUNA backend — FastAPI app.

Endpoints (all under /api):
  POST /auth/register
  POST /auth/login
  GET  /auth/me                                 (auth)
  GET  /cases
  POST /cases
  GET  /cases/{id}
  PATCH /cases/{id}/assign                      (auth: ngo/admin)
  PATCH /cases/{id}/status                      (auth: ngo/admin/vet)
  POST /cases/{id}/notes                        (auth: ngo/admin/vet)
  POST /cases/{id}/donations
  POST /cases/{id}/adoption-apply
  PATCH /cases/{id}/adoption/{appId}            (auth: ngo/admin)
  POST /ai/triage

WebSocket: /ws — broadcasts every mutation as a JSON event.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, status, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db, init_db
from .models import (
    User, Case, CaseEvent, Donation, AdoptionApplication,
    Role, Severity, CaseStatus, ApplicationStatus,
)
from . import schemas, auth, ai
from .realtime import manager, ws_endpoint
from .serialize import case_to_dict

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s — %(message)s")
log = logging.getLogger("karuna")

app = FastAPI(title="KARUNA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    init_db()
    log.info("DB initialised. Claude AI: %s", "ENABLED" if settings.claude_enabled else "MOCK")


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "claudeEnabled": settings.claude_enabled,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ───────────────────────────────────────────────────────────────────────
# Helper: broadcast a case-mutation event
# ───────────────────────────────────────────────────────────────────────

async def _broadcast(event_type: str, case: Case):
    await manager.broadcast({
        "type": event_type,
        "caseId": case.id,
        "payload": case_to_dict(case),
    })


# ───────────────────────────────────────────────────────────────────────
# Auth
# ───────────────────────────────────────────────────────────────────────

@app.post("/api/auth/register", response_model=schemas.TokenOut)
def register(body: schemas.RegisterIn, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")
    user = User(
        email=body.email,
        name=body.name,
        password_hash=auth.hash_password(body.password),
        role=Role(body.role),
        ngo_name=body.ngo_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": auth.create_access_token(user), "user": user}


@app.post("/api/auth/login", response_model=schemas.TokenOut)
def login(body: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not auth.verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    return {"access_token": auth.create_access_token(user), "user": user}


@app.get("/api/auth/me", response_model=schemas.UserOut)
def me(user: User = Depends(auth.require_user)):
    return user


# ───────────────────────────────────────────────────────────────────────
# Cases — read
# ───────────────────────────────────────────────────────────────────────

@app.get("/api/cases")
def list_cases(db: Session = Depends(get_db)):
    rows = db.query(Case).order_by(Case.created_at.desc()).all()
    return [case_to_dict(c) for c in rows]


@app.get("/api/cases/{case_id}")
def get_case(case_id: str, db: Session = Depends(get_db)):
    c = db.get(Case, case_id)
    if not c:
        raise HTTPException(404, "Case not found")
    return case_to_dict(c)


# ───────────────────────────────────────────────────────────────────────
# Cases — create
# ───────────────────────────────────────────────────────────────────────

@app.post("/api/cases", status_code=201)
async def create_case(
    body: schemas.CaseCreateIn,
    db: Session = Depends(get_db),
    current: User | None = Depends(auth.get_current_user),
):
    case = Case(
        reporter_user_id=current.id if current else None,
        reporter_name=body.reporter_name,
        reporter_contact=body.reporter_contact,
        image_data_url=body.image_data_url,
        location_lat=body.location.lat,
        location_lon=body.location.lon,
        location_label=body.location.label,
        species=body.species,
        injury_type=body.injury_type,
        severity=Severity(body.severity),
        probable_condition=body.probable_condition,
        first_aid_steps=body.first_aid_steps,
        estimated_cost_inr=body.estimated_cost_inr,
        notes=[],
    )
    db.add(case)
    db.flush()
    ev = CaseEvent(case_id=case.id, type="created", actor=body.reporter_name,
                   details=f"Case opened ({body.severity})")
    db.add(ev)
    db.commit()
    db.refresh(case)
    await _broadcast("case.created", case)
    return case_to_dict(case)


# ───────────────────────────────────────────────────────────────────────
# Cases — assign / status / note
# ───────────────────────────────────────────────────────────────────────

@app.patch("/api/cases/{case_id}/assign")
async def assign_case(
    case_id: str,
    body: schemas.AssignIn,
    db: Session = Depends(get_db),
    user: User = Depends(auth.require_role(Role.ngo, Role.admin)),
):
    c = db.get(Case, case_id)
    if not c:
        raise HTTPException(404, "Case not found")
    c.status = CaseStatus.assigned
    c.assigned_responder = body.responder
    c.ngo = body.ngo or c.ngo or (user.ngo_name or "Karuna Volunteers")
    db.add(CaseEvent(case_id=c.id, type="assigned", actor=c.ngo,
                     details=f"Dispatched to {body.responder}"))
    db.commit(); db.refresh(c)
    await _broadcast("case.assigned", c)
    return case_to_dict(c)


@app.patch("/api/cases/{case_id}/status")
async def update_status(
    case_id: str,
    body: schemas.StatusUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(auth.require_role(Role.ngo, Role.vet, Role.admin)),
):
    c = db.get(Case, case_id)
    if not c:
        raise HTTPException(404, "Case not found")
    c.status = CaseStatus(body.to)
    details = f"→ {body.to}" + (f" ({body.note})" if body.note else "")
    db.add(CaseEvent(case_id=c.id, type="status", actor=body.actor, details=details))
    if body.note:
        c.notes = list(c.notes or []) + [body.note]
    db.commit(); db.refresh(c)
    await _broadcast("case.status", c)
    return case_to_dict(c)


@app.post("/api/cases/{case_id}/notes")
async def add_note(
    case_id: str,
    body: schemas.NoteIn,
    db: Session = Depends(get_db),
    user: User = Depends(auth.require_role(Role.ngo, Role.vet, Role.admin)),
):
    c = db.get(Case, case_id)
    if not c:
        raise HTTPException(404, "Case not found")
    c.notes = list(c.notes or []) + [body.note]
    db.add(CaseEvent(case_id=c.id, type="note", actor=body.actor, details=body.note))
    db.commit(); db.refresh(c)
    await _broadcast("case.note", c)
    return case_to_dict(c)


# ───────────────────────────────────────────────────────────────────────
# Donations — no auth required (donors can be anonymous)
# ───────────────────────────────────────────────────────────────────────

@app.post("/api/cases/{case_id}/donations")
async def add_donation(case_id: str, body: schemas.DonationIn, db: Session = Depends(get_db)):
    c = db.get(Case, case_id)
    if not c:
        raise HTTPException(404, "Case not found")
    d = Donation(case_id=c.id, donor_name=body.donor_name,
                 amount_inr=body.amount_inr, message=body.message)
    db.add(d)
    db.add(CaseEvent(case_id=c.id, type="donation", actor=body.donor_name,
                     details=f"₹{body.amount_inr:,} donated"))
    db.commit(); db.refresh(c)
    await _broadcast("case.donation", c)
    return case_to_dict(c)


# ───────────────────────────────────────────────────────────────────────
# Adoption — apply (no auth), decide (NGO)
# ───────────────────────────────────────────────────────────────────────

@app.post("/api/cases/{case_id}/adoption-apply")
async def apply_for_adoption(case_id: str, body: schemas.AdoptionApplyIn, db: Session = Depends(get_db)):
    c = db.get(Case, case_id)
    if not c:
        raise HTTPException(404, "Case not found")
    a = AdoptionApplication(case_id=c.id, applicant_name=body.applicant_name,
                            contact=body.contact, reason=body.reason)
    db.add(a)
    db.add(CaseEvent(case_id=c.id, type="adoption_application", actor=body.applicant_name,
                     details="Applied to adopt"))
    db.commit(); db.refresh(c)
    await _broadcast("case.adoption_application", c)
    return case_to_dict(c)


@app.patch("/api/cases/{case_id}/adoption/{app_id}")
async def decide_adoption(
    case_id: str, app_id: str,
    body: schemas.AdoptionDecideIn,
    db: Session = Depends(get_db),
    user: User = Depends(auth.require_role(Role.ngo, Role.admin)),
):
    c = db.get(Case, case_id)
    if not c:
        raise HTTPException(404, "Case not found")
    a = db.get(AdoptionApplication, app_id)
    if not a or a.case_id != c.id:
        raise HTTPException(404, "Application not found")
    a.status = ApplicationStatus(body.status)
    if body.status == "approved":
        c.status = CaseStatus.adopted
    db.add(CaseEvent(case_id=c.id, type="adoption_decision", actor=body.actor,
                     details=f"Adoption {body.status} ({a.applicant_name})"))
    db.commit(); db.refresh(c)
    await _broadcast("case.adoption_decision", c)
    return case_to_dict(c)


# ───────────────────────────────────────────────────────────────────────
# AI triage proxy
# ───────────────────────────────────────────────────────────────────────

@app.post("/api/ai/triage")
async def ai_triage(body: schemas.TriageIn):
    result = await ai.triage(
        image_data_url=body.image_data_url,
        description=body.description,
        language=body.language,
        location=body.location,
    )
    return result


# ───────────────────────────────────────────────────────────────────────
# WebSocket
# ───────────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def ws(ws: WebSocket):
    await ws_endpoint(ws)


# Local dev convenience: `python -m backend.main` runs uvicorn
def run():
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)


if __name__ == "__main__":
    run()
