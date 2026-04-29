
import React, { useState, useEffect } from 'react';
import { useSystem } from '../context/SystemContext';
import { AgentStatus } from '../types';
import { useNavigate } from 'react-router-dom';
import { Server, Activity, Edit3, Trash2, Clock, Settings, FileText, Wifi, WifiOff, Link, PlayCircle, Play, Square, Loader2 } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { agents, dataflows, loadDataflow, deleteDataflow, reorderDataflows, parameters, loadParameter, deleteParameter, reorderParameters, defaultAssignments, agentActiveFlows, setAgentState } = useSystem();
  const navigate = useNavigate();
  
  const [, setTick] = useState(0);
  useEffect(() => {
      const timer = setInterval(() => setTick(t => t + 1), 1000);
      return () => clearInterval(timer);
  }, []);

  const [pendingOperations, setPendingOperations] = useState<Record<string, string>>({});

  const sortedAgents = React.useMemo(() => {
      return [...agents].sort((a, b) => a.id.localeCompare(b.id));
  }, [agents]);

  const [draggedDataflowIndex, setDraggedDataflowIndex] = useState<number | null>(null);
  const [draggedParamIndex, setDraggedParamIndex] = useState<number | null>(null);

  const handleDataflowDragStart = (index: number) => {
      setDraggedDataflowIndex(index);
  };

  const handleDataflowDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedDataflowIndex === null || draggedDataflowIndex === index) return;
      
      const newFlows = [...dataflows];
      const draggedItem = newFlows[draggedDataflowIndex];
      newFlows.splice(draggedDataflowIndex, 1);
      newFlows.splice(index, 0, draggedItem);
      
      reorderDataflows(newFlows);
      setDraggedDataflowIndex(index);
  };

  const handleDataflowDrop = () => {
      setDraggedDataflowIndex(null);
  };

  const handleParamDragStart = (index: number) => {
      setDraggedParamIndex(index);
  };

  const handleParamDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedParamIndex === null || draggedParamIndex === index) return;
      
      const newParams = [...parameters];
      const draggedItem = newParams[draggedParamIndex];
      newParams.splice(draggedParamIndex, 1);
      newParams.splice(index, 0, draggedItem);
      
      reorderParameters(newParams);
      setDraggedParamIndex(index);
  };

  const handleParamDrop = () => {
      setDraggedParamIndex(null);
  };

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
               setPendingOperations(prev => {
                   const next = { ...prev };
                   delete next[agentId];
                   return next;
               });
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

  const handleEditFlow = (flow: any) => {
    loadDataflow(flow);
    navigate('/editor');
  };

  const handleEditParam = (param: any) => {
    loadParameter(param);
    navigate('/parameter-editor');
  };

  const handleDeleteParam = (name: string) => {
    if (confirm(`Delete parameter ${name}?`)) {
      deleteParameter(name);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col gap-6 relative">
      <div className="flex justify-between items-center">
         <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-500 bg-clip-text text-transparent">
                System Overview
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Monitor active agents and manage system configurations</p>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-8">
        {/* Agents Grid */}
        <section>
        <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-2">
          <Server size={18} /> Connected Agents
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedAgents.map((agent) => {
            const timeSinceLastSeen = Date.now() - agent.lastSeen;
            const isConnected = timeSinceLastSeen < 20000;
            const pendingStatus = pendingOperations[agent.id];
            
            return (
            <div 
                key={agent.id} 
                onClick={() => navigate(`/agent/${agent.id}`)}
                className={`bg-white dark:bg-slate-900 border rounded-xl p-5 transition-all shadow-lg cursor-pointer ${isConnected ? 'border-slate-200 dark:border-slate-800 hover:border-blue-500/50' : 'border-red-200 dark:border-red-900/50 opacity-75'}`}
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
                    <span className={`w-2 h-2 rounded-full ${!isConnected ? 'bg-slate-400' : agent.status === AgentStatus.RUNNING ? 'bg-green-500 animate-pulse' : agent.status === AgentStatus.ONLINE ? 'bg-blue-500' : 'bg-red-500'}`} />
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">
                        {!isConnected ? 'OFFLINE' : agent.status}
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
          })}
          {agents.length === 0 && (
            <div className="col-span-full p-8 text-center border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-slate-500">
              No agents connected. Start an agent to see it here.
            </div>
          )}
        </div>
      </section>

      {/* Dataflows List */}
      <section>
        <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-4 flex items-center gap-2">
          <Activity size={18} /> Dataflow Library
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dataflows.map((flow, index) => {
            // Find agents running this flow
            const runningAgents = agents.filter(a => {
                const timeDiff = Date.now() - a.lastSeen;
                const isConnected = timeDiff < 20000;
                
                const activeFlow = agentActiveFlows[a.id];
                const defaultFlow = defaultAssignments[a.id]?.dataflow;
                
                // Match if it's the active flow (runtime) OR if it's the default flow (configuration)
                const isAssigned = activeFlow === flow.config.name || (!activeFlow && defaultFlow === flow.config.name);
                
                return isConnected && a.status === AgentStatus.RUNNING && isAssigned;
            });

            return (
            <div 
                key={flow.config.name} 
                draggable
                onDragStart={() => handleDataflowDragStart(index)}
                onDragOver={(e) => handleDataflowDragOver(e, index)}
                onDragEnd={handleDataflowDrop}
                className={`group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-purple-500/50 transition-all cursor-pointer relative overflow-hidden shadow-sm ${draggedDataflowIndex === index ? 'opacity-50' : ''}`}
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteDataflow(flow.config.name); }}
                  className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-900 text-red-500 dark:text-red-400 rounded-lg border border-slate-200 dark:border-slate-700"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleEditFlow(flow); }}
                  className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-500 dark:text-blue-400 rounded-lg border border-slate-200 dark:border-slate-700"
                  title="Edit"
                >
                  <Edit3 size={16} />
                </button>
              </div>

              <div onClick={() => handleEditFlow(flow)}>
                <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-1">{flow.config.name}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">{flow.config.description || 'No description provided.'}</p>
                
                <div className="flex items-center gap-2 flex-wrap text-xs font-mono text-slate-500">
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                    {flow.nodes.length} Nodes
                  </span>

                  {/* Running Agents Display - Moved here */}
                  {runningAgents.map(agent => (
                      <span key={agent.id} className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 px-2 py-1 rounded border border-green-100 dark:border-green-800/50 flex items-center gap-1 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                          {agent.id}
                      </span>
                  ))}
                </div>
              </div>
            </div>
            );
          })}
          
          {/* Add New Dataflow Card */}
          <button 
            onClick={() => {
              loadDataflow({ config: { name: `NewFlow_${Date.now().toString().slice(-4)}`, description: "New dataflow description" }, nodes: [] });
              navigate('/editor');
            }}
            className="border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-5 hover:border-purple-500/30 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all flex flex-col items-center justify-center text-slate-500 gap-2 min-h-[160px]"
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl text-purple-500 dark:text-purple-400">+</div>
            <span className="font-medium">Create New Dataflow</span>
          </button>
        </div>
      </section>

      {/* Parameter Library */}
      <section>
        <h3 className="text-lg font-semibold text-orange-600 dark:text-orange-400 mb-4 flex items-center gap-2">
          <Settings size={18} /> Parameter Library
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {parameters.map((param, index) => (
            <div 
                key={param.name} 
                draggable
                onDragStart={() => handleParamDragStart(index)}
                onDragOver={(e) => handleParamDragOver(e, index)}
                onDragEnd={handleParamDrop}
                className={`group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-orange-500/50 transition-all cursor-pointer relative overflow-hidden shadow-sm ${draggedParamIndex === index ? 'opacity-50' : ''}`}
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteParam(param.name); }}
                  className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-900 text-red-500 dark:text-red-400 rounded-lg border border-slate-200 dark:border-slate-700"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleEditParam(param); }}
                  className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-500 dark:text-blue-400 rounded-lg border border-slate-200 dark:border-slate-700"
                  title="Edit"
                >
                  <Edit3 size={16} />
                </button>
              </div>

              <div onClick={() => handleEditParam(param)}>
                <div className="flex items-center gap-2 mb-2">
                    <FileText size={16} className="text-orange-500 dark:text-orange-400" />
                    <h4 className="font-bold text-lg text-slate-900 dark:text-white truncate">{param.name}</h4>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 rounded p-2 border border-slate-200 dark:border-slate-800 mb-2">
                    <pre className="text-[10px] text-slate-500 font-mono line-clamp-3 overflow-hidden">
                        {param.content}
                    </pre>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                    YAML Configuration
                </div>
              </div>
            </div>
          ))}
          
          {/* Add New Parameter Card */}
          <button 
            onClick={() => {
              loadParameter({ name: '', content: '' });
              navigate('/parameter-editor');
            }}
            className="border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-5 hover:border-orange-500/30 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all flex flex-col items-center justify-center text-slate-500 gap-2 min-h-[160px]"
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl text-orange-500 dark:text-orange-400">+</div>
            <span className="font-medium">Create New Parameter</span>
          </button>
        </div>
      </section>
      </div>
    </div>
  );
};
