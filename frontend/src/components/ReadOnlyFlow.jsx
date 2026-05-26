import React from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  ReactFlowProvider,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import SourceNode from './nodes/SourceNode';
import QueueNode from './nodes/QueueNode';
import ServerNode from './nodes/ServerNode';
import BranchNode from './nodes/BranchNode';
import SinkNode from './nodes/SinkNode';
import CustomNode from './nodes/CustomNode';
import RouterNode from './nodes/RouterNode';
import MergeNode from './nodes/MergeNode';
import RLObservationNode from './nodes/RLObservationNode';
import RLActionNode from './nodes/RLActionNode';
import RLRewardNode from './nodes/RLRewardNode';
import GateNode from './nodes/GateNode';

const nodeTypes = {
  source: SourceNode,
  queue: QueueNode,
  server: ServerNode,
  branch: BranchNode,
  router: RouterNode,
  merge: MergeNode,
  sink: SinkNode,
  custom: CustomNode,
  gate: GateNode,
  buffer: QueueNode,
  machine: ServerNode,
  inspector: BranchNode,
  rl_observation: RLObservationNode,
  rl_action: RLActionNode,
  rl_reward: RLRewardNode,
};

function Flow({ schemaJson }) {
  const nodes = (schemaJson?.nodes || []).map(n => ({
    ...n,
    position: n.position || { x: Math.random() * 500, y: Math.random() * 500 },
  }));

  const edges = (schemaJson?.edges || []).map(e => ({
    ...e,
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text-secondary)' },
    style: { stroke: 'var(--text-secondary)', strokeWidth: 1.5 },
  }));

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag
      zoomOnScroll
      preventScrolling={false}
    >
      <Background color="#000000" gap={16} size={1} opacity={0.06} />
      <MiniMap
        nodeColor={(n) => {
          if (n.type === 'source') return '#00c9a7';
          if (n.type === 'buffer' || n.type === 'queue') return '#ffc53d';
          if (n.type === 'machine' || n.type === 'server') return '#6c9fff';
          if (n.type === 'inspector' || n.type === 'branch') return '#c084fc';
          if (n.type === 'sink') return '#ff6b6b';
          if (n.type?.startsWith('rl_')) return '#6c5ce7';
          return '#eee';
        }}
        style={{ backgroundColor: 'var(--bg-secondary)' }}
        maskColor="rgba(0, 0, 0, 0.4)"
      />
      <Controls style={{ backgroundColor: 'var(--bg-secondary)', fill: 'var(--text-primary)' }} />
    </ReactFlow>
  );
}

export default function ReadOnlyFlow({ schemaJson, style = {} }) {
  return (
    <div style={{ width: '100%', height: 450, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)', ...style }}>
      <ReactFlowProvider>
        <Flow schemaJson={schemaJson} />
      </ReactFlowProvider>
    </div>
  );
}
