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
    const [currentId, setCurrentId] = useState(id);

    // 强制同步 isLoading 状态，确保切换 ID 时立即进入加载状态，避免旧图残留
    if (id !== currentId) {
        setCurrentId(id);
        setIsLoading(true);
    }
    
    // 从全局 agents 列表中找到当前 Agent
    const agent = agents.find(a => a.id === id);
    const isRunning = agent?.status === 'RUNNING';
    const pid = agent?.pid || 0;
    
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        
        const initAgentDetails = async () => {
            if (id && agent) {
                setIsLoading(true);
                // 设置当前选中的 Agent ID 供 DataflowEditor 使用
                setEditorSelectedAgentId(id);

                // 获取并加载 Agent 当前运行的 Dataflow
                try {
                    let flow = null;
                    let retries = 0;
                    const maxRetries = 3;
                    
                    // 增加重试逻辑，应对 Agent 列表与命令执行之间的短暂同步延迟
                    while (!flow && retries < maxRetries) {
                        flow = await getAgentDataflow(id);
                        if (!flow) {
                            retries++;
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }

                    if (flow) {
                        loadDataflow(flow);
                    } else {
                        // 如果重试后仍没有 flow，清空当前显示
                        loadDataflow({ config: { name: id, description: '' }, nodes: [] });
                    }
                } catch (e) {
                    console.error("Failed to load agent dataflow", e);
                }
                
                setIsLoading(false);
            } else if (id && agents.length > 0 && !agent) {
                setIsLoading(true);
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

            {/* Main Content: Reusing DataflowEditor with its internal subscription */}
            <div className="flex-1 overflow-hidden relative">
                <ReactFlowProvider>
                    <DataflowEditor key={id} initialAgentId={id} hideSidebar={true} readOnly={true} />
                </ReactFlowProvider>
            </div>
        </div>
    );
};
