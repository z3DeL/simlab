"""
Блоки-объекты для SimPy моделирования.

Каждый блок имеет единый интерфейс:
- setup(env, connections) — инициализация SimPy-процессов
- get_metrics() -> dict — текущие метрики блока
- get_timeseries() -> list[dict] — временные ряды

Метрики у каждого блока свои — runner собирает их обобщённо
по block_id, фронтенд рендерит динамически.
"""
import simpy
import random
import math
from abc import ABC, abstractmethod


class BaseBlock(ABC):
    """Базовый класс блока."""

    def __init__(self, block_id: str, block_type: str, data: dict):
        self.id = block_id
        self.block_type = block_type
        self.data = data
        self.env = None
        self._timeseries = []

    @abstractmethod
    def setup(self, env: simpy.Environment, in_stores: list, out_stores: list):
        """Инициализирует SimPy-процессы."""
        self.env = env

    @abstractmethod
    def get_metrics(self) -> dict:
        """Возвращает текущие метрики блока."""
        pass

    def get_timeseries(self) -> list:
        return self._timeseries

    def apply_rl_action(self, action: int, index: int, total: int, name: str) -> None:
        """Применяет действие RL-агента к блоку.

        Вызывается env_builder для каждого целевого блока.
        По умолчанию — no-op. Переопредели в подклассе чтобы добавить логику управления.

        Args:
            action: текущее действие агента (0..N-1)
            index:  индекс этого блока среди всех целей данного RLAction-узла
            total:  общее количество целей данного RLAction-узла
            name:   строковое имя действия из values[action]
        """
        pass

    def _sample(self, dist_config: dict) -> float:
        """Генерирует случайную величину по конфигурации распределения."""
        dist = dist_config.get("dist", "exponential")
        params = dist_config.get("params", {})

        if dist == "exponential":
            lam = params.get("lam", 1.0)
            return random.expovariate(lam)
        elif dist == "normal":
            mu = params.get("mu", 5.0)
            sigma = params.get("sigma", 1.0)
            return max(0.1, random.gauss(mu, sigma))
        elif dist == "uniform":
            a = params.get("a", 1.0)
            b = params.get("b", 5.0)
            return random.uniform(a, b)
        elif dist == "constant":
            return params.get("value", 1.0)
        else:
            return 1.0


class SourceBlock(BaseBlock):
    """Генератор сущностей (деталей, заявок, и т.д.)"""

    def __init__(self, block_id, data):
        super().__init__(block_id, "source", data)
        self.entities_generated = 0
        self.interval_config = data.get("interval", {"dist": "exponential", "params": {"lam": 1.0}})
        self.max_entities = data.get("max_entities", float("inf"))

    def setup(self, env, in_stores, out_stores):
        super().setup(env, in_stores, out_stores)
        self.out_stores = out_stores
        env.process(self._generate())

    def _generate(self):
        entity_id = 0
        while self.entities_generated < self.max_entities:
            interval = self._sample(self.interval_config)
            yield self.env.timeout(interval)
            entity = {"id": entity_id, "created_at": self.env.now, "source": self.id}
            entity_id += 1
            self.entities_generated += 1
            for store in self.out_stores:
                yield store.put(entity)
                break  # одна сущность → один выход (не клонировать)

    def get_metrics(self):
        return {"entities_generated": self.entities_generated}


class _TrackedGetEvent:
    """Обёртка над simpy.Store.get(), увеличивает total_out после реального извлечения."""

    def __init__(self, store_get_event, buffer_block):
        self._event = store_get_event
        self._buffer = buffer_block
        self._triggered = False

    def __getattr__(self, name):
        return getattr(self._event, name)

    @property
    def callbacks(self):
        return self._event.callbacks

    @callbacks.setter
    def callbacks(self, val):
        self._event.callbacks = val

    def trigger(self, event):
        self._buffer.total_out += 1
        return self._event.trigger(event)


