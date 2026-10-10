from pydantic import BaseModel, Field, HttpUrl, field_validator, ConfigDict
from typing import Any

class RegisterIn(BaseModel):
    company_name: str = Field(min_length=2, max_length=160)
    industry: str = Field(default="Other", max_length=100)
    website: str = Field(default="", max_length=500)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    description: str = Field(default="", max_length=3000)

class LoginIn(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)

class BrandIn(BaseModel):
    official_name: str = Field(min_length=1, max_length=160)
    alternative_names: list[str] = Field(default_factory=list, max_length=30)
    official_website: str = Field(default="", max_length=500)
    official_domains: list[str] = Field(default_factory=list, max_length=30)
    social_accounts: list[str] = Field(default_factory=list, max_length=50)
    registration_urls: list[str] = Field(default_factory=list, max_length=30)
    payment_instructions: str = Field(default="", max_length=2000)
    description: str = Field(default="", max_length=3000)
    verification_status: str = "unverified"

class ThreatIn(BaseModel):
    candidate: str = Field(min_length=3, max_length=700)
    asset_type: str = Field(default="website", max_length=40)
    platform: str = Field(default="Manual submission", max_length=80)

class ThreatPatch(BaseModel):
    status: str | None = None
    analyst_notes: str | None = Field(default=None, max_length=5000)

class NoteIn(BaseModel):
    note: str = Field(min_length=1, max_length=5000)

class IncidentIn(BaseModel):
    threat_id: int | None = None
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=5000)
    severity: str = "Medium"

class IncidentPatch(BaseModel):
    status: str | None = None
    resolution_notes: str | None = Field(default=None, max_length=5000)
    note: str | None = Field(default=None, max_length=5000)
