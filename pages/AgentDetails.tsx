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
        const initAgentDetails = async () => {
            if (id) {
                setIsLoading(true);
                
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
            }
        };
        initAgentDetails();
    }, [id, getAgentDataflow, loadDataflow, setEditorSelectedAgentId]);

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
            {/* Main Content: Reusing DataflowEditor */}
            <div className="flex-1 overflow-hidden relative">
                <ReactFlowProvider>
                    <DataflowEditor initialAgentId={id} hideSidebar={true} />
                </ReactFlowProvider>
            </div>
        </div>
    );
};
