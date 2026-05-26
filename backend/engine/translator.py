"""
Транслятор: JSON-схема → Python SimPy-код (для отображения студенту).
"""
import json


def translate(schema_json: dict, custom_code: str = "") -> str:
    """Генерирует читаемый Python-код из JSON-схемы визуального конструктора."""
    nodes = schema_json.get("nodes", [])
    edges = schema_json.get("edges", [])

    lines = [
        "import simpy",
        "import random",
        "",
        "# ========== Автоматически сгенерированный код ==========",
        "",
    ]
    
    if custom_code and custom_code.strip():
        lines.append("# --- Кастомный код пользователя ---")
        lines.append(custom_code)
        lines.append("")

    # Собираем связи
    outgoing = {}  # source_id -> [target_id]
    for edge in edges:
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        if src and tgt:
            outgoing.setdefault(src, []).append(tgt)

    def _label(data, ntype, nid):
        """Возвращает читаемое имя блока: label > name > тип блока."""
        return data.get("label") or data.get("name") or ntype.capitalize()

    # Генерируем код для каждого блока
    for node in nodes:
        ntype = node.get("type", "")
        nid = node.get("id", "")
        data = node.get("data", {})
        lbl = _label(data, ntype, nid)

        # Пропускаем RL-блоки (они не транслируются в SimPy)
        if ntype.startswith("rl_"):
            lines.append(f"# Системный RL-блок {ntype} ({lbl}) обрабатывается отдельно через env_builder")
            continue

        if ntype == "source":
            interval = data.get("interval", {})
            dist = interval.get("dist", "exponential")
            params = interval.get("params", {})
            lines.append(f"# --- Источник: {lbl} ---")
            if dist == "exponential":
                lam = params.get("lam", 1.0)
                lines.append(f"def {nid}_process(env, out_store):")
                lines.append(f"    while True:")
                lines.append(f"        yield env.timeout(random.expovariate({lam}))")
                lines.append(f"        out_store.put({{'id': id(env.now), 'time': env.now}})")
            elif dist == "normal":
                mu = params.get("mu", 5.0)
                sigma = params.get("sigma", 1.0)
                lines.append(f"def {nid}_process(env, out_store):")
                lines.append(f"    while True:")
                lines.append(f"        yield env.timeout(max(0.1, random.gauss({mu}, {sigma})))")
                lines.append(f"        out_store.put({{'id': id(env.now), 'time': env.now}})")
            lines.append("")

        elif ntype in ("queue", "buffer"):
            cap = data.get("capacity", 20)
            lines.append(f"# --- Очередь: {lbl} (вместимость: {cap}) ---")
            lines.append(f"{nid} = simpy.Store(env, capacity={cap})")
            lines.append("")

        elif ntype in ("server", "machine"):
            pt = data.get("processing_time", {})
            dist = pt.get("dist", "normal")
            params = pt.get("params", {})
            count = data.get("count", 1)
            mu = params.get("mu", 5.0)
            sigma = params.get("sigma", 1.0)

            lines.append(f"# --- Сервер: {lbl} (x{count}) ---")
            lines.append(f"{nid}_resource = simpy.Resource(env, capacity={count})")
            lines.append(f"def {nid}_process(env, resource, in_store, out_store):")
            lines.append(f"    while True:")
            lines.append(f"        entity = yield in_store.get()")
            lines.append(f"        with resource.request() as req:")
            lines.append(f"            yield req")
            lines.append(f"            yield env.timeout(max(0.1, random.gauss({mu}, {sigma})))")
            lines.append(f"        out_store.put(entity)")
            lines.append("")

        elif ntype in ("branch", "inspector"):
            weights = data.get("weights", None)
            defect_rate = data.get("defect_rate", 0.1)
            mode = data.get("mode", "probability")
            service_time = data.get("service_time", data.get("inspection_time", 1.0))
            outputs = data.get("outputs", 2)
            if weights is None:
                weights = [1.0 - defect_rate, defect_rate]
            lines.append(f"# --- Ветвитель: {lbl} (режим: {mode}, выходов: {outputs}) ---")
            lines.append(f"_branch_{nid}_weights = {weights}")
            lines.append(f"_branch_{nid}_rr = 0")
            lines.append(f"def {nid}_process(env, in_store, *out_stores):")
            lines.append(f"    global _branch_{nid}_rr")
            lines.append(f"    while True:")
            lines.append(f"        entity = yield in_store.get()")
            if service_time > 0:
                lines.append(f"        yield env.timeout({service_time})")
            if mode == "round_robin":
                lines.append(f"        idx = _branch_{nid}_rr % len(out_stores)")
                lines.append(f"        _branch_{nid}_rr += 1")
            else:
                lines.append(f"        r = random.random()")
                lines.append(f"        idx, cum = 0, 0.0")
                lines.append(f"        for i, w in enumerate(_branch_{nid}_weights[:len(out_stores)]):")
                lines.append(f"            cum += w")
                lines.append(f"            if r <= cum: idx = i; break")
            lines.append(f"        out_stores[idx].put(entity)")
            lines.append("")

        elif ntype == "router":
            outputs = data.get("outputs", 2)
            mode = data.get("mode", "round_robin")
            lines.append(f"# --- Маршрутизатор: {lbl} (режим: {mode}, выходов: {outputs}) ---")
            lines.append(f"_router_{nid}_rr = 0")
            lines.append(f"def {nid}_process(env, in_store, *out_stores):")
            lines.append(f"    global _router_{nid}_rr")
            lines.append(f"    while True:")
            lines.append(f"        entity = yield in_store.get()")
            lines.append(f"        idx = _router_{nid}_rr % len(out_stores)")
            lines.append(f"        _router_{nid}_rr += 1")
            lines.append(f"        out_stores[idx].put(entity)")
            lines.append("")

        elif ntype == "merge":
            lines.append(f"# --- Слияние: {lbl} ---")
            lines.append(f"def {nid}_process(env, in_store, out_store):")
            lines.append(f"    while True:")
            lines.append(f"        entity = yield in_store.get()")
            lines.append(f"        out_store.put(entity)")
            lines.append("")

        elif ntype == "sink":
            lines.append(f"# --- Сток: {lbl} ---")
            lines.append(f"{nid}_count = 0")
            lines.append(f"def {nid}_process(env, in_store):")
            lines.append(f"    global {nid}_count")
            lines.append(f"    while True:")
            lines.append(f"        entity = yield in_store.get()")
            lines.append(f"        {nid}_count += 1")
            lines.append("")

        elif ntype == "custom":
            outputs = data.get("outputs", 1)
            user_code = data.get("code", "").strip()
            lines.append(f"# --- Скрипт: {lbl}, выходов: {outputs} ---")
            if user_code:
                lines.append(user_code)
            else:
                lines.append(f"def process(entity, env, metrics):")
                lines.append(f"    metrics['count'] = metrics.get('count', 0) + 1")
                lines.append(f"    return 0  # → out_0")
            lines.append(f"# Блок обёртывает process() в SimPy-цикл автоматически")
            lines.append("")

    return "\n".join(lines)
