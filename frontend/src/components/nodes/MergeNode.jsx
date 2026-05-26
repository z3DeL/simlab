import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitMerge } from 'lucide-react';

export default function MergeNode({ data }) {
  const inputs = data.inputs || 2;

  return (
    <div style={{ borderColor: 'var(--color-merge)', background: 'linear-gradient(135deg, rgba(6,182,212,0.08), transparent)', minHeight: `${Math.max(60, inputs * 22)}px` }}>
      {Array.from({ length: inputs }, (_, i) => (
        <Handle
          key={`in_${i}`}
          type="target"
          position={Position.Left}
          id={`in_${i}`}
          style={{
            background: 'var(--color-merge)',
            width: 8,
            height: 8,
            top: `${((i + 1) / (inputs + 1)) * 100}%`,
          }}
          title={`Вход ${i}`}
        />
      ))}
      <div className="node-header" style={{ color: 'var(--color-merge)' }}>
        <GitMerge size={14} /> {data.label || 'Слияние'}
      </div>
      <div className="node-content">
        <span>{inputs} входа</span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: 'var(--color-merge)', width: 8, height: 8 }} />
    </div>
  );
}
