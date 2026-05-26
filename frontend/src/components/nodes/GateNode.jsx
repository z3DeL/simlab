import React, { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { TrafficCone } from 'lucide-react';

export default function GateNode({ id, data }) {
  const inputCount = data.inputs || 2;
  const phaseTimes = data.phase_times || Array(inputCount).fill(30);
  const switchCost = data.switch_cost ?? 3.0;
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => { updateNodeInternals(id); }, [id, inputCount, updateNodeInternals]);

  const inputHandles = [];
  for (let i = 0; i < inputCount; i++) {
    const top = inputCount === 1 ? '50%' : `${20 + (60 / Math.max(inputCount - 1, 1)) * i}%`;
    inputHandles.push(
      <Handle
        key={`in_${i}`}
        type="target"
        position={Position.Left}
        id={`in_${i}`}
        style={{ background: 'var(--color-gate)', width: 8, height: 8, top }}
      />
    );
  }

  const outputHandles = [];
  for (let i = 0; i < inputCount; i++) {
    const top = inputCount === 1 ? '50%' : `${20 + (60 / Math.max(inputCount - 1, 1)) * i}%`;
    outputHandles.push(
      <Handle
        key={`out_${i}`}
        type="source"
        position={Position.Right}
        id={`out_${i}`}
        style={{ background: 'var(--color-gate)', width: 8, height: 8, top }}
      />
    );
  }

  return (
    <div style={{ borderColor: 'var(--color-gate)', background: 'linear-gradient(135deg, rgba(239,68,68,0.08), transparent)' }}>
      {inputHandles}
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
      <div className="node-header" style={{ color: 'var(--color-gate)' }}>
        <TrafficCone size={14} /> {data.label || 'Светофор'}
      </div>
      <div className="node-content">
        <span>{inputCount} полосы · {phaseTimes.join('/')}с · 🟡{switchCost}с</span>
      </div>
      {outputHandles}
    </div>
  );
}
