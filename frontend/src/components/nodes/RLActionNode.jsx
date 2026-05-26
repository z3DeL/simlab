import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Gamepad2 } from 'lucide-react';

export default function RLActionNode({ data }) {
  const { action_type = 'Maintain' } = data;
  
  return (
    <div style={{ borderColor: 'var(--color-rl-act)', background: 'linear-gradient(135deg, rgba(249,115,22,0.1), transparent)' }}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--color-rl-act)', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: 'var(--color-rl-act)', width: 8, height: 8 }} />
      <div className="node-header" style={{ color: 'var(--color-rl-act)' }}>
        <Gamepad2 size={14} /> {data.label || 'RL Action'}
      </div>
      <div className="node-content">
        <span>Управление: {action_type}</span>
      </div>
    </div>
  );
}
