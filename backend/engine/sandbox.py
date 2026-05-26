"""
Sandbox: безопасное выполнение пользовательского кода.
"""
import sys
import io
import traceback
import signal


SAFE_BUILTINS = {
    "print": print,
    "range": range,
    "len": len,
    "min": min,
    "max": max,
    "sum": sum,
    "abs": abs,
    "round": round,
    "enumerate": enumerate,
    "zip": zip,
    "map": map,
    "filter": filter,
    "sorted": sorted,
    "list": list,
    "dict": dict,
    "tuple": tuple,
    "set": set,
    "int": int,
    "float": float,
    "str": str,
    "bool": bool,
    "type": type,
    "isinstance": isinstance,
    "True": True,
    "False": False,
    "None": None,
}


class TimeoutError(Exception):
    pass


def safe_exec(code: str, globals_dict: dict = None, timeout_sec: int = 60):
    """
    Выполняет код в ограниченном окружении.

    Returns:
        (result_globals, stdout_text, error_text)
    """
    if globals_dict is None:
        globals_dict = {}

    globals_dict["__builtins__"] = SAFE_BUILTINS

    stdout_buffer = io.StringIO()
    old_stdout = sys.stdout

    error_text = ""
    try:
        sys.stdout = stdout_buffer

        # Timeout (Unix only)
        def handler(signum, frame):
            raise TimeoutError(f"Превышено время выполнения ({timeout_sec} сек)")

        old_handler = signal.signal(signal.SIGALRM, handler)
        signal.alarm(timeout_sec)

        try:
            exec(code, globals_dict)
        finally:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, old_handler)

    except TimeoutError as e:
        error_text = str(e)
    except Exception:
        error_text = traceback.format_exc()
    finally:
        sys.stdout = old_stdout

    return globals_dict, stdout_buffer.getvalue(), error_text
