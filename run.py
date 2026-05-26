"""
Лаунчер SimLab.
Запускает FastAPI + открывает браузер.

Использование:
    python run.py
    python run.py --port 8080
    python run.py --no-browser
"""
import argparse
import os
import subprocess
import sys
import threading
import time
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(ROOT, "backend")
DIST = os.path.join(ROOT, "frontend", "dist")


def check_dist():
    if not os.path.isdir(DIST):
        print("⚠️  frontend/dist не найден.")
        print("   Запусти сначала: bash build.sh")
        sys.exit(1)


def init_db():
    print("🗄️  Инициализация базы данных...")
    result = subprocess.run(
        [sys.executable, "seed.py"],
        cwd=BACKEND,
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("⚠️  seed.py:", result.stderr.strip() or result.stdout.strip())
    else:
        print(result.stdout.strip())


def open_browser(port: int, delay: float = 1.5):
    def _open():
        time.sleep(delay)
        webbrowser.open(f"http://simlab.local:{port}")
    threading.Thread(target=_open, daemon=True).start()


def main():
    parser = argparse.ArgumentParser(description="Запуск SimLab")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    check_dist()
    init_db()

    if not args.no_browser:
        open_browser(args.port)

    print(f"\n🚀 SimLab запущен: http://simlab.local:{args.port}")
    print("   Для остановки нажми Ctrl+C\n")

    os.chdir(BACKEND)
    os.execv(sys.executable, [
        sys.executable, "-m", "uvicorn", "main:app",
        "--host", "0.0.0.0",
        "--port", str(args.port),
    ])


if __name__ == "__main__":
    main()
