import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Users, BookOpen, ChevronDown, ChevronRight, LogOut, Eye, Plus, Pencil, Trash2, Save, X, Star, MessageSquare, ArrowLeft } from 'lucide-react';
import ReadOnlyFlow from './ReadOnlyFlow';

export default function TeacherDashboard({ onViewProject }) {
  const { user, logout } = useAuth();
  const [students, setStudents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [labWorks, setLabWorks] = useState([]);
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [activeTab, setActiveTab] = useState('students');
  const [editingLab, setEditingLab] = useState(null);
  const [labForm, setLabForm] = useState({ title: '', description_md: '', order: 0, default_schema_json: {} });
  const [viewingProject, setViewingProject] = useState(null);
  const [gradeInput, setGradeInput] = useState('');
  const [gradeComment, setGradeComment] = useState('');
  const [gradeSaving, setGradeSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [studentsRes, projectsRes, labsRes] = await Promise.all([
        api.get('/auth/users'),
        api.get('/projects/'),
        api.get('/lab_works/'),
      ]);
      setStudents(studentsRes.data);
      setProjects(projectsRes.data);
      setLabWorks(labsRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    }
  };

  const getStudentProjects = (studentId) =>
    projects.filter((p) => p.user_id === studentId);

  const openProject = async (proj) => {
    try {
      const { data } = await api.get(`/projects/${proj.id}`);
      setViewingProject(data);
      setGradeInput(data.grade != null ? String(data.grade) : '');
      setGradeComment(data.grade_comment || '');
    } catch (err) {
      console.error('Failed to load project', err);
    }
  };

  const saveGrade = async () => {
    if (!viewingProject) return;
    const g = parseInt(gradeInput, 10);
    if (isNaN(g) || g < 1 || g > 10) { alert('Оценка должна быть от 1 до 10'); return; }
    setGradeSaving(true);
    try {
      const { data } = await api.post(`/projects/${viewingProject.id}/grade`, { grade: g, comment: gradeComment });
      setViewingProject(data);
      setProjects(prev => prev.map(p => p.id === data.id ? { ...p, grade: data.grade, grade_comment: data.grade_comment } : p));
    } catch (err) {
      console.error('Failed to save grade', err);
    } finally {
      setGradeSaving(false);
    }
  };

  const getStudentName = (userId) => {
    const s = students.find(s => s.id === userId);
    return s ? (s.full_name || s.username) : `Студент #${userId}`;
  };

  const startEditLab = (lab) => {
    setEditingLab(lab.id);
    setLabForm({
      title: lab.title,
      description_md: lab.description_md,
      order: lab.order,
      default_schema_json: lab.default_schema_json,
    });
  };

  const startCreateLab = () => {
    setEditingLab('new');
    setLabForm({ title: '', description_md: '', order: labWorks.length + 1, default_schema_json: {} });
  };

  const cancelEdit = () => {
    setEditingLab(null);
  };

  const saveLab = async () => {
    try {
      if (editingLab === 'new') {
        await api.post('/lab_works/', labForm);
      } else {
        await api.put(`/lab_works/${editingLab}`, labForm);
      }
      setEditingLab(null);
      const { data } = await api.get('/lab_works/');
      setLabWorks(data);
    } catch (err) {
      console.error('Failed to save lab work', err);
    }
  };

  const deleteLab = async (id) => {
    if (!window.confirm('Удалить лабораторную работу?')) return;
    try {
      await api.delete(`/lab_works/${id}`);
      setLabWorks(labWorks.filter((l) => l.id !== id));
    } catch (err) {
      console.error('Failed to delete lab work', err);
    }
  };

  // ────────── Просмотр проекта студента ──────────
  if (viewingProject) {
    const vp = viewingProject;
    const hasSimResults = !!vp.sim_results_json?.metrics_json;
    const hasRlResults = !!vp.rl_results_json?.metrics_json;

    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-primary, #0d1117)',
        color: 'var(--text-primary, #e6edf3)',
        fontFamily: 'var(--font-family, Inter, system-ui, sans-serif)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px',
          background: 'var(--bg-secondary, #161b22)',
          borderBottom: '1px solid var(--border-color, #30363d)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setViewingProject(null)} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', border: '1px solid var(--border-color)',
              borderRadius: 6, background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
            }}>
              <ArrowLeft size={14} /> Назад
            </button>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{vp.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {getStudentName(vp.user_id)}
            </span>
          </div>
        </div>

        <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
          {/* Оценка */}
          <div style={{
            padding: 20, marginBottom: 20,
            border: '1px solid var(--border-color, #30363d)',
            borderRadius: 8, background: 'var(--bg-secondary, #161b22)',
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={16} color="#eab308" /> Оценка проекта
            </h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={formLabel}>Балл (1–10)</label>
                <input
                  type="number" min="1" max="10"
                  value={gradeInput}
                  onChange={e => setGradeInput(e.target.value)}
                  style={{ ...formInput, width: 80 }}
                  placeholder="—"
                />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={formLabel}>Комментарий</label>
                <input
                  type="text"
                  value={gradeComment}
                  onChange={e => setGradeComment(e.target.value)}
                  style={formInput}
                  placeholder="Необязательный комментарий..."
                />
              </div>
              <button onClick={saveGrade} disabled={gradeSaving} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', border: 'none', borderRadius: 6,
                background: '#eab308', color: '#000',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                opacity: gradeSaving ? 0.6 : 1,
              }}>
                <Save size={14} /> {gradeSaving ? 'Сохранение...' : 'Поставить оценку'}
              </button>
            </div>
            {vp.grade != null && (
              <div style={{
                marginTop: 12, padding: '8px 14px', borderRadius: 6,
                background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)',
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
              }}>
                <Star size={14} color="#eab308" />
                <span style={{ fontWeight: 600 }}>Текущая оценка: {vp.grade}/10</span>
                {vp.grade_comment && (
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                    — {vp.grade_comment}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Статус */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <StatusBadge ok={hasSimResults} label="Симуляция выполнена" />
            <StatusBadge ok={hasRlResults && !vp.rl_results_json?.metrics_json?.error} label="RL-агент обучен" />
            <StatusBadge ok={!!vp.rl_code?.trim()} label="RL-код написан" />
            <StatusBadge ok={(vp.schema_json?.nodes?.length || 0) > 0} label="Схема собрана" />
          </div>

          {/* Схема модели — визуальное отображение */}
          <CollapsibleSection title={`Схема модели (${vp.schema_json?.nodes?.length || 0} блоков, ${vp.schema_json?.edges?.length || 0} связей)`} defaultOpen={true}>
            <ReadOnlyFlow schemaJson={vp.schema_json} />
          </CollapsibleSection>

          {/* Результаты симуляции */}
          {hasSimResults && (
            <CollapsibleSection title="Результаты симуляции" defaultOpen={true}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {Object.entries(vp.sim_results_json.metrics_json).map(([blockId, metrics]) => (
                  <div key={blockId} style={{
                    padding: 10, borderRadius: 6,
                    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--accent)' }}>
                      {blockId}
                    </div>
                    {Object.entries(metrics).filter(([k]) => k !== 'label' && k !== 'id').map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                        <span style={{ fontWeight: 500 }}>{typeof v === 'number' ? (v % 1 ? v.toFixed(3) : v) : String(v)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Результаты RL */}
          {hasRlResults && !vp.rl_results_json.metrics_json.error && (
            <CollapsibleSection title="Результаты RL-агента" defaultOpen={true}>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>Эпизодов: </span>
                {vp.rl_results_json.metrics_json.episodes_trained || '—'}
              </div>
              {vp.rl_results_json.metrics_json.baseline && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {Object.entries(vp.rl_results_json.metrics_json.baseline).map(([blockId, baseMetrics]) => {
                    const rlMetrics = vp.rl_results_json.metrics_json.with_rl?.[blockId] || {};
                    return (
                      <div key={blockId} style={{
                        padding: 10, borderRadius: 6,
                        background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#a78bfa' }}>{blockId}</div>
                        {Object.keys({ ...baseMetrics, ...rlMetrics }).filter(k => k !== 'label' && k !== 'id').map(k => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                            <span>
                              <span style={{ opacity: 0.5 }}>{baseMetrics[k] !== undefined ? (typeof baseMetrics[k] === 'number' && baseMetrics[k] % 1 ? baseMetrics[k].toFixed(2) : baseMetrics[k]) : '—'}</span>
                              <span style={{ margin: '0 4px', opacity: 0.3 }}>→</span>
                              <span style={{ fontWeight: 600 }}>{rlMetrics[k] !== undefined ? (typeof rlMetrics[k] === 'number' && rlMetrics[k] % 1 ? rlMetrics[k].toFixed(2) : rlMetrics[k]) : '—'}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </CollapsibleSection>
          )}

          {/* Код Custom-блоков */}
          {(() => {
            const customNodes = (vp.schema_json?.nodes || []).filter(n => n.type === 'custom' && n.data?.code?.trim());
            if (customNodes.length === 0) return null;
            return (
              <CollapsibleSection title={`Пользовательский код (${customNodes.length} блок${customNodes.length > 1 ? 'а' : ''})`} defaultOpen={true}>
                {customNodes.map(n => (
                  <div key={n.id} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--accent)' }}>
                      {n.data.name || n.data.label || n.id}
                    </div>
                    <pre style={{
                      background: 'var(--bg-primary)', padding: 14, borderRadius: 6,
                      fontSize: 12, lineHeight: 1.6, overflowX: 'auto', maxHeight: 400,
                      border: '1px solid var(--border-color)',
                      fontFamily: "'JetBrains Mono', monospace", margin: 0,
                    }}>{n.data.code}</pre>
                  </div>
                ))}
              </CollapsibleSection>
            );
          })()}

          {/* RL-код студента */}
          {vp.rl_code?.trim() && (
            <CollapsibleSection title="RL-код студента" defaultOpen={false}>
              <pre style={{
                background: 'var(--bg-primary)', padding: 14, borderRadius: 6,
                fontSize: 12, lineHeight: 1.6, overflowX: 'auto', maxHeight: 400,
                border: '1px solid var(--border-color)',
                fontFamily: "'JetBrains Mono', monospace",
              }}>{vp.rl_code}</pre>
            </CollapsibleSection>
          )}

          {/* Сгенерированный код */}
          {vp.generated_code?.trim() && (
            <CollapsibleSection title="Сгенерированный SimPy-код" defaultOpen={false}>
              <pre style={{
                background: 'var(--bg-primary)', padding: 14, borderRadius: 6,
                fontSize: 12, lineHeight: 1.6, overflowX: 'auto', maxHeight: 400,
                border: '1px solid var(--border-color)',
                fontFamily: "'JetBrains Mono', monospace",
              }}>{vp.generated_code}</pre>
            </CollapsibleSection>
          )}
        </div>
      </div>
    );
  }

  // ────────── Главный дашборд ──────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary, #0d1117)',
      color: 'var(--text-primary, #e6edf3)',
      fontFamily: 'var(--font-family, Inter, system-ui, sans-serif)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px',
        background: 'var(--bg-secondary, #161b22)',
        borderBottom: '1px solid var(--border-color, #30363d)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>SimLab</span>
          <span style={{
            fontSize: 11, padding: '2px 8px',
            borderRadius: 10,
            background: 'rgba(88,166,255,0.15)',
            color: 'var(--accent, #58a6ff)',
            fontWeight: 600,
          }}>
            Преподаватель
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary, #8b949e)' }}>
            {user?.full_name || user?.username}
          </span>
          <button onClick={logout} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', border: '1px solid var(--border-color, #30363d)',
            borderRadius: 6, background: 'transparent',
            color: 'var(--text-secondary, #8b949e)', cursor: 'pointer', fontSize: 13,
          }}>
            <LogOut size={14} /> Выйти
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, padding: '0 24px',
        borderBottom: '1px solid var(--border-color, #30363d)',
        background: 'var(--bg-secondary, #161b22)',
      }}>
        {[
          { key: 'students', label: 'Студенты', icon: <Users size={15} /> },
          { key: 'labs', label: 'Лабораторные', icon: <BookOpen size={15} /> },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '12px 20px', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 500, background: 'transparent',
              color: activeTab === key
                ? 'var(--accent, #58a6ff)' : 'var(--text-secondary, #8b949e)',
              borderBottom: activeTab === key
                ? '2px solid var(--accent, #58a6ff)' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        {activeTab === 'students' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
              Студенты ({students.length})
            </h2>
            {students.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                Нет зарегистрированных студентов
              </p>
            )}
            {students.map((student) => {
              const sp = getStudentProjects(student.id);
              const isExpanded = expandedStudent === student.id;
              return (
                <div key={student.id} style={{
                  marginBottom: 8,
                  border: '1px solid var(--border-color, #30363d)',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}>
                  <div
                    onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', cursor: 'pointer',
                      background: 'var(--bg-secondary, #161b22)',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {student.full_name || student.username}
                      </span>
                      <span style={{
                        marginLeft: 10, fontSize: 12,
                        color: 'var(--text-secondary, #8b949e)',
                      }}>
                        @{student.username}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontSize: 12, padding: '2px 8px', borderRadius: 10,
                        background: 'rgba(88,166,255,0.1)',
                        color: 'var(--accent, #58a6ff)',
                      }}>
                        {sp.length} проект(ов)
                      </span>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '8px 16px 12px', background: 'var(--bg-primary, #0d1117)' }}>
                      {sp.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          Нет проектов
                        </p>
                      ) : (
                        sp.map((proj) => (
                          <div key={proj.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', marginBottom: 4,
                            borderRadius: 6,
                            background: 'var(--bg-secondary, #161b22)',
                          }}>
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{proj.name}</span>
                              <span style={{
                                marginLeft: 8, fontSize: 11,
                                color: 'var(--text-secondary)',
                              }}>
                                {proj.sim_results_json ? '✅ симуляция' : ''}
                                {proj.rl_results_json ? ' ✅ RL' : ''}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {proj.grade != null && (
                                <span style={{
                                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                                  background: 'rgba(234,179,8,0.15)', color: '#eab308',
                                }}>
                                  {proj.grade}/10
                                </span>
                              )}
                              <button
                                onClick={() => openProject(proj)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  padding: '4px 10px', border: '1px solid var(--border-color)',
                                  borderRadius: 4, background: 'transparent',
                                  color: 'var(--accent)', cursor: 'pointer', fontSize: 12,
                                }}
                              >
                                <Eye size={13} /> Открыть
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'labs' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                Лабораторные работы ({labWorks.length})
              </h2>
              <button onClick={startCreateLab} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', border: 'none', borderRadius: 6,
                background: 'var(--accent, #58a6ff)', color: '#fff',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
              }}>
                <Plus size={15} /> Добавить
              </button>
            </div>

            {/* Форма редактирования / создания */}
            {editingLab && (
              <div style={{
                padding: 20, marginBottom: 16,
                border: '1px solid var(--accent, #58a6ff)',
                borderRadius: 8,
                background: 'var(--bg-secondary, #161b22)',
              }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={formLabel}>Название</label>
                  <input
                    type="text" value={labForm.title}
                    onChange={(e) => setLabForm({ ...labForm, title: e.target.value })}
                    placeholder="Название лабораторной"
                    style={formInput}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={formLabel}>Порядковый номер</label>
                  <input
                    type="number" value={labForm.order}
                    onChange={(e) => setLabForm({ ...labForm, order: Number(e.target.value) })}
                    style={{ ...formInput, width: 80 }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={formLabel}>Описание (Markdown)</label>
                  <textarea
                    value={labForm.description_md}
                    onChange={(e) => setLabForm({ ...labForm, description_md: e.target.value })}
                    placeholder="# Описание лабораторной работы..."
                    rows={10}
                    style={{ ...formInput, resize: 'vertical', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={formLabel}>Схема по умолчанию (JSON)</label>
                  <textarea
                    value={JSON.stringify(labForm.default_schema_json, null, 2)}
                    onChange={(e) => {
                      try { setLabForm({ ...labForm, default_schema_json: JSON.parse(e.target.value) }); } catch {}
                    }}
                    rows={6}
                    style={{ ...formInput, resize: 'vertical', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveLab} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', border: 'none', borderRadius: 6,
                    background: 'var(--accent, #58a6ff)', color: '#fff',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  }}>
                    <Save size={14} /> Сохранить
                  </button>
                  <button onClick={cancelEdit} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', border: '1px solid var(--border-color, #30363d)',
                    borderRadius: 6, background: 'transparent',
                    color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
                  }}>
                    <X size={14} /> Отмена
                  </button>
                </div>
              </div>
            )}

            {labWorks.map((lab) => (
              <div key={lab.id} style={{
                padding: '14px 16px', marginBottom: 8,
                border: '1px solid var(--border-color, #30363d)',
                borderRadius: 8,
                background: 'var(--bg-secondary, #161b22)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{lab.title}</span>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 10,
                      background: 'rgba(63,185,80,0.12)',
                      color: '#3fb950',
                    }}>
                      №{lab.order}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => startEditLab(lab)} style={iconBtn}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => deleteLab(lab.id)} style={{ ...iconBtn, color: '#ff6b6b' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {lab.description_md && (
                  <p style={{
                    fontSize: 13, color: 'var(--text-secondary)', marginTop: 6,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: 600,
                  }}>
                    {lab.description_md.slice(0, 120)}...
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const formLabel = {
  display: 'block', marginBottom: 5,
  fontSize: 13, fontWeight: 500,
  color: 'var(--text-secondary, #8b949e)',
};

const formInput = {
  width: '100%', padding: '9px 12px',
  borderRadius: 6,
  border: '1px solid var(--border-color, #30363d)',
  background: 'var(--bg-primary, #0d1117)',
  color: 'var(--text-primary, #e6edf3)',
  fontSize: 13, outline: 'none',
  boxSizing: 'border-box',
};

const iconBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 30, border: '1px solid var(--border-color, #30363d)',
  borderRadius: 6, background: 'transparent',
  color: 'var(--text-secondary, #8b949e)', cursor: 'pointer',
};

function StatusBadge({ ok, label }) {
  return (
    <span style={{
      fontSize: 12, padding: '4px 12px', borderRadius: 20,
      background: ok ? 'rgba(63,185,80,0.12)' : 'rgba(139,148,158,0.12)',
      color: ok ? '#3fb950' : 'var(--text-secondary, #8b949e)',
      fontWeight: 500,
    }}>
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}

function CollapsibleSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={{
      marginBottom: 14,
      border: '1px solid var(--border-color, #30363d)',
      borderRadius: 8, overflow: 'hidden',
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', cursor: 'pointer',
          background: 'var(--bg-secondary, #161b22)',
          fontSize: 14, fontWeight: 600,
        }}
      >
        <span>{title}</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </div>
      {open && (
        <div style={{ padding: 14, background: 'var(--bg-primary, #0d1117)' }}>
          {children}
        </div>
      )}
    </div>
  );
}
