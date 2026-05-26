import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, AlertCircle } from 'lucide-react';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password, fullName, role);
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary, #0d1117)',
      fontFamily: 'var(--font-family, Inter, system-ui, sans-serif)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        padding: '40px 32px',
        borderRadius: 'var(--radius-lg, 12px)',
        background: 'var(--bg-secondary, #161b22)',
        border: '1px solid var(--border-color, #30363d)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{
            fontSize: 26, fontWeight: 700,
            color: 'var(--text-primary, #e6edf3)',
            margin: '0 0 4px',
          }}>
            SimLab
          </h1>
          <p style={{
            fontSize: 13, color: 'var(--text-secondary, #8b949e)', margin: 0,
          }}>
            Платформа имитационного моделирования
          </p>
        </div>

        {/* Переключатель Вход / Регистрация */}
        <div style={{
          display: 'flex', gap: 0, marginBottom: 24,
          borderRadius: 'var(--radius-md, 8px)',
          border: '1px solid var(--border-color, #30363d)',
          overflow: 'hidden',
        }}>
          {[
            { key: true, label: 'Вход' },
            { key: false, label: 'Регистрация' },
          ].map(({ key, label }) => (
            <button
              key={String(key)}
              onClick={() => { setIsLogin(key); setError(''); }}
              style={{
                flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 500, transition: 'all 0.15s',
                background: isLogin === key
                  ? 'var(--accent, #58a6ff)' : 'transparent',
                color: isLogin === key
                  ? '#fff' : 'var(--text-secondary, #8b949e)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Полное имя</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Логин</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="login"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={inputStyle}
            />
          </div>


          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', marginBottom: 16,
              borderRadius: 'var(--radius-md, 8px)',
              background: 'rgba(255,107,107,0.1)',
              border: '1px solid rgba(255,107,107,0.25)',
              color: '#ff6b6b', fontSize: 13,
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', border: 'none',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--accent, #58a6ff)',
              color: '#fff', fontSize: 15, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'opacity 0.15s',
            }}
          >
            {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
            {loading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться')}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block', marginBottom: 5,
  fontSize: 13, fontWeight: 500,
  color: 'var(--text-secondary, #8b949e)',
};

const inputStyle = {
  width: '100%', padding: '10px 12px',
  borderRadius: 'var(--radius-md, 8px)',
  border: '1px solid var(--border-color, #30363d)',
  background: 'var(--bg-primary, #0d1117)',
  color: 'var(--text-primary, #e6edf3)',
  fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};
