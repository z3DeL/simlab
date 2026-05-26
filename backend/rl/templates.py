"""
Генерация шаблона RL-кода для студента.

Подставляет obs_dim и act_dim из текущей JSON-схемы.
"""


def generate_template(schema_json: dict):
    """
    Генерирует шаблон Python-кода для обучения RL-агента.

    Returns:
        (code: str, obs_dim: int, act_dim: int)
    """
    nodes = schema_json.get("nodes", [])
    edges = schema_json.get("edges", [])

    # Считаем dimensions
    obs_dim = sum(1 for n in nodes if n.get("type") == "rl_observation")
    if obs_dim == 0:
        raise ValueError(
            "В схеме нет блоков RL Observation. "
            "Добавьте блоки 'RL Наблюдение' и подключите к машинам/буферам."
        )

    # act_dim — из списка values блока RL Action (студент заполняет вручную)
    act_dim = 2  # default
    for n in nodes:
        if n.get("type") == "rl_action":
            values = n.get("data", {}).get("values", ["noop"])
            act_dim = len(values) if values else 2
            break

    code = f'''import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import random
from collections import deque

# ================================================================
# Среда уже создана и доступна как переменная `env`
#
# env.observation_space = Box(shape=({obs_dim},))
# env.action_space = Discrete({act_dim})
#
# obs, info = env.reset()      — сбросить среду
# obs, reward, terminated, truncated, info = env.step(action)
# info["all_metrics"] = {{block_id: {{metric: value}}}}
# ================================================================

# ===== 1. Определите нейросеть =====
class QNetwork(nn.Module):
    def __init__(self, input_dim, output_dim):
        super().__init__()
        # TODO: задайте слои сети (подсказка: 2-3 Linear + ReLU)
        self.net = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 64),
            nn.ReLU(),
            nn.Linear(64, output_dim),
        )

    def forward(self, x):
        return self.net(x)

# ===== 2. Гиперпараметры (настройте под свою задачу) =====
EPISODES = 1500
LR = 1e-3
GAMMA = 0.99
EPSILON_START = 1.0
EPSILON_END = 0.01
EPSILON_DECAY = 0.995
BATCH_SIZE = 32
MEMORY_SIZE = 5000
TARGET_UPDATE = 10  # как часто обновлять target-сеть

# ===== 3. Инициализация =====
obs_dim = env.observation_space.shape[0]
act_dim = env.action_space.n

q_net = QNetwork(obs_dim, act_dim)
target_net = QNetwork(obs_dim, act_dim)
target_net.load_state_dict(q_net.state_dict())

optimizer = optim.Adam(q_net.parameters(), lr=LR)
memory = deque(maxlen=MEMORY_SIZE)
epsilon = EPSILON_START

# ===== 4. Цикл обучения =====
rewards_history = []

for episode in range(EPISODES):
    obs, info = env.reset()
    total_reward = 0

    while True:
        # TODO: реализуйте epsilon-greedy выбор действия
        # Подсказка:
        #   - с вероятностью epsilon: случайное действие (env.action_space.sample())
        #   - иначе: лучшее по Q-сети (q_net(obs) -> argmax)
        raise NotImplementedError("TODO: реализуйте epsilon-greedy выбор действия")  # <-- ваш код здесь

        next_obs, reward, terminated, truncated, info = env.step(action)
        done = terminated or truncated

        memory.append((obs, action, reward, next_obs, done))
        total_reward += reward
        obs = next_obs

        # TODO: обучение на мини-батче из replay buffer
        # Подсказка:
        #   1. if len(memory) >= BATCH_SIZE: выбрать случайный батч
        #   2. Рассчитать current_q = q_net(states)[actions]
        #   3. Рассчитать target_q = rewards + GAMMA * target_net(next_states).max()
        #   4. loss = MSE(current_q, target_q), optimizer step
        if len(memory) >= BATCH_SIZE:
            raise NotImplementedError("TODO: реализуйте обучение на мини-батче")  # <-- ваш код здесь

        if done:
            break

    epsilon = max(EPSILON_END, epsilon * EPSILON_DECAY)
    rewards_history.append(total_reward)
    if (episode + 1) % TARGET_UPDATE == 0:
        target_net.load_state_dict(q_net.state_dict())
    if (episode + 1) % 10 == 0 or episode == 0:
        print(f"Эпизод {{episode+1}}/{{EPISODES}} | Reward: {{total_reward:.1f}} | Eps: {{epsilon:.3f}}")

print(f"\\n> Обучение завершено! Лучший reward: {{max(rewards_history):.1f}}, средний за последние 10: {{np.mean(rewards_history[-10:]):.1f}}")

# ===== 5. Оценка обученного агента =====
print("> Запуск оценки обученного агента...")
obs, info = env.reset()
eval_actions = []
while True:
    with torch.no_grad():
        action = q_net(torch.FloatTensor(obs)).argmax().item()
    obs, reward, terminated, truncated, info = env.step(action)
    eval_actions.append({{"time": info["time"], "action": int(action)}})
    if terminated or truncated:
        break

# ===== Платформа считывает эту переменную =====
results = {{
    "rewards_history": rewards_history,
    "eval_info": info,
    "eval_actions": eval_actions,
}}
'''
    return code, obs_dim, act_dim


