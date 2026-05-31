from database import SessionLocal, engine
from models import Base, LabWork, Project, User
from auth import hash_password
import json

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# ── Создаём дефолтного преподавателя (если ещё нет) ──
if not db.query(User).filter(User.username == "teacher").first():
    teacher = User(
        username="teacher",
        full_name="Преподаватель",
        hashed_password=hash_password("teacher"),
        role="teacher",
    )
    db.add(teacher)
    db.commit()
    print("✅ Создан преподаватель: teacher / teacher")
else:
    print("ℹ️  Преподаватель уже существует")

# Удаляем все старые лабораторные и пересоздаём
db.query(LabWork).delete()
db.commit()

# ──────────────────────────────────────────────────────────
# Лабораторная 1 — Управление светофором (Q-learning)
# ──────────────────────────────────────────────────────────

lab1_schema = {
    "nodes": [
        # --- Направление A ---
        {
            "id": "source_a",
            "type": "source",
            "position": {"x": 50, "y": 80},
            "data": {
                "label": "Поток A",
                "interval": {"dist": "exponential", "params": {"lam": 0.4}},
            },
        },
        {
            "id": "queue_a",
            "type": "queue",
            "position": {"x": 300, "y": 80},
            "data": {"label": "Очередь A", "capacity": 30},
        },
        # --- Направление B ---
        {
            "id": "source_b",
            "type": "source",
            "position": {"x": 50, "y": 300},
            "data": {
                "label": "Поток B",
                "interval": {"dist": "exponential", "params": {"lam": 0.1}},
            },
        },
        {
            "id": "queue_b",
            "type": "queue",
            "position": {"x": 300, "y": 300},
            "data": {"label": "Очередь B", "capacity": 30},
        },
        # --- Единый светофор ---
        {
            "id": "gate",
            "type": "gate",
            "position": {"x": 550, "y": 190},
            "data": {
                "label": "Светофор",
                "inputs": 2,
                "pass_time": 2.0,
                "phase_times": [20, 20],
                "switch_cost": 1.0,
                "min_green_time": 5.0,
            },
        },
        # --- Выезды ---
        {
            "id": "sink_a",
            "type": "sink",
            "position": {"x": 800, "y": 80},
            "data": {"label": "Выезд A"},
        },
        {
            "id": "sink_b",
            "type": "sink",
            "position": {"x": 800, "y": 300},
            "data": {"label": "Выезд B"},
        },
    ],
    "edges": [
        # Направление A
        {"id": "e-source_a-queue_a", "source": "source_a", "target": "queue_a"},
        {"id": "e-queue_a-gate", "source": "queue_a", "target": "gate", "targetHandle": "in_0"},
        {"id": "e-gate-sink_a", "source": "gate", "target": "sink_a", "sourceHandle": "out_0"},
        # Направление B
        {"id": "e-source_b-queue_b", "source": "source_b", "target": "queue_b"},
        {"id": "e-queue_b-gate", "source": "queue_b", "target": "gate", "targetHandle": "in_1"},
        {"id": "e-gate-sink_b", "source": "gate", "target": "sink_b", "sourceHandle": "out_1"},
    ],
}

