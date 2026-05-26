from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import asyncio
import json
from concurrent.futures import ThreadPoolExecutor

from database import get_db
from models import Project, SimulationResult, User
from schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    RunSimulationRequest, RunRLRequest,
    GeneratedCodeResponse, SimulationResultResponse, RLTemplateResponse,
    GradeRequest,
)
from engine.translator import translate
from engine.runner import run
from rl.executor import execute_rl
from rl.templates import generate_template, generate_qlearning_template, generate_reinforce_template
from auth import get_current_user, require_teacher

router = APIRouter(prefix="/projects", tags=["projects"])

# Пул потоков для выполнения RL-кода
executor_pool = ThreadPoolExecutor(max_workers=5)


@router.get("/", response_model=list[ProjectResponse])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Студент видит только свои проекты, преподаватель — все."""
    if current_user.role == "teacher":
        return db.query(Project).order_by(Project.updated_at.desc()).all()
    return db.query(Project).filter(Project.user_id == current_user.id).order_by(Project.updated_at.desc()).all()


@router.post("/", response_model=ProjectResponse)
def create_project(
    data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = Project(**data.model_dump(), user_id=current_user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _get_project_for_user(project_id: int, user: User, db: Session) -> Project:
    """Возвращает проект если пользователь имеет к нему доступ."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    if user.role != "teacher" and project.user_id != user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этому проекту")
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_project_for_user(project_id, current_user, db)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_for_user(project_id, current_user, db)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_for_user(project_id, current_user, db)
    db.delete(project)
    db.commit()
    return {"ok": True}


@router.post("/{project_id}/grade", response_model=ProjectResponse)
def grade_project(
    project_id: int,
    data: GradeRequest,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    if not 1 <= data.grade <= 10:
        raise HTTPException(status_code=400, detail="Оценка должна быть от 1 до 10")
    project.grade = data.grade
    project.grade_comment = data.comment
    db.commit()
    db.refresh(project)
    return project


@router.post("/{project_id}/generate_code", response_model=GeneratedCodeResponse)
def generate_code(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_for_user(project_id, current_user, db)
    try:
        code = translate(project.schema_json, project.custom_code)
        rl_code = ""
        try:
            rl_code, _, _ = generate_qlearning_template(project.schema_json)
        except ValueError:
            pass  # нет RL-блоков — не страшно
        project.generated_code = code
        db.commit()
        return {"code": code, "rl_code": rl_code}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{project_id}/run_simulation", response_model=SimulationResultResponse)
def run_simulation(
    project_id: int,
    req: RunSimulationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_for_user(project_id, current_user, db)
    try:
        code = translate(project.schema_json, project.custom_code)
        metrics, timeseries, log = run(
            project.schema_json, project.custom_code, sim_time=req.sim_time
        )
        result = SimulationResult(
            project_id=project.id,
            result_type="simulation",
            metrics_json=metrics,
            timeseries_json=timeseries,
            generated_code=code,
            log_text=log,
        )
        db.add(result)
        db.flush()  # присваивает result.id
        project.sim_results_json = {
            "id": result.id,
            "project_id": project.id,
            "result_type": "simulation",
            "metrics_json": metrics,
            "timeseries_json": timeseries,
            "generated_code": code,
            "log_text": log,
        }
        db.commit()
        db.refresh(result)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{project_id}/run_rl", response_model=SimulationResultResponse)
def run_rl(
    project_id: int,
    req: RunRLRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_for_user(project_id, current_user, db)
    try:
        rl_code = req.rl_code or project.rl_code
        if not rl_code or not rl_code.strip():
            rl_code, _, _ = generate_qlearning_template(project.schema_json)
            
        metrics, timeseries, log = execute_rl(
            project.schema_json, project.custom_code, rl_code
        )
        result = SimulationResult(
            project_id=project.id,
            result_type="rl",
            metrics_json=metrics,
            timeseries_json=timeseries,
            log_text=log,
        )
        db.add(result)
        db.commit()
        db.refresh(result)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.websocket("/{project_id}/train_ws")
async def project_train_ws(websocket: WebSocket, project_id: int, db: Session = Depends(get_db)):
    """WebSocket для обучения RL-агента с логами в реальном времени."""
    await websocket.accept()
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        await websocket.send_json({"type": "error", "data": "Проект не найден"})
        await websocket.close()
        return

    loop = asyncio.get_event_loop()
    log_queue = asyncio.Queue()

    def log_callback(data: str):
        # Вызывается из (синхронного) потока выполнения RL
        loop.call_soon_threadsafe(log_queue.put_nowait, data)

    async def log_reader():
        while True:
            data = await log_queue.get()
            if data is None:
                break
            await websocket.send_json({"type": "log", "data": data})

    reader_task = asyncio.create_task(log_reader())

    try:
        rl_code = project.rl_code
        if not rl_code or not rl_code.strip():
            rl_code, _, _ = generate_qlearning_template(project.schema_json)

        # Выполняем RL в пуле потоков
        def task():
            return execute_rl(
                project.schema_json, project.custom_code, rl_code,
                log_callback=log_callback
            )

        metrics, timeseries, log = await loop.run_in_executor(executor_pool, task)

        # Сохраняем результат
        result = SimulationResult(
            project_id=project.id,
            result_type="rl",
            metrics_json=metrics,
            timeseries_json=timeseries,
            log_text=log,
        )
        db.add(result)
        db.flush()
        project.rl_results_json = {
            "id": result.id,
            "project_id": project.id,
            "result_type": "rl",
            "metrics_json": metrics,
            "timeseries_json": timeseries,
            "log_text": log,
        }
        db.commit()
        db.refresh(result)

        # Оповещаем о завершении
        await log_queue.put(None)
        await reader_task
        
        await websocket.send_json({
            "type": "result",
            "data": {
                "id": result.id,
                "project_id": result.project_id,
                "result_type": result.result_type,
                "metrics_json": result.metrics_json,
                "timeseries_json": result.timeseries_json,
                "log_text": result.log_text,
                "created_at": result.created_at.isoformat() if result.created_at else None
            }
        })

    except Exception as e:
        await websocket.send_json({"type": "error", "data": str(e)})
    finally:
        try:
            await websocket.close()
        except:
            pass


@router.get("/{project_id}/rl_template", response_model=RLTemplateResponse)
def get_rl_template(
    project_id: int,
    algorithm: str = "dqn",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_for_user(project_id, current_user, db)
    _generators = {
        "dqn": generate_template,
        "qlearning": generate_qlearning_template,
        "reinforce": generate_reinforce_template,
    }
    generator = _generators.get(algorithm)
    if generator is None:
        raise HTTPException(status_code=400, detail=f"Неизвестный алгоритм: {algorithm}. Доступны: {', '.join(_generators)}")
    try:
        code, obs_dim, act_dim = generator(project.schema_json)
        return {"code": code, "obs_dim": obs_dim, "act_dim": act_dim}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
