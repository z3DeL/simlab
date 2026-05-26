import React, { useState, useRef, useCallback, useEffect } from 'react';
import Toolbar from './components/Toolbar';
import FlowCanvas from './components/FlowCanvas';
import CodePanel from './components/CodePanel';
import ResultsPanel from './components/ResultsPanel';
import LabGuide from './components/LabGuide';
import AuthPage from './components/AuthPage';
import TeacherDashboard from './components/TeacherDashboard';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ReactFlowProvider } from '@xyflow/react';
import { AlertCircle, X } from 'lucide-react';

function ErrorToast() {
  const { error, setError } = useProject();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (error) {
      setVisible(true);
      const timer = setTimeout(() => { setVisible(false); setError(null); }, 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!visible || !error) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      maxWidth: '600px', width: '90%', zIndex: 10000,
      display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px 16px',
      borderRadius: 'var(--radius-md)', backgroundColor: 'var(--danger-soft, rgba(255,107,107,0.12))',
      border: '1px solid rgba(255,107,107,0.3)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.5',
    }}>
      <AlertCircle size={18} color="var(--danger, #ff6b6b)" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error}</div>
      <button onClick={() => { setVisible(false); setError(null); }} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0,
        color: 'var(--text-secondary)', marginTop: -2,
      }}><X size={16} /></button>
    </div>
  );
}

function AppContent() {
  const [rightPanelTab, setRightPanelTab] = useState('code'); // 'code', 'results', 'lab'
  const [leftWidthPct, setLeftWidthPct] = useState(60); // percentage for left panel
  const isDragging = useRef(false);
  const containerRef = useRef(null);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftWidthPct(Math.min(Math.max(pct, 20), 80));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  return (
    <div className="app-container">
      <Toolbar />
      <ErrorToast />
      <div className="main-content" ref={containerRef}>
        <div className="left-panel" style={{ flex: 'none', width: `${leftWidthPct}%` }}>
          <FlowCanvas />
        </div>

        {/* Resizable divider */}
        <div
          onMouseDown={onMouseDown}
          style={{
            width: '4px',
            cursor: 'col-resize',
            background: 'var(--border-color)',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--border-color)'}
        />
        
        <div className="right-panel" style={{ flex: 1, minWidth: 0 }}>
          <div className="tabs-header">
            <button 
              className={`tab-btn ${rightPanelTab === 'code' ? 'active' : ''}`}
              onClick={() => setRightPanelTab('code')}
            >
              Редактор кода
            </button>
            <button 
              className={`tab-btn ${rightPanelTab === 'results' ? 'active' : ''}`}
              onClick={() => setRightPanelTab('results')}
            >
              Результаты
            </button>
            <button 
              className={`tab-btn ${rightPanelTab === 'lab' ? 'active' : ''}`}
              onClick={() => setRightPanelTab('lab')}
            >
              Методичка
            </button>
          </div>
          
          <div className="tab-content">
            {rightPanelTab === 'code' && <CodePanel />}
            {rightPanelTab === 'results' && <ResultsPanel />}
            {rightPanelTab === 'lab' && <LabGuide />}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary, #0d1117)', color: 'var(--text-secondary, #8b949e)',
        fontSize: 15,
      }}>
        Загрузка...
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (user.role === 'teacher') {
    return <TeacherDashboard />;
  }

  return (
    <ProjectProvider>
      <ReactFlowProvider>
        <AppContent />
      </ReactFlowProvider>
    </ProjectProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