lab1_description = r"""# Лабораторная работа №1: Управление светофором на перекрёстке

## Цель работы

Освоить принципы дискретно-событийного моделирования (DES) и применить табличный алгоритм **Q-learning** для оптимизации управления светофором на перекрёстке.

---

## Теоретическая справка

### Дискретно-событийное моделирование (DES)
DES — метод исследования систем, в котором состояние меняется только в моменты наступления событий (прибытие автомобиля, переключение сигнала, выезд с перекрёстка).

### Табличный Q-learning
Q-learning строит таблицу Q(s, a), оценивающую ожидаемую суммарную награду при выборе действия a в состоянии s.

**Правило обновления:**
Q(s, a) ← Q(s, a) + α [ r + γ max Q(s', a') − Q(s, a) ]

- α — скорость обучения
- γ — коэффициент дисконтирования
- r — награда
- s' — следующее состояние

**ε-greedy стратегия:** с вероятностью ε выбирается случайное действие (исследование), иначе — лучшее по Q-таблице.

---

## Описание модели

Перекрёсток с двумя направлениями и одним блоком **Светофор** (GateBlock):
- **Направление A** (главная дорога) — интенсивный поток (λ = 0.4)
- **Направление B** (второстепенная дорога) — менее интенсивный поток (λ = 0.1)

Автомобили прибывают, встают в очередь. Светофор имеет 2 входа и 2 выхода и переключает полосы по таймеру. Обе полосы не могут быть активны одновременно.

```
Источник A → Очередь A ─→ Светофор (полоса A) → Выезд A
Источник B → Очередь B ─→ Светофор (полоса B) → Выезд B
```

---

## Порядок выполнения

### Этап 1: Сборка модели из блоков

> Нажмите **«Загрузить схему»** чтобы загрузить готовую модель, или соберите вручную.

1. Создайте 7 блоков: 2 источника, 2 буфера, 1 светофор (2 входа), 2 стока
2. Соедините очереди со входами светофора (`in_0`, `in_1`), выходы с выездами
3. Запустите симуляцию (480 единиц времени)
4. Зафиксируйте: сколько машин проехало через каждую полосу, средние очереди

> **Вопрос:** Фаза A = 20с, фаза B = 20с. Почему очередь A растёт, если поток A в 4 раза интенсивнее B?

### Этап 2: Умный светофор (Custom блок)

Замените блок **Светофор** на **«Пользовательский код»**. Custom-блок — это класс Python, наследующий `GateBlock`. Переопредели метод `_cycle()` — именно он решает, когда переключать полосу. Все `_lane()` процессы работают автоматически.

Параметры светофора (`switch_cost`, `min_green_time` и т.д.) задаются в `__init__` — либо через `data`, либо перезаписывая атрибуты напрямую:

**Пример — светофор на основе длины очереди:**

```python
class SmartGate(GateBlock):
    def __init__(self, block_id, data):
        super().__init__(block_id, data)
        self.switch_cost = 1.0      # жёлтая фаза 1 с
        self.min_green_time = 5.0   # минимум зелёного 5 с

    def _cycle(self):
        # Переключается на полосу с наибольшей очередью каждые 10 тиков.
        while not self._rl_controlled:
            yield self.env.timeout(10)
            if self._rl_controlled:
                break
            n = len(self.in_stores)
            if n == 0:
                continue
            lengths = [len(s.items) for s in self.in_stores]
            best = lengths.index(max(lengths))
            if best != self._active_lane:
                yield self.env.process(self._do_switch(best))
```

**Пример — гистерезисный светофор (не переключать пока разница < 5 машин):**

```python
class HysteresisGate(GateBlock):
    def __init__(self, block_id, data):
        super().__init__(block_id, data)
        self.switch_cost = 3.0
        self.min_green_time = 10.0

    def _cycle(self):
        while not self._rl_controlled:
            yield self.env.timeout(5)
            if self._rl_controlled:
                break
            n = len(self.in_stores)
            if n == 0:
                continue
            cur = max(self._active_lane, 0)
            lengths = [len(s.items) for s in self.in_stores]
            # Переключиться только если другая очередь длиннее на 5+
            for i, l in enumerate(lengths):
                if i != cur and l > lengths[cur] + 5:
                    yield self.env.process(self._do_switch(i))
                    break
```

> **Важно:** вызывай `self._do_switch(new_lane)` вместо прямого присваивания `self._active_lane = i` — иначе жёлтая фаза не отработает.

Поэкспериментируйте с логикой. Почему очередь-зависимый контроллер лучше фиксированного при стохастическом потоке?

### Этап 3: Три полосы — добавляем пешеходов

Теперь усложним сценарий: добавим **третью полосу** — пешеходный переход.

Расширьте модель вручную:

1. Добавьте на холст **Источник C** (λ = 0.05), **Очередь C** (вместимость 10) и **Сток C**
2. Соедините: `Источник C → Очередь C`
3. В настройках светофора увеличьте **«Количество входов»** с 2 до 3
4. Подключите: `Очередь C → Светофор (вход in_2)`, `Светофор (выход out_2) → Сток C`

Запустите симуляцию с `HysteresisGate` (порог 5) и убедитесь, что модель работает для трёх полос.

Затем **измените порог с 5 на 20** в коде (замените `+ 5` на `+ 20`) и запустите снова.

> **Вопрос:** Открываются ли пешеходы при пороге 20? Почему пешеходы могут ждать бесконечно?

Напишите `ThreeWayGate` — контроллер для трёх полос, который даёт пешеходам зелёный хотя бы раз за N тиков:

```python
class ThreeWayGate(GateBlock):
    def __init__(self, block_id, data):
        super().__init__(block_id, data)
        self.switch_cost = 1.0
        self.min_green_time = 5.0
        self._last_ped_time = 0.0   # когда последний раз горел C

    def _cycle(self):
        while not self._rl_controlled:
            yield self.env.timeout(5)
            if self._rl_controlled:
                break
            n = len(self.in_stores)
            if n == 0:
                continue
            cur = max(self._active_lane, 0)
            lengths = [len(s.items) for s in self.in_stores]

            # Принудительно даём пешеходам (полоса 2) раз в 100 тиков
            if n > 2 and self.env.now - self._last_ped_time > 100:
                if cur != 2:
                    yield self.env.process(self._do_switch(2))
                    self._last_ped_time = self.env.now
                continue

            # Иначе — на полосу с наибольшей машинной очередью (только 0 и 1)
            best = max(range(min(n, 2)), key=lambda i: lengths[i])
            if best != cur:
                yield self.env.process(self._do_switch(best))
```

> Поэкспериментируйте с периодом 100 тиков. При каком значении пешеходы обслуживаются, но машины не страдают?

### Этап 4: Обучение RL-агента (Q-learning)

Добавьте RL-контур вручную. Нужно 5 новых блоков и **5 рёбер** (Reward связей не требует):

**Блоки (панель слева → раздел RL):**

| Блок | Настройки | Рёбра |
|:---|:---|:---|
| **RL Наблюдение** × 3 | метрика: `current_level` | **Нужны:** ← от Очереди A, B и C |
| **RL Действие** × 1 | значения: `green_a`, `green_b`, `green_c` | **Нужно:** → к Светофору (вход `rl-action`) |
| **RL Награда** × 1 | режим: `formula`; веса ниже | **Рёбра не нужны** |

**Веса Reward-блока:**
```
sink_a = 1,  sink_b = 1,  sink_c = 3
queue_a = -2.0,  queue_b = -2.0,  queue_c = -5.0
```

> Пешеходам дан высокий вес — агент должен периодически открывать полосу C даже при малой очереди.

**Состояние Q-таблицы:** `(bin_A, bin_B, bin_C, last_action)` — таблица `[5×5×5×3×3]`.

После сборки схемы:

1. Нажмите **«Сгенерировать шаблон»** → **Q-learning**
2. Измените в коде:
```python
BINS = 5
# q_table уже правильного размера — obs_dim=3, act_dim=3
```
3. Запустите обучение (3000–5000 эпизодов)
4. Сравните: получают ли пешеходы зелёный? Сколько раз? Сравните с `ThreeWayGate`

---

## Контрольные вопросы

1. Что такое DES? Чем отличается от непрерывного моделирования?
2. Какую роль играет блок «Затвор» в модели?
3. Запишите формулу обновления Q-таблицы. Что означает каждый параметр?
4. Что такое ε-greedy? Зачем нужна фаза исследования?
5. Почему Q-learning требует дискретизации? Как BINS влияет на обучение?
6. Почему `HysteresisGate` с порогом 20 никогда не открывает пешеходный переход?
7. Как RL решает проблему «голодания» пешеходов без явного правила?
8. Как изменится размер Q-таблицы при переходе с 2 на 3 полосы (BINS=5)?

---

## Критерии оценки

| Этап | Баллы | Критерий |
|------|-------|----------|
| 1. Сборка 2-полосной модели | 1 | Модель собрана, симуляция запускается |
| 2. Custom-код (2 полосы) | 2 | HysteresisGate работает, объяснение поведения |
| 3. Три полосы + ThreeWayGate | 3 | Пешеходы обслуживаются, эксперимент с периодом |
| 4. RL-агент (3 полосы) | 3 | Агент обучается, пешеходы получают зелёный |
| Контрольные вопросы | 1 | Ответы на ≥5 из 8 |
| **Итого** | **10** | |
"""

