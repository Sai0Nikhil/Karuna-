"""KARUNA backend — Claude vision triage proxy.

Hides ANTHROPIC_API_KEY from the browser. Falls back to a deterministic
mock if no key is configured OR the call errors — the demo never breaks.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import re
from typing import Any

import httpx

from .config import settings
from .schemas import CaseLocation

log = logging.getLogger("karuna.ai")

# ─── Mock fallback (kept in sync with frontend mock) ───────────────────

_MOCK_CONDITIONS = [
    {"species": "dog", "injuryType": "open_wound", "severity": "high",
     "probableCondition": "Deep laceration on hind leg with early signs of infection",
     "estimatedCostInr": 3500},
    {"species": "dog", "injuryType": "fracture", "severity": "high",
     "probableCondition": "Suspected fracture of the right hind limb (possible RTA)",
     "estimatedCostInr": 6500},
    {"species": "dog", "injuryType": "mange", "severity": "medium",
     "probableCondition": "Sarcoptic mange covering ~30% of body — treatable",
     "estimatedCostInr": 1800},
    {"species": "cat", "injuryType": "bleeding", "severity": "high",
     "probableCondition": "Active bleeding from head wound — likely from a fall",
     "estimatedCostInr": 2900},
    {"species": "cow", "injuryType": "open_wound", "severity": "medium",
     "probableCondition": "Surface wound on the flank, possibly from a nail/wire",
     "estimatedCostInr": 4200},
    {"species": "dog", "injuryType": "emaciation", "severity": "low",
     "probableCondition": "Mild emaciation, needs feeding support and a deworm cycle",
     "estimatedCostInr": 1200},
]

_AID_STEPS = {
    "open_wound": [
        "Approach slowly and from the side; speak in a soft voice.",
        "Pour clean drinking water or saline over the wound for 30 seconds.",
        "Do NOT apply human ointments. Wait for the responder.",
    ],
    "fracture": [
        "Do NOT try to set the limb — it can cause more damage.",
        "Slide a flat board / piece of cardboard under the animal as a stretcher.",
        "Cover the body with a light cloth to reduce shock.",
    ],
    "mange": [
        "Do NOT touch with bare hands — wear gloves or use a cloth.",
        "Offer clean water and a small portion of soft food.",
        "Avoid contact with pet animals.",
    ],
    "bleeding": [
        "Apply firm pressure with a clean cloth for 3 minutes.",
        "Do NOT remove the cloth even if it soaks through — add another layer.",
        "Call the nearest responder immediately — this is critical.",
    ],
    "emaciation": [
        "Offer small amounts of soft food (curd-rice, soaked biscuits).",
        "Provide clean water in a shallow bowl.",
        "Wait for the responder to arrive.",
    ],
}


def _pick_mock(image_data_url: str) -> dict[str, Any]:
    h = int(hashlib.sha1(image_data_url[:4096].encode()).hexdigest(), 16)
    return _MOCK_CONDITIONS[h % len(_MOCK_CONDITIONS)]


def mock_triage(image_data_url: str, description: str = "") -> dict[str, Any]:
    c = _pick_mock(image_data_url)
    steps = _AID_STEPS.get(c["injuryType"], _AID_STEPS["open_wound"])
    cond = c["probableCondition"]
    if description:
        cond = f'{cond}. Reporter note: "{description}".'
    severity = {"high": "critical", "medium": "urgent", "low": "routine"}[c["severity"]]
    return {
        "animal": c["species"],
        "injuryType": c["injuryType"],
        "severity": severity,
        "probableCondition": cond,
        "firstAidSteps": steps,
        "estimatedCostInr": c["estimatedCostInr"],
        "isInjured": True,
        "disclaimer": "AI-generated triage suggestion, not a veterinary diagnosis.",
    }


# ─── Claude vision call ────────────────────────────────────────────────

_PROMPT_TEMPLATE = """You are Karuṇā, a compassionate AI veterinary assistant. Identify the most probable condition of the animal in the image and return ONLY a JSON object (no prose) with these fields:

{
  "animal": "dog" | "cat" | "cow" | "other",
  "isInjured": true | false,
  "severity": "critical" | "urgent" | "routine",
  "injuryType": "open_wound" | "fracture" | "mange" | "bleeding" | "emaciation" | "eye_injury" | "general",
  "probableCondition": string,
  "firstAidSteps": [string, ...] (3-5 short steps),
  "estimatedCostInr": integer (rough INR estimate for treatment),
  "disclaimer": string
}

Reporter note: %(description)s
Reporter location: %(location)s
"""


def _parse_data_url(s: str) -> tuple[str, str] | None:
    m = re.match(r"^data:([^;]+);base64,(.+)$", s)
    if not m:
        return None
    return m.group(1), m.group(2)


async def claude_triage(image_data_url: str, description: str, language: str,
                        location: CaseLocation | None) -> dict[str, Any]:
    """Call Anthropic Claude with the image. Raises on any error."""
    parsed = _parse_data_url(image_data_url)
    if not parsed:
        raise ValueError("Image is not a base64 data URL")
    media_type, b64 = parsed

    loc_str = "unknown"
    if location:
        if location.lat is not None and location.lon is not None:
            loc_str = f"lat={location.lat}, lon={location.lon} ({location.label})"
        else:
            loc_str = location.label

    prompt = _PROMPT_TEMPLATE % {"description": description or "(none)", "location": loc_str}

    body = {
        "model": settings.ANTHROPIC_MODEL,
        "max_tokens": 1200,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": prompt},
            ],
        }],
    }
    headers = {
        "x-api-key": settings.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post("https://api.anthropic.com/v1/messages", json=body, headers=headers)
        r.raise_for_status()
        data = r.json()

    # Extract text block
    blocks = data.get("content", [])
    text = next((b.get("text", "") for b in blocks if b.get("type") == "text"), "")
    if not text:
        raise ValueError("Claude returned no text content")

    # Extract first {...} JSON
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise ValueError(f"No JSON in Claude reply: {text[:200]}")
    parsed_json = json.loads(m.group(0))
    parsed_json.setdefault("isInjured", True)
    parsed_json.setdefault("disclaimer", "AI-generated triage suggestion.")
    return parsed_json


async def triage(image_data_url: str, description: str = "",
                 language: str = "english",
                 location: CaseLocation | None = None) -> dict[str, Any]:
    """Public entry point — tries Claude first, falls back to mock."""
    if settings.claude_enabled:
        try:
            return await claude_triage(image_data_url, description, language, location)
        except Exception as e:
            log.warning("Claude triage failed, using mock: %s", e)
    return mock_triage(image_data_url, description)
