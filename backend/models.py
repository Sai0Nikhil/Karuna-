"""KARUNA backend — SQLAlchemy ORM models."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON, Enum, ForeignKey, Integer, String, Text, DateTime, Float,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# ─── Enums ─────────────────────────────────────────────────────────────

class Role(str, enum.Enum):
    citizen = "citizen"
    ngo = "ngo"
    vet = "vet"
    admin = "admin"


class Severity(str, enum.Enum):
    critical = "critical"
    urgent = "urgent"
    routine = "routine"


class CaseStatus(str, enum.Enum):
    reported = "reported"
    assigned = "assigned"
    collected = "collected"
    at_clinic = "at_clinic"
    in_treatment = "in_treatment"
    discharged = "discharged"
    adopted = "adopted"
    released = "released"


class ApplicationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


# ─── User ──────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: _new_id("user"))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(Enum(Role), nullable=False, default=Role.citizen)
    ngo_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now_utc)


# ─── Case ──────────────────────────────────────────────────────────────

class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: _new_id("case"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now_utc, index=True)

    # Reporter — either an authenticated user or an anonymous citizen
    reporter_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reporter_name: Mapped[str] = mapped_column(String(120), nullable=False)
    reporter_contact: Mapped[str | None] = mapped_column(String(120), nullable=True)

    image_data_url: Mapped[str] = mapped_column(Text, nullable=False)
    location_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_label: Mapped[str] = mapped_column(String(255), nullable=False)

    species: Mapped[str] = mapped_column(String(40), nullable=False)
    injury_type: Mapped[str] = mapped_column(String(40), nullable=False)
    severity: Mapped[Severity] = mapped_column(Enum(Severity), nullable=False, index=True)
    probable_condition: Mapped[str] = mapped_column(Text, nullable=False)
    first_aid_steps: Mapped[list[str]] = mapped_column(JSON, default=list)

    status: Mapped[CaseStatus] = mapped_column(Enum(CaseStatus), nullable=False, default=CaseStatus.reported, index=True)
    assigned_responder: Mapped[str | None] = mapped_column(String(120), nullable=True)
    ngo: Mapped[str | None] = mapped_column(String(120), nullable=True)
    estimated_cost_inr: Mapped[int] = mapped_column(Integer, default=0)

    notes: Mapped[list[str]] = mapped_column(JSON, default=list)

    # Relationships
    donations: Mapped[list["Donation"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    applications: Mapped[list["AdoptionApplication"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    events: Mapped[list["CaseEvent"]] = relationship(back_populates="case", cascade="all, delete-orphan",
                                                     order_by="CaseEvent.ts")


# ─── CaseEvent — append-only audit log ─────────────────────────────────

class CaseEvent(Base):
    __tablename__ = "case_events"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: _new_id("ev"))
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), index=True, nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now_utc, index=True)
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    actor: Mapped[str] = mapped_column(String(120), nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=False)

    case: Mapped[Case] = relationship(back_populates="events")


# ─── Donation — per-case append-only ledger ────────────────────────────

class Donation(Base):
    __tablename__ = "donations"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: _new_id("don"))
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), index=True, nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now_utc)
    donor_name: Mapped[str] = mapped_column(String(120), nullable=False)
    amount_inr: Mapped[int] = mapped_column(Integer, nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    case: Mapped[Case] = relationship(back_populates="donations")


# ─── Adoption application ──────────────────────────────────────────────

class AdoptionApplication(Base):
    __tablename__ = "adoption_applications"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: _new_id("app"))
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), index=True, nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now_utc)
    applicant_name: Mapped[str] = mapped_column(String(120), nullable=False)
    contact: Mapped[str] = mapped_column(String(120), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ApplicationStatus] = mapped_column(Enum(ApplicationStatus), default=ApplicationStatus.pending)

    case: Mapped[Case] = relationship(back_populates="applications")