lab1 = LabWork(
    title="Управление светофором на перекрёстке (Q-learning)",
    description_md=lab1_description,
    default_schema_json=lab1_schema,
    order=1,
)
db.add(lab1)
db.commit()
print(f"✅ Лабораторная 1 создана (id={lab1.id})")

# ──────────────────────────────────────────────────────────
# Лабораторная 2 — Пошив шляп с браком и переделкой (две/одна очередь)
# ──────────────────────────────────────────────────────────

hat_schema_stage1 = {
    "nodes": [
        {"id": "src_orders", "type": "source", "position": {"x": 50, "y": 160},
         "data": {"label": "Заказы", "interval": {"dist": "uniform", "params": {"a": 2, "b": 4}}}},
        {"id": "queue_main", "type": "queue", "position": {"x": 260, "y": 160},
         "data": {"label": "Очередь пошива"}},
        {"id": "srv_sew1", "type": "server", "position": {"x": 480, "y": 160},
         "data": {"label": "Пошив-1", "process_time": {"dist": "uniform", "params": {"a": 4, "b": 6}}}},
        {"id": "br_qc", "type": "branch", "position": {"x": 680, "y": 160},
         "data": {"label": "Контроль качества", "probabilities": [0.8, 0.2]}},
        {"id": "queue_rework", "type": "queue", "position": {"x": 880, "y": 260},
         "data": {"label": "Очередь переделки"}},
        {"id": "srv_sew2", "type": "server", "position": {"x": 1080, "y": 260},
         "data": {"label": "Пошив-2", "process_time": {"dist": "uniform", "params": {"a": 1, "b": 3}}}},
        {"id": "br_qc2", "type": "branch", "position": {"x": 1280, "y": 260},
         "data": {"label": "Контроль 0%", "probabilities": [1.0, 0.0]}},
        {"id": "sink_done", "type": "sink", "position": {"x": 1480, "y": 160},
         "data": {"label": "Готово"}},
    ],
    "edges": [
        {"id": "e-src-queue", "source": "src_orders", "target": "queue_main"},
        {"id": "e-queue-srv1", "source": "queue_main", "target": "srv_sew1"},
        {"id": "e-srv1-branch", "source": "srv_sew1", "target": "br_qc"},
        {"id": "e-branch-good", "source": "br_qc", "target": "sink_done", "sourceHandle": "out_0"},
        {"id": "e-branch-bad", "source": "br_qc", "target": "queue_rework", "sourceHandle": "out_1"},
        {"id": "e-rework-srv2", "source": "queue_rework", "target": "srv_sew2"},
        {"id": "e-srv2-branch2", "source": "srv_sew2", "target": "br_qc2"},
        {"id": "e-branch2-good", "source": "br_qc2", "target": "sink_done", "sourceHandle": "out_0"},
    ],
}

