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
import urllib.parse

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


_ALL_VETERINARY_CONTACTS = [
    {
        "name": "NTR Veterinary Super Specialty Hospital",
        "address": "Bunder Road, Near Vijaya Dairy Parlour, Punammathota, Labbipet, Vijayawada, AP 520010",
        "phone": "N/A",
    },
    {
        "name": "Prathyusha Pet Clinic",
        "address": "Indira Gandhi Municipal Stadium Complex, Labbipet, Vijayawada, AP 520010",
        "phone": "N/A",
    },
    {
        "name": "Bluewings Pet Clinic",
        "address": "Veterinary Colony, Road Number 2, Vijayawada, AP 520008",
        "phone": "N/A",
    },
    {
        "name": "K-Petz Hospital (24-hour)",
        "address": "Gunadala Poranki, Vijayawada, AP",
        "phone": "N/A",
    },
    {
        "name": "Care Well Dog Clinic",
        "address": "Vijayawada, AP",
        "phone": "N/A",
    },
    {
        "name": "Veterinary Hospital, Guntur",
        "address": "89, Old Bank St, Kothapeta, Guntur, AP 522001",
        "phone": "N/A",
    },
    {
        "name": "Pet Care Clinic, Visakhapatnam",
        "address": "Banker Street, Opp Nr Function Hall, Murali Nagar, Visakhapatnam, AP 530007",
        "phone": "N/A",
    },
    {
        "name": "State Institute of Animal Health (SIAH)",
        "address": "Tanuku, West Godavari, AP",
        "phone": "N/A",
    },
    {
        "name": "Animal Warriors Conservation Society (AWCS Hyderabad)",
        "address": "Hyderabad, Telangana",
        "phone": "Contact via Facebook",
    },
    {
        "name": "AASRA Pets",
        "address": "Bowrampet, Hyderabad, Telangana",
        "phone": "Visit weaasra.org",
    },
    {
        "name": "Humane World For Animals (NGO)",
        "address": "Hyderabad, Telangana",
        "phone": "N/A",
    },
    {
        "name": "BREATH Animal Rescue Home",
        "address": "Hyderabad, Telangana",
        "phone": "N/A",
    },
    {
        "name": "PETA India (Delhi Office)",
        "address": "Delhi, NCR",
        "phone": "www.petaindia.com",
    },
    {
        "name": "Delhi Govt. Veterinary Hospital, Rohini",
        "address": "Rohini, Delhi",
        "phone": "Contact MCD",
    },
    {
        "name": "Delhi Govt. Veterinary Hospital, Timarpur",
        "address": "Timarpur, Delhi",
        "phone": "Contact MCD",
    },
    {
        "name": "Delhi Govt. Veterinary Hospital, Dwarka",
        "address": "Dwarka, Delhi",
        "phone": "Contact MCD",
    },
    {
        "name": "Delhi Govt. Veterinary Hospital, Tughlakabad",
        "address": "Tughlakabad, Delhi",
        "phone": "Contact MCD",
    },
    {
        "name": "Delhi Govt. Veterinary Hospital, Usmanpur",
        "address": "Usmanpur, Delhi",
        "phone": "Contact MCD",
    },
    {
        "name": "Delhi Govt. Veterinary Hospital, Bijwasan",
        "address": "Bijwasan, Delhi",
        "phone": "Contact MCD",
    },
    {
        "name": "Madras Veterinary College Teaching Hospital (Vepery)",
        "address": "Vepery High Road, Vepery, Chennai, Tamil Nadu 600007",
        "phone": "044-25304000",
    },
    {
        "name": "Blue Cross of India (Velachery)",
        "address": "Velachery Road, Near IIT Madras, Velachery, Chennai, Tamil Nadu 600042",
        "phone": "044-22354985",
    },
    {
        "name": "Sanchu Animal Hospital (Adyar)",
        "address": "Adyar, Chennai, Tamil Nadu 600020",
        "phone": "9445170000",
    }
]

