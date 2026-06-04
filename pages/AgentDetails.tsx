import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSystem } from '../context/SystemContext';
import { ArrowLeft, Monitor, StopCircle, Loader2 } from 'lucide-react';
import { DataflowEditor } from './Editor';
import { ReactFlowProvider } from '@xyflow/react';

export const AgentDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { agents, getAgentDataflow, loadDataflow, setAgentState, setEditorSelectedAgentId } = useSystem();
    const [isLoading, setIsLoading] = useState(true);
    
    // 从全局 agents 列表中找到当前 Agent
    const agent = agents.find(a => a.id === id);
    const isRunning = agent?.status === 'RUNNING';
    const pid = agent?.pid || 0;
    
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        
        const initAgentDetails = async () => {
            if (id && agent) {
                // 设置当前选中的 Agent ID 供 DataflowEditor 使用
                setEditorSelectedAgentId(id);

                // 获取并加载 Agent 当前运行的 Dataflow
                try {
                    const flow = await getAgentDataflow(id);
                    if (flow) {
                        loadDataflow(flow);
                    }
                } catch (e) {
                    console.error("Failed to load agent dataflow", e);
                }
                
                setIsLoading(false);
            } else if (id && agents.length > 0 && !agent) {
                // 如果列表已加载但没找到该 agent，等待一会再标记加载完成（可能还在同步中）
                timeout = setTimeout(() => {
                    setIsLoading(false);
                }, 2000);
            }
        };
        initAgentDetails();
        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [id, agent?.id, agents.length, getAgentDataflow, loadDataflow, setEditorSelectedAgentId]);

    const handleStop = async () => {
        if (!id) return;
        if (!confirm(`Are you sure you want to stop agent ${id}?`)) return;
        try {
            await setAgentState(id, 'STOPPED');
        } catch (e) {
            alert('Failed to stop agent');
        }
    };

    if (!id) return <div>Invalid Agent ID</div>;
    if (isLoading) return (
        <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-blue-500" size={40} />
                <p className="text-slate-500 font-medium">Loading Agent Details...</p>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
            {/* Header: Simplified UI as before */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/agents')}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{id}</h1>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                isRunning ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                                {isRunning ? 'RUNNING' : 'ONLINE'}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 mt-0.5 text-xs text-slate-500">
                            <div className="flex items-center gap-1">
                                <Monitor size={12} />
                                <span>PID: {pid || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {isRunning && (
                        <button 
                            onClick={handleStop}
                            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg font-medium transition-colors border border-red-200 dark:border-red-900/50"
                        >
                            <StopCircle size={18} />
                            Stop Agent
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content: Reusing DataflowEditor with its internal subscription */}
            <div className="flex-1 overflow-hidden relative">
                <ReactFlowProvider>
                    <DataflowEditor initialAgentId={id} hideSidebar={true} />
                </ReactFlowProvider>
            </div>
        </div>
    );
};
