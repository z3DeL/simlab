import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Shuffle } from 'lucide-react';

export default function RouterNode({ data }) {
  const outputs = data.outputs || 2;
  const mode = data.mode || 'round_robin';

  return (
    <div style={{ borderColor: 'var(--color-router)', background: 'linear-gradient(135deg, rgba(245,158,11,0.08), transparent)', minHeight: `${Math.max(60, outputs * 22)}px` }}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--color-router)', width: 8, height: 8 }} />
      <div className="node-header" style={{ color: 'var(--color-router)' }}>
        <Shuffle size={14} /> {data.label || 'Маршрутизатор'}
      </div>
      <div className="node-content">
        <span>{mode === 'weighted_random' ? 'Взвешенный' : 'Round-robin'}</span>
        <span>{outputs} выхода</span>
      </div>
      {Array.from({ length: outputs }, (_, i) => (
        <Handle
          key={`out_${i}`}
          type="source"
          position={Position.Right}
          id={`out_${i}`}
          style={{
            background: 'var(--color-router)',
            width: 8,
            height: 8,
            top: `${((i + 1) / (outputs + 1)) * 100}%`,
          }}
          title={`Выход ${i}`}
        />
      ))}
    </div>
  );
}
