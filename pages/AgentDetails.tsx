import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSystem } from '../context/SystemContext';
import { ArrowLeft, Terminal, Activity, Monitor, List, Power, StopCircle } from 'lucide-react';
import { LogViewer } from '../components/LogViewer';

export const AgentDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { agents, removeAgent } = useSystem();
    const [agent, setAgent] = useState<any>(null);
    const [logs, setLogs] = useState<string>('');
    const [status, setStatus] = useState<{ running: boolean, pid: number }>({ running: false, pid: 0 });
    
    useEffect(() => {
        if (id) {
            const found = agents.find(a => a.id === id);
            setAgent(found);
            fetchStatus();
        }
    }, [id, agents]);

    const fetchStatus = async () => {
        if (!id) return;
        try {
            const res = await fetch(`/api/fins/agent/status?name=${encodeURIComponent(id)}`);
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            }
        } catch (e) {
            console.error("Failed to fetch agent status", e);
        }
    };

    const fetchLogs = async () => {
        if (!id) return;
        try {
            const res = await fetch(`/api/fins/agent/logs?name=${encodeURIComponent(id)}`);
          
            if (res.ok) {
                const text = await res.text();
                setLogs(text);
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchStatus();
        fetchLogs();
        const interval = setInterval(() => {
            fetchStatus();
            fetchLogs();
        }, 2000);
        return () => clearInterval(interval);
    }, [id]);

    const handleStop = async () => {
        if (!confirm(`Are you sure you want to stop agent ${id}?`)) return;
        try {
            await fetch('/api/fins/agent/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent_name: id })
            });
            if (id) removeAgent(id);
            navigate('/agents'); 
        } catch (e) {
            alert('Failed to stop agent');
        }
    };

    if (!id) return <div>Invalid Agent ID</div>;

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{id}</h1>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                                status.running 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                                {status.running ? 'Running' : 'Stopped'}
                            </span>
                             {status.running && <span className="text-xs font-mono text-slate-400">PID: {status.pid}</span>}
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                            <Monitor size={14} />
                            {agent ? `${agent.agent_ip}:${agent.agent_port}` : 'Loading config...'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button 
                         onClick={handleStop}
                         disabled={!status.running}
                         className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                             status.running 
                                ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' 
                                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                         }`}
                    >
                        <StopCircle size={16} />
                        Stop Agent
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden p-6">
                <div className="h-full flex flex-col gap-4">
                    <LogViewer logs={logs} />
                </div>
            </div>
        </div>
    );
};
