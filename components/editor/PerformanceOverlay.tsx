
import React from 'react';
import { MonitorPlay } from 'lucide-react';
import { Agent, AgentStatus } from '../../types';
import { useAgentMetrics } from '../../context/SystemContext';

interface PerformanceOverlayProps {
  selectedAgent: Agent | undefined;
}

export const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({ selectedAgent: initialAgent }) => {
  const agent = useAgentMetrics(initialAgent?.id);
  
  const displayAgent = agent || initialAgent;

  const isTimeout = displayAgent ? (Date.now() - displayAgent.lastSeen > 20000) : true;
  if (!displayAgent || displayAgent.status !== AgentStatus.RUNNING || isTimeout) return null;

  return (
    <div className="absolute top-20 right-4 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-700 p-2 rounded-lg flex items-center gap-4 pointer-events-auto shadow-sm select-none">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700 pr-3">
        <MonitorPlay size={14} className="text-blue-500" />
        <span className="font-bold">Live Stats</span>
      </div>
      
      <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold uppercase text-[10px]">Wait</span>
            <span className="font-mono text-orange-500 dark:text-orange-400 font-bold">
                {displayAgent.metrics.avg_wait_time_ms?.toFixed(1) ?? '0.0'}ms
            </span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold uppercase text-[10px]">Queue</span>
            <span className="font-mono text-blue-500 dark:text-blue-400 font-bold">
                {displayAgent.metrics.queue_length ?? 0}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold uppercase text-[10px]">Pool</span>
            <span className="font-mono text-purple-500 dark:text-purple-400 font-bold">
                {(displayAgent.metrics.thread_pool_utilization ?? 0).toFixed(0)}%
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold uppercase text-[10px]">Drop</span>
            <span className="font-mono text-red-500 dark:text-red-400 font-bold">
                {displayAgent.metrics.dropped_tasks_count ?? 0}
            </span>
          </div>
      </div>
    </div>
  );
};