class TrackedStore:
    """Wrapper around simpy.Store that tracks put/get counts."""

    def __init__(self, store, buffer_block):
        self._store = store
        self._buffer = buffer_block

    def put(self, item):
        self._buffer.total_in += 1
        return self._store.put(item)

    def get(self):
        event = self._store.get()
        event.callbacks.append(lambda ev: setattr(
            self._buffer, 'total_out', self._buffer.total_out + 1
        ))
        return event

    @property
    def items(self):
        return self._store.items

    @property
    def capacity(self):
        return self._store.capacity


class QueueBlock(BaseBlock):
    """Очередь (буфер) между блоками."""

    def __init__(self, block_id, data):
        super().__init__(block_id, "queue", data)
        self.capacity = data.get("capacity", 20)
        self.store = None
        self.total_in = 0
        self.total_out = 0
        self.max_level = 0
        self._level_samples = []

    def setup(self, env, in_stores, out_stores):
        super().setup(env, in_stores, out_stores)
        raw_store = simpy.Store(env, capacity=self.capacity)
        self.store = TrackedStore(raw_store, self)
        env.process(self._monitor())

    def _monitor(self):
        """Записывает уровень буфера каждые 10 мин."""
        while True:
            level = len(self.store.items)
            self.max_level = max(self.max_level, level)
            self._level_samples.append(level)
            self._timeseries.append({"t": self.env.now, "metric": "level", "value": level})
            yield self.env.timeout(10)

    def get_metrics(self):
        avg = sum(self._level_samples) / max(len(self._level_samples), 1)
        return {
            "current_level": len(self.store.items) if self.store else 0,
            "max_level": self.max_level,
            "avg_level": round(avg, 2),
            "total_in": self.total_in,
            "total_out": self.total_out,
            "capacity": self.capacity,
        }


class ServerBlock(BaseBlock):
    """Сервер обслуживания (Service/Delay) — стандартный DES-блок."""

    def __init__(self, block_id, data):
        super().__init__(block_id, "server", data)
        self.processing_time_config = data.get("processing_time", {"dist": "normal", "params": {"mu": 5.0, "sigma": 1.0}})
        self.count = data.get("count", 1)
        self.total_processed = 0
        self.busy_time = 0.0

    def setup(self, env, in_stores, out_stores):
        super().setup(env, in_stores, out_stores)
        self.in_stores = in_stores
        self.out_stores = out_stores
        self.resource = simpy.Resource(env, capacity=self.count)
        for _ in range(self.count):
            env.process(self._work())
        env.process(self._monitor())

    def _work(self):
        while True:
            if not self.in_stores:
                yield self.env.timeout(1)
                continue
            entity = yield self.in_stores[0].get()
            with self.resource.request() as req:
                yield req
                proc_time = self._sample(self.processing_time_config)
                start = self.env.now
                yield self.env.timeout(proc_time)
                self.busy_time += self.env.now - start
                self.total_processed += 1
                for store in self.out_stores:
                    yield store.put(entity)
                    break

    def _monitor(self):
        while True:
            util = self.busy_time / (self.count * max(self.env.now, 0.1))
            self._timeseries.append({"t": self.env.now, "metric": "utilization", "value": round(util, 3)})
            yield self.env.timeout(10)

    def get_metrics(self):
        total_time = max(self.env.now, 0.1) if self.env else 1
        return {
            "utilization": round(self.busy_time / (self.count * total_time), 3),
            "total_processed": self.total_processed,
        }


