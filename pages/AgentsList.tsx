import React, { useState, useEffect } from 'react';
import { useSystem, useAgentMetrics } from '../context/SystemContext';
import { AgentStatus } from '../types';
import { useNavigate } from 'react-router-dom';
import { Server, Wifi, WifiOff, Loader2, Square, Play, Clock } from 'lucide-react';

// Sub-component for individual Agent Card to isolate re-renders
const AgentCard: React.FC<{ 
    agentId: string, 
    pendingStatus: string | undefined, 
    handleSetStatus: (e: React.MouseEvent, agentId: string, state: 'RUNNING' | 'STOPPED') => void 
}> = ({ agentId, pendingStatus, handleSetStatus }) => {
    const navigate = useNavigate();
    const agent = useAgentMetrics(agentId);

    if (!agent) return null;

    const timeSinceLastSeen = Date.now() - agent.lastSeen;
    const isConnected = timeSinceLastSeen < 20000;

    return (
        <div 
            onClick={() => navigate(`/agent/${agent.id}`)}
            className={`bg-white dark:bg-slate-900 border rounded-xl p-5 transition-all shadow-sm cursor-pointer ${isConnected ? 'border-slate-200 dark:border-slate-800 hover:border-blue-500/50' : 'border-red-200 dark:border-red-900/50 opacity-75'}`}
        >
        <div className="flex justify-between items-start mb-4">
            <div>
            <h4 className="font-mono text-lg font-bold text-slate-900 dark:text-white">{agent.id}</h4>
            
            {/* Connection Status */}
            <div className="flex items-center gap-1.5 mt-1 mb-1">
                {isConnected ? <Wifi size={12} className="text-emerald-500" /> : <WifiOff size={12} className="text-red-500" />}
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
            </div>

            {/* Execution Status */}
            <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${agent.status === AgentStatus.STOPPED ? 'bg-red-500' : !isConnected ? 'bg-slate-400' : agent.status === AgentStatus.RUNNING ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`} />
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">
                    {agent.status === AgentStatus.STOPPED ? 'STOPPED' : (!isConnected ? 'OFFLINE' : agent.status)}
                </span>
            </div>

            {/* Control Buttons */}
            <div className="mt-3 flex gap-2">
                {pendingStatus ? (
                    <button 
                        disabled
                        className="bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm cursor-not-allowed text-xs font-bold"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Loader2 size={12} className="animate-spin" /> 
                        {pendingStatus === 'RUNNING' ? 'Starting...' : 'Stopping...'}
                    </button>
                ) : agent.status === AgentStatus.RUNNING ? (
                    <button 
                        onClick={(e) => handleSetStatus(e, agent.id, 'STOPPED')}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm text-xs font-bold transition-colors"
                    >
                        <Square size={12} fill="currentColor" /> Stop
                    </button>
                ) : (
                    <button 
                        onClick={(e) => handleSetStatus(e, agent.id, 'RUNNING')}
                        disabled={!isConnected || agent.status === AgentStatus.OFFLINE}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm text-xs font-bold transition-colors"
                    >
                        <Play size={12} fill="currentColor" /> Run
                    </button>
                )}
            </div>
            </div>
            <div className="text-right text-xs text-slate-500">
            <div className="flex items-center gap-1 justify-end">
                <Clock size={12} />
                {new Date(agent.lastSeen).toLocaleTimeString()}
            </div>
            <div className="text-[10px] opacity-70 mt-0.5">
                {Math.floor(timeSinceLastSeen / 1000)}s ago
            </div>
            </div>
        </div>

        {/* Metrics Bars */}
        <div className={`space-y-4 ${!isConnected ? 'opacity-50 grayscale' : ''}`}>
            <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500 dark:text-slate-400">CPU Usage</span>
                <span className="text-slate-700 dark:text-slate-200 font-mono">{agent.metrics.cpu_usage_percent.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                className={`h-full rounded-full transition-all duration-500 ${agent.metrics.cpu_usage_percent > 80 ? 'bg-red-500' : 'bg-blue-500'}`} 
                style={{ width: `${agent.metrics.cpu_usage_percent}%` }}
                />
            </div>
            </div>

            <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500 dark:text-slate-400">Memory</span>
                <span className="text-slate-700 dark:text-slate-200 font-mono">
                {(agent.metrics.memory_used_mb / 1024).toFixed(1)}GB / {(agent.metrics.memory_total_mb / 1024).toFixed(1)}GB
                </span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                style={{ width: `${agent.metrics.memory_usage_percent}%` }}
                />
            </div>
            </div>
        </div>
        </div>
    );
};

export const AgentsList: React.FC = () => {
  const { agents, setAgentState } = useSystem();
  const navigate = useNavigate();
  
  const [pendingOperations, setPendingOperations] = useState<Record<string, string>>({});

  const sortedAgentIds = React.useMemo(() => {
      return agents
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(a => a.id);
  }, [agents]);

  useEffect(() => {
    setPendingOperations(prev => {
        const next = { ...prev };
        let changed = false;
        Object.entries(next).forEach(([agentId, targetStatus]) => {
            const agent = agents.find(a => a.id === agentId);
            if (agent) {
                if (agent.status === targetStatus || (targetStatus === 'STOPPED' && agent.status === AgentStatus.ONLINE)) {
                    delete next[agentId];
                    changed = true;
                } else if (agent.status === AgentStatus.OFFLINE) {
                     delete next[agentId];
                     changed = true;
                }
            }
        });
        return changed ? next : prev;
    });
  }, [agents]);

  const handleSetStatus = async (e: React.MouseEvent, agentId: string, state: 'RUNNING' | 'STOPPED') => {
      e.stopPropagation();
      setPendingOperations(prev => ({ ...prev, [agentId]: state }));
      
      try {
          const success = await setAgentState(agentId, state);
          if (!success) {
                throw new Error("Failed to set state");
          }
      } catch (e: any) {
          console.error(e);
          setPendingOperations(prev => {
               const next = { ...prev };
               delete next[agentId];
               return next;
           });
      }
  };

  return (
    <div className="p-6 h-full flex flex-col gap-6 relative bg-slate-50 dark:bg-slate-950 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full space-y-6">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                    <Server className="text-white" size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Agents</h1>
                    <p className="text-slate-500 dark:text-slate-400">Monitor and manage agents</p>
                </div>
            </div>
            
            <section>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
                {/* Create New Agent Card */}
                <button 
                  onClick={() => navigate('/create-agent')}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-5 hover:border-blue-500/30 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all flex flex-col items-center justify-center text-slate-500 gap-2 min-h-[160px]"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl text-blue-500 dark:text-blue-400">+</div>
                  <span className="font-medium">Create Local Agent</span>
                </button>

                {sortedAgentIds.map((agentId) => (
                    <AgentCard 
                        key={agentId} 
                        agentId={agentId} 
                        pendingStatus={pendingOperations[agentId]} 
                        handleSetStatus={handleSetStatus} 
                    />
                ))}
              </div>
            </section>
        </div>
    </div>
  );
};