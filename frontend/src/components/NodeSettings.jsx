import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

function CodeModal({ code, onSave, onClose }) {
  const [draft, setDraft] = useState(code);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = draft.substring(0, start) + '    ' + draft.substring(end);
      setDraft(newVal);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 4; });
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        width: '80vw', height: '80vh',
        background: 'var(--bg-secondary)',
        borderRadius: '8px', border: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-panel)', flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-primary)' }}>
            Код блока — Python
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { onSave(draft); onClose(); }} style={{
              padding: '6px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer',
              background: '#6c63ff', color: '#fff', fontSize: '13px', fontWeight: 600,
            }}>Сохранить</button>
            <button onClick={onClose} style={{
              padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-color)',
              background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px',
            }}>Закрыть</button>
          </div>
        </div>
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          style={{
            flex: 1, resize: 'none', border: 'none', outline: 'none',
            fontFamily: '"Fira Code", "JetBrains Mono", "Courier New", monospace',
            fontSize: '13px', lineHeight: 1.6, padding: '16px',
            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            tabSize: 4, whiteSpace: 'pre', overflowX: 'auto', overflowY: 'auto',
            wordBreak: 'keep-all', overflowWrap: 'normal',
          }}
        />
      </div>
    </div>,
    document.body
  );
}