hat_description = r"""
# Пошив шляп с браком и переделкой

**Цель:** исследовать влияние вероятности брака (K%) на выпуск и очереди. 
**Метрика удовлетворённости:** выполненные / поступившие.

Этап 1 — базовая схема на готовых блоках: две очереди (основная и для переделки).
Этап 2 — улучшенная логика (приоритеты/условная маршрутизация) — студент может доработать Custom-блоками.
Этап 3 — свободный эксперимент (например, добавить RL или иные эвристики).
"""

lab_hat = LabWork(
    title="Пошив шляп с браком и переделкой",
    description_md=hat_description,
    default_schema_json=hat_schema_stage1,
    order=2,
)
db.add(lab_hat)
db.commit()
print(f"✅ Лабораторная 2 создана (id={lab_hat.id})")

# ──────────────────────────────────────────────────────────
# Тестовый студент для лабораторной 2
# ──────────────────────────────────────────────────────────

hat_student = db.query(User).filter(User.username == "hat_student").first()
if not hat_student:
    hat_student = User(
        username="hat_student",
        full_name="Студент Пошив",
        hashed_password=hash_password("hat_student"),
        role="student",
    )
    db.add(hat_student)
    db.commit()
    db.refresh(hat_student)
    print("✅ Создан студент: hat_student / hat_student")