class BranchBlock(BaseBlock):
    """Ветвитель: 1 вход, N выходов — вероятностная или round-robin маршрутизация."""

    def __init__(self, block_id, data):
        super().__init__(block_id, "branch", data)
        self.outputs = data.get("outputs", 2)
        self.mode = data.get("mode", "probability")  # 'probability' | 'round_robin'
        self.service_time = data.get("service_time", data.get("inspection_time", 0.0))

        raw_weights = data.get("weights", None)
        if raw_weights:
            self.weights = list(raw_weights)
        else:
            # backward compat: defect_rate → [pass, fail] weights
            defect_rate = data.get("defect_rate", 0.5)
            self.weights = [1.0 - defect_rate, defect_rate]

        # Normalise
        total = sum(self.weights) or 1.0
        self.weights = [w / total for w in self.weights]

        self.total_in = 0
        self._out_counts = {}
        self._rr_index = 0

    def setup(self, env, in_stores, out_stores):
        super().setup(env, in_stores, out_stores)
        self.in_stores = in_stores
        self.out_stores = out_stores
        for i in range(len(out_stores)):
            self._out_counts[f"out_{i}"] = 0
        env.process(self._branch())

    def _branch(self):
        while True:
            if not self.in_stores:
                yield self.env.timeout(1)
                continue
            entity = yield self.in_stores[0].get()

            if self.service_time > 0:
                yield self.env.timeout(self.service_time)

            self.total_in += 1

            if not self.out_stores:
                continue

            n = len(self.out_stores)
            if self.mode == "round_robin":
                idx = self._rr_index % n
                self._rr_index += 1
            else:  # probability
                weights = (self.weights[:n] + [0.0] * n)[:n]
                total = sum(weights) or 1.0
                r = random.random() * total
                idx, cumulative = 0, 0.0
                for i, w in enumerate(weights):
                    cumulative += w
                    if r <= cumulative:
                        idx = i
                        break

            key = f"out_{idx}"
            self._out_counts[key] = self._out_counts.get(key, 0) + 1
            yield self.out_stores[idx].put(entity)

    def get_metrics(self):
        m = {"total_in": self.total_in, "mode": self.mode}
        m.update(self._out_counts)
        # backward-compat aliases (old InspectorBlock metric keys)
        m["total_inspected"] = self.total_in
        if "out_0" in self._out_counts:
            m["total_passed"] = self._out_counts["out_0"]
        if "out_1" in self._out_counts:
            m["total_rejected"] = self._out_counts["out_1"]
            m["defect_rate_actual"] = round(
                self._out_counts["out_1"] / max(self.total_in, 1), 3
            )
        return m


class RouterBlock(BaseBlock):
    """Маршрутизатор: 1 вход, N выходов, мгновенное переключение (round-robin или взвешенный)."""

    def __init__(self, block_id, data):
        super().__init__(block_id, "router", data)
        self.outputs = data.get("outputs", 2)
        self.mode = data.get("mode", "round_robin")  # 'round_robin' | 'weighted_random'
        self.weights = list(data.get("weights") or [])
        self.total_routed = 0
        self._out_counts = {}
        self._rr_index = 0

    def setup(self, env, in_stores, out_stores):
        super().setup(env, in_stores, out_stores)
        self.in_stores = in_stores
        self.out_stores = out_stores
        for i in range(len(out_stores)):
            self._out_counts[f"out_{i}"] = 0
        env.process(self._route())

    def _route(self):
        while True:
            if not self.in_stores:
                yield self.env.timeout(1)
                continue
            entity = yield self.in_stores[0].get()
            self.total_routed += 1

            if not self.out_stores:
                continue

            n = len(self.out_stores)
            if self.mode == "weighted_random" and self.weights:
                weights = (self.weights[:n] + [1.0] * n)[:n]
                total = sum(weights) or 1.0
                r = random.random() * total
                idx, cumulative = 0, 0.0
                for i, w in enumerate(weights):
                    cumulative += w
                    if r <= cumulative:
                        idx = i
                        break
            else:  # round_robin
                idx = self._rr_index % n
                self._rr_index += 1

            key = f"out_{idx}"
            self._out_counts[key] = self._out_counts.get(key, 0) + 1
            yield self.out_stores[idx].put(entity)

    def get_metrics(self):
        m = {"total_routed": self.total_routed, "mode": self.mode}
        m.update(self._out_counts)
        return m


