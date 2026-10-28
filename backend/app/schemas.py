from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class UserSignupRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="Password (min 6 characters)")
    company_name: str = Field(..., min_length=1, description="Company or University name for tenant isolation")
    role: Optional[str] = Field("Student", description="User role: Student or Instructor")


class UserLoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    tenant_id: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ProgramCreateRequest(BaseModel):
    name: str = Field(..., min_length=1)
    assembly_source: str = Field(..., min_length=1)
    isa_preset: Optional[str] = "RISC-V"


class ProgramUpdateRequest(BaseModel):
    name: Optional[str] = None
    assembly_source: Optional[str] = None
    isa_preset: Optional[str] = None


class StepRequest(BaseModel):
    assembly_source: Optional[str] = None
    isa_preset: Optional[str] = None
    step_index: Optional[int] = 0
    forwarding_enabled: Optional[bool] = True
    cpu_state: Optional[Dict[str, Any]] = None


class RunRequest(BaseModel):
    assembly_source: Optional[str] = None
    isa_preset: Optional[str] = None
    forwarding_enabled: Optional[bool] = True
    max_cycles: Optional[int] = 500
    record_run: Optional[bool] = True
