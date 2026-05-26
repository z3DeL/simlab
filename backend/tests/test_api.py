"""
Тесты для API endpoints (FastAPI).
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models  # noqa: F401 — register models with Base
from database import Base, get_db

# In-memory SQLite with StaticPool (single shared connection)
TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)
Base.metadata.create_all(bind=TEST_ENGINE)

from main import app


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    with TestSession() as db:
        db.query(models.SimulationResult).delete()
        db.query(models.Project).delete()
        db.commit()


SIMPLE_SCHEMA = {
    "nodes": [
        {"id": "source_1", "type": "source", "data": {
            "interval": {"dist": "constant", "params": {"value": 2.0}}
        }},
        {"id": "buffer_1", "type": "buffer", "data": {"capacity": 20}},
        {"id": "machine_1", "type": "machine", "data": {
            "processing_time": {"dist": "constant", "params": {"value": 3.0}},
            "count": 1, "mtbf": 10000, "mttr": 1,
        }},
        {"id": "sink_1", "type": "sink", "data": {"label": "Выход"}},
    ],
    "edges": [
        {"source": "source_1", "target": "buffer_1"},
        {"source": "buffer_1", "target": "machine_1"},
        {"source": "machine_1", "target": "sink_1"},
    ],
}


class TestProjectsCRUD:
    def test_create_project(self):
        r = client.post("/api/projects/", json={"name": "Test Project"})
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Test Project"
        assert data["id"] > 0

    def test_list_projects(self):
        client.post("/api/projects/", json={"name": "P1"})
        client.post("/api/projects/", json={"name": "P2"})
        r = client.get("/api/projects/")
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_get_project(self):
        r1 = client.post("/api/projects/", json={"name": "P1"})
        pid = r1.json()["id"]
        r2 = client.get(f"/api/projects/{pid}")
        assert r2.status_code == 200
        assert r2.json()["name"] == "P1"

    def test_update_project(self):
        r1 = client.post("/api/projects/", json={"name": "Old"})
        pid = r1.json()["id"]
        r2 = client.put(f"/api/projects/{pid}", json={"name": "New"})
        assert r2.status_code == 200
        assert r2.json()["name"] == "New"

    def test_delete_project(self):
        r1 = client.post("/api/projects/", json={"name": "Del"})
        pid = r1.json()["id"]
        r2 = client.delete(f"/api/projects/{pid}")
        assert r2.status_code == 200
        r3 = client.get(f"/api/projects/{pid}")
        assert r3.status_code == 404

    def test_get_nonexistent_returns_404(self):
        r = client.get("/api/projects/999")
        assert r.status_code == 404


class TestSimulation:
    def test_generate_code(self):
        r = client.post("/api/projects/", json={"name": "Sim", "schema_json": SIMPLE_SCHEMA})
        pid = r.json()["id"]
        r2 = client.post(f"/api/projects/{pid}/generate_code")
        assert r2.status_code == 200
        assert "simpy" in r2.json()["code"].lower() or "import" in r2.json()["code"]

    def test_run_simulation(self):
        r = client.post("/api/projects/", json={"name": "Sim", "schema_json": SIMPLE_SCHEMA})
        pid = r.json()["id"]
        r2 = client.post(f"/api/projects/{pid}/run_simulation", json={"sim_time": 50})
        assert r2.status_code == 200
        data = r2.json()
        assert "metrics_json" in data
        assert "source_1" in data["metrics_json"]
        assert "sink_1" in data["metrics_json"]
        assert data["metrics_json"]["sink_1"]["total_received"] > 0

    def test_run_simulation_empty_schema(self):
        r = client.post("/api/projects/", json={"name": "Empty", "schema_json": {"nodes": [], "edges": []}})
        pid = r.json()["id"]
        r2 = client.post(f"/api/projects/{pid}/run_simulation", json={"sim_time": 10})
        assert r2.status_code == 200


class TestRoot:
    def test_root(self):
        r = client.get("/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"
