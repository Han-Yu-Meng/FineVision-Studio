
import React, { useMemo } from 'react';
import { 
  EdgeProps, 
  BaseEdge, 
  getBezierPath, 
  EdgeLabelRenderer 
} from '@xyflow/react';

const PRIORITY_COLORS = {
    Urgent: '#ef4444', 
    High: '#f97316',   
    Medium: '#3b82f6', 
    Low: '#64748b'     
};

export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const { fps, delay, queue = 'FCFS', priority = 'Medium' } = (data as any) || {};

  const edgeStyle = useMemo(() => {
      let baseColor = PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.Medium;
      let opacity = selected ? 1 : 0.8;
      let zIndex = 10;

      const isLGFS = queue === 'LGFS';
      const dashPattern = isLGFS ? '10 5' : '4 4';
      
      const animationName = isLGFS ? 'flow-lgfs' : 'flow-fcfs';
      const animationDuration = isLGFS ? '1.5s' : '0.8s';

      return {
          ...style,
          stroke: baseColor, 
          strokeWidth: priority === 'Urgent' ? 3 : 2,
          strokeDasharray: dashPattern, 
          opacity: opacity,
          animation: `${animationName} ${animationDuration} linear infinite`,
          willChange: 'stroke-dashoffset',
          zIndex: zIndex
      };
  }, [style, queue, priority, selected]);

  const showMetrics = (fps !== undefined || delay !== undefined);

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      
      {showMetrics && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div className={`
                text-[9px] font-mono text-slate-200 px-1.5 py-0.5 rounded border shadow-sm whitespace-nowrap flex flex-col items-center leading-tight backdrop-blur-sm
                ${priority === 'Urgent' ? 'bg-red-900/80 border-red-700' : 'bg-slate-900/80 border-slate-700'}
            `}>
               {fps !== undefined && <span className="text-green-400 font-bold">{Number(fps).toFixed(1)} FPS</span>}
               {delay !== undefined && <span className="text-orange-400">{Number(delay).toFixed(1)} ms</span>}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
