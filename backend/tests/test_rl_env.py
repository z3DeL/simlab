"""
Тесты для rl/env_builder.py — Gymnasium-среда из JSON-схемы.
"""
import pytest
import numpy as np
from rl.env_builder import DynamicSimEnv, build_env


RL_SCHEMA = {
    "nodes": [
        {"id": "source_1", "type": "source", "data": {
            "interval": {"dist": "constant", "params": {"value": 2.0}}
        }},
        {"id": "buffer_1", "type": "buffer", "data": {"capacity": 20}},
        {"id": "machine_1", "type": "machine", "data": {
            "processing_time": {"dist": "constant", "params": {"value": 3.0}},
            "count": 1, "mtbf": 50, "mttr": 5,
        }},
        {"id": "sink_1", "type": "sink", "data": {"label": "Выход"}},
        {"id": "rl_obs_1", "type": "rl_observation", "data": {"metric": "wear"}},
        {"id": "rl_obs_2", "type": "rl_observation", "data": {"metric": "current_level"}},
        {"id": "rl_act_1", "type": "rl_action", "data": {
            "action_type": "Maintain",
            "values": ["noop", "maintain"]
        }},
        {"id": "rl_rew_1", "type": "rl_reward", "data": {
            "mode": "formula",
            "weights": {"sink_1": 1.0, "machine_1": -5.0, "action_penalty": -0.3}
        }},
    ],
    "edges": [
        {"source": "source_1", "target": "buffer_1"},
        {"source": "buffer_1", "target": "machine_1"},
        {"source": "machine_1", "target": "sink_1"},
        {"source": "machine_1", "target": "rl_obs_1"},
        {"source": "buffer_1", "target": "rl_obs_2"},
        {"source": "rl_act_1", "target": "machine_1"},
        {"source": "sink_1", "target": "rl_rew_1"},
        {"source": "machine_1", "target": "rl_rew_1"},
    ],
}


class TestDynamicSimEnv:
    def test_build_env(self):
        env = build_env(RL_SCHEMA)
        assert env.observation_space.shape[0] == 2
        assert env.action_space.n == 2

    def test_reset(self):
        env = build_env(RL_SCHEMA)
        obs, info = env.reset()
        assert isinstance(obs, np.ndarray)
        assert obs.shape == (2,)
        assert "time" in info

    def test_step(self):
        env = build_env(RL_SCHEMA)
        obs, info = env.reset()
        obs2, reward, terminated, truncated, info2 = env.step(0)
        assert isinstance(reward, float)
        assert isinstance(terminated, bool)
        assert obs2.shape == obs.shape

    def test_full_episode(self):
        env = build_env(RL_SCHEMA)
        obs, _ = env.reset()
        total_reward = 0.0
        done = False
        steps = 0
        while not done:
            action = env.action_space.sample()
            obs, reward, terminated, truncated, info = env.step(action)
            total_reward += reward
            done = terminated or truncated
            steps += 1
        assert steps > 0
        assert isinstance(total_reward, float)

    def test_obs_normalized(self):
        env = build_env(RL_SCHEMA)
        obs, _ = env.reset()
        for _ in range(5):
            obs, _, done, _, _ = env.step(0)
            if done:
                break
        assert np.all(obs >= 0.0)
        assert np.all(obs <= 1.0)

    def test_fallback_without_rl_nodes(self):
        """Without RL blocks, build_env should raise ValueError."""
        schema = {
            "nodes": [
                {"id": "source_1", "type": "source", "data": {
                    "interval": {"dist": "constant", "params": {"value": 2.0}}
                }},
                {"id": "buffer_1", "type": "buffer", "data": {"capacity": 20}},
                {"id": "machine_1", "type": "machine", "data": {
                    "processing_time": {"dist": "constant", "params": {"value": 3.0}},
                    "count": 1, "mtbf": 100, "mttr": 5,
                }},
                {"id": "sink_1", "type": "sink", "data": {"label": "Выход"}},
            ],
            "edges": [
                {"source": "source_1", "target": "buffer_1"},
                {"source": "buffer_1", "target": "machine_1"},
                {"source": "machine_1", "target": "sink_1"},
            ],
        }
        with pytest.raises(ValueError):
            build_env(schema)
