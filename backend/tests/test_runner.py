"""
Тесты для engine/runner.py — запуск симуляции из JSON-схемы.
"""
from engine.runner import run


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


class TestRunner:
    def test_basic_pipeline(self):
        metrics, timeseries, log = run(SIMPLE_SCHEMA, sim_time=100)
        assert "source_1" in metrics
        assert "buffer_1" in metrics
        assert "machine_1" in metrics
        assert "sink_1" in metrics
        assert metrics["source_1"]["entities_generated"] > 0
        assert metrics["sink_1"]["total_received"] > 0

    def test_metrics_structure(self):
        metrics, timeseries, log = run(SIMPLE_SCHEMA, sim_time=50)
        buf_m = metrics["buffer_1"]
        assert "current_level" in buf_m
        assert "capacity" in buf_m
        assert "max_level" in buf_m
        mach_m = metrics["machine_1"]
        assert "utilization" in mach_m
        assert "total_processed" in mach_m

    def test_timeseries_generated(self):
        metrics, timeseries, log = run(SIMPLE_SCHEMA, sim_time=50)
        assert "buffer_1" in timeseries
        assert len(timeseries["buffer_1"]) > 0
        assert "t" in timeseries["buffer_1"][0]

    def test_empty_schema(self):
        metrics, timeseries, log = run({"nodes": [], "edges": []}, sim_time=10)
        assert metrics == {}

    def test_with_inspector(self):
        schema = {
            "nodes": [
                {"id": "source_1", "type": "source", "data": {
                    "interval": {"dist": "constant", "params": {"value": 1.0}}
                }},
                {"id": "buffer_1", "type": "buffer", "data": {"capacity": 50}},
                {"id": "insp_1", "type": "inspector", "data": {
                    "defect_rate": 0.2, "inspection_time": 0.5,
                }},
                {"id": "sink_1", "type": "sink", "data": {"label": "OK"}},
            ],
            "edges": [
                {"source": "source_1", "target": "buffer_1"},
                {"source": "buffer_1", "target": "insp_1"},
                {"source": "insp_1", "target": "sink_1"},
            ],
        }
        metrics, _, _ = run(schema, sim_time=100)
        assert metrics["insp_1"]["total_inspected"] > 0
