import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Server } from 'lucide-react';

export default function ServerNode({ data }) {
  const { count = 1 } = data;
  
  return (
    <div style={{ borderColor: 'var(--color-server)', background: 'linear-gradient(135deg, rgba(108,159,255,0.08), transparent)' }}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--color-server)', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: 'var(--color-server)', width: 8, height: 8 }} />
      <Handle 
        type="target" position={Position.Top} id="rl-action"
        style={{ background: 'var(--color-rl-act)', borderRadius: '3px', width: '10px', height: '5px' }} 
        title="RL Action"
      />
      <Handle 
        type="source" position={Position.Bottom} id="rl-obs"
        style={{ background: 'var(--color-rl-obs)', borderRadius: '3px', width: '10px', height: '5px' }} 
        title="RL Observation"
      />
      <div className="node-header" style={{ color: 'var(--color-server)' }}>
        <Server size={14} /> {data.label || 'Сервер'}
      </div>
      <div className="node-content">
        <span>Каналов: {count}</span>
      </div>
    </div>
  );
}
