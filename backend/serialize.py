"""ORM → API DTO helpers. Hand-written to keep the JSON shape exactly
compatible with the frontend TypeScript types (camelCase keys, location
as a nested object).
"""
from __future__ import annotations

from typing import Any

from .models import Case, CaseEvent, Donation, AdoptionApplication


def case_to_dict(c: Case) -> dict[str, Any]:
    return {
        "id": c.id,
        "createdAt": c.created_at.isoformat() if c.created_at else None,
        "reporterName": c.reporter_name,
        "reporterContact": c.reporter_contact,
        "imageDataUrl": c.image_data_url,
        "location": {
            "lat": c.location_lat,
            "lon": c.location_lon,
            "label": c.location_label,
        },
        "species": c.species,
        "injuryType": c.injury_type,
        "severity": c.severity.value if hasattr(c.severity, "value") else c.severity,
        "probableCondition": c.probable_condition,
        "firstAidSteps": list(c.first_aid_steps or []),
        "status": c.status.value if hasattr(c.status, "value") else c.status,
        "assignedResponder": c.assigned_responder,
        "ngo": c.ngo,
        "estimatedCostInr": c.estimated_cost_inr,
        "donations": [donation_to_dict(d) for d in c.donations],
        "adoptionApplications": [app_to_dict(a) for a in c.applications],
        "events": [event_to_dict(e) for e in c.events],
        "notes": list(c.notes or []),
    }


def event_to_dict(e: CaseEvent) -> dict[str, Any]:
    return {
        "ts": e.ts.isoformat() if e.ts else None,
        "type": e.type,
        "actor": e.actor,
        "details": e.details,
    }


def donation_to_dict(d: Donation) -> dict[str, Any]:
    return {
        "id": d.id,
        "ts": d.ts.isoformat() if d.ts else None,
        "donorName": d.donor_name,
        "amountInr": d.amount_inr,
        "message": d.message,
    }


def app_to_dict(a: AdoptionApplication) -> dict[str, Any]:
    return {
        "id": a.id,
        "ts": a.ts.isoformat() if a.ts else None,
        "applicantName": a.applicant_name,
        "contact": a.contact,
        "reason": a.reason,
        "status": a.status.value if hasattr(a.status, "value") else a.status,
    }