else:
    db.query(Project).filter(Project.user_id == hat_student.id).delete()
    db.commit()
    print("ℹ️  Студент hat_student уже существует, проекты пересозданы")

# Этап 1 — базовая схема
project_hat_1 = Project(
    name="Пошив шляп — этап 1 (две очереди)",
    user_id=hat_student.id,
    schema_json=hat_schema_stage1,
    custom_code="",
    rl_code="",
)

# Этап 2 — заготовка под улучшения
project_hat_2 = Project(
    name="Пошив шляп — этап 2 (улучшенная логика)",
    user_id=hat_student.id,
    schema_json=hat_schema_stage1,
    custom_code="",
    rl_code="",
)

# Этап 3 — свободный эксперимент
project_hat_3 = Project(
    name="Пошив шляп — этап 3 (эксперимент)",
    user_id=hat_student.id,
    schema_json=hat_schema_stage1,
    custom_code="",
    rl_code="",
)

db.add_all([project_hat_1, project_hat_2, project_hat_3])
db.commit()
print(
    f"✅ Созданы проекты для hat_student: "
    f"1) {project_hat_1.name} (id={project_hat_1.id}), "
    f"2) {project_hat_2.name} (id={project_hat_2.id}), "
    f"3) {project_hat_3.name} (id={project_hat_3.id})"
)

# ──────────────────────────────────────────────────────────
# Тестовый студент с 4 проектами (по этапам лабораторной)
# ──────────────────────────────────────────────────────────

