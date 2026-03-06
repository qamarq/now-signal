'use client';

import { useEffect, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ClusterNode {
  id: string;
  hypothesis: string | null;
  category: string;
  depth: number;
  parentClusterId: string | null;
  signalCount: number;
  confidence: number;
  status: string;
}

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 320;
const nodeHeight = 140;

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  dagreGraph.setGraph({ rankdir: 'TB', ranksep: 150, nodesep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export default function TreeView() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTree() {
      try {
        const res = await fetch('/api/clusters/tree');
        if (!res.ok) throw new Error('Failed to fetch');
        const data: ClusterNode[] = await res.json();

        const flowNodes: Node[] = [];
        const flowEdges: Edge[] = [];

        data.forEach((cluster) => {
          const depthColors = {
            0: {
              bg: 'bg-blue-600',
              text: 'text-white',
              border: 'border-blue-500',
              badgeBg: 'bg-blue-700/50',
            },
            1: {
              bg: 'bg-purple-600',
              text: 'text-white',
              border: 'border-purple-500',
              badgeBg: 'bg-purple-700/50',
            },
            2: {
              bg: 'bg-orange-600',
              text: 'text-white',
              border: 'border-orange-500',
              badgeBg: 'bg-orange-700/50',
            },
            3: {
              bg: 'bg-emerald-600',
              text: 'text-white',
              border: 'border-emerald-500',
              badgeBg: 'bg-emerald-700/50',
            },
            4: {
              bg: 'bg-amber-600',
              text: 'text-white',
              border: 'border-amber-500',
              badgeBg: 'bg-amber-700/50',
            },
          };

          const colors =
            depthColors[cluster.depth as keyof typeof depthColors] ||
            depthColors[0];

          flowNodes.push({
            id: cluster.id,
            data: {
              label: (
                <div
                  className={cn(
                    'w-full h-full p-5 border-2 rounded-4xl shadow-2xl',
                    colors.bg,
                    colors.border,
                  )}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3
                        className={cn(
                          'font-bold text-sm leading-tight text-left',
                          colors.text,
                        )}>
                        {cluster.hypothesis || 'Unknown Event'}
                      </h3>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-xs shrink-0 border-0 rounded-full px-3',
                          colors.badgeBg,
                          colors.text,
                        )}>
                        Depth {cluster.depth}
                      </Badge>
                    </div>
                    <div
                      className={cn(
                        'text-xs font-medium opacity-90',
                        colors.text,
                      )}>
                      {cluster.category.toUpperCase()}
                    </div>
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-0 rounded-full px-3',
                          colors.badgeBg,
                          colors.text,
                        )}>
                        {cluster.signalCount} signals
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-0 rounded-full px-3',
                          colors.badgeBg,
                          colors.text,
                        )}>
                        {cluster.status} {cluster.confidence}%
                      </Badge>
                    </div>
                  </div>
                </div>
              ),
            },
            position: { x: 0, y: 0 },
            style: {
              width: nodeWidth,
              background: 'transparent',
              border: 'none',
            },
          });

          if (cluster.parentClusterId) {
            flowEdges.push({
              id: `${cluster.parentClusterId}-${cluster.id}`,
              source: cluster.parentClusterId,
              target: cluster.id,
              type: 'smoothstep',
              animated: true,
              style: {
                stroke: '#818cf8',
                strokeWidth: 3,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#818cf8',
              },
            });
          }
        });

        const { nodes: layoutedNodes, edges: layoutedEdges } =
          getLayoutedElements(flowNodes, flowEdges);

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    fetchTree();
  }, [setNodes, setEdges]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-white font-semibold animate-pulse">
          Loading tree view...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="p-6 bg-red-600 rounded-2xl shadow-2xl border-2 border-red-500">
          <div className="text-white font-semibold">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={1.5}
        defaultEdgeOptions={{
          style: { strokeWidth: 3, stroke: '#818cf8' },
        }}>
        <Background />
        <Controls className="bg-gray-800 border-gray-700 rounded-xl" />
        <MiniMap
          className="bg-gray-800 border-gray-700 rounded-xl"
          nodeColor={() => '#2563eb'}
        />
      </ReactFlow>
    </div>
  );
}
