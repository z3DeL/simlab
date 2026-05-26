"""
Исполнитель RL-кода студента.

Платформа предоставляет env, студент пишет агента.
"""
import io
import traceback
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import random
from collections import deque

from rl.env_builder import build_env

# Чтобы torch не конфликтовал с потоками FastAPI
torch.set_num_threads(1)


class CallbackWriter:
    def __init__(self, callback, buffer):
        self.callback = callback
        self.buffer = buffer
        self._pending = ""

    def write(self, data):
        self.buffer.write(data)
        if self.callback:
            self._pending += data
            # Отправляем только целые строки (заканчивающиеся на \n)
            while '\n' in self._pending:
                line, self._pending = self._pending.split('\n', 1)
                self.callback(line + '\n')

    def flush(self):
        # Отправляем остаток если есть
        if self.callback and self._pending:
            self.callback(self._pending)
            self._pending = ""
        self.buffer.flush()


def execute_rl(schema_json: dict, custom_code: str = "", rl_code: str = "", log_callback=None):
    """
    Выполняет RL-код студента.
    """
    log_buffer = io.StringIO()
    writer = CallbackWriter(log_callback, log_buffer)

    def _print(*args, **kwargs):
        """Thread-safe print: пишет в writer, не трогая sys.stdout."""
        sep = kwargs.get("sep", " ")
        end = kwargs.get("end", "\n")
        writer.write(sep.join(str(a) for a in args) + end)

    try:
        _print("> Инициализация среды...")

        # 1. Проверяем, что env можно построить (RL-блоки на месте)
        try:
            env = build_env(schema_json, custom_code)
        except ValueError as e:
            _print(f"> ОШИБКА: {e}")
            return (
                {"baseline": {}, "error": str(e)},
                {},
                f"Ошибка конфигурации: {e}"
            )

        # 2. Baseline: без агента
        _print("> Запуск baseline симуляции (без агента)...")
        baseline_metrics = _run_baseline(schema_json, custom_code)

        # Если код не задан — ошибка
        if not rl_code.strip():
            _print("> ОШИБКА: RL-код не задан.")
            return (
                {"baseline": baseline_metrics, "error": "RL-код не задан"},
                {},
                "Ошибка: вставьте код агента во вкладку RL-обучение."
            )

        # 3. Выполняем код студента
        _print("> Подготовка нейросети и запуск кода агента...")

        exec_globals = {
            "__builtins__": __builtins__.copy() if isinstance(__builtins__, dict) else dict(__builtins__),
            "env": env,
            "torch": torch,
            "nn": nn,
            "optim": optim,
            "np": np,
            "random": random,
            "deque": deque,
            "results": {},
            "print": _print,
        }

        if not isinstance(exec_globals["__builtins__"], dict):
            exec_globals["__builtins__"] = exec_globals["__builtins__"].__dict__

        _print("> Запуск exec()...")
        exec(rl_code, exec_globals)
        _print("> Код успешно выполнен.")

        # Если студент изменил sim_total в env — перезапускаем baseline с тем же значением
        final_sim_total = exec_globals["env"].sim_total
        if final_sim_total != env.sim_total or final_sim_total != 960:
            _print(f"> Пересчёт baseline для sim_total={final_sim_total}...")
            baseline_metrics = _run_baseline(schema_json, custom_code, sim_total=final_sim_total)

        # Считываем результаты
        results = exec_globals.get("results", {})
        rewards_history = results.get("rewards_history", [])
        eval_info = results.get("eval_info", {})
        eval_actions = results.get("eval_actions", [])

        # Метрики RL-прогона
        rl_block_metrics = eval_info.get("all_metrics", {})
        
        metrics = {
            "baseline": baseline_metrics,
            "with_rl": rl_block_metrics,
            "episodes_trained": len(rewards_history),
        }

        timeseries = {
            "rewards": [float(r) for r in rewards_history],
            "eval_actions": eval_actions,
        }

        log = log_buffer.getvalue()
        return metrics, timeseries, log

    except Exception as e:
        log = log_buffer.getvalue()
        log += f"\n\nОШИБКА ПРИ ВЫПОЛНЕНИИ:\n{traceback.format_exc()}"
        # We don't have baseline_metrics here if it failed early
        bm = locals().get('baseline_metrics', {})
        return {"baseline": bm, "error": str(e)}, {}, log

    finally:
        writer.flush()


def _run_baseline(schema_json, custom_code, sim_total=960):
    """Прогон без RL-агента: обычная SimPy-симуляция через runner.

    GateBlock работает со встроенным циклическим таймером (phase_times),
    RL-контур игнорируется. Это честный baseline для сравнения с агентом.
    """
    from engine.runner import run as runner_run
    metrics, _ts, _log = runner_run(schema_json, custom_code=custom_code, sim_time=sim_total)
    return metrics
