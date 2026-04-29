
import React, { useState, useEffect } from 'react';
import { useSystem } from '../context/SystemContext';
import { AgentStatus } from '../types';
import { useNavigate } from 'react-router-dom';
import { Activity, Trash2 } from 'lucide-react';

export const DataflowList: React.FC = () => {
  const { dataflows, loadDataflow, deleteDataflow, reorderDataflows, agents, agentActiveFlows } = useSystem();
  const navigate = useNavigate();

  const [draggedDataflowIndex, setDraggedDataflowIndex] = useState<number | null>(null);

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

  
  return (
    <div className="p-6 h-full flex flex-col gap-6 relative bg-slate-50 dark:bg-slate-950 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full space-y-6">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                    <Activity className="text-white" size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dataflows</h1>
                    <p className="text-slate-500 dark:text-slate-400">Create, edit, and manage dataflow</p>
                </div>
            </div>

      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

          {dataflows.map((flow, index) => {
            const runningAgents = agents.filter(a => {
                const timeDiff = Date.now() - a.lastSeen;
                const isConnected = timeDiff < 20000;
                
                const activeFlow = agentActiveFlows[a.id];
                
                const isAssigned = activeFlow === flow.config.name;
                
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
                              </div>

              <div onClick={() => {
                loadDataflow(flow);
                navigate('/editor');
            }}>
                <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-1">{flow.config.name}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">{flow.config.description || 'No description provided.'}</p>
                
                <div className="flex items-center gap-2 flex-wrap text-xs font-mono text-slate-500">
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                    {flow.nodes.length} Nodes
                  </span>

                  {/* Running Agents Display */}
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
        </div>
      </section>
      </div>
    </div>
  );
};
