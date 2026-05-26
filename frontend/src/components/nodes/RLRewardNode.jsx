import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Trophy } from 'lucide-react';

export default function RLRewardNode({ data }) {
  const { mode = 'formula' } = data;
  
  return (
    <div style={{ borderColor: 'var(--color-rl-reward)', background: 'linear-gradient(135deg, rgba(234,179,8,0.1), transparent)' }}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--color-rl-reward)', width: 8, height: 8 }} />
      <div className="node-header" style={{ color: 'var(--color-rl-reward)' }}>
        <Trophy size={14} /> {data.label || 'RL Reward'}
      </div>
      <div className="node-content">
        <span>Режим: {mode === 'formula' ? 'Формула' : 'Custom'}</span>
      </div>
    </div>
  );
}