def _get_dims(schema_json: dict):
    """Извлекает obs_dim и act_dim из JSON-схемы."""
    nodes = schema_json.get("nodes", [])
    obs_dim = sum(1 for n in nodes if n.get("type") == "rl_observation")
    if obs_dim == 0:
        raise ValueError(
            "В схеме нет блоков RL Observation. "
            "Добавьте блоки 'RL Наблюдение' и подключите к машинам/буферам."
        )
    act_dim = 2
    for n in nodes:
        if n.get("type") == "rl_action":
            values = n.get("data", {}).get("values", ["noop"])
            act_dim = len(values) if values else 2
            break
    return obs_dim, act_dim


def generate_qlearning_template(schema_json: dict):
    """
    Шаблон табличного Q-Learning с дискретизацией наблюдений.

    Returns:
        (code: str, obs_dim: int, act_dim: int)
    """
    obs_dim, act_dim = _get_dims(schema_json)

    code = f'''import numpy as np
import random

# ================================================================
# Среда уже создана и доступна как переменная `env`
#
# env.observation_space = Box(shape=({obs_dim},))
# env.action_space = Discrete({act_dim})
#
# obs, info = env.reset()
# obs, reward, terminated, truncated, info = env.step(action)
# ================================================================

# ===== 1. Дискретизация пространства наблюдений =====
# Q-learning требует дискретных состояний; делим каждую ось на BINS корзин.
# Наблюдения нормализованы в [0, 1], поэтому делим напрямую.
BINS = 5

def discretize(obs, bins=BINS):
    """Преобразует непрерывное наблюдение [0..1] в кортеж индексов."""
    indices = np.floor(np.clip(obs, 0.0, 0.999) * bins).astype(int)
    return tuple(indices)

# ===== 2. Гиперпараметры =====
EPISODES       = 3000
ALPHA          = 0.15    # скорость обучения
GAMMA          = 0.99    # коэффициент дисконтирования
EPSILON_START  = 1.0
EPSILON_END    = 0.05
EPSILON_DECAY  = 0.9993

# ===== 3. Q-таблица =====
# Форма: (BINS, BINS, ..., BINS, act_dim)
q_table = np.zeros([BINS] * {obs_dim} + [{act_dim}])
epsilon = EPSILON_START

# ===== 4. Цикл обучения =====
rewards_history = []

for episode in range(EPISODES):
    obs, info = env.reset()
    state = discretize(obs)
    total_reward = 0

    while True:
        # TODO: реализуйте epsilon-greedy выбор действия
        # Подсказка:
        #   - с вероятностью epsilon: random.randrange({act_dim})
        #   - иначе: np.argmax(q_table[state])
        raise NotImplementedError("TODO: реализуйте epsilon-greedy выбор действия")  # <-- ваш код здесь

        next_obs, reward, terminated, truncated, info = env.step(action)
        done = terminated or truncated
        next_state = discretize(next_obs)

        # TODO: обновление Q-таблицы по формуле Беллмана
        # Q(s, a) += alpha * (reward + gamma * max_Q(s') - Q(s, a))
        # Подсказка:
        #   current_q  = q_table[state + (action,)]
        #   best_next  = np.max(q_table[next_state]) if not done else 0.0
        #   td_target  = reward + GAMMA * best_next
        #   q_table[state + (action,)] += ALPHA * (td_target - current_q)
        raise NotImplementedError("TODO: реализуйте обновление Q-таблицы")  # <-- ваш код здесь

        total_reward += reward
        state = next_state
        if done:
            break

    epsilon = max(EPSILON_END, epsilon * EPSILON_DECAY)
    rewards_history.append(total_reward)
    if (episode + 1) % 100 == 0 or episode == 0:
        print(f"Эпизод {{episode+1}}/{{EPISODES}} | Reward: {{total_reward:.1f}} | Eps: {{epsilon:.3f}}")

print(f"\\n> Обучение завершено! Лучший reward: {{max(rewards_history):.1f}}, средний за последние 20: {{np.mean(rewards_history[-20:]):.1f}}")

# ===== 5. Оценка =====
print("> Запуск оценки обученного агента...")
obs, info = env.reset()
state = discretize(obs)
eval_actions = []
while True:
    action = int(np.argmax(q_table[state]))
    obs, reward, terminated, truncated, info = env.step(action)
    state = discretize(obs)
    eval_actions.append({{"time": info["time"], "action": action}})
    if terminated or truncated:
        break

# ===== Платформа считывает эту переменную =====
results = {{
    "rewards_history": rewards_history,
    "eval_info": info,
    "eval_actions": eval_actions,
}}
'''
    return code, obs_dim, act_dim


