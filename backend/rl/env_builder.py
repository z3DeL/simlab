"""
Динамическая генерация Gymnasium Env из JSON-схемы.

Среда строится по RL-блокам на графе:
- RL Observation → observation_space
- RL Action → action_space
- RL Reward → reward function

Студент получает готовый `env` и пишет только агента.
"""
import gymnasium as gym
from gymnasium import spaces
import numpy as np
import simpy
import random

from engine.blocks import (
    create_block, BaseBlock, BLOCK_CLASSES, CustomBlock,
    QueueBlock, ServerBlock, BranchBlock, RouterBlock, MergeBlock, GateBlock,
    # backward-compat aliases
    BufferBlock, MachineBlock, InspectorBlock,
)


class DynamicSimEnv(gym.Env):
    """Gymnasium-среда, автоматически сгенерированная из графа."""

    metadata = {"render_modes": []}

    def __init__(self, schema_json: dict, custom_code: str = "",
                 sim_step: int = 20, sim_total: int = 960):
        super().__init__()

        self.schema_json = schema_json
        self.custom_code = custom_code
        self.sim_step = sim_step
        self.sim_total = sim_total

        # Парсим RL-блоки
        self._parse_rl_config()

        # Строим spaces
        obs_dim = len(self.obs_config)
        self.observation_space = spaces.Box(
            low=np.zeros(obs_dim, dtype=np.float32),
            high=np.ones(obs_dim, dtype=np.float32),
        )
        self.action_space = spaces.Discrete(self.act_dim)

    def _parse_rl_config(self):
        """Извлекает конфигурацию RL из JSON-схемы."""
        nodes = self.schema_json.get("nodes", [])
        edges = self.schema_json.get("edges", [])

        nodes_by_id = {n["id"]: n for n in nodes}

        # Строим карту связей
        edge_targets = {}  # src -> [target]
        edge_sources = {}  # target -> [src]
        for e in edges:
            src, tgt = e.get("source", ""), e.get("target", "")
            edge_targets.setdefault(src, []).append(tgt)
            edge_sources.setdefault(tgt, []).append(src)

        # --- Observation: RL Observation блоки ---
        self.obs_config = []
        for node in nodes:
            if node["type"] == "rl_observation":
                metric = node.get("data", {}).get("metric", "level")
                # Находим целевой блок (по входящему ребру)
                targets = edge_sources.get(node["id"], [])
                if not targets:
                    targets = edge_targets.get(node["id"], [])
                target_block_id = targets[0] if targets else None
                self.obs_config.append({
                    "block_id": target_block_id,
                    "metric": metric,
                })

        # Observation блоки обязательны
        if not self.obs_config:
            raise ValueError(
                "В схеме не найдены блоки RL Observation. "
                "Добавьте блок 'RL Наблюдение' и подключите его к нужному блоку (машине или буферу)."
            )

        # --- Action: RL Action блоки ---
        self.action_config = []
        for node in nodes:
            if node["type"] == "rl_action":
                data = node.get("data", {})
                values = data.get("values", ["noop"])
                targets = edge_targets.get(node["id"], [])
                self.action_config.append({
                    "values": values,
                    "target_blocks": targets,
                })

        if self.action_config:
            self.act_dim = len(self.action_config[0].get("values", ["noop"]))
        else:
            raise ValueError(
                "В схеме не найден блок RL Action. "
                "Добавьте блок 'RL Действие' и подключите его к машине(ам), которыми должен управлять агент."
            )

        # --- Reward: RL Reward блок ---
        self.reward_config = {"mode": "default", "weights": {}}
        for node in nodes:
            if node["type"] == "rl_reward":
                data = node.get("data", {})
                self.reward_config = {
                    "mode": data.get("mode", "formula"),
                    "weights": data.get("weights", {}),
                    "code": data.get("code", ""),
                }
                # Находим связанные блоки
                sources = edge_sources.get(node["id"], [])
                self.reward_config["source_blocks"] = sources
                break

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        if seed is not None:
            random.seed(seed)

        self.env = simpy.Environment()
        self.blocks = {}
        self._step_metrics_before = {}

        # Создаём блоки
        for node in self.schema_json.get("nodes", []):
            if node["type"].startswith("rl_"):
                continue
            block = create_block(node)
            self.blocks[block.id] = block

        # Создаём stores для буферов
        for bid, block in self.blocks.items():
            if isinstance(block, QueueBlock):
                block.setup(self.env, [], [])

        # Строим связи
        edges = self.schema_json.get("edges", [])
        outgoing = {}
        incoming = {}
        for e in edges:
            src, tgt = e.get("source", ""), e.get("target", "")
            if src.startswith("rl_") or tgt.startswith("rl_"):
                continue
            outgoing.setdefault(src, []).append((tgt, e.get("sourceHandle", "")))
            incoming.setdefault(tgt, []).append((src, e.get("targetHandle", "")))

        _implicit = {}
        def get_store(block_id):
            if block_id in self.blocks and isinstance(self.blocks[block_id], QueueBlock):
                return self.blocks[block_id].store
            if block_id not in _implicit:
                _implicit[block_id] = simpy.Store(self.env, capacity=1000)
            return _implicit[block_id]

        def _handle_idx(h, prefix='out_'):
            if h and h.startswith(prefix):
                try:
                    return int(h[len(prefix):])
                except ValueError:
                    return 0
            return 1 if h == 'reject' else 0

        for bid, block in self.blocks.items():
            if isinstance(block, QueueBlock):
                continue

            # Входные stores: если источник не буфер, берем неявный стор текущего блока (bid)
            raw_incoming = incoming.get(bid, [])
            if isinstance(block, GateBlock):
                raw_incoming = sorted(raw_incoming, key=lambda e: _handle_idx(e[1], 'in_'))
            in_stores = []
            for src_id, *_ in raw_incoming:
                if src_id in self.blocks and isinstance(self.blocks[src_id], QueueBlock):
                    in_stores.append(self.blocks[src_id].store)
                else:
                    in_stores.append(get_store(bid))

            # Выходные stores
            out_edges = outgoing.get(bid, [])
            if isinstance(block, (BranchBlock, RouterBlock, GateBlock)):
                out_edges = sorted(out_edges, key=lambda e: _handle_idx(e[1]))
            elif isinstance(block, CustomBlock):
                out_edges = sorted(out_edges, key=lambda e: e[1] or '')
            out_stores = [get_store(t) for t, _ in out_edges]

            block.setup(self.env, in_stores, out_stores)

        # Запоминаем начальные метрики
        self._step_metrics_before = self._collect_all_metrics()

        return self._get_obs(), self._get_info()

    def step(self, action):
        assert self.action_space.contains(action)

        metrics_before = self._collect_all_metrics()

        # Применяем действие
        self._apply_action(action)

        # Прогоняем SimPy
        target = min(self.env.now + self.sim_step, self.sim_total)
        self.env.run(until=target)

        metrics_after = self._collect_all_metrics()

        # Считаем reward
        reward = self._calc_reward(metrics_before, metrics_after, action)

        terminated = self.env.now >= self.sim_total
        truncated = False

        return self._get_obs(), reward, terminated, truncated, self._get_info()

    def _get_obs(self):
        obs = []
        for cfg in self.obs_config:
            block = self.blocks.get(cfg["block_id"])
            if block:
                metrics = block.get_metrics()
                metric_key = cfg["metric"]
                # Alias resolution: "level" -> "current_level"
                _METRIC_ALIASES = {
                    "level": "current_level",
                }
                resolved = _METRIC_ALIASES.get(metric_key, metric_key)
                value = metrics.get(resolved, metrics.get(metric_key, 0.0))
                # Нормализация в [0, 1]
                if metric_key in ("wear", "utilization"):
                    obs.append(float(value))
                elif metric_key in ("current_level", "level"):
                    cap = metrics.get("capacity", 20) or 20
                    obs.append(float(value) / max(cap, 1))
                elif metric_key in ("is_working", "is_open"):
                    obs.append(1.0 if value else 0.0)
                else:
                    obs.append(min(1.0, float(value) / 100.0))
            else:
                obs.append(0.0)
        return np.array(obs, dtype=np.float32)

    def _get_info(self):
        return {
            "time": self.env.now,
            "all_metrics": self._collect_all_metrics(),
        }

    def _collect_all_metrics(self):
        return {bid: block.get_metrics() for bid, block in self.blocks.items()}

    def _apply_action(self, action):
        """Применяет действие к целевым блокам через универсальный интерфейс."""
        if not self.action_config:
            return

        for cfg in self.action_config:
            values = cfg.get("values", ["noop"])
            targets = cfg.get("target_blocks", [])

            if action >= len(values):
                continue

            action_name = str(values[action]).lower()

            if action_name == "noop":
                continue

            total = len(targets)
            for index, target_id in enumerate(targets):
                block = self.blocks.get(target_id)
                if block is None:
                    continue
                block.apply_rl_action(action, index, total, action_name)

    def _calc_reward(self, before, after, action):
        """Вычисляет reward на основе конфигурации RL Reward блока."""
        mode = self.reward_config.get("mode", "default")
        weights = self.reward_config.get("weights", {})

        # 1. Режим формулы (если есть веса)
        if mode == "formula" and weights:
            reward = 0.0
            for block_id, w in weights.items():
                w_val = float(w) if w is not None else 0.0
                
                # Специальный случай: Штраф за действия
                if block_id == "action_penalty":
                    if action > 0:
                        reward += w_val
                    continue
                
                b_after = after.get(block_id, {})
                b_before = before.get(block_id, {})
                block = self.blocks.get(block_id)
                b_type = getattr(block, 'block_type', '') if block else ''

                # Применяем веса избирательно к ключевым метрикам
                if b_type in ("server", "machine"):
                    # Для серверов: загрузка (утилизация)
                    delta = b_after.get("utilization", 0) - b_before.get("utilization", 0)
                    reward += w_val * delta
                elif b_type == "sink":
                    # Для складов: только полученные детали
                    delta = b_after.get("total_received", 0) - b_before.get("total_received", 0)
                    reward += w_val * delta
                elif b_type in ("buffer", "queue"):
                    # Для буферов/очередей: штраф за уровень + штраф за накопление (рост очереди)
                    cap = b_after.get("capacity", None) or getattr(block, 'capacity', None) or 20
                    level = b_after.get("current_level", 0) / cap
                    # Дельта накопления: вошло больше чем вышло → очередь растёт → доп. штраф
                    d_in = b_after.get("total_in", 0) - b_before.get("total_in", 0)
                    d_out = b_after.get("total_out", 0) - b_before.get("total_out", 0)
                    accumulation = max(0, d_in - d_out) / max(cap, 1)
                    reward += w_val * (level + accumulation)
                else:
                    # Fallback для остальных
                    for metric, val in b_after.items():
                        if metric in ["total_received", "breakdowns", "current_level"]:
                            delta = val - b_before.get(metric, 0)
                            reward += w_val * delta
            return float(reward)

        # 2. Режим кода
        if mode == "code":
            code = self.reward_config.get("code", "")
            ctx = {"before": before, "after": after, "action": action, "reward": 0.0}
            try:
                exec(code, ctx)
                res = ctx.get("reward", 0.0)
                return float(res) if res is not None else 0.0
            except Exception:
                return 0.0

        # 3. Дефолтный режим (или fallback если формула пустая)
        reward = 0.0
        for bid, block in self.blocks.items():
            m_after = after.get(bid, {})
            m_before = before.get(bid, {})
            
            # +1 за деталь на выходе
            if getattr(block, 'block_type', None) == "sink":
                delta = m_after.get("total_received", 0) - m_before.get("total_received", 0)
                reward += float(delta)
            
            # -5 за каждую поломку
            if "breakdowns" in m_after:
                delta = m_after["breakdowns"] - m_before.get("breakdowns", 0)
                reward -= 5.0 * delta
        
        # Штраф за действия (содержание)
        if action > 0:
            reward -= 0.3
            
        return float(reward)


def build_env(schema_json: dict, custom_code: str = "") -> DynamicSimEnv:
    """Фабрика: создаёт Gymnasium-среду из JSON-схемы."""
    return DynamicSimEnv(schema_json=schema_json, custom_code=custom_code)
