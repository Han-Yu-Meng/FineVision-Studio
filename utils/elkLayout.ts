import ELK, { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import { Node, Edge } from '@xyflow/react';

const elk = new ELK();

// ELK 布局选项，旨在最小化交叉并优化连线
const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.padding': '[top=50,left=50,bottom=50,right=50]',
  'elk.spacing.nodeNode': '80', // 节点之间的垂直间距
  'elk.layered.spacing.nodeNodeBetweenLayers': '120', // 层级之间的水平间距
  'elk.edgeRouting': 'POLYLINE', // 连线路由方式
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.portConstraints': 'FIXED_ORDER', // 保持端口顺序
};

export const getLayoutedElements = async (nodes: Node[], edges: Edge[]) => {
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: elkOptions,
    children: nodes.map((node) => {
      const data = node.data as any;
      
      // 构建端口信息，以便 ELK 进行更精细的布局
      const ports = [
        ...(data.inputs || []).map((input: any) => ({
          id: `${node.id}-${input.name}`,
          properties: {
            'port.side': 'WEST',
            'port.index': data.inputs.indexOf(input)
          }
        })),
        ...(data.outputs || []).map((output: any) => ({
          id: `${node.id}-${output.name}`,
          properties: {
            'port.side': 'EAST',
            'port.index': data.outputs.indexOf(output)
          }
        }))
      ];

      // 默认尺寸估算（如果节点尚未测量）
      const DEFAULT_WIDTH = 300;
      const DEFAULT_HEIGHT = 200;
      const COLLAPSED_HEIGHT = 60;

      let height = node.measured?.height ?? DEFAULT_HEIGHT;
      let width = node.measured?.width ?? DEFAULT_WIDTH;

      if (!node.measured?.height) {
        if (data.collapsed) {
          height = COLLAPSED_HEIGHT;
        } else {
          const rowCount = Math.max(
            (data.inputs?.length || 0),
            (data.outputs?.length || 0),
            (data.parameterDefs?.length || 0)
          );
          height = Math.max(DEFAULT_HEIGHT, 100 + rowCount * 30);
        }
      }

      return {
        id: node.id,
        width,
        height,
        ports: ports,
        properties: {
            'portConstraints': 'FIXED_ORDER'
        }
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [`${edge.source}-${edge.sourceHandle}`],
      targets: [`${edge.target}-${edge.targetHandle}`],
    })) as ElkExtendedEdge[],
  };

  try {
    const layoutedGraph = await elk.layout(graph);

    return nodes.map((node) => {
      const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
      if (elkNode) {
        // ELK 返回的是中心坐标还是左上角坐标？
        // 默认情况下 ELK 返回的是左上角坐标 (x, y)
        return {
          ...node,
          position: { 
            x: elkNode.x || 0, 
            y: elkNode.y || 0 
          },
        };
      }
      return node;
    });
  } catch (error) {
    console.error('ELK layout failed:', error);
    return nodes;
  }
};
