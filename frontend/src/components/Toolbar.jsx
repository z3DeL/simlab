import React from 'react';
import { createPortal } from 'react-dom';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { Zap, PlayCircle, Bot, Trash2, ChevronDown, LogOut } from 'lucide-react';

export default function Toolbar() {
  const { 
    project, 
    projects, 
    setProject, 
    switchProject,
    createProject,
    createProjectFromLab,
    deleteProject,
    updateProject, 
    generateCode, 
    runSimulation, 
    runRL, 
    isLoading,
    isTraining,
    liveLogs
  } = useProject();
  const { user, logout } = useAuth();

  const [simTime, setSimTime] = React.useState(480);
  const [showLogs, setShowLogs] = React.useState(false);

  // Открываем оверлей когда стартует обучение
  React.useEffect(() => {
    if (isTraining) setShowLogs(true);
  }, [isTraining]);

  if (!project) return <div className="toolbar"><span style={{ color: 'var(--text-muted)' }}>Загрузка...</span></div>;

  return (
    <div className="toolbar">
      {/* Left: Branding + Project */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          fontSize: '16px', fontWeight: 700, 
          background: 'linear-gradient(135deg, var(--accent), #a78bfa)', 
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.5px'
        }}>
          SimLab
        </div>
        
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />
        
        <select 
          className="select-field" 
          value={project.id} 
          onChange={(e) => {
            if (e.target.value === 'new') createProject('Новый проект');
            else if (e.target.value === 'from_lab') createProjectFromLab();
            else {
              const p = projects.find(p => p.id === parseInt(e.target.value));
              if (p) switchProject(p);
            }
          }}
          style={{ width: '180px', padding: '5px 10px', fontSize: '12.5px' }}
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
          <option value="new">+ Пустой проект</option>
          <option value="from_lab">+ Из лабораторной</option>
        </select>
        
        <input 
          type="text" 
          className="input-field" 
          value={project.name} 
          onChange={(e) => updateProject({ name: e.target.value })}
          style={{ width: '200px', padding: '5px 10px', fontSize: '12.5px' }}
        />

        <button
          className="btn"
          title="Удалить проект"
          onClick={() => {
            if (window.confirm(`Удалить проект «${project.name}»?`)) {
              deleteProject(project.id);
            }
          }}
          disabled={isLoading || isTraining}
          style={{ color: 'var(--danger)', borderColor: 'var(--danger-soft)', padding: '5px 7px' }}
        >
          <Trash2 size={14} />
        </button>

        {project.grade != null && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
            background: 'rgba(234,179,8,0.15)', color: '#eab308',
            whiteSpace: 'nowrap',
          }}
            title={project.grade_comment || ''}
          >
            Оценка: {project.grade}/10
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button className="btn" onClick={generateCode} disabled={isLoading || isTraining} style={{ fontSize: '12.5px' }}>
          <Zap size={14} /> Код
        </button>
        
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />
        
        <input 
          type="number" 
          value={simTime}
          onChange={(e) => setSimTime(Number(e.target.value))}
          className="input-field"
          style={{ width: '64px', padding: '5px 8px', fontSize: '12px', textAlign: 'center' }}
          title="Время симуляции (мин)"
        />
        <button className="btn btn-primary" onClick={() => runSimulation(simTime)} disabled={isLoading || isTraining} style={{ fontSize: '12.5px' }}>
          {isLoading ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <PlayCircle size={14} />} 
          Симуляция
        </button>
        
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />
        
        <button 
          className="btn" 
          onClick={() => runRL()} 
          disabled={isLoading || isTraining} 
          style={{ 
            borderColor: 'rgba(234, 179, 8, 0.3)', 
            color: 'var(--color-rl-reward)',
            fontSize: '12.5px'
          }}
        >
          {isTraining ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderLeftColor: 'var(--color-rl-reward)' }} /> : <Bot size={14} />}
          RL Агент
        </button>

        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {user?.full_name || user?.username}
        </span>
        <button
          className="btn"
          onClick={logout}
          title="Выйти"
          style={{ padding: '5px 7px', color: 'var(--text-secondary)' }}
        >
          <LogOut size={14} />
        </button>
      </div>

      {/* Training overlay — rendered via portal to escape stacking context */}
      {showLogs && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{
            width: '80%', maxWidth: '800px', height: '520px',
            backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', 
            border: '1px solid var(--border-color)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
          }}>
            <div style={{ 
              backgroundColor: 'var(--bg-secondary)', padding: '14px 20px', 
              borderBottom: '1px solid var(--border-color)', 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderLeftColor: 'var(--color-rl-reward)' }} />
                <span style={{ fontSize: '13px', fontWeight: '600', letterSpacing: '0.3px', color: 'var(--color-rl-reward)' }}>Обучение RL-агента</span>
              </div>
              {isTraining
                ? <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Не закрывайте вкладку</span>
                : <button onClick={() => setShowLogs(false)} style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', padding: '4px 12px', cursor: 'pointer', fontSize: '12px' }}>Закрыть</button>
              }
            </div>
            <div 
              style={{ 
                flex: 1, padding: '16px 20px', overflowY: 'auto', 
                fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', 
                color: 'var(--success)', lineHeight: '1.7',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                backgroundColor: 'var(--bg-surface)'
              }}
              ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
            >
              {liveLogs || '> Ожидание запуска...'}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
