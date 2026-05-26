import React from 'react';
import ReactPlotly from 'react-plotly.js';
import { useProject } from '../context/ProjectContext';
import { BarChart3, AlertCircle, Box, Cpu, Search, LogOut, Layers, ArrowRight } from 'lucide-react';

const Plot = ReactPlotly.default || ReactPlotly;

/* ── Словарь метрик ── */
const METRIC_LABELS = {
  entities_generated: 'Создано деталей',
  current_level: 'Текущий уровень',
  max_level: 'Макс. уровень',
  avg_level: 'Средний уровень',
  total_in: 'Вошло',
  total_out: 'Вышло',
  capacity: 'Ёмкость',
  utilization: 'Загрузка',
  total_processed: 'Обработано',
  breakdowns: 'Поломки',
  downtime: 'Простой',
  wear: 'Износ',
  is_working: 'Работает',
  in_maintenance: 'На обслуживании',
  total_inspected: 'Проверено',
  total_passed: 'Годные',
  total_rejected: 'Брак',
  defect_rate_actual: 'Факт. % брака',
  total_received: 'Получено',
};

const SKIP_METRICS = new Set(['label', 'id', 'is_working', 'in_maintenance']);
const BAD_METRICS = new Set([
  'rejected', 'downtime', 'breakdowns', 'wear', 'defect_rate',  // машины / ОТК
  'scrap', 'repaint',                                             // кастомные
  'current_level', 'max_level', 'avg_level',                      // буферы (больше WIP = хуже)
]);

const BLOCK_ICONS = {
  source: <Box size={15} />,
  buffer: <Layers size={15} />,
  machine: <Cpu size={15} />,
  inspector: <Search size={15} />,
  sink: <LogOut size={15} />,
};
const BLOCK_COLORS = {
  source: '#22c55e',
  buffer: '#6c9fff',
  machine: '#a78bfa',
  inspector: '#fbbf24',
  sink: '#f87171',
};

function metricLabel(key) {
  return METRIC_LABELS[key] || key;
}

function isBadMetric(key) {
  return [...BAD_METRICS].some(b => key.includes(b));
}

function formatValue(val) {
  if (typeof val === 'boolean') return val ? 'Да' : 'Нет';
  if (typeof val === 'number') return val % 1 === 0 ? val : val.toFixed(3);
  return String(val);
}

/* Цвет разницы baseline→rl */
function diffColor(key, base, rl, isWaste) {
  if (typeof base !== 'number' || typeof rl !== 'number') return 'inherit';
  if (base === rl) return 'var(--text-secondary)';
  let bad = isBadMetric(key);
  /* Для «мусорных» узлов любой рост количества = плохо */
  if (!bad && isWaste) bad = true;
  const better = bad ? rl < base : rl > base;
  return better ? 'var(--color-source)' : 'var(--color-sink)';
}

/**
 * Обход графа: находим все узлы, достижимые из reject-выходов инспекторов
 * и из out_1+ кастомных блоков (обычно это ветки брака / переделки).
 * Для них рост любых числовых метрик = ухудшение.
 */
function buildWasteNodes(schema) {
  if (!schema?.nodes || !schema?.edges) return new Set();
  const nodeMap = {};
  schema.nodes.forEach(n => { nodeMap[n.id] = n; });

  // Seed: все ребра из reject-выхода инспектора + out_1+ кастомного блока
  const queue = [];
  schema.edges.forEach(e => {
    const src = nodeMap[e.source];
    if (!src) return;
    if (src.type === 'inspector' && e.sourceHandle === 'reject') queue.push(e.target);
    if (src.type === 'custom' && e.sourceHandle && e.sourceHandle !== 'out_0') queue.push(e.target);
  });

  // BFS по рёбрам (без sourceHandle фильтра — всё что ниже по потоку от брака)
  const waste = new Set(queue);
  const adj = {};
  schema.edges.forEach(e => {
    if (!adj[e.source]) adj[e.source] = [];
    adj[e.source].push(e.target);
  });
  while (queue.length > 0) {
    const cur = queue.shift();
    (adj[cur] || []).forEach(next => {
      if (!waste.has(next)) { waste.add(next); queue.push(next); }
    });
  }
  return waste;
}

