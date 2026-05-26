import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlignJustify } from 'lucide-react';

export default function QueueNode({ data }) {
  const { capacity = 20 } = data;
  
  return (
    <div style={{ borderColor: 'var(--color-queue)', background: 'linear-gradient(135deg, rgba(255,197,61,0.08), transparent)' }}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--color-queue)', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: 'var(--color-queue)', width: 8, height: 8 }} />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="rl-obs"
        style={{ background: 'var(--color-rl-obs)', borderRadius: '3px', width: '10px', height: '5px' }} 
        title="RL Observation"
      />
      <div className="node-header" style={{ color: 'var(--color-queue)' }}>
        <AlignJustify size={14} /> {data.label || 'Очередь'}
      </div>
      <div className="node-content">
        <span>Вместимость: {capacity}</span>
      </div>
    </div>
  );
}