class MergeBlock(BaseBlock):
    """Слияние потоков: N входов → 1 выход."""

    def __init__(self, block_id, data):
        super().__init__(block_id, "merge", data)
        self.inputs = data.get("inputs", 2)
        self.total_merged = 0

    def setup(self, env, in_stores, out_stores):
        super().setup(env, in_stores, out_stores)
        self.out_stores = out_stores
        # Deduplicate in_stores (implicit stores from runner may repeat)
        seen, unique = set(), []
        for s in in_stores:
            if id(s) not in seen:
                seen.add(id(s))
                unique.append(s)
        for in_store in unique:
            env.process(self._collect(in_store))

    def _collect(self, in_store):
        while True:
            entity = yield in_store.get()
            self.total_merged += 1
            if self.out_stores:
                yield self.out_stores[0].put(entity)

    def get_metrics(self):
        return {"total_merged": self.total_merged}


class SinkBlock(BaseBlock):
    """Сток — собирает сущности и считает."""

    def __init__(self, block_id, data):
        super().__init__(block_id, "sink", data)
        self.label = data.get("label", "Выход")
        self.total_received = 0
        self._store = None

    def setup(self, env, in_stores, out_stores):
        super().setup(env, in_stores, out_stores)
        self._store = simpy.Store(env, capacity=10000)
        self.in_stores = in_stores
        env.process(self._collect())

    def _collect(self):
        while True:
            if not self.in_stores:
                yield self.env.timeout(1)
                continue
            entity = yield self.in_stores[0].get()
            self.total_received += 1

    def get_metrics(self):
        return {
            "total_received": self.total_received,
            "label": self.label,
        }


class CustomBlock(BaseBlock):
    """Скрипт-блок: студент пишет класс — наследник любого базового блока.

    Код должен содержать ровно один пользовательский класс, например:

        class MyBlock(ServerBlock):
            def _work(self):
                while True:
                    entity = yield self.in_stores[0].get()
                    yield self.env.timeout(1.0)
                    self.total_processed += 1
                    yield self.out_stores[0].put(entity)

    CustomBlock находит первый объявленный класс-наследник BaseBlock,
    инстанцирует его и делегирует ему setup / get_metrics / get_timeseries.
    """

    DEFAULT_CODE = (
        "class MyBlock(ServerBlock):\n"
        "    def _work(self):\n"
        "        while True:\n"
        "            entity = yield self.in_stores[0].get()\n"
        "            yield self.env.timeout(1.0)\n"
        "            self.total_processed += 1\n"
        "            yield self.out_stores[0].put(entity)\n"
    )

    def __init__(self, block_id, data):
        super().__init__(block_id, "custom", data)
        self.code = data.get("code") or data.get("custom_code") or self.DEFAULT_CODE
        self.name = data.get("name", block_id)
        self._inner: "BaseBlock | None" = None

    @property
    def custom_metrics(self) -> dict:
        """Прозрачный доступ к custom_metrics внутреннего блока.

        Позволяет env_builder писать block.custom_metrics['rl_action'] = action
        и быть уверенным, что внутренний блок это прочитает.
        """
        if self._inner is not None:
            if not hasattr(self._inner, "custom_metrics"):
                self._inner.custom_metrics = {}
            return self._inner.custom_metrics
        # До setup()
        if "_fallback_cm" not in self.__dict__:
            self.__dict__["_fallback_cm"] = {}
        return self.__dict__["_fallback_cm"]

    def setup(self, env, in_stores, out_stores):
        super().setup(env, in_stores, out_stores)

        _builtin = {
            BaseBlock, SourceBlock, ServerBlock, BranchBlock,
            RouterBlock, MergeBlock, SinkBlock, GateBlock, QueueBlock,
        }
        ctx = {
            "random": random, "math": math, "simpy": simpy,
            "BaseBlock": BaseBlock, "SourceBlock": SourceBlock,
            "ServerBlock": ServerBlock, "BranchBlock": BranchBlock,
            "RouterBlock": RouterBlock, "MergeBlock": MergeBlock,
            "SinkBlock": SinkBlock, "GateBlock": GateBlock,
            "QueueBlock": QueueBlock,
        }

        try:
            exec(self.code, ctx)
        except Exception as e:
            raise RuntimeError(f"Ошибка компиляции Custom-блока «{self.name}»: {e}") from e

        block_cls = None
        for v in ctx.values():
            if isinstance(v, type) and issubclass(v, BaseBlock) and v not in _builtin:
                block_cls = v
                break

        if block_cls is None:
            raise RuntimeError(
                f"Custom-блок «{self.name}»: не найден класс-наследник BaseBlock. "
                f"Объяви `class MyBlock(ServerBlock):` или другой базовый класс."
            )

        try:
            self._inner = block_cls(self.id, self.data)
            self._inner.setup(env, in_stores, out_stores)
        except Exception as e:
            raise RuntimeError(
                f"Ошибка инициализации Custom-блока «{self.name}»: {e}"
            ) from e

    def apply_rl_action(self, action: int, index: int, total: int, name: str) -> None:
        """Пробрасывает RL-действие во внутренний блок.

        Если внутренний блок определил `apply_rl_action` — вызывает его.
        Иначе записывает action в `custom_metrics['rl_action']`, откуда
        код блока может его прочитать через self.custom_metrics['rl_action'].
        """
        target = self._inner
        if target is None:
            return
        if hasattr(target, "apply_rl_action") and callable(target.apply_rl_action):
            target.apply_rl_action(action, index, total, name)
        else:
            if not hasattr(target, "custom_metrics"):
                target.custom_metrics = {}
            target.custom_metrics["rl_action"] = action
            target.custom_metrics["rl_action_name"] = name

    def get_metrics(self) -> dict:
        if self._inner is not None:
            return self._inner.get_metrics()
        return {}

    def get_timeseries(self) -> list:
        if self._inner is not None:
            return self._inner.get_timeseries()
        return self._timeseries