export default function ResultsPanel() {
  const { project, simResults, rlResults } = useProject();

  const wasteIds = React.useMemo(
    () => buildWasteNodes(project?.schema_json),
    [project?.schema_json]
  );

  const getBlockInfo = (id) => {
    const node = project?.schema_json?.nodes?.find(n => n.id === id);
    const name = node?.data?.name || node?.data?.label || `${node?.type || 'block'} (${id.split('_')[1] || id})`;
    const type = node?.type || id.split('_')[0];
    return { name, type };
  };

  const plotLayout = (title) => ({
    title: { text: title, font: { color: '#1a1d2e', size: 13, family: 'Inter' } },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#4a5068', family: 'Inter', size: 11 },
    xaxis: { gridcolor: 'rgba(0,0,0,0.07)', zerolinecolor: 'rgba(0,0,0,0.15)', tickfont: { color: '#4a5068' } },
    yaxis: { gridcolor: 'rgba(0,0,0,0.07)', zerolinecolor: 'rgba(0,0,0,0.15)', tickfont: { color: '#4a5068' } },
    height: 260,
    margin: { l: 52, r: 20, t: 40, b: 40 },
    autosize: true,
  });

  /* ── Пустое состояние ── */
  if (!simResults && !rlResults) {
    return (
      <div className="empty-state" style={{ marginTop: '60px' }}>
        <BarChart3 size={40} />
        <p>Запустите симуляцию или обучите RL-агента для просмотра результатов</p>
      </div>
    );
  }

  /* ────────────────── Карточка метрик (sim-only) ────────────────── */
  const SimBlockCard = ({ blockId, metrics }) => {
    const { name, type } = getBlockInfo(blockId);
    const color = BLOCK_COLORS[type] || 'var(--accent)';
    const icon = BLOCK_ICONS[type] || <Box size={15} />;
    const keys = Object.keys(metrics).filter(k => !SKIP_METRICS.has(k));
    if (keys.length === 0) return null;

    return (
      <div className="stat-card">
        <div className="stat-card-header" style={{ borderColor: color }}>
          <span style={{ color, display: 'flex', alignItems: 'center', gap: 6 }}>{icon} {name}</span>
        </div>
        <div className="stat-card-body">
          {keys.map(k => (
            <div key={k} className="stat-row">
              <span className="stat-label">{metricLabel(k)}</span>
              <span className="stat-value">{formatValue(metrics[k])}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ────────────────── Карточка сравнения (RL) ────────────────── */
  const CompareBlockCard = ({ blockId, base, rl, isWaste }) => {
    const { name, type } = getBlockInfo(blockId);
    const color = BLOCK_COLORS[type] || 'var(--accent)';
    const icon = BLOCK_ICONS[type] || <Box size={15} />;

    const allKeys = new Set([...Object.keys(base || {}), ...Object.keys(rl || {})]);
    const keys = [...allKeys].filter(k => !SKIP_METRICS.has(k));
    if (keys.length === 0) return null;

    return (
      <div className="stat-card">
        <div className="stat-card-header" style={{ borderColor: color }}>
          <span style={{ color, display: 'flex', alignItems: 'center', gap: 6 }}>{icon} {name}</span>
        </div>
        <div className="stat-card-body">
          {/* Sub-header */}
          <div className="stat-row stat-row-head">
            <span className="stat-label">Метрика</span>
            <span className="stat-col-base">Без RL</span>
            <span className="stat-col-arrow" />
            <span className="stat-col-rl">С Агентом</span>
          </div>
          {keys.map(k => {
            const bv = base?.[k];
            const rv = rl?.[k];
            return (
              <div key={k} className="stat-row">
                <span className="stat-label">{metricLabel(k)}</span>
                <span className="stat-col-base" style={{ color: 'var(--text-secondary)' }}>
                  {bv !== undefined ? formatValue(bv) : '-'}
                </span>
                <span className="stat-col-arrow" style={{ color: 'var(--text-muted)' }}>
                  <ArrowRight size={12} />
                </span>
                <span className="stat-col-rl" style={{ fontWeight: 600 }}>
                  {rv !== undefined ? formatValue(rv) : '-'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ── Sim-only results ── */
  if (simResults && !rlResults) {
    const { metrics_json, timeseries_json } = simResults;
    if (!metrics_json) return <div style={{ padding: 20 }}>Нет метрик</div>;

    return (
      <div style={{ padding: '20px', overflowY: 'auto', height: '100%' }}>
        <h3 style={{ color: 'var(--accent)', marginBottom: '16px', fontSize: '15px', fontWeight: 700 }}>
          Результаты симуляции
        </h3>
        <div className="stat-cards-grid">
          {Object.entries(metrics_json).map(([blockId, metrics]) => (
            <SimBlockCard key={blockId} blockId={blockId} metrics={metrics} />
          ))}
        </div>

        {timeseries_json && Object.keys(timeseries_json).map(blockId => {
          const tsData = timeseries_json[blockId];
          if (!tsData || tsData.length === 0) return null;

          const metricsBySeries = {};
          tsData.forEach(pt => {
             if (!metricsBySeries[pt.metric]) metricsBySeries[pt.metric] = { x: [], y: [] };
             metricsBySeries[pt.metric].x.push(pt.t);
             metricsBySeries[pt.metric].y.push(pt.value);
          });

          return Object.entries(metricsBySeries).map(([metricName, data]) => {
            const isUtil = metricName.includes('utilization');
            const { name: readableName } = getBlockInfo(blockId);
            
            return (
              <div key={`${blockId}-${metricName}`} style={{ 
                marginBottom: '12px', backgroundColor: 'var(--bg-secondary)', 
                padding: '8px', borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--border-color)' 
              }}>
                <Plot
                  data={[{
                    x: data.x, y: data.y,
                    type: isUtil ? 'bar' : 'scatter',
                    mode: 'lines',
                    line: { color: isUtil ? '#6c9fff' : '#ffc53d', width: 2 },
                    marker: { color: isUtil ? '#6c9fff' : '#ffc53d' },
                    name: `${readableName} - ${metricName}`
                  }]}
                  layout={plotLayout(`${readableName} — ${metricName}`)}
                  config={{ responsive: true, displayModeBar: false }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '260px' }}
                />
              </div>
            );
          });
        })}
      </div>
    );
  }

  /* ── RL results ── */
  if (rlResults) {
    const { metrics_json, timeseries_json } = rlResults;
    if (metrics_json.error) {
      return (
        <div style={{ padding: '24px' }}>
          <div style={{ 
            display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', 
            borderRadius: 'var(--radius-md)', backgroundColor: 'var(--danger-soft)', 
            border: '1px solid rgba(255,107,107,0.2)' 
          }}>
            <AlertCircle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--danger)', marginBottom: '4px' }}>Ошибка RL Агента</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{metrics_json.error}</div>
            </div>
          </div>
        </div>
      );
    }

    const { baseline, with_rl, episodes_trained } = metrics_json;
    const { rewards } = timeseries_json;
    const log = rlResults.log_text;

    return (
      <div style={{ padding: '20px', overflowY: 'auto', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ color: 'var(--color-rl-reward)', fontSize: '15px', fontWeight: 700 }}>
            Результаты RL Агента
          </h3>
          <span style={{ 
            fontSize: '11px', fontWeight: 600, color: 'var(--accent)', 
            background: 'var(--accent-soft)', padding: '4px 10px', borderRadius: '20px' 
          }}>
            {episodes_trained} эпизодов
          </span>
        </div>
        
        {rewards && rewards.length > 0 && (
          <div style={{ 
            marginBottom: '16px', backgroundColor: 'var(--bg-secondary)', 
            padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' 
          }}>
            <Plot
              data={(() => {
                const W = 50;
                const avg = rewards.map((_, i, arr) => {
                  const slice = arr.slice(Math.max(0, i - W + 1), i + 1);
                  return slice.reduce((a, b) => a + b, 0) / slice.length;
                });
                const std = rewards.map((_, i, arr) => {
                  const slice = arr.slice(Math.max(0, i - W + 1), i + 1);
                  const m = slice.reduce((a, b) => a + b, 0) / slice.length;
                  return Math.sqrt(slice.reduce((a, b) => a + (b - m) ** 2, 0) / slice.length);
                });
                const x = rewards.map((_, i) => i);
                return [
                  // Полоса ±std
                  {
                    x: [...x, ...x.slice().reverse()],
                    y: [...avg.map((v, i) => v + std[i]), ...avg.map((v, i) => v - std[i]).reverse()],
                    fill: 'toself', fillcolor: 'rgba(234,179,8,0.12)',
                    line: { width: 0 }, showlegend: false, hoverinfo: 'skip', type: 'scatter',
                  },
                  // Скользящее среднее
                  {
                    x, y: avg, type: 'scatter', mode: 'lines',
                    name: 'Среднее (50 эп.)',
                    line: { color: '#eab308', width: 2 },
                  },
                ];
              })()}
              layout={plotLayout('Reward по эпизодам')}
              config={{ responsive: true, displayModeBar: false }}
              useResizeHandler={true}
              style={{ width: '100%', height: '260px' }}
            />
          </div>
        )}

        <h4 style={{ color: 'var(--text-primary)', marginBottom: '12px', fontSize: '13px', fontWeight: 600 }}>
          Сравнение: Baseline vs RL
        </h4>
        <div className="stat-cards-grid">
          {Object.keys(baseline).map(blockId => (
            <CompareBlockCard
              key={blockId}
              blockId={blockId}
              base={baseline[blockId]}
              rl={with_rl?.[blockId]}
              isWaste={wasteIds.has(blockId)}
            />
          ))}
        </div>

        {log && (
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Логи обучения</h4>
            <pre style={{ 
              backgroundColor: 'var(--bg-surface)', color: 'var(--success)', padding: '14px', 
              borderRadius: 'var(--radius-md)', fontSize: '11.5px', maxHeight: '240px', overflowY: 'auto', 
              border: '1px solid var(--border-color)',
              fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'pre-wrap', lineHeight: 1.6
            }}>
              {log}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return null;
}
