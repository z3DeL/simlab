import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play } from 'lucide-react';

export default function SourceNode({ data }) {
  const { interval = { dist: 'exponential', params: { lam: 1.0 } } } = data;
  
  let desc = 'Пакетный';
  if (interval.dist === 'exponential') desc = `exp(λ=${interval.params.lam})`;
  else if (interval.dist === 'normal') desc = `norm(μ=${interval.params.mu})`;
  else if (interval.dist === 'uniform') desc = `uniform(${interval.params.a}..${interval.params.b})`;
  else if (interval.dist === 'constant') desc = `const(${interval.params.value})`;

  return (
    <div style={{ borderColor: 'var(--color-source)', background: 'linear-gradient(135deg, rgba(0,201,167,0.08), transparent)' }}>
      <div className="node-header" style={{ color: 'var(--color-source)' }}>
        <Play size={14} /> {data.label || 'Source'}
      </div>
      <div className="node-content">
        <span>Интервал: {desc}</span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: 'var(--color-source)', width: 8, height: 8 }} />
    </div>
  );
}
