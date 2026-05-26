#!/bin/bash
# Сборка SimLab для production (macOS/Linux)
# Запускай один раз перед раздачей студентам

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== SimLab build ==="

# 1. Собираем фронтенд
echo "📦 Сборка фронтенда..."
cd "$ROOT/frontend"
npm install
npm run build
echo "✅ frontend/dist готов"

# 2. Устанавливаем Python-зависимости через uv (или pip)
echo "🐍 Установка Python зависимостей..."
cd "$ROOT"
if command -v uv &>/dev/null; then
    uv pip install -r backend/requirements.txt
else
    pip install -r backend/requirements.txt
fi
echo "✅ Python зависимости установлены"

echo ""
echo "=== Готово ==="
echo "Запускай: python run.py"
