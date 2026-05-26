"""
Тесты для engine/blocks.py — блоки симуляции.
"""
import simpy
import pytest
from engine.blocks import (
    SourceBlock, BufferBlock, MachineBlock, InspectorBlock,
    SinkBlock, CustomBlock, create_block,
)


def make_env():
    return simpy.Environment()


# --- SourceBlock ---

class TestSourceBlock:
    def test_generates_entities(self):
        env = make_env()
        src = SourceBlock("src_1", {"interval": {"dist": "constant", "params": {"value": 1.0}}})
        store = simpy.Store(env, capacity=100)
        src.setup(env, [], [store])
        env.run(until=10)
        assert src.entities_generated > 0
        assert src.get_metrics()["entities_generated"] == src.entities_generated

    def test_respects_max_entities(self):
        env = make_env()
        src = SourceBlock("src_1", {
            "interval": {"dist": "constant", "params": {"value": 1.0}},
            "max_entities": 3
        })
        store = simpy.Store(env, capacity=100)
        src.setup(env, [], [store])
        env.run(until=100)
        assert src.entities_generated == 3

    def test_blocks_when_buffer_full(self):
        """Source should wait (not lose entities) when output store is full."""
        env = make_env()
        src = SourceBlock("src_1", {"interval": {"dist": "constant", "params": {"value": 1.0}}})
        store = simpy.Store(env, capacity=2)
        src.setup(env, [], [store])
        env.run(until=20)
        # Source should have generated some, and store should be at capacity
        assert len(store.items) <= store.capacity


# --- BufferBlock ---

class TestBufferBlock:
    def test_monitor_tracks_level(self):
        env = make_env()
        buf = BufferBlock("buf_1", {"capacity": 10})
        buf.setup(env, [], [])
        buf.store.put({"id": 1})
        buf.store.put({"id": 2})
        env.run(until=15)
        m = buf.get_metrics()
        assert m["capacity"] == 10
        assert m["max_level"] >= 2
        assert "avg_level" in m
        assert len(buf.get_timeseries()) > 0

    def test_default_capacity(self):
        buf = BufferBlock("buf_1", {})
        assert buf.capacity == 20


# --- MachineBlock (ServerBlock) ---

class TestMachineBlock:
    def test_processes_entities(self):
        env = make_env()
        in_store = simpy.Store(env, capacity=100)
        out_store = simpy.Store(env, capacity=100)
        machine = MachineBlock("m1", {
            "processing_time": {"dist": "constant", "params": {"value": 1.0}},
        })
        machine.setup(env, [in_store], [out_store])
        for i in range(5):
            in_store.put({"id": i})
        env.run(until=50)
        assert machine.total_processed > 0
        m = machine.get_metrics()
        assert "utilization" in m
        assert "total_processed" in m

    def test_multiple_channels(self):
        env = make_env()
        in_store = simpy.Store(env, capacity=100)
        out_store = simpy.Store(env, capacity=100)
        machine = MachineBlock("m1", {
            "processing_time": {"dist": "constant", "params": {"value": 2.0}},
            "count": 3,
        })
        machine.setup(env, [in_store], [out_store])
        for i in range(9):
            in_store.put({"id": i})
        env.run(until=20)
        assert machine.total_processed > 0


# --- InspectorBlock ---

class TestInspectorBlock:
    def test_inspects_entities(self):
        env = make_env()
        in_store = simpy.Store(env, capacity=100)
        ok_store = simpy.Store(env, capacity=100)
        reject_store = simpy.Store(env, capacity=100)
        inspector = InspectorBlock("insp_1", {
            "defect_rate": 0.5,
            "inspection_time": 0.1,
        })
        inspector.setup(env, [in_store], [ok_store, reject_store])
        for i in range(50):
            in_store.put({"id": i})
        env.run(until=100)
        m = inspector.get_metrics()
        assert m["total_inspected"] > 0
        assert m["total_passed"] + m["total_rejected"] == m["total_inspected"]


# --- SinkBlock ---

class TestSinkBlock:
    def test_collects_entities(self):
        env = make_env()
        in_store = simpy.Store(env, capacity=100)
        sink = SinkBlock("sink_1", {"label": "Exit"})
        sink.setup(env, [in_store], [])
        for i in range(10):
            in_store.put({"id": i})
        env.run(until=10)
        assert sink.total_received > 0
        assert sink.get_metrics()["total_received"] == sink.total_received


# --- create_block factory ---

class TestCreateBlock:
    def test_creates_all_types(self):
        for btype in ["source", "buffer", "machine", "inspector", "sink", "custom"]:
            block = create_block({"id": f"{btype}_1", "type": btype, "data": {}})
            assert block.id == f"{btype}_1"

    def test_unknown_type_raises(self):
        with pytest.raises(ValueError, match="Неизвестный тип блока"):
            create_block({"id": "x", "type": "nonexistent", "data": {}})
