# SimLab — платформа имитационного моделирования с RL-обучением

Интерактивная учебная платформа для построения имитационных моделей систем массового обслуживания (СМО) и обучения агентов методами обучения с подкреплением (Reinforcement Learning).

## Возможности

- **Визуальный редактор** — блок-схемы СМО (источники, очереди, серверы, маршрутизаторы, гейты) через drag-and-drop
- **Симуляция** — дискретно-событийное моделирование на SimPy с метриками (пропускная способность, загрузка, среднее время ожидания)
- **RL-обучение** — встроенные шаблоны Q-learning, DQN и REINFORCE для управления моделью
- **Лабораторные работы** — пошаговые задания с методическими указаниями
- **Генерация кода** — автоматическая трансляция визуальной схемы в Python-код SimPy

## Стек технологий

| Компонент | Технологии |
|-----------|-----------|
| Backend | Python, FastAPI, SimPy, PyTorch, SQLAlchemy, SQLite |
| Frontend | React, React Flow, Vite |
| RL | Gymnasium, Q-learning, DQN, REINFORCE |

## Быстрый старт

### Требования

- Python 3.10+
- Node.js 18+ (только для разработки)

### Установка и запуск (production)

```bash
./install.sh      # установка зависимостей
./run.sh          # запуск на http://simlab.local:8000
```

### Запуск (один сервер)

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
python seed.py                          # создать лабораторные

# 2. Собрать frontend
cd ../frontend
npm install
npm run build                           # создаст frontend/dist/

# 3. Запустить
cd ../backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
# Открыть http://localhost:8000
```

### Разработка (два терминала)

```bash
# Терминал 1 — Backend
cd backend
pip install -r requirements.txt
python seed.py
python -m uvicorn main:app --reload     # API на :8000

# Терминал 2 — Frontend
cd frontend
npm install
npm run dev                             # dev-сервер на :5173
```

## Структура проекта

```
backend/
├── engine/          # SimPy-блоки и движок симуляции
│   ├── blocks.py    # Source, Queue, Server, Gate, Router, Branch, Merge, Sink
│   ├── runner.py    # запуск симуляции по JSON-схеме
│   ├── translator.py # JSON → Python-код
│   └── sandbox.py   # безопасное исполнение пользовательского кода
├── rl/              # RL-контур
│   ├── env_builder.py  # Gymnasium-среда поверх SimPy
│   ├── executor.py     # исполнение RL-кода студента
│   └── templates.py    # шаблоны Q-learning / DQN / REINFORCE
├── routers/         # API-эндпоинты
├── models.py        # SQLAlchemy-модели
├── schemas.py       # Pydantic-схемы
├── seed.py          # наполнение БД лабораторными
└── main.py          # FastAPI-приложение

frontend/src/
├── components/      # React-компоненты
│   ├── FlowCanvas.jsx    # основной canvas (React Flow)
│   ├── BlockPalette.jsx  # палитра блоков
│   ├── NodeSettings.jsx  # настройки блока
│   ├── CodePanel.jsx     # панель кода
│   ├── ResultsPanel.jsx  # результаты симуляции/RL
│   └── nodes/            # визуальные блоки
├── context/
│   └── ProjectContext.jsx # состояние проекта
└── api/
    └── client.js          # API-клиент
```

## API

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/lab_works/` | Список лабораторных |
| GET | `/api/projects/` | Список проектов |
| POST | `/api/projects/` | Создать проект |
| PUT | `/api/projects/{id}` | Обновить проект |
| POST | `/api/projects/{id}/generate_code` | Сгенерировать Python-код |
| POST | `/api/projects/{id}/run_simulation` | Запустить симуляцию |
| WS | `/api/projects/{id}/train_ws` | RL-обучение (WebSocket) |
| GET | `/api/projects/{id}/rl_template?algorithm=qlearning` | Получить шаблон RL-кода |

## Тестирование

```bash
cd backend && python -m pytest tests/ -v
```

## Лицензия

MIT