export default function NodeSettings({ node, nodes = [], updateNode, style = {} }) {
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  if (!node) return null;

  const handleChange = (field, value) => {
    updateNode(node.id, field, value);
  };

  const getLabel = (id) => {
    const n = nodes.find(n => n.id === id);
    if (!n) return id;
    if (n.data?.label) return n.data.label;
    if (n.type === 'custom' && n.data?.name) return n.data.name;
    return n.type.charAt(0).toUpperCase() + n.type.slice(1);
  };

  const renderTypeSpecificFields = () => {
    switch (node.type) {
      case 'source':
        return (
          <>
            <div className="form-group">
              <label>Распределение</label>
              <select 
                className="select-field"
                value={node.data?.interval?.dist || 'exponential'}
                onChange={e => handleChange('interval.dist', e.target.value)}
              >
                <option value="exponential">Экспоненциальное</option>
                <option value="normal">Нормальное</option>
                <option value="uniform">Равномерное</option>
                <option value="constant">Константа</option>
              </select>
            </div>
            {node.data?.interval?.dist === 'exponential' && (
              <div className="form-group">
                <label>λ (Лямбда)</label>
                <input 
                  type="number" className="input-field" step="0.1"
                  value={node.data?.interval?.params?.lam || 1.0}
                  onChange={e => handleChange('interval.params.lam', parseFloat(e.target.value))}
                />
              </div>
            )}
            {node.data?.interval?.dist === 'normal' && (
              <>
                <div className="form-group">
                  <label>μ (Мат. ожидание)</label>
                  <input 
                    type="number" className="input-field" step="0.1"
                    value={node.data?.interval?.params?.mu || 5.0}
                    onChange={e => handleChange('interval.params.mu', parseFloat(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>σ (Откл.)</label>
                  <input 
                    type="number" className="input-field" step="0.1"
                    value={node.data?.interval?.params?.sigma || 1.0}
                    onChange={e => handleChange('interval.params.sigma', parseFloat(e.target.value))}
                  />
                </div>
              </>
            )}
            {node.data?.interval?.dist === 'uniform' && (
              <>
                <div className="form-group">
                  <label>a (мин)</label>
                  <input 
                    type="number" className="input-field" step="0.1"
                    value={node.data?.interval?.params?.a || 1.0}
                    onChange={e => handleChange('interval.params.a', parseFloat(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>b (макс)</label>
                  <input 
                    type="number" className="input-field" step="0.1"
                    value={node.data?.interval?.params?.b || 5.0}
                    onChange={e => handleChange('interval.params.b', parseFloat(e.target.value))}
                  />
                </div>
              </>
            )}
            {node.data?.interval?.dist === 'constant' && (
              <div className="form-group">
                <label>Значение</label>
                <input 
                  type="number" className="input-field" step="0.1"
                  value={node.data?.interval?.params?.value || 1.0}
                  onChange={e => handleChange('interval.params.value', parseFloat(e.target.value))}
                />
              </div>
            )}
          </>
        );
      case 'queue':
      case 'buffer':  // backward compat
        return (
          <div className="form-group">
            <label>Вместимость</label>
            <input 
              type="number" className="input-field"
              value={node.data?.capacity || 20}
              onChange={e => handleChange('capacity', parseInt(e.target.value, 10))}
            />
          </div>
        );
      case 'server':
      case 'machine':  // backward compat
        return (
          <>
            <div className="form-group">
              <label>Количество каналов</label>
              <input 
                type="number" className="input-field"
                value={node.data?.count || 1}
                onChange={e => handleChange('count', parseInt(e.target.value, 10))}
              />
            </div>
            <div className="form-group">
              <label>Распределение (время)</label>
              <select 
                className="select-field"
                value={node.data?.processing_time?.dist || 'normal'}
                onChange={e => handleChange('processing_time.dist', e.target.value)}
              >
                <option value="normal">Нормальное</option>
                <option value="exponential">Экспоненциальное</option>
                <option value="constant">Константа</option>
              </select>
            </div>
            <div className="form-group">
              <label>Ср. время обслуживания (μ / Знач / λ)</label>
              <input 
                type="number" className="input-field" step="0.1"
                value={node.data?.processing_time?.params?.mu || node.data?.processing_time?.params?.value || node.data?.processing_time?.params?.lam || 5.0}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  const dist = node.data?.processing_time?.dist || 'normal';
                  if (dist === 'normal') handleChange('processing_time.params.mu', val);
                  else if (dist === 'constant') handleChange('processing_time.params.value', val);
                  else handleChange('processing_time.params.lam', val);
                }}
              />
            </div>
            {node.data?.processing_time?.dist === 'normal' && (
              <div className="form-group">
                <label>σ (Отклонение)</label>
                <input 
                  type="number" className="input-field" step="0.1"
                  value={node.data?.processing_time?.params?.sigma || 1.0}
                  onChange={e => handleChange('processing_time.params.sigma', parseFloat(e.target.value))}
                />
              </div>
            )}
          </>
        );
      case 'branch':
      case 'inspector': {  // backward compat
        const branchOutputs = node.data?.outputs || 2;
        const branchWeights = node.data?.weights || [0.9, 0.1];
        const branchMode = node.data?.mode || 'probability';
        return (
          <>
            <div className="form-group">
              <label>Режим маршрутизации</label>
              <select
                className="select-field"
                value={branchMode}
                onChange={e => handleChange('mode', e.target.value)}
              >
                <option value="probability">Вероятностный</option>
                <option value="round_robin">Round-robin</option>
              </select>
            </div>
            <div className="form-group">
              <label>Количество выходов</label>
              <input
                type="number" className="input-field" min="2" max="6" step="1"
                value={branchOutputs}
                onChange={e => handleChange('outputs', Math.max(2, Math.min(6, parseInt(e.target.value) || 2)))}
              />
            </div>
            <div className="form-group">
              <label>Время обслуживания</label>
              <input
                type="number" className="input-field" step="0.1" min="0"
                value={node.data?.service_time ?? 0}
                onChange={e => handleChange('service_time', parseFloat(e.target.value))}
              />
            </div>
            {branchMode === 'probability' && (
              <div className="form-group">
                <label>Веса выходов (сумма нормируется)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  {Array.from({ length: branchOutputs }, (_, i) => (
                    <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '50px' }}>Выход {i}</span>
                      <input
                        type="number" className="input-field" step="0.05" min="0" max="1"
                        style={{ flex: 1 }}
                        value={(branchWeights[i] ?? (1 / branchOutputs)).toFixed(2)}
                        onChange={e => {
                          const newW = [...branchWeights];
                          while (newW.length < branchOutputs) newW.push(0);
                          newW[i] = parseFloat(e.target.value) || 0;
                          handleChange('weights', newW.slice(0, branchOutputs));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      }
      case 'sink':
        return null; // Только название (уже в общем поле)
      case 'gate':
        return (
          <>
            <div className="form-group">
              <label>Количество полос</label>
              <input
                type="number" className="input-field" min="1" max="5" step="1"
                value={node.data?.inputs || 2}
                onChange={e => handleChange('inputs', Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div className="form-group">
              <label>Длительности фаз (s, через пробел)</label>
              <input
                type="text" className="input-field"
                defaultValue={(node.data?.phase_times || [30, 20]).join(' ')}
                key={node.id}
                onBlur={e => {
                  const vals = e.target.value.trim().split(/\s+/).map(Number).filter(n => n > 0);
                  if (vals.length > 0) handleChange('phase_times', vals);
                }}
              />
            </div>
            <div className="form-group">
              <label>Время проезда (s)</label>
              <input
                type="number" className="input-field" step="0.5" min="0.5"
                value={node.data?.pass_time || 2.0}
                onChange={e => handleChange('pass_time', parseFloat(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>Жёлтая фаза — штраф за переключение (s)</label>
              <input
                type="number" className="input-field" step="0.5" min="0"
                value={node.data?.switch_cost ?? 3.0}
                onChange={e => handleChange('switch_cost', parseFloat(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>Мин. время зелёного (s)</label>
              <input
                type="number" className="input-field" step="1" min="0"
                value={node.data?.min_green_time ?? 10.0}
                onChange={e => handleChange('min_green_time', parseFloat(e.target.value))}
              />
            </div>
          </>
        );
      case 'custom': {
        const outputs = node.data?.outputs || 1;
        const inputs = node.data?.inputs || 1;
        const defaultCode =
          `class MyBlock(ServerBlock):\n` +
          `    def _work(self):\n` +
          `        while True:\n` +
          `            entity = yield self.in_stores[0].get()\n` +
          `            yield self.env.timeout(1.0)\n` +
          `            self.total_processed += 1\n` +
          `            yield self.out_stores[0].put(entity)\n` +
          `\n` +
          `    def get_metrics(self):\n` +
          `        return {"total_processed": self.total_processed}`;
        return (
          <>
            <div className="form-group">
              <label>Количество входов</label>
              <input
                type="number" className="input-field" min="1" max="5" step="1"
                value={inputs}
                onChange={e => handleChange('inputs', Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
              />
            </div>
            <div className="form-group">
              <label>Количество выходов</label>
              <input
                type="number" className="input-field" min="1" max="5" step="1"
                value={outputs}
                onChange={e => handleChange('outputs', Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Код блока</span>
                <button
                  onClick={() => setCodeModalOpen(true)}
                  style={{
                    fontSize: '11px', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer',
                    background: 'var(--color-primary, #6c63ff)', color: '#fff',
                    border: 'none', lineHeight: 1.5,
                  }}
                >⛶ Развернуть</button>
              </label>
              <textarea
                className="input-field"
                style={{ minHeight: '160px', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.5 }}
                value={node.data?.code || defaultCode}
                onChange={e => handleChange('code', e.target.value)}
                spellCheck={false}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block', lineHeight: 1.5 }}>
                {`Наследуй ServerBlock, MergeBlock, BranchBlock и т.д. Переопредели _work() или _collect()`}
              </span>
            </div>
            {codeModalOpen && (
              <CodeModal
                code={node.data?.code || defaultCode}
                onSave={code => handleChange('code', code)}
                onClose={() => setCodeModalOpen(false)}
              />
            )}
          </>
        );
      }
      case 'rl_observation':
        return (
          <div className="form-group">
             <label>Наблюдаемая метрика целевого блока</label>
             <select 
                className="select-field"
                value={node.data?.metric || 'level'}
                onChange={e => handleChange('metric', e.target.value)}
             >
                <option value="level">Уровень буфера (level)</option>
                <option value="utilization">Загрузка (utilization)</option>
                <option value="wear">Износ (wear)</option>
                <option value="is_working">Работает ли (is_working)</option>
                <option value="is_open">Затвор открыт (is_open)</option>
                <option value="total_passed">Пропущено (total_passed)</option>
                <option value="total_blocked">Заблокировано (total_blocked)</option>
                <option value="breakdowns">Поломки (breakdowns)</option>
             </select>
          </div>
        );
      case 'rl_action': {
        const actionValues = node.data?.values || ['noop'];
        return (
          <>
            <div className="form-group">
               <label>Тип действия</label>
               <select 
                  className="select-field"
                  value={node.data?.action_type || 'Maintain'}
                  onChange={e => handleChange('action_type', e.target.value)}
               >
                  <option value="Maintain">Профилактика (Maintain)</option>
                  <option value="Lane">Полоса (Lane)</option>
                  <option value="Custom">Custom</option>
               </select>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Список действий (values)
                <button
                  onClick={() => handleChange('values', [...actionValues, ''])}
                  style={{ background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}
                >
                  + Добавить
                </button>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {actionValues.map((val, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '20px' }}>{idx}</span>
                    <input
                      type="text" className="input-field"
                      style={{ flex: 1, padding: '4px 8px', fontSize: '12px', fontFamily: 'monospace' }}
                      value={val}
                      placeholder="напр. noop, maintain_weld1"
                      onChange={e => {
                        const newVals = [...actionValues];
                        newVals[idx] = e.target.value;
                        handleChange('values', newVals);
                      }}
                    />
                    <button
                      onClick={() => {
                        const newVals = actionValues.filter((_, i) => i !== idx);
                        handleChange('values', newVals.length ? newVals : ['noop']);
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--color-sink)', cursor: 'pointer', padding: '0 4px', fontSize: '18px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px', display: 'block', lineHeight: 1.4 }}>
                Индекс = номер действия для агента. Напр.: 0=noop, 1=maintain_weld1, 2=maintain_paint1, 3=maintain_all
              </span>
            </div>
          </>
        );
      }
      case 'rl_reward':
        const weights = node.data?.weights || {};
        const availableNodes = nodes.filter(n => ['sink', 'server', 'machine', 'queue', 'buffer', 'branch', 'inspector'].includes(n.type));

        return (
          <>
            <div className="form-group">
               <label>Режим Reward</label>
               <select 
                  className="select-field"
                  value={node.data?.mode || 'formula'}
                  onChange={e => handleChange('mode', e.target.value)}
               >
                  <option value="formula">Формула (взвешенная сумма)</option>
                  <option value="code">Python код</option>
               </select>
            </div>

            {node.data?.mode === 'formula' ? (
              <div className="form-group">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Веса компонентов
                  <select 
                    className="select-field"
                    style={{ width: 'auto', padding: '2px 4px', fontSize: '11px' }}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleChange('weights', { ...weights, [e.target.value]: 1.0 });
                      }
                    }}
                    value=""
                  >
                    <option value="" disabled>Добавить блок...</option>
                    <option value="action_penalty">Штраф за действия (action_penalty)</option>
                    {availableNodes.map(n => (
                      <option key={n.id} value={n.id}>{getLabel(n.id)} ({n.id})</option>
                    ))}
                  </select>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                  {Object.entries(weights).map(([bid, w]) => (
                    <div key={bid} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                        <span style={{ fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bid === 'action_penalty' ? 'Штраф за действия' : getLabel(bid)}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.6 }}>{bid}</span>
                      </div>
                      <input 
                        type="number" step="0.1" className="input-field" 
                        style={{ width: '60px', padding: '2px 4px', textAlign: 'right' }}
                        value={w}
                        onChange={e => handleChange('weights', { ...weights, [bid]: parseFloat(e.target.value) })}
                      />
                      <button 
                        onClick={() => {
                          const newWeights = { ...weights };
                          delete newWeights[bid];
                          handleChange('weights', newWeights);
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-sink)', cursor: 'pointer', padding: '0 4px', fontSize: '18px' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {Object.keys(weights).length === 0 && (
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>
                      Выберите блок из выпадающего списка выше, чтобы назначить ему вес награды.
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label>Python код награды</label>
                <textarea 
                  className="input-field"
                  style={{ minHeight: '130px', fontFamily: 'monospace', fontSize: '12px' }}
                  value={node.data?.code || 'reward = after["sink_1"]["total_received"] * 1.0'}
                  onChange={e => handleChange('code', e.target.value)}
                  placeholder="reward = (after['s1']['total_received'] - before['s1']['total_received']) * 1.0"
                />
              </div>
            )}
          </>
        );
      case 'router': {
        const routerOutputs = node.data?.outputs || 2;
        const routerMode = node.data?.mode || 'round_robin';
        const routerWeights = node.data?.weights || [];
        return (
          <>
            <div className="form-group">
              <label>Режим маршрутизации</label>
              <select
                className="select-field"
                value={routerMode}
                onChange={e => handleChange('mode', e.target.value)}
              >
                <option value="round_robin">Round-robin</option>
                <option value="weighted_random">Взвешенный случайный</option>
              </select>
            </div>
            <div className="form-group">
              <label>Количество выходов</label>
              <input
                type="number" className="input-field" min="2" max="6" step="1"
                value={routerOutputs}
                onChange={e => handleChange('outputs', Math.max(2, Math.min(6, parseInt(e.target.value) || 2)))}
              />
            </div>
            {routerMode === 'weighted_random' && (
              <div className="form-group">
                <label>Веса выходов</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  {Array.from({ length: routerOutputs }, (_, i) => (
                    <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '50px' }}>Выход {i}</span>
                      <input
                        type="number" className="input-field" step="0.1" min="0"
                        style={{ flex: 1 }}
                        value={routerWeights[i] ?? 1.0}
                        onChange={e => {
                          const newW = [...routerWeights];
                          while (newW.length < routerOutputs) newW.push(1.0);
                          newW[i] = parseFloat(e.target.value) || 0;
                          handleChange('weights', newW.slice(0, routerOutputs));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      }
      case 'merge':
        return (
          <div className="form-group">
            <label>Количество входов</label>
            <input
              type="number" className="input-field" min="2" max="6" step="1"
              value={node.data?.inputs || 2}
              onChange={e => handleChange('inputs', Math.max(2, Math.min(6, parseInt(e.target.value) || 2)))}
            />
          </div>
        );
      default:
        return <div>Нет настроек</div>;
    }
  };

  const renderFields = () => {
    return (
      <>
        <div className="form-group">
          <label>Название блока</label>
          <input 
            type="text" className="input-field"
            value={node.data?.label || node.data?.name || ''}
            onChange={e => {
               handleChange('label', e.target.value);
               if (node.type === 'custom') handleChange('name', e.target.value);
            }}
            placeholder={`Введите название (напр. ПРЕСС-1)`}
          />
        </div>
        <div style={{ borderBottom: '1px solid var(--border-color)', margin: '16px 0', opacity: 0.3 }}></div>
        {renderTypeSpecificFields()}
      </>
    );
  };

  const typeLabels = {
    source: 'Источник', buffer: 'Буфер', machine: 'Станок', inspector: 'Инспектор',
    sink: 'Выход', custom: 'Custom блок', rl_observation: 'RL Наблюдение',
    rl_action: 'RL Действие', rl_reward: 'RL Награда',
  };

  const typeColors = {
    source: 'var(--color-source)', buffer: 'var(--color-buffer)', machine: 'var(--color-machine)',
    inspector: 'var(--color-inspector)', sink: 'var(--color-sink)', custom: 'var(--color-custom)',
    rl_observation: 'var(--color-rl-obs)', rl_action: 'var(--color-rl-act)', rl_reward: 'var(--color-rl-reward)',
  };

  return (
    <div style={{
      position: 'absolute', width: 280,
      backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)',
      maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
      background: 'var(--bg-secondary)',
      backdropFilter: 'blur(16px)',
      ...style,
    }}>
      <div style={{ 
        padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', gap: '8px'
      }}>
        <div style={{ 
          width: 8, height: 8, borderRadius: '50%', 
          backgroundColor: typeColors[node.type] || 'var(--text-muted)' 
        }} />
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {typeLabels[node.type] || node.type}
        </span>
      </div>
      <div style={{ padding: '14px 16px' }}>
        {renderFields()}
      </div>
    </div>
  );
}
