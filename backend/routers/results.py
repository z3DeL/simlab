from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import SimulationResult, Project, User
from schemas import SimulationResultResponse
from auth import get_current_user

router = APIRouter(prefix="/results", tags=["results"])


@router.get("/", response_model=list[SimulationResultResponse])
def list_results(
    project_id: Optional[int] = Query(None),
    result_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(SimulationResult)
    if project_id is not None:
        q = q.filter(SimulationResult.project_id == project_id)
    if result_type is not None:
        q = q.filter(SimulationResult.result_type == result_type)
    if current_user.role != "teacher":
        user_project_ids = [p.id for p in db.query(Project.id).filter(Project.user_id == current_user.id).all()]
        q = q.filter(SimulationResult.project_id.in_(user_project_ids))
    return q.order_by(SimulationResult.created_at.desc()).all()