student = db.query(User).filter(User.username == "student").first()
if not student:
    student = User(
        username="student",
        full_name="Иванов Иван",
        hashed_password=hash_password("student"),
        role="student",
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    print("✅ Создан студент: student / student")
else:
    # Удаляем старые проекты студента для чистого пересоздания
    db.query(Project).filter(Project.user_id == student.id).delete()
    db.commit()
    print("ℹ️  Студент уже существует, проекты пересозданы")

# ── Этап 1: Базовая 2-полосная модель (готовая схема, без кастомного кода) ──
project1 = Project(
    name="Этап 1 — Базовая модель (2 полосы)",
    user_id=student.id,
    schema_json=lab1_schema,
    custom_code="",
    rl_code="",
    generated_code="",
)

# ── Этап 2: Умный светофор (Custom-блок HysteresisGate) ──
stage2_schema = json.loads(json.dumps(lab1_schema))
# Заменяем gate на custom-блок
for node in stage2_schema["nodes"]:
    if node["id"] == "gate":
        node["type"] = "custom"
        node["data"] = {
            **node["data"],
            "name": "Умный светофор",
            "inputs": 2,
            "outputs": 2,
            "code": (
                "class HysteresisGate(GateBlock):\n"
                "    def __init__(self, block_id, data):\n"
                "        super().__init__(block_id, data)\n"
                "        self.switch_cost = 3.0\n"
                "        self.min_green_time = 10.0\n"
                "\n"
                "    def _cycle(self):\n"
                "        while not self._rl_controlled:\n"
                "            yield self.env.timeout(5)\n"
                "            if self._rl_controlled:\n"
                "                break\n"
                "            n = len(self.in_stores)\n"
                "            if n == 0:\n"
                "                continue\n"
                "            cur = max(self._active_lane, 0)\n"
                "            lengths = [len(s.items) for s in self.in_stores]\n"
                "            for i, l in enumerate(lengths):\n"
                "                if i != cur and l > lengths[cur] + 5:\n"
                "                    yield self.env.process(self._do_switch(i))\n"
                "                    break\n"
            ),
        }

project2 = Project(
    name="Этап 2 — Умный светофор (HysteresisGate)",
    user_id=student.id,
    schema_json=stage2_schema,
    custom_code="",
    rl_code="",
    generated_code="",
)

# ── Этап 3: Три полосы + пешеходы (ThreeWayGate) ──
stage3_schema = json.loads(json.dumps(stage2_schema))
# Добавляем 3-е направление (пешеходы)
stage3_schema["nodes"].extend([
    {
        "id": "source_c",
        "type": "source",
        "position": {"x": 50, "y": 520},
        "data": {
            "label": "Пешеходы",
            "interval": {"dist": "exponential", "params": {"lam": 0.05}},
        },
    },
    {
        "id": "queue_c",
        "type": "queue",
        "position": {"x": 300, "y": 520},
        "data": {"label": "Очередь C (пешеходы)", "capacity": 10},
    },
    {
        "id": "sink_c",
        "type": "sink",
        "position": {"x": 800, "y": 520},
        "data": {"label": "Выход C (пешеходы)"},
    },
])
stage3_schema["edges"].extend([
    {"id": "e-source_c-queue_c", "source": "source_c", "target": "queue_c"},
    {"id": "e-queue_c-gate", "source": "queue_c", "target": "gate", "targetHandle": "in_2"},
    {"id": "e-gate-sink_c", "source": "gate", "target": "sink_c", "sourceHandle": "out_2"},
])
# Обновляем custom-блок на ThreeWayGate с 3 входами/выходами
for node in stage3_schema["nodes"]:
    if node["id"] == "gate":
        node["data"]["inputs"] = 3
        node["data"]["outputs"] = 3
        node["data"]["name"] = "Светофор 3 полосы"
        node["data"]["code"] = (
            "class ThreeWayGate(GateBlock):\n"
            "    def __init__(self, block_id, data):\n"
            "        super().__init__(block_id, data)\n"
            "        self.switch_cost = 1.0\n"
            "        self.min_green_time = 5.0\n"
            "        self._last_ped_time = 0.0\n"
            "\n"
            "    def _cycle(self):\n"
            "        while not self._rl_controlled:\n"
            "            yield self.env.timeout(5)\n"
            "            if self._rl_controlled:\n"
            "                break\n"
            "            n = len(self.in_stores)\n"
            "            if n == 0:\n"
            "                continue\n"
            "            cur = max(self._active_lane, 0)\n"
            "            lengths = [len(s.items) for s in self.in_stores]\n"
            "\n"
            "            # Принудительно даём пешеходам раз в 100 тиков\n"
            "            if n > 2 and self.env.now - self._last_ped_time > 100:\n"
            "                if cur != 2:\n"
            "                    yield self.env.process(self._do_switch(2))\n"
            "                    self._last_ped_time = self.env.now\n"
            "                continue\n"
            "\n"
            "            best = max(range(min(n, 2)), key=lambda i: lengths[i])\n"
            "            if best != cur:\n"
            "                yield self.env.process(self._do_switch(best))\n"
        )

project3 = Project(
    name="Этап 3 — Три полосы + пешеходы (ThreeWayGate)",
    user_id=student.id,
    schema_json=stage3_schema,
    custom_code="",
    rl_code="",
    generated_code="",
)

# ── Этап 4: RL-агент (Q-learning) для 3-полосного светофора ──
stage4_schema = json.loads(json.dumps(stage3_schema))
# Добавляем RL-блоки
stage4_schema["nodes"].extend([
    # 3 наблюдения — уровни очередей
    {
        "id": "rl_obs_a",
        "type": "rl_observation",
        "position": {"x": 300, "y": -100},
        "data": {"label": "Obs: Очередь A", "metric": "level"},
    },
    {
        "id": "rl_obs_b",
        "type": "rl_observation",
        "position": {"x": 500, "y": -100},
        "data": {"label": "Obs: Очередь B", "metric": "level"},
    },
    {
        "id": "rl_obs_c",
        "type": "rl_observation",
        "position": {"x": 700, "y": -100},
        "data": {"label": "Obs: Очередь C", "metric": "level"},
    },
    # 1 действие — переключение полосы
    {
        "id": "rl_act",
        "type": "rl_action",
        "position": {"x": 550, "y": -200},
        "data": {
            "label": "Действие: переключить полосу",
            "action_type": "Lane",
            "values": ["green_a", "green_b", "green_c"],
        },
    },
    # 1 награда
    {
        "id": "rl_reward",
        "type": "rl_reward",
        "position": {"x": 550, "y": 650},
        "data": {
            "label": "Награда",
            "mode": "formula",
            "weights": {
                "sink_a": 1.0,
                "sink_b": 1.0,
                "sink_c": 3.0,
                "queue_a": -2.0,
                "queue_b": -2.0,
                "queue_c": -5.0,
            },
        },
    },
])
# Рёбра: наблюдения ← от очередей, действие → к светофору
stage4_schema["edges"].extend([
    {"id": "e-queue_a-obs_a", "source": "queue_a", "target": "rl_obs_a"},
    {"id": "e-queue_b-obs_b", "source": "queue_b", "target": "rl_obs_b"},
    {"id": "e-queue_c-obs_c", "source": "queue_c", "target": "rl_obs_c"},
    {"id": "e-act-gate", "source": "rl_act", "target": "gate"},
])

# RL-код студента — заполненный Q-learning
stage4_rl_code = r"""import numpy as np
import random

# Среда уже создана: env
# obs_dim = 3 (уровни трёх очередей), act_dim = 3 (green_a, green_b, green_c)

BINS = 5

def discretize(obs, bins=BINS):
    indices = np.floor(np.clip(obs, 0.0, 0.999) * bins).astype(int)
    return tuple(indices)

EPISODES       = 3000
ALPHA          = 0.15
GAMMA          = 0.99
EPSILON_START  = 1.0
EPSILON_END    = 0.05
EPSILON_DECAY  = 0.9993

obs_dim = env.observation_space.shape[0]
act_dim = env.action_space.n

q_table = np.zeros([BINS] * obs_dim + [act_dim])
epsilon = EPSILON_START

rewards_history = []

for episode in range(EPISODES):
    obs, info = env.reset()
    state = discretize(obs)
    total_reward = 0

    while True:
        # epsilon-greedy
        if random.random() < epsilon:
            action = random.randrange(act_dim)
        else:
            action = int(np.argmax(q_table[state]))

        next_obs, reward, terminated, truncated, info = env.step(action)
        done = terminated or truncated
        next_state = discretize(next_obs)

        # Q-update
        current_q = q_table[state + (action,)]
        best_next = np.max(q_table[next_state]) if not done else 0.0
        td_target = reward + GAMMA * best_next
        q_table[state + (action,)] += ALPHA * (td_target - current_q)

        total_reward += reward
        state = next_state
        if done:
            break

    epsilon = max(EPSILON_END, epsilon * EPSILON_DECAY)
    rewards_history.append(total_reward)
    if (episode + 1) % 100 == 0 or episode == 0:
        print(f"Эпизод {episode+1}/{EPISODES} | Reward: {total_reward:.1f} | Eps: {epsilon:.3f}")

print(f"\n> Обучение завершено! Лучший reward: {max(rewards_history):.1f}, средний за последние 20: {np.mean(rewards_history[-20:]):.1f}")

# Оценка
print("> Запуск оценки обученного агента...")
obs, info = env.reset()
state = discretize(obs)
eval_actions = []
while True:
    action = int(np.argmax(q_table[state]))
    obs, reward, terminated, truncated, info = env.step(action)
    state = discretize(obs)
    eval_actions.append({"time": info["time"], "action": action})
    if terminated or truncated:
        break

results = {
    "rewards_history": rewards_history,
    "eval_info": info,
    "eval_actions": eval_actions,
}
"""

project4 = Project(
    name="Этап 4 — RL-агент (Q-learning, 3 полосы)",
    user_id=student.id,
    schema_json=stage4_schema,
    custom_code="",
    rl_code=stage4_rl_code,
    generated_code="",
)

db.add_all([project1, project2, project3, project4])
db.commit()
print(f"✅ Создано 4 проекта для студента «{student.full_name}»:")
print(f"   1. {project1.name} (id={project1.id})")
print(f"   2. {project2.name} (id={project2.id})")
print(f"   3. {project3.name} (id={project3.id})")
print(f"   4. {project4.name} (id={project4.id})")

db.close()
