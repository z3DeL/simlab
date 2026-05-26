import React, { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { Wrench } from 'lucide-react';

export default function CustomNode({ id, data }) {
  const outputCount = data.outputs || 1;
  const inputCount = data.inputs || 1;
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => { updateNodeInternals(id); }, [id, inputCount, outputCount, updateNodeInternals]);

  const inputHandles = [];
  for (let i = 0; i < inputCount; i++) {
    const top = inputCount === 1 ? '50%' : `${20 + (60 / Math.max(inputCount - 1, 1)) * i}%`;
    inputHandles.push(
      <Handle
        key={`in_${i}`}
        type="target"
        position={Position.Left}
        id={`in_${i}`}
        style={{ background: 'var(--color-custom)', width: 8, height: 8, top }}
      />
    );
  }

  const outputHandles = [];
  for (let i = 0; i < outputCount; i++) {
    const top = outputCount === 1 ? '50%' : `${20 + (60 / Math.max(outputCount - 1, 1)) * i}%`;
    outputHandles.push(
      <Handle
        key={`out_${i}`}
        type="source"
        position={Position.Right}
        id={`out_${i}`}
        style={{ background: 'var(--color-custom)', width: 8, height: 8, top }}
      />
    );
  }

  return (
    <div style={{ borderColor: 'var(--color-custom)', background: 'linear-gradient(135deg, rgba(148,163,184,0.08), transparent)' }}>
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
      <div className="node-header" style={{ color: 'var(--color-custom)' }}>
        <Wrench size={14} /> {data.label || data.name || 'Custom'}
      </div>
      <div className="node-content">
        <span>Пользовательский код</span>
        {(inputCount > 1 || outputCount > 1) && (
          <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: 4 }}>
            ({inputCount} вх. / {outputCount} вых.)
          </span>
        )}
      </div>
      {outputHandles}
    </div>
  );
}