class GateBlock(BaseBlock):
    """Перекрёсток: N входов, N выходов, встроенное циклическое переключение.

    Параметры:
      inputs      — кол-во полос (default 2)
      pass_time   — время проезда авто через перекрёсток (default 2.0)
      phase_times — список длительностей фаз в сек. [30, 20, ...] (default [30]*inputs)

    Без RL: переключает полосы по таймеру (фиксированный цикл).
    С RL:   apply_rl_action устанавливает активную полосу напрямую,
            таймер перестаёт переключать (флаг _rl_controlled).
    """

    def __init__(self, block_id, data):
        super().__init__(block_id, "gate", data)
        self.inputs = data.get("inputs", 2)
        self.pass_time = data.get("pass_time", 2.0)
        raw_phases = data.get("phase_times", None)
        self.phase_times = list(raw_phases) if raw_phases else [30.0] * self.inputs
        self.switch_cost = float(data.get("switch_cost", 3.0))
        self.min_green_time = float(data.get("min_green_time", 10.0))

        self._active_lane = 0
        self._rl_controlled = False
        self._switching = False
        self._last_switch_time = 0.0
        self._total_switches = 0
        self._total_passed = [0] * self.inputs
        self._total_waited = [0] * self.inputs
        self._total_wait_time = [0.0] * self.inputs

    def setup(self, env, in_stores, out_stores):
        super().setup(env, in_stores, out_stores)
        self.in_stores = in_stores
        self.out_stores = out_stores
        n = len(in_stores)
        # Расширяем массивы метрик если полос больше чем ожидалось
        while len(self._total_passed) < n:
            self._total_passed.append(0)
            self._total_waited.append(0)
            self._total_wait_time.append(0.0)
        for i in range(n):
            env.process(self._lane(i))
        env.process(self._cycle())
        env.process(self._monitor())

    def _do_switch(self, new_lane):
        """Переключение с жёлтой фазой: на switch_cost секунд активная полоса = -1."""
        if self._switching:
            yield self.env.timeout(0)
            return
        self._switching = True
        if self.switch_cost > 0 and self._active_lane != -1:
            self._active_lane = -1  # жёлтая фаза — никто не едет
            yield self.env.timeout(self.switch_cost)
        else:
            yield self.env.timeout(0)
        self._active_lane = new_lane
        self._last_switch_time = self.env.now
        self._total_switches += 1
        self._switching = False

    def _cycle(self):
        """Циклически переключает активную полосу по таймеру.

        Переопредели этот метод в наследнике чтобы реализовать умную логику.
        Когда RL-агент берёт управление (_rl_controlled=True), цикл останавливается.
        min_green_time гарантирует, что фаза длится не меньше заданного минимума.
        """
        n = len(self.in_stores)
        if n == 0:
            return
        while not self._rl_controlled:
            phase_idx = max(self._active_lane, 0) % len(self.phase_times)
            phase = max(self.phase_times[phase_idx], self.min_green_time)
            yield self.env.timeout(phase)
            if self._rl_controlled:
                break
            next_lane = (max(self._active_lane, 0) + 1) % n
            yield self.env.process(self._do_switch(next_lane))

    def _lane(self, i):
        """Процесс одной полосы: берёт авто из очереди, ждёт зелёного, пропускает."""
        while True:
            if i >= len(self.in_stores):
                yield self.env.timeout(1)
                continue
            entity = yield self.in_stores[i].get()
            # Считаем полное время от момента создания сущности
            born = entity.get("created_at", self.env.now) if isinstance(entity, dict) else self.env.now
            while self._active_lane != i:
                yield self.env.timeout(1)
            wait = self.env.now - born
            self._total_wait_time[i] += wait
            if wait > 0:
                self._total_waited[i] += 1
            yield self.env.timeout(self.pass_time)
            self._total_passed[i] += 1
            if i < len(self.out_stores):
                yield self.out_stores[i].put(entity)

    def _monitor(self):
        while True:
            self._timeseries.append({
                "t": self.env.now,
                "metric": "active_lane",
                "value": self._active_lane,
            })
            yield self.env.timeout(1)

    def apply_rl_action(self, action: int, index: int, total: int, name: str) -> None:
        """RL-агент переключает активную полосу; отключает таймер.

        Переключение происходит только если:
          - прошло не меньше min_green_time с последнего переключения,
          - не идёт уже жёлтая фаза (_switching),
          - выбранная полоса отличается от текущей.
        Само переключение выполняется через _do_switch (жёлтая фаза switch_cost секунд).
        """
        self._rl_controlled = True
        n = max(len(self.in_stores), self.inputs)
        new_lane = action % n
        if new_lane == self._active_lane or self._switching:
            return
        elapsed = self.env.now - self._last_switch_time
        if elapsed < self.min_green_time:
            return  # слишком рано переключаться
        self.env.process(self._do_switch(new_lane))

    def get_metrics(self) -> dict:
        n = len(self._total_passed)
        m = {
            "active_lane": self._active_lane,
            "inputs": len(self.in_stores),
            "total_switches": self._total_switches,
        }
        for i in range(n):
            m[f"passed_{i}"] = self._total_passed[i]
            m[f"waited_{i}"] = self._total_waited[i]
            m[f"avg_total_wait_{i}"] = round(
                self._total_wait_time[i] / max(self._total_passed[i], 1), 2
            )
        return m


# --- Фабрика ---

BLOCK_CLASSES = {
    # Актуальные имена (DES-стандарт)
    "source": SourceBlock,
    "queue": QueueBlock,
    "server": ServerBlock,
    "branch": BranchBlock,
    "router": RouterBlock,
    "merge": MergeBlock,
    "sink": SinkBlock,
    "custom": CustomBlock,
    "gate": GateBlock,
    # Backward-compatibility алиасы (старые схемы)
    "buffer": QueueBlock,
    "machine": ServerBlock,
    "inspector": BranchBlock,
}

# Backward-compatibility алиасы классов
BufferBlock = QueueBlock
MachineBlock = ServerBlock
InspectorBlock = BranchBlock


def create_block(node: dict) -> BaseBlock:
    """Создаёт блок по описанию из JSON-схемы."""
    block_type = node.get("type", "")
    block_id = node.get("id", "unknown")
    data = node.get("data", {})

    cls = BLOCK_CLASSES.get(block_type)
    if cls is None:
        raise ValueError(f"Неизвестный тип блока: {block_type}")
    return cls(block_id, data)
