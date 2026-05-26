import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Eye } from 'lucide-react';

export default function RLObservationNode({ data }) {
  const { metric = 'level' } = data;
  
  return (
    <div style={{ borderColor: 'var(--color-rl-obs)', background: 'linear-gradient(135deg, rgba(56,189,248,0.1), transparent)' }}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--color-rl-obs)', width: 8, height: 8 }} />
      <div className="node-header" style={{ color: 'var(--color-rl-obs)' }}>
        <Eye size={14} /> {data.label || 'RL Obs'}
      </div>
      <div className="node-content">
        <span>Метрика: {metric}</span>
      </div>
    </div>
  );
}
