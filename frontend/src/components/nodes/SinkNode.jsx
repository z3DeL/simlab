import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Flag } from 'lucide-react';

export default function SinkNode({ data }) {
  return (
    <div style={{ borderColor: 'var(--color-sink)', background: 'linear-gradient(135deg, rgba(255,107,107,0.08), transparent)' }}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--color-sink)', width: 8, height: 8 }} />
      <div className="node-header" style={{ color: 'var(--color-sink)' }}>
        <Flag size={14} /> {data.label || 'Sink'}
      </div>
      <div className="node-content">
        <span>Выход продукции</span>
      </div>
    </div>
  );
}
