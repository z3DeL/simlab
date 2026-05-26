import axios from 'axios';

// В dev-режиме Vite проксирует /api → localhost:8000
// В production FastAPI сам отдаёт фронт, поэтому используем относительный путь
const baseURL = import.meta.env.DEV
  ? 'http://localhost:8000/api'
  : '/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Автоматически подставляем токен из localStorage при каждом запросе
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
