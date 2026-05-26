from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# --- Auth ---

class UserRegister(BaseModel):
    username: str
    password: str
    full_name: str = ""
    role: str = "student"  # "student" | "teacher"


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    username: str
    full_name: str
    role: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# --- Project ---

class ProjectCreate(BaseModel):
    model_config = {"protected_namespaces": ()}
    name: str = "Новый проект"
    schema_json: dict = {}
    custom_code: str = ""
    rl_code: str = ""


class ProjectUpdate(BaseModel):
    model_config = {"protected_namespaces": ()}
    name: Optional[str] = None
    schema_json: Optional[dict] = None
    custom_code: Optional[str] = None
    rl_code: Optional[str] = None
    generated_code: Optional[str] = None
    sim_results_json: Optional[dict] = None
    rl_results_json: Optional[dict] = None


class ProjectResponse(BaseModel):
    model_config = {"protected_namespaces": (), "from_attributes": True}
    id: int
    name: str
    user_id: Optional[int] = None
    schema_json: dict
    custom_code: str
    rl_code: str
    generated_code: str = ""
    sim_results_json: Optional[dict] = None
    rl_results_json: Optional[dict] = None
    grade: Optional[int] = None
    grade_comment: str = ""
    created_at: datetime
    updated_at: datetime


# --- Simulation ---

class RunSimulationRequest(BaseModel):
    sim_time: int = 480


class RunRLRequest(BaseModel):
    rl_code: str = ""
    episodes: int = 1500


class GeneratedCodeResponse(BaseModel):
    code: str
    rl_code: str = ""


class SimulationResultResponse(BaseModel):
    model_config = {"protected_namespaces": (), "from_attributes": True}
    id: int
    project_id: int
    result_type: str
    metrics_json: dict
    timeseries_json: dict
    generated_code: str
    log_text: str
    created_at: datetime


# --- LabWork ---

class LabWorkResponse(BaseModel):
    model_config = {"protected_namespaces": (), "from_attributes": True}
    id: int
    title: str
    description_md: str
    default_schema_json: dict
    order: int


class RLTemplateResponse(BaseModel):
    code: str
    obs_dim: int
    act_dim: int


class GradeRequest(BaseModel):
    grade: int  # 1–10
    comment: str = ""