def generate_reinforce_template(schema_json: dict):
    """
    Шаблон алгоритма REINFORCE (Monte-Carlo Policy Gradient).

    Returns:
        (code: str, obs_dim: int, act_dim: int)
    """
    obs_dim, act_dim = _get_dims(schema_json)

    code = f'''import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np

# ================================================================
# Среда уже создана и доступна как переменная `env`
#
# env.observation_space = Box(shape=({obs_dim},))
# env.action_space = Discrete({act_dim})
#
# obs, info = env.reset()
# obs, reward, terminated, truncated, info = env.step(action)
# ================================================================

# ===== 1. Определите сеть политики =====
class PolicyNetwork(nn.Module):
    def __init__(self, input_dim, output_dim):
        super().__init__()
        # TODO: задайте слои (подсказка: 2 Linear + ReLU, финал — Softmax)
        self.net = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.ReLU(),
            nn.Linear(64, output_dim),
            nn.Softmax(dim=-1),
        )

    def forward(self, x):
        return self.net(x)  # вероятности действий (после Softmax)

# ===== 2. Гиперпараметры =====
EPISODES = 1500
LR       = 1e-3
GAMMA    = 0.99

# ===== 3. Инициализация =====
obs_dim = env.observation_space.shape[0]
act_dim = env.action_space.n

policy = PolicyNetwork(obs_dim, act_dim)
optimizer = optim.Adam(policy.parameters(), lr=LR)

# ===== 4. Вспомогательная функция: подсчёт дисконтированных доходностей =====
def compute_returns(rewards, gamma=GAMMA):
    """G_t = r_t + gamma*r_{{t+1}} + gamma^2*r_{{t+2}} + ..."""
    returns = []
    G = 0.0
    for r in reversed(rewards):
        G = r + gamma * G
        returns.insert(0, G)
    returns = torch.tensor(returns, dtype=torch.float32)
    # Нормализация для стабильности обучения
    returns = (returns - returns.mean()) / (returns.std() + 1e-8)
    return returns

# ===== 5. Цикл обучения =====
rewards_history = []

for episode in range(EPISODES):
    obs, info = env.reset()
    log_probs = []   # log π(a|s) для каждого шага
    ep_rewards = []  # награды за эпизод
    total_reward = 0

    while True:
        obs_t = torch.FloatTensor(obs)

        # TODO: сэмплируйте действие из политики
        # Подсказка:
        #   probs = policy(obs_t)                          # вероятности
        #   dist  = torch.distributions.Categorical(probs) # категориальное распределение
        #   action = dist.sample()
        #   log_prob = dist.log_prob(action)
        raise NotImplementedError("TODO: сэмплируйте действие из политики")  # <-- ваш код здесь

        next_obs, reward, terminated, truncated, info = env.step(int(action))
        done = terminated or truncated

        log_probs.append(log_prob)
        ep_rewards.append(reward)
        total_reward += reward
        obs = next_obs
        if done:
            break

    # TODO: обновление политики по REINFORCE
    # Подсказка:
    #   returns = compute_returns(ep_rewards)
    #   loss = -sum(log_prob * G for log_prob, G in zip(log_probs, returns))
    #   optimizer.zero_grad(); loss.backward(); optimizer.step()
    raise NotImplementedError("TODO: реализуйте обновление политики REINFORCE")  # <-- ваш код здесь

    rewards_history.append(total_reward)
    if (episode + 1) % 50 == 0 or episode == 0:
        print(f"Эпизод {{episode+1}}/{{EPISODES}} | Reward: {{total_reward:.1f}}")

print(f"\\n> Обучение завершено! Лучший reward: {{max(rewards_history):.1f}}, средний за последние 10: {{np.mean(rewards_history[-10:]):.1f}}")

# ===== 6. Оценка =====
print("> Запуск оценки обученного агента...")
obs, info = env.reset()
eval_actions = []
while True:
    with torch.no_grad():
        probs = policy(torch.FloatTensor(obs))
        action = probs.argmax().item()
    obs, reward, terminated, truncated, info = env.step(action)
    eval_actions.append({{"time": info["time"], "action": int(action)}})
    if terminated or truncated:
        break

# ===== Платформа считывает эту переменную =====
results = {{
    "rewards_history": rewards_history,
    "eval_info": info,
    "eval_actions": eval_actions,
}}
'''
    return code, obs_dim, act_dim
