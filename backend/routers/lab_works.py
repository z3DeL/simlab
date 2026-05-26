from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import LabWork, User
from schemas import LabWorkResponse
from auth import get_current_user, require_teacher

router = APIRouter(prefix="/lab_works", tags=["lab_works"])


class LabWorkCreate(BaseModel):
    title: str
    description_md: str = ""
    default_schema_json: dict = {}
    order: int = 0


class LabWorkUpdate(BaseModel):
    title: Optional[str] = None
    description_md: Optional[str] = None
    default_schema_json: Optional[dict] = None
    order: Optional[int] = None


@router.get("/", response_model=list[LabWorkResponse])
def list_lab_works(db: Session = Depends(get_db)):
    return db.query(LabWork).order_by(LabWork.order).all()


@router.get("/{lab_work_id}", response_model=LabWorkResponse)
def get_lab_work(lab_work_id: int, db: Session = Depends(get_db)):
    lw = db.query(LabWork).filter(LabWork.id == lab_work_id).first()
    if not lw:
        raise HTTPException(status_code=404, detail="Лабораторная работа не найдена")
    return lw


@router.post("/", response_model=LabWorkResponse)
def create_lab_work(
    data: LabWorkCreate,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    lw = LabWork(**data.model_dump())
    db.add(lw)
    db.commit()
    db.refresh(lw)
    return lw


@router.put("/{lab_work_id}", response_model=LabWorkResponse)
def update_lab_work(
    lab_work_id: int,
    data: LabWorkUpdate,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    lw = db.query(LabWork).filter(LabWork.id == lab_work_id).first()
    if not lw:
        raise HTTPException(status_code=404, detail="Лабораторная работа не найдена")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(lw, key, value)
    db.commit()
    db.refresh(lw)
    return lw


@router.delete("/{lab_work_id}")
def delete_lab_work(
    lab_work_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    lw = db.query(LabWork).filter(LabWork.id == lab_work_id).first()
    if not lw:
        raise HTTPException(status_code=404, detail="Лабораторная работа не найдена")
    db.delete(lw)
    db.commit()
    return {"ok": True}
