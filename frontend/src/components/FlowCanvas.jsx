import React, { useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ConnectionMode,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useProject } from '../context/ProjectContext';

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
import BlockPalette from './BlockPalette';
import NodeSettings from './NodeSettings';

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
  // backward-compat for saved schemas
  buffer: QueueNode,
  machine: ServerNode,
  inspector: BranchNode,
  rl_observation: RLObservationNode,
  rl_action: RLActionNode,
  rl_reward: RLRewardNode,
};

let idManager = 0;
const getId = (type) => `${type}_${idManager++}_${Date.now()}`;

export default function FlowCanvas() {
  const reactFlowWrapper = useRef(null);
  const { project, updateProject } = useProject();
  
  const initialNodes = (project?.schema_json?.nodes || []).map(n => ({
    ...n,
    position: n.position || { x: Math.random() * 500, y: Math.random() * 500 }
  }));
  const initialEdges = project?.schema_json?.edges || [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = React.useState(null);
  const [selectedNodeId, setSelectedNodeId] = React.useState(null);

  // --- Undo / Redo ---
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const MAX_HISTORY = 50;

  const pushHistory = useCallback((newNodes, newEdges) => {
    if (isUndoRedoRef.current) return;
    const snapshot = JSON.stringify({ nodes: newNodes, edges: newEdges });
    const last = historyRef.current[historyIndexRef.current];
    if (last === snapshot) return;
    // Обрезаем "будущее" при новом действии
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const snapshot = JSON.parse(historyRef.current[historyIndexRef.current]);
    isUndoRedoRef.current = true;
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    saveSchema();
    requestAnimationFrame(() => { isUndoRedoRef.current = false; });
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snapshot = JSON.parse(historyRef.current[historyIndexRef.current]);
    isUndoRedoRef.current = true;
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    saveSchema();
    requestAnimationFrame(() => { isUndoRedoRef.current = false; });
  }, [setNodes, setEdges]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Push initial snapshot
  useEffect(() => {
    if (initialNodes.length > 0 && historyRef.current.length === 0) {
      pushHistory(initialNodes, initialEdges);
    }
  }, []);

  // Update flow when project changes externally (e.g. load lab schema)
  const prevSchemaRef = useRef(null);
  React.useEffect(() => {
    if (project?.schema_json && reactFlowInstance) {
      const newSchemaStr = JSON.stringify(project.schema_json);
      // Skip if schema hasn't changed (e.g. our own save triggered the update)
      if (prevSchemaRef.current === newSchemaStr) return;
      prevSchemaRef.current = newSchemaStr;

      const currentNodes = reactFlowInstance.getNodes();
      const incomingNodes = project.schema_json.nodes || [];
      
      // Check if this is a fundamentally different schema (different node IDs)
      const currentIds = new Set(currentNodes.map(n => n.id));
      const incomingIds = new Set(incomingNodes.map(n => n.id));
      const sameSchema = currentIds.size === incomingIds.size && 
        [...incomingIds].every(id => currentIds.has(id));
      
      if (!sameSchema && incomingNodes.length > 0) {
        const mappedNodes = incomingNodes.map(n => ({
          ...n,
          position: n.position || { x: Math.random() * 500, y: Math.random() * 500 }
        }));
        setNodes(mappedNodes);
        setEdges(project.schema_json.edges || []);
        
        const maxId = incomingNodes.reduce((max, node) => {
          const parts = node.id.split('_');
          const num = parseInt(parts[1], 10);
          return !isNaN(num) && num > max ? num : max;
        }, 0);
        idManager = maxId + 1;
        
        // Push to undo history
        pushHistory(mappedNodes, project.schema_json.edges || []);
      } else if (!sameSchema && incomingNodes.length === 0) {
        // Пустой проект — очищаем канвас
        setNodes([]);
        setEdges([]);
        idManager = 0;
        historyRef.current = [];
        historyIndexRef.current = -1;
      } else if (currentNodes.length === 0 && incomingNodes.length > 0) {
        const mappedNodes = incomingNodes.map(n => ({
          ...n,
          position: n.position || { x: Math.random() * 500, y: Math.random() * 500 }
        }));
        setNodes(mappedNodes);
        setEdges(project.schema_json.edges || []);
        
        const maxId = incomingNodes.reduce((max, node) => {
          const parts = node.id.split('_');
          const num = parseInt(parts[1], 10);
          return !isNaN(num) && num > max ? num : max;
        }, 0);
        idManager = maxId + 1;
      }
    }
  }, [project?.schema_json, reactFlowInstance, setNodes, setEdges, pushHistory]);

  const updateProjectRef = useRef(updateProject);
  React.useEffect(() => { updateProjectRef.current = updateProject; }, [updateProject]);

  const reactFlowInstanceRef = useRef(reactFlowInstance);
  React.useEffect(() => { reactFlowInstanceRef.current = reactFlowInstance; }, [reactFlowInstance]);

  const saveTimeoutRef = useRef(null);

  // Sync back to project with proper debounce and stable reference
  const saveSchema = useCallback(() => {
    if (!reactFlowInstanceRef.current) return;
    
    if (saveTimeoutRef.current) {
       clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      const flow = reactFlowInstanceRef.current.toObject();
      // Mark this as our own save so external update detection ignores it
      prevSchemaRef.current = JSON.stringify(flow);
      updateProjectRef.current({ schema_json: flow });
    }, 1000);
  }, []);

  const onConnect = useCallback(
    (params) => {
      const edge = {
        ...params,
        type: 'default',
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text-secondary)' },
        style: { stroke: 'var(--text-secondary)', strokeWidth: 1.5 }
      };
      setEdges((eds) => {
        const newEdges = addEdge(edge, eds);
        saveSchema();
        setTimeout(() => {
          if (reactFlowInstanceRef.current) {
            const flow = reactFlowInstanceRef.current.toObject();
            pushHistory(flow.nodes, flow.edges);
          }
        }, 50);
        return newEdges;
      });
    },
    [setEdges, saveSchema]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Default data based on type
      let data = {};
      if (type === 'source') data = { interval: { dist: 'exponential', params: { lam: 1.0 } } };
      if (type === 'buffer') data = { capacity: 20 };
      if (type === 'machine') data = { processing_time: { dist: 'normal', params: { mu: 5.0, sigma: 1.0 } }, count: 1, mtbf: 100, mttr: 15 };
      if (type === 'inspector') data = { defect_rate: 0.1, inspection_time: 1.0 };
      if (type === 'sink') data = { label: 'Выход' };
      if (type === 'gate') data = { inputs: 2, pass_time: 2.0, phase_times: [30, 20], switch_cost: 3.0, min_green_time: 10.0 };
      if (type === 'custom') data = { name: 'Custom Component', code: 'class MyBlock(ServerBlock):\n    def _work(self):\n        while True:\n            entity = yield self.in_stores[0].get()\n            yield self.env.timeout(1.0)\n            self.total_processed += 1\n            yield self.out_stores[0].put(entity)\n\n    def get_metrics(self):\n        return {"total_processed": self.total_processed}' };
      if (type === 'rl_observation') data = { metric: 'level' };
      if (type === 'rl_action') data = { action_type: 'Maintain', values: ['noop', 'maintain'] };
      if (type === 'rl_reward') data = { mode: 'formula', weights: {} };

      const newNode = {
        id: getId(type),
        type,
        position,
        data,
      };

      setNodes((nds) => {
        const newNodes = nds.concat(newNode);
        saveSchema();
        setTimeout(() => {
          if (reactFlowInstanceRef.current) {
            const flow = reactFlowInstanceRef.current.toObject();
            pushHistory(flow.nodes, flow.edges);
          }
        }, 50);
        return newNodes;
      });
    },
    [reactFlowInstance, setNodes, saveSchema]
  );

  const onSelectionChange = useCallback(({ nodes }) => {
    if (nodes.length === 1) setSelectedNodeId(nodes[0].id);
    else setSelectedNodeId(null);
  }, []);
  
  const handleNodeUpdate = (id, property, value) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          const updatedNode = { ...node, data: { ...node.data, [property]: value } };
          
          // Fix nested updates
          if (property.includes('.')) {
             const parts = property.split('.');
             let current = {...node.data};
             let ref = current;
             for (let i = 0; i < parts.length - 1; i++) {
                ref[parts[i]] = {...ref[parts[i]]};
                ref = ref[parts[i]];
             }
             ref[parts[parts.length - 1]] = value;
             updatedNode.data = current;
          }
          
          return updatedNode;
        }
        return node;
      })
    );
    saveSchema(); // debounce save handled inside saveSchema
  };

  const selectedNode = React.useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId);
  }, [nodes, selectedNodeId]);

  const handleNodesChange = useCallback((c) => {
    onNodesChange(c);
    saveSchema();
    // Snapshot after structural changes (add/remove), not drags
    const structural = c.some(ch => ch.type === 'remove' || ch.type === 'add');
    if (structural) {
      setTimeout(() => {
        if (reactFlowInstanceRef.current) {
          const flow = reactFlowInstanceRef.current.toObject();
          pushHistory(flow.nodes, flow.edges);
        }
      }, 50);
    }
  }, [onNodesChange, saveSchema, pushHistory]);

  const handleEdgesChange = useCallback((c) => {
    onEdgesChange(c);
    saveSchema();
    const structural = c.some(ch => ch.type === 'remove' || ch.type === 'add');
    if (structural) {
      setTimeout(() => {
        if (reactFlowInstanceRef.current) {
          const flow = reactFlowInstanceRef.current.toObject();
          pushHistory(flow.nodes, flow.edges);
        }
      }, 50);
    }
  }, [onEdgesChange, saveSchema, pushHistory]);

  const nodeColor = useCallback((n) => {
    if (n.type === 'source') return '#00c9a7';
    if (n.type === 'buffer') return '#ffc53d';
    if (n.type === 'machine') return '#6c9fff';
    if (n.type === 'inspector') return '#c084fc';
    if (n.type === 'sink') return '#ff6b6b';
    if (n.type.startsWith('rl_')) return '#6c5ce7';
    return '#eee';
  }, []);

  const minimapStyle = React.useMemo(() => ({ backgroundColor: 'var(--bg-secondary)' }), []);
  const controlsStyle = React.useMemo(() => ({ backgroundColor: 'var(--bg-secondary)', fill: 'var(--text-primary)' }), []);

  return (
    <div className="reactflow-wrapper" ref={reactFlowWrapper} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <BlockPalette />
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
      >
        <Background color="#000000" gap={16} size={1} opacity={0.06} />
        <MiniMap 
          nodeColor={nodeColor}
          style={minimapStyle}
          maskColor="rgba(0, 0, 0, 0.4)"
        />
        <Controls style={controlsStyle} />
      </ReactFlow>

      {selectedNode && (() => {
        // Вычисляем позицию узла в экранных координатах относительно wrapper
        let panelLeft = 20;
        let panelTop = 20;
        if (reactFlowInstance && reactFlowWrapper.current) {
          const screen = reactFlowInstance.flowToScreenPosition(selectedNode.position);
          const rect = reactFlowWrapper.current.getBoundingClientRect();
          const nodeW = selectedNode.measured?.width || 160;
          const nodeH = selectedNode.measured?.height || 60;
          // Предпочитаем показывать справа от блока, если влезает
          let left = screen.x - rect.left + nodeW + 12;
          let top = screen.y - rect.top;
          // Если не влезает справа — слева
          if (left + 280 > rect.width) left = screen.x - rect.left - 280 - 12;
          // Не выходим за низ
          if (top + 400 > rect.height) top = rect.height - 410;
          if (top < 0) top = 8;
          panelLeft = Math.max(4, left);
          panelTop = top;
        }
        return (
          <NodeSettings
            node={selectedNode}
            nodes={nodes}
            updateNode={handleNodeUpdate}
            style={{ position: 'absolute', left: panelLeft, top: panelTop, zIndex: 100 }}
          />
        );
      })()}
    </div>
  );
}
