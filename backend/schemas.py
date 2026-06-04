"""KARUNA backend — Pydantic request/response schemas.

Shapes are kept close to the frontend's TypeScript types so the client can
deserialise without any field renaming.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

# ─── Auth ──────────────────────────────────────────────────────────────

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    role: Literal["citizen", "ngo", "vet", "admin"] = "citizen"
    ngo_name: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    ngo_name: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Case ──────────────────────────────────────────────────────────────

class CaseLocation(BaseModel):
    lat: Optional[float] = None
    lon: Optional[float] = None
    label: str


class CaseEventOut(BaseModel):
    ts: datetime
    type: str
    actor: str
    details: str

    class Config:
        from_attributes = True


class DonationOut(BaseModel):
    id: str
    ts: datetime
    donor_name: str = Field(alias="donorName")
    amount_inr: int = Field(alias="amountInr")
    message: Optional[str] = None

    class Config:
        from_attributes = True
        populate_by_name = True


class AdoptionApplicationOut(BaseModel):
    id: str
    ts: datetime
    applicant_name: str = Field(alias="applicantName")
    contact: str
    reason: str
    status: str

    class Config:
        from_attributes = True
        populate_by_name = True


class CaseOut(BaseModel):
    id: str
    created_at: datetime = Field(alias="createdAt")
    reporter_name: str = Field(alias="reporterName")
    reporter_contact: Optional[str] = Field(default=None, alias="reporterContact")
    image_data_url: str = Field(alias="imageDataUrl")
    location: CaseLocation
    species: str
    injury_type: str = Field(alias="injuryType")
    severity: str
    probable_condition: str = Field(alias="probableCondition")
    first_aid_steps: list[str] = Field(default_factory=list, alias="firstAidSteps")
    status: str
    assigned_responder: Optional[str] = Field(default=None, alias="assignedResponder")
    ngo: Optional[str] = None
    estimated_cost_inr: int = Field(alias="estimatedCostInr")
    donations: list[DonationOut] = []
    adoption_applications: list[AdoptionApplicationOut] = Field(default_factory=list, alias="adoptionApplications")
    events: list[CaseEventOut] = []
    notes: list[str] = []

    class Config:
        populate_by_name = True


class CaseCreateIn(BaseModel):
    reporter_name: str = Field(alias="reporterName")
    reporter_contact: Optional[str] = Field(default=None, alias="reporterContact")
    image_data_url: str = Field(alias="imageDataUrl")
    location: CaseLocation
    species: str
    injury_type: str = Field(alias="injuryType")
    severity: Literal["critical", "urgent", "routine"]
    probable_condition: str = Field(alias="probableCondition")
    first_aid_steps: list[str] = Field(default_factory=list, alias="firstAidSteps")
    estimated_cost_inr: int = Field(alias="estimatedCostInr")

    class Config:
        populate_by_name = True


class AssignIn(BaseModel):
    responder: str
    ngo: Optional[str] = None


class StatusUpdateIn(BaseModel):
    to: Literal["reported", "assigned", "collected", "at_clinic", "in_treatment", "discharged", "adopted", "released"]
    actor: str
    note: Optional[str] = None


class NoteIn(BaseModel):
    actor: str
    note: str


class DonationIn(BaseModel):
    donor_name: str = Field(alias="donorName")
    amount_inr: int = Field(alias="amountInr", gt=0)
    message: Optional[str] = None

    class Config:
        populate_by_name = True


class AdoptionApplyIn(BaseModel):
    applicant_name: str = Field(alias="applicantName")
    contact: str
    reason: str

    class Config:
        populate_by_name = True


class AdoptionDecideIn(BaseModel):
    status: Literal["approved", "rejected"]
    actor: str = "NGO Admin"


# ─── AI triage proxy ───────────────────────────────────────────────────

class TriageIn(BaseModel):
    image_data_url: str = Field(alias="imageDataUrl")
    description: str = ""
    language: str = "english"
    location: Optional[CaseLocation] = None

    class Config:
        populate_by_name = True


# ─── WebSocket events ──────────────────────────────────────────────────

class WsEvent(BaseModel):
    type: Literal[
        "case.created", "case.updated", "case.assigned", "case.status",
        "case.donation", "case.note", "case.adoption_application",
        "case.adoption_decision",
    ]
    case_id: str = Field(alias="caseId")
    payload: dict | None = None

    class Config:
        populate_by_name = True


# resolve forward refs
TokenOut.model_rebuild()