def pick_local_support(location: Any) -> list[dict[str, Any]]:
    all_vets = _ALL_VETERINARY_CONTACTS
    chosen = all_vets[:3]
    if location:
        q = ""
        if isinstance(location, str):
            q = location.lower()
        elif hasattr(location, 'label') and location.label:
            q = location.label.lower()
        elif isinstance(location, dict) and location.get("label"):
            q = location["label"].lower()
            
        if q:
            tokens = [t for t in q.split() if len(t) > 2]
            matches = []
            for v in all_vets:
                addr = v["address"].lower()
                nm = v["name"].lower()
                if q in addr or q in nm or any(t in addr or t in nm for t in tokens):
                    matches.append(v)
            if matches:
                chosen = matches[:3]
                
    result = []
    for v in chosen:
        v_copy = dict(v)
        query_str = v["name"] + " " + v["address"]
        v_copy["mapsLink"] = f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(query_str)}"
        result.append(v_copy)
    return result


def mock_triage(image_data_url: str, description: str = "", location: Any = None) -> dict[str, Any]:
    c = _pick_mock(image_data_url)
    species = c["species"]
    injury_type = c["injuryType"]
    severity = {"high": "critical", "medium": "urgent", "low": "routine"}[c["severity"]]
    probable_condition = c["probableCondition"]

    desc_lower = description.lower() if description else ""

    # Species keyword overrides
    if "cow" in desc_lower or "cattle" in desc_lower or "calf" in desc_lower or "bull" in desc_lower or "bovine" in desc_lower:
        species = "cow"
        probable_condition = "Bovine health issue"
        injury_type = "open_wound"
        severity = "urgent"
    elif "cat" in desc_lower or "kitten" in desc_lower:
        species = "cat"
        probable_condition = "Feline health issue"
        injury_type = "open_wound"
        severity = "urgent"
    elif "dog" in desc_lower or "puppy" in desc_lower or "pariah" in desc_lower:
        species = "dog"
        probable_condition = "Canine health issue"
        injury_type = "open_wound"
        severity = "urgent"

    # Injury type keyword overrides
    if "bleeding" in desc_lower or "blood" in desc_lower or "intestine" in desc_lower:
        injury_type = "bleeding"
        severity = "critical"
        probable_condition = "Severe internal bleeding / gastrointestinal distress in street cattle" if species == "cow" else "Active bleeding from open wound" if species == "cat" else "Severe deep tissue wound with active bleeding"
    elif "broken" in desc_lower or "fracture" in desc_lower or "limp" in desc_lower or "leg" in desc_lower:
        injury_type = "fracture"
        severity = "critical"
        probable_condition = "Suspected bone fracture or joint dislocation"
    elif "mange" in desc_lower or "skin" in desc_lower or "itch" in desc_lower:
        injury_type = "mange"
        severity = "urgent"
        probable_condition = "Severe skin infestation, likely sarcoptic mange"
    elif "starv" in desc_lower or "thin" in desc_lower or "weak" in desc_lower or "emaciat" in desc_lower:
        injury_type = "emaciation"
        severity = "routine"
        probable_condition = "Mild emaciation and dehydration, needs feeding support"

    if description:
        probable_condition = f'{probable_condition}. Reporter note: "{description}".'

    steps = _AID_STEPS.get(injury_type, _AID_STEPS["open_wound"])
    
    # Cost estimation based on severity
    cost_map = {"critical": 5500, "urgent": 2800, "routine": 1500}
    estimated_cost = cost_map.get(severity, 1500)

    return {
        "animal": species,
        "injuryType": injury_type,
        "severity": severity,
        "probableCondition": probable_condition,
        "firstAidSteps": steps,
        "estimatedCostInr": estimated_cost,
        "isInjured": True,
        "disclaimer": "AI-generated triage suggestion, not a veterinary diagnosis.",
        "localSupport": pick_local_support(location),
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
    parsed_json.setdefault("localSupport", pick_local_support(location))
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
    return mock_triage(image_data_url, description, location)
