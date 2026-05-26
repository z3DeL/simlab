"""
Runner: запускает SimPy-модель из JSON-схемы, собирает per-block метрики.
"""
import simpy
from typing import Dict
from engine.blocks import (
    create_block, BaseBlock, BLOCK_CLASSES,
    QueueBlock, BranchBlock, RouterBlock, MergeBlock, CustomBlock, GateBlock,
    # backward-compat aliases still importable
    BufferBlock, InspectorBlock,
)


def run(schema_json: dict, custom_code: str = "", sim_time: int = 480):
    """
    Строит и запускает SimPy-модель, собирает метрики.

    Returns:
        (metrics, timeseries, log) где:
        - metrics = {block_id: block.get_metrics()}
        - timeseries = {block_id: block.get_timeseries()}
        - log = строка с текстовыми событиями
    """
    nodes = schema_json.get("nodes", [])
    edges = schema_json.get("edges", [])

    env = simpy.Environment()

    # 1. Создаём блоки (кроме RL-блоков)
    blocks: Dict[str, BaseBlock] = {}
    buffer_stores: Dict[str, simpy.Store] = {}

    for node in nodes:
        ntype = node.get("type", "")
        if ntype.startswith("rl_"):
            continue  # RL-блоки обрабатываются в env_builder
        block = create_block(node)
        blocks[block.id] = block

    # 2. Создаём Store для очередей/буферов
    for bid, block in blocks.items():
        if isinstance(block, QueueBlock):
            block.setup(env, [], [])
            buffer_stores[bid] = block.store

    # 3. Строим связи (edges) и запускаем блоки
    # Для каждого блока определяем входные и выходные stores
    outgoing = {}  # src_id -> [(target_id, label)]
    incoming = {}  # target_id -> [(src_id, label)]
    for edge in edges:
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        label = edge.get("label", "")
        if src.startswith("rl_") or tgt.startswith("rl_"):
            continue
        source_handle = edge.get("sourceHandle", "")
        target_handle = edge.get("targetHandle", "")
        outgoing.setdefault(src, []).append((tgt, label, source_handle))
        incoming.setdefault(tgt, []).append((src, label, target_handle))

    # Для блоков, которым нужен промежуточный store (не-буферы),
    # создаём неявные stores
    def get_or_create_store(block_id):
        if block_id in buffer_stores:
            return buffer_stores[block_id]
        if block_id not in _implicit_stores:
            _implicit_stores[block_id] = simpy.Store(env, capacity=1000)
        return _implicit_stores[block_id]

    _implicit_stores = {}

    # Запускаем остальные блоки
    for bid, block in blocks.items():
        if isinstance(block, QueueBlock):
            continue  # уже setup

        def _handle_idx(h, prefix='out_'):
            if h and h.startswith(prefix):
                try:
                    return int(h[len(prefix):])
                except ValueError:
                    return 0
            return 1 if h == 'reject' else 0

        # Входные stores
        raw_incoming = incoming.get(bid, [])
        if isinstance(block, GateBlock):
            raw_incoming = sorted(raw_incoming, key=lambda e: _handle_idx(e[2], 'in_'))
        in_stores = []
        for src_id, label, *_ in raw_incoming:
            if src_id in buffer_stores:
                in_stores.append(buffer_stores[src_id])
            else:
                in_stores.append(get_or_create_store(bid))

        # Выходные stores: сортируем по handle-индексу
        out_edges = outgoing.get(bid, [])
        if isinstance(block, (BranchBlock, RouterBlock, CustomBlock, GateBlock)):
            out_edges = sorted(out_edges, key=lambda e: _handle_idx(e[2]))
        out_stores = [get_or_create_store(tgt_id) for tgt_id, _, _ in out_edges]

        block.setup(env, in_stores, out_stores)

    # Для буферов, у которых есть выходные рёбра к другим блокам –
    # их store уже используется как вход для следующего блока

    # 4. Запуск
    # Примечание: sys.stdout не подменяем — print внутри блоков
    # пишет в log_buffer только если блоки явно вызывают print.
    # Для thread-safety используем contextvar или просто не трогаем stdout.
    env.run(until=sim_time)

    # 5. Сбор метрик
    metrics = {}
    timeseries = {}
    for bid, block in blocks.items():
        metrics[bid] = block.get_metrics()
        ts = block.get_timeseries()
        if ts:
            timeseries[bid] = ts

    return metrics, timeseries, ""
