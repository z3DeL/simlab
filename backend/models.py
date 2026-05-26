from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(150), unique=True, index=True, nullable=False)
    full_name = Column(String(255), default="")
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="student")  # "student" | "teacher"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), default="Новый проект")
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    schema_json = Column(JSON, default=dict)
    custom_code = Column(Text, default="")
    rl_code = Column(Text, default="")
    generated_code = Column(Text, default="")
    sim_results_json = Column(JSON, nullable=True)
    rl_results_json = Column(JSON, nullable=True)
    grade = Column(Integer, nullable=True)
    grade_comment = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="projects")
    results = relationship("SimulationResult", back_populates="project", cascade="all, delete-orphan")


class SimulationResult(Base):
    __tablename__ = "simulation_results"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    result_type = Column(String(20), default="simulation")  # simulation / rl
    metrics_json = Column(JSON, default=dict)
    timeseries_json = Column(JSON, default=dict)
    generated_code = Column(Text, default="")
    log_text = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="results")


class LabWork(Base):
    __tablename__ = "lab_works"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255))
    description_md = Column(Text, default="")
    default_schema_json = Column(JSON, default=dict)
    order = Column(Integer, default=0)
