import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

export default function BranchNode({ data }) {
  const outputs = data.outputs || 2;
  const mode = data.mode || 'probability';
  const weights = data.weights || [];

  return (
    <div style={{ borderColor: 'var(--color-branch)', background: 'linear-gradient(135deg, rgba(192,132,252,0.08), transparent)', minHeight: `${Math.max(60, outputs * 22)}px` }}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--color-branch)', width: 8, height: 8 }} />
      <div className="node-header" style={{ color: 'var(--color-branch)' }}>
        <GitBranch size={14} /> {data.label || 'Ветвитель'}
      </div>
      <div className="node-content">
        <span>{mode === 'round_robin' ? 'Round-robin' : 'Вероятностный'}</span>
        <span>{outputs} выхода</span>
      </div>
      {Array.from({ length: outputs }, (_, i) => (
        <Handle
          key={`out_${i}`}
          type="source"
          position={Position.Right}
          id={`out_${i}`}
          style={{
            background: 'var(--color-branch)',
            width: 8,
            height: 8,
            top: `${((i + 1) / (outputs + 1)) * 100}%`,
          }}
          title={`Выход ${i}${weights[i] != null ? ` (${(weights[i] * 100).toFixed(0)}%)` : ''}`}
        />
      ))}
    </div>
  );
}
