import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Box, Layers, Server } from 'lucide-react';
import { useSystem } from '../context/SystemContext';

const AVAILABLE_PLUGINS = [
];

export const CreateAgent: React.FC = () => {
    const navigate = useNavigate();
    const { packages } = useSystem();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        agent_name: '',
        agent_ip: '127.0.0.1',
        agent_port: 7777,
        log_level: 1,
        urgent_threads: 2,
        high_threads: 2,
        medium_threads: 4,
        low_threads: 4,
        plugins: [] as { name: string, source: string }[]
    });

    const threadConfig = [
        { key: 'urgent_threads', label: 'Urgent Threads' },
        { key: 'high_threads', label: 'High Threads' },
        { key: 'medium_threads', label: 'Medium Threads' },
        { key: 'low_threads', label: 'Low Threads' }
    ];

    const logLevels = [
        { value: 0, label: 'DEBUG' },
        { value: 1, label: 'INFO' },
        { value: 2, label: 'WARN' },
        { value: 3, label: 'ERROR' },
        { value: 4, label: 'OFF' }
    ];

    // Filter valid plugins from packages
    const availablePlugins = packages.map(p => ({ 
        name: p.name.split('/').pop() || p.name, // Short name
        source: p.source || 'Unknown',
        id: p.name, // Full ID
        description: p.description,
        version: p.version,
        icon_path: p.icon_path
    }));

    // Grouping Logic for Plugins (Similar to PackageList)
    const normalizeSource = (src: string) => {
         if (!src) return 'Unknown';
         if (src.startsWith('github@')) return 'github';
         return src;
    };

    const groupedPlugins: Record<string, typeof availablePlugins> = {};
    availablePlugins.forEach(p => {
        const src = normalizeSource(p.source);
        if (!groupedPlugins[src]) groupedPlugins[src] = [];
        groupedPlugins[src].push(p);
    });

    const togglePlugin = (plugin: { name: string, source: string, id: string }) => {
        setForm(prev => {
            const exists = prev.plugins.find(p => p.name === plugin.name && p.source === plugin.source);
            if (exists) {
                return { ...prev, plugins: prev.plugins.filter(p => !(p.name === plugin.name && p.source === plugin.source)) };
            } else {
                return { ...prev, plugins: [...prev.plugins, { name: plugin.name, source: plugin.source }] };
            }
        });
    };


    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/fins/agent/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to start agent');
            }

            navigate('/');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 h-full flex flex-col gap-6 relative bg-slate-50 dark:bg-slate-950 overflow-y-auto">
             <div className="max-w-7xl mx-auto w-full space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                     <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
                         <ArrowLeft size={20} className="text-slate-500" />
                     </button>
                     <div>
                         <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Create New Agent</h1>
                         <p className="text-slate-500">Configure and launch a new local agent instance</p>
                     </div>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <Server size={18} className="text-blue-500" />
                            <h2 className="font-bold text-slate-900 dark:text-slate-100">Basic Configuration</h2>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Agent Name</label>
                            <input 
                                value={form.agent_name}
                                onChange={e => setForm({...form, agent_name: e.target.value})}
                                placeholder="e.g. agent_alpha"
                                className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">IP Address</label>
                                <input 
                                    value={form.agent_ip}
                                    onChange={e => setForm({...form, agent_ip: e.target.value})}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Port</label>
                                <input 
                                    type="number"
                                    value={form.agent_port}
                                    onChange={e => setForm({...form, agent_port: Number(e.target.value)})}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Log Level</label>
                            <select 
                                value={form.log_level}
                                onChange={e => setForm({...form, log_level: Number(e.target.value)})}
                                className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            >
                                {logLevels.map(l => (
                                    <option key={l.value} value={l.value}>{l.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Thread Pool */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <Layers size={18} className="text-purple-500" />
                            <h2 className="font-bold text-slate-900 dark:text-slate-100">Thread Pool Config</h2>
                        </div>
                        
                        <div className="space-y-4">
                            {threadConfig.map(cfg => {
                                let styleClass = "ring-slate-500 border-slate-200";
                                let labelColor = "text-slate-500";
                                let labelText = cfg.label.replace(' Threads', '');
                                
                                if (cfg.key === 'urgent_threads') {
                                    styleClass = "ring-red-500 bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30";
                                    labelColor = "text-red-500";
                                } else if (cfg.key === 'high_threads') {
                                    styleClass = "ring-orange-500 bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-900/30";
                                    labelColor = "text-orange-500";
                                } else if (cfg.key === 'medium_threads') {
                                    styleClass = "ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30";
                                    labelColor = "text-blue-500";
                                }

                                return (
                                <div key={cfg.key} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                    <label className={`text-sm font-bold uppercase tracking-wider ${labelColor}`}>{labelText}</label>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="range"
                                            min={0}
                                            max={16}
                                            value={(form as any)[cfg.key]}
                                            onChange={e => setForm({...form, [cfg.key]: Number(e.target.value)})}
                                            className="w-24 accent-slate-500"
                                        />
                                        <input 
                                            type="number"
                                            min={0}
                                            value={(form as any)[cfg.key]}
                                            onChange={e => setForm({...form, [cfg.key]: Number(e.target.value)})}
                                            className={`w-14 text-center bg-white dark:bg-slate-800 border rounded-lg px-1 py-1 outline-none focus:ring-2 font-mono text-sm ${styleClass}`}
                                        />
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>
                </div>

                {/* Plugins */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <Box size={18} className="text-emerald-500" />
                        <h2 className="font-bold text-slate-900 dark:text-slate-100">Select Packages</h2>
                    </div>
                    
                    {Object.keys(groupedPlugins).length === 0 && (
                        <div className="text-slate-500 italic text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                            No packages available. Please scan or download packages first.
                        </div>
                    )}

                    <div className="space-y-6">
                    {Object.keys(groupedPlugins).sort((a, b) => {
                        if (a === 'github') return -1;
                        if (b === 'github') return 1;
                        return a.localeCompare(b);
                    }).map(source => (
                        <div key={source}>
                             <div className="flex items-center gap-2 mb-3">
                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                                    {source}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {groupedPlugins[source].sort((a, b) => a.name.localeCompare(b.name)).map(plugin => {
                                    const isSelected = form.plugins.some(p => p.name === plugin.name && p.source === plugin.source);
                                    return (
                                        <div 
                                            key={plugin.id}
                                            onClick={() => togglePlugin(plugin)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col gap-1 relative ${
                                                isSelected 
                                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-sm ring-1 ring-blue-500' 
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden ${isSelected ? 'bg-white' : 'bg-slate-50 dark:bg-slate-800'}`}>
                                                     {plugin.icon_path ? (
                                                        <img src={`/api/fins/package/asset/${plugin.id}/${plugin.icon_path.replace(/^\/+/, '')}`} alt={plugin.name} className="w-full h-full object-contain" />
                                                    ) : (
                                                        <Box className={isSelected ? "text-blue-500" : "text-slate-400"} size={18} />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                     <div className="flex items-center justify-between mb-1">
                                                        <h3 className={`font-bold text-sm truncate pr-2 ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}`}>
                                                            {plugin.name}
                                                        </h3>
                                                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-[10px] font-mono">
                                                            v{plugin.version}
                                                        </span>
                                                     </div>
                                                     <p className="text-xs text-slate-500 line-clamp-1">{plugin.description}</p>
                                                </div>
                                            </div>
                                            
                                            {isSelected && (
                                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    </div>
                </div>

                <div className="flex justify-end pt-4 pb-8">
    
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
  
                    <button 
                         onClick={handleSubmit}
                         disabled={loading || !form.agent_name}
                         className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 transition-all ${
                             loading || !form.agent_name 
                                ? 'bg-slate-300 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-xl hover:scale-[1.02]'
                         }`}
                    >
                        {loading ? 'Launching Agent...' : 'Launch Agent'}
                        {!loading && <Play size={18} fill="currentColor" />}
                    </button>
                </div>
             </div>
        </div>
    );
};
