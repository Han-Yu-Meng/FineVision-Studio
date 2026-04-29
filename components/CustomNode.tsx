
import React, { memo, useState, useEffect, useMemo } from 'react';
import { Handle, Position, NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import { Image as ImageIcon, Box, Hash, Type, Activity, Clock, Compass, Map, Move3d, ScrollText, ChevronDown, ChevronUp, Maximize2, Minimize2, Scan, Grid, Wind, MapPin, ExternalLink, Info, Network, ArrowRight, Send, Server, ToggleLeft, Quote, Target, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSystem } from '../context/SystemContext';
import { ParameterDef, LogEntry } from '../types';
import { filterLogsByClearTime } from '../utils/dataflowUtils';
import { TypeIcon, ServiceBadge, ActionBadge } from './ServiceBadge';
import { renderTextWithKaTeX } from '../utils/dataflowUtils';
import 'katex/dist/katex.min.css';

export const CustomNode = memo(({ id: reactFlowId, data, selected }: NodeProps) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const navigate = useNavigate();
  const { editorSelectedAgentId, getAgentClearTimestamp } = useSystem();

  const { 
    label, 
    user_id, 
    inputs = [], 
    outputs = [], 
    parameterDefs = [], 
    currentParameterValues = {}, 
    clients = [],
    servers = [],
    actors = [],
    commanders = [],
    onParameterChange,
    onClientChange,
    onServerChange,
    onActorChange,
    onCommanderChange,
    onIdChange,
    onCollapseChange,
    collapsed = false,
    onVersionChange,
    source,
    version,
    package_name,
    metrics,
    logs = [],
    isUnsupported,
    highlightedPorts, 
    agentId,
    hasCompilationError = false, 
    isCompiling = false 
  } = data as any;

  const { agents, localCapabilities } = useSystem();
  const resolvedAgentId = agentId || editorSelectedAgentId;
  const agent = agents.find(a => a.id === resolvedAgentId);

  const variants = useMemo(() => {
    if (!agent) return [];
    return Object.values(agent.capabilities).filter((c: any) => c.name === label);
  }, [agent, label]);
  
  const hasMultipleVariants = variants.length > 1;

  // Calculate isUnsupported locally based on available capabilities
  const isActuallyUnsupported = useMemo(() => {
    // Check if this node type exists in either local capabilities or agent capabilities
    const hasLocalCapability = Object.values(localCapabilities).some(pkgCaps => 
      pkgCaps.some((cap: any) => cap.name === label)
    );
    const hasAgentCapability = agent && Object.values(agent.capabilities).some((cap: any) => cap.name === label);
    
    return !hasLocalCapability && !hasAgentCapability;
  }, [localCapabilities, agent, label]);

  useEffect(() => {
    updateNodeInternals(reactFlowId);
  }, [collapsed, reactFlowId, updateNodeInternals]);

  // Refresh node when capabilities change to auto-update disabled state
  useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [localCapabilities, agent?.capabilities]);

  const [showLogs, setShowLogs] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleLogClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const targetAgentId = agentId || editorSelectedAgentId;
    const resolvedNodeId = user_id || reactFlowId;
    
    if (targetAgentId && resolvedNodeId) {
        const path = `/logs/${encodeURIComponent(targetAgentId)}/${encodeURIComponent(resolvedNodeId)}`;
        setTimeout(() => {
            navigate(path);
        }, 0);
    }
  };

  const isNeighbor = !selected && highlightedPorts; 
  
  let containerClasses = 'bg-white dark:bg-slate-900 rounded-lg border-2 min-w-[240px] transition-all duration-300 relative ';
  
  if (isActuallyUnsupported) {
      containerClasses += 'opacity-60 grayscale border-slate-200 dark:border-slate-700 shadow-none';
  } else if (selected) {
      containerClasses += 'border-blue-500 shadow-xl opacity-100 z-10';
  } else {
      containerClasses += 'border-slate-200 dark:border-slate-700 shadow-md opacity-100';
  }

  const isPortHighlighted = (portName: string) => {
      if (!highlightedPorts) return false;
      return highlightedPorts.includes(portName);
  };

  const renderKaTeX = (text: string) => {
    const parts = renderTextWithKaTeX(text);
    return parts.map((p: any) => {
      if (p.type === 'math') {
        return <span key={p.key} dangerouslySetInnerHTML={{ __html: p.html }} className="inline-block align-middle" />;
      }
      return <span key={p.key}>{p.content}</span>;
    });
  };

  return (
    <div key={refreshKey} className={containerClasses}>
      
      {/* Runtime Metrics Badges */}
      {!collapsed && metrics && (
        <div className="absolute -top-8 left-0 right-0 flex justify-between gap-2 text-[10px] font-mono font-bold">
            <div className="bg-slate-100 dark:bg-slate-800 text-green-600 dark:text-green-400 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1 shadow-sm">
                <Activity size={10} /> {metrics.fps.toFixed(1)} FPS
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 text-orange-600 dark:text-orange-400 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1 shadow-sm">
                <Clock size={10} /> {metrics.processTime.toFixed(1)} ms
            </div>
        </div>
      )}

      {/* Header - Normal opacity for all states */}
      <div className={`bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-t-lg border-b border-slate-200 dark:border-slate-700 transition-opacity duration-300 opacity-100`}>
        <div className="flex justify-between items-center mb-1">
             <div className="flex items-center gap-1.5">
                {hasCompilationError ? (
                    <span 
                        className="font-bold text-sm text-slate-900 dark:text-slate-100 cursor-pointer hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        style={{
                            textDecoration: 'underline wavy',
                            textDecorationColor: '#dc2626',
                            textDecorationThickness: '1px',
                            textUnderlineOffset: '2px',
                            textDecorationSkipInk: 'none'
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (package_name) {
                                const pkgSource = source || 'local';
                                navigate(`/package/${encodeURIComponent(pkgSource)}/${encodeURIComponent(package_name)}?tab=compilation`);
                            }
                        }}
                        title="Compilation error - click to view details"
                    >
                        {label}
                    </span>
                ) : isCompiling ? (
                    <span 
                        className="font-bold text-sm text-slate-900 dark:text-slate-100 animate-pulse"
                        title="Compiling..."
                    >
                        {label}
                    </span>
                ) : (
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{label}</span>
                )}
                <div 
                    className="group relative flex items-center cursor-pointer" 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (package_name) {
                            const pkgSource = source || 'local';
                            navigate(`/package/${encodeURIComponent(pkgSource)}/${encodeURIComponent(package_name)}`);
                        }
                    }}
                >
                    <Info size={12} className="text-slate-300 hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400 transition-colors" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-[100] w-max max-w-[200px] bg-slate-800 text-slate-100 rounded p-2 shadow-xl border border-slate-700 pointer-events-none">
                        <div className="text-[10px] space-y-0.5">
                            <div className="flex gap-2"><span className="text-slate-400">ID:</span> <span className="font-mono text-yellow-400">{user_id || reactFlowId}</span></div>
                            <div className="flex gap-2"><span className="text-slate-400">Ver:</span> <span className="font-mono">{version || 'default'}</span></div>
                            <div className="flex gap-2"><span className="text-slate-400">Source:</span> <span className="font-mono">{source || 'local'}</span></div>
                            {package_name && <div className="flex gap-2"><span className="text-slate-400">Pkg:</span> <span className="font-mono underline decoration-slate-500">{package_name}</span></div>}
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                    </div>
                </div>
             </div>
             <button 
                onClick={(e) => {
                    e.stopPropagation();
                    if (onCollapseChange) onCollapseChange(reactFlowId, !collapsed);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title={collapsed ? "Expand" : "Collapse"}
             >
                 {collapsed ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
             </button>
        </div>
        
        {/* Controls Row */}
        {!collapsed && hasMultipleVariants && onVersionChange && (
            <div className="flex flex-col gap-1 mt-1">
                <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500 font-mono">Ver:</span>
                    <select 
                        className="nodrag text-[9px] bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none text-slate-600 dark:text-slate-400 max-w-[120px]"
                        value={`${source}|${package_name}|${version}`}
                        onChange={(e) => {
                            const [s, p, v] = e.target.value.split('|');
                            onVersionChange(reactFlowId, s, v, p);
                        }}
                    >
                        {variants.map((v: any, idx: number) => {
                            const val = `${v.source}|${v.package_name}|${v.version}`;
                            let display = v.version;
                            if (v.source === 'workspace') display = `workspace (${v.version})`;
                            else display = `${v.source} (${v.version})`;

                            return <option key={idx} value={val}>{display}</option>;
                        })}
                    </select>
                </div>
            </div>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="p-3 space-y-4">
            {/* Input/Output Row Container */}
            <div className="flex justify-between gap-2">
            
            {/* Inputs (Left) */}
            <div className="flex flex-col gap-3 flex-1">
                {inputs.map((input: any, idx: number) => {
                    const name = input.name || input.description;
                    const isHighlighted = isPortHighlighted(name);
                    
                    return (
                        <div key={`${reactFlowId}-in-${idx}`} 
                             className={`relative flex items-center h-5 transition-all duration-300`} 
                             title={input.type}
                        >
                            <Handle
                            type="target"
                            position={Position.Left}
                            id={name}
                            className={`!w-3 !h-3 !-left-[19px] !border-2 !border-white dark:!border-slate-900 transition-colors !bg-blue-500`}
                            />
                            <div className={`flex items-center gap-1.5 ml-0.5 px-2 py-1 rounded-full transition-all duration-300 ${
                                isHighlighted ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                            }`}>
                                <TypeIcon type={input.type} size={10} />
                                <span className={`text-xs font-mono font-extrabold text-slate-900 dark:text-white`}>
                                    {renderKaTeX(name)}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Outputs (Right) */}
            <div className="flex flex-col gap-3 flex-1 items-end">
                {outputs.map((output: any, idx: number) => {
                    const name = output.name || output.description;
                    const isHighlighted = isPortHighlighted(name);
                    
                    return (
                        <div key={`${reactFlowId}-out-${idx}`} 
                             className={`relative flex items-center justify-end h-5 transition-all duration-300`}
                             title={output.type}
                        >
                            <div className={`flex items-center gap-1.5 mr-0.5 px-2 py-1 rounded-full transition-all duration-300 ${
                                isHighlighted ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                            }`}>
                                <span className={`text-xs text-right font-mono font-extrabold text-slate-900 dark:text-white`}>
                                    {renderKaTeX(name)}
                                </span>
                                <TypeIcon type={output.type} size={10} />
                            </div>
                            <Handle
                            type="source"
                            position={Position.Right}
                            id={name}
                            className={`!w-3 !h-3 !-right-[19px] !border-2 !border-white dark:!border-slate-900 transition-colors !bg-emerald-500`}
                            />
                        </div>
                    );
                })}
            </div>
            </div>

            {/* Services & Actions Section */}
            {(clients.length > 0 || servers.length > 0 || actors.length > 0 || commanders.length > 0) && (
                <div className={`pt-2 border-t border-slate-200 dark:border-slate-700 mt-2 transition-opacity duration-300 opacity-100`}>
                    <div className="space-y-2">
                        {/* Render Clients */}
                        {clients.map((client: any, i: number) => (
                            <div key={`client-${i}`} className="bg-indigo-50/50 dark:bg-indigo-900/10 rounded p-1.5 border border-indigo-100 dark:border-indigo-900/30">
                                <div className="flex justify-between items-center text-[10px] mb-1">
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                        <Send size={12} className="text-indigo-500" />
                                        <span className="font-bold text-indigo-700 dark:text-indigo-300 truncate" title={client.name}>
                                            {renderKaTeX(client.name)}
                                        </span>
                                    </div>
                                    <ServiceBadge reqType={client.request_type} resType={client.response_type} />
                                </div>
                                <div className="flex items-center gap-1">
                                    <input 
                                        className="nodrag flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 font-mono"
                                        value={client.topic || ''}
                                        placeholder={"Topic"}
                                        onChange={(e) => onClientChange(reactFlowId, client.name, e.target.value)}
                                    />
                                </div>
                            </div>
                        ))}
                        {/* Render Servers */}
                        {servers.map((server: any, i: number) => (
                             <div key={`server-${i}`} className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded p-1.5 border border-emerald-100 dark:border-emerald-900/30">
                                <div className="flex justify-between items-center text-[10px] mb-1">
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                        <Server size={12} className="text-emerald-500" />
                                        <span className="font-bold text-emerald-700 dark:text-emerald-300 truncate" title={server.name}>
                                            {renderKaTeX(server.name)}
                                        </span>
                                    </div>
                                    <ServiceBadge reqType={server.request_type} resType={server.response_type} />
                                </div>
                                <div className="flex items-center gap-1">
                                    <input 
                                        className="nodrag flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
                                        value={server.topic || ''}
                                        placeholder={"Topic"}
                                        onChange={(e) => onServerChange && onServerChange(reactFlowId, server.name, e.target.value)}
                                    />
                                </div>
                            </div>
                        ))}
                        {/* Render Actors */}
                        {actors.map((actor: any, i: number) => (
                            <div key={`actor-${i}`} className="bg-purple-50/50 dark:bg-purple-900/10 rounded p-1.5 border border-purple-100 dark:border-purple-900/30">
                                <div className="flex justify-between items-center text-[10px] mb-1">
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                        <Target size={12} className="text-purple-500" />
                                        <span className="font-bold text-purple-700 dark:text-purple-300 truncate" title={actor.name}>
                                            {renderKaTeX(actor.name)}
                                        </span>
                                    </div>
                                    <ActionBadge goalType={actor.goal_type} feedbackType={actor.feedback_type} />
                                </div>
                                <div className="flex items-center gap-1">
                                    <input 
                                        className="nodrag flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-purple-500 font-mono"
                                        value={actor.topic || ''}
                                        placeholder={"Topic"}
                                        onChange={(e) => onActorChange && onActorChange(reactFlowId, actor.name, e.target.value)}
                                    />
                                </div>
                            </div>
                        ))}
                        {/* Render Commanders */}
                        {commanders.map((commander: any, i: number) => (
                            <div key={`commander-${i}`} className="bg-amber-50/50 dark:bg-amber-900/10 rounded p-1.5 border border-amber-100 dark:border-amber-900/30">
                                <div className="flex justify-between items-center text-[10px] mb-1">
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                        <Radio size={12} className="text-amber-500" />
                                        <span className="font-bold text-amber-700 dark:text-amber-300 truncate" title={commander.name}>
                                            {renderKaTeX(commander.name)}
                                        </span>
                                    </div>
                                    <ActionBadge goalType={commander.goal_type} feedbackType={commander.feedback_type} />
                                </div>
                                <div className="flex items-center gap-1">
                                    <input 
                                        className="nodrag flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
                                        value={commander.topic || ''}
                                        placeholder={"Topic"}
                                        onChange={(e) => onCommanderChange && onCommanderChange(reactFlowId, commander.name, e.target.value)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Parameters (Configuration) */}
            {parameterDefs.length > 0 && (
            <div className={`pt-2 border-t border-slate-200 dark:border-slate-800 mt-2 transition-opacity duration-300 opacity-100`}>
                <div className="space-y-2">
                {parameterDefs.map((param: ParameterDef) => { 
                    const isNumber = param.type === 'int' || param.type === 'double' || param.type === 'float';
                    const isBool = param.type === 'bool';
                    const paramName = param.name;
                    const val = currentParameterValues[paramName];

                    if (isBool) {
                        return (
                            <div key={paramName} className="flex items-center justify-between py-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400">{paramName}</label>
                                <input 
                                    type="checkbox"
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 cursor-pointer"
                                    checked={val === true || val === 'true' || val === 1}
                                    onChange={(e) => {
                                        onParameterChange(reactFlowId, paramName, e.target.checked);
                                    }}
                                />
                            </div>
                        );
                    }

                    return (
                    <div key={paramName} className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 flex justify-between">
                            {paramName} 
                            <span className="opacity-50 font-mono text-[9px]">{param.type}</span>
                        </label>
                        {isNumber ? (
                        <input
                            type="number"
                            className="nodrag font-mono w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                            value={val !== undefined && !Number.isNaN(val) ? val : ''}
                            placeholder={param.default_value}
                            onChange={(e) => {
                                const v = e.target.value;
                                // Retain as string if user typing, parse when needed, or allow float
                                onParameterChange(reactFlowId, paramName, v === '' ? undefined : parseFloat(v));
                            }}
                        />
                        ) : (
                        <textarea
                            className="nodrag font-mono w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 min-h-[2.5rem] resize-y"
                            rows={2}
                            value={val !== undefined ? val : ''}
                            placeholder={param.default_value}
                            onChange={(e) => onParameterChange(reactFlowId, paramName, e.target.value)}
                        />
                        )}
                    </div>
                    );
                })}
                </div>
            </div>
            )}

            {/* Logs Section */}
            {logs && logs.length > 0 && (() => {
                // Filter logs based on clear timestamp
                const currentAgentId = agentId || editorSelectedAgentId;
                const clearTimestamp = currentAgentId ? getAgentClearTimestamp(currentAgentId) : 0;
                const filteredLogs = filterLogsByClearTime(logs, clearTimestamp);
                
                if (filteredLogs.length === 0) return null;
                
                return (
                    <div className={`pt-2 border-t border-slate-200 dark:border-slate-800 mt-2 transition-opacity duration-300 opacity-100`}>
                        <div className="flex items-center justify-between mb-1">
                            <button 
                                onClick={() => setShowLogs(!showLogs)}
                                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                            >
                                <ScrollText size={12} />
                                <span>Logs ({filteredLogs.length})</span>
                                {showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                            <button 
                                onClick={handleLogClick}
                                className="p-1 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                title="Open Full Logs"
                            >
                                <ExternalLink size={12} />
                            </button>
                        </div>
                        
                        {showLogs && (
                        <div 
                            className="mt-1 max-h-32 overflow-y-auto p-2 bg-slate-100 dark:bg-slate-950 rounded text-[10px] font-mono space-y-1 custom-scrollbar border border-slate-200 dark:border-slate-800 nodrag nowheel cursor-text" 
                            onMouseDown={(e) => e.stopPropagation()}
                            onWheel={(e) => e.stopPropagation()}
                        >
                            {[...filteredLogs].reverse().slice(0, 10).map((log: LogEntry, i: number) => (
                            <div key={i} className="flex gap-1.5 items-start leading-tight">
                                <span className="text-slate-400 shrink-0 text-[9px]">{new Date(log.timestamp * 1000).toLocaleTimeString([], {hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit"})}</span>
                                <span className={`font-bold shrink-0 text-[9px] px-1 rounded ${
                                log.level === 'ERROR' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                                log.level === 'WARN' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                                log.level === 'DEBUG' ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400' :
                                'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}>{log.level}</span>
                                <span className="text-slate-700 dark:text-slate-300 break-all" style={{ maxWidth: '50ch' }}>{log.message}</span>
                            </div>
                            ))}
                        </div>
                        )}
                    </div>
                );
            })()}
        </div>
      )}

      {/* Collapsed View */}
      {collapsed && (
         <div className="p-3">
            <div className="flex justify-between gap-2">
                {/* Inputs */}
                <div className="flex flex-col gap-1 flex-1">
                    {inputs.map((input: any, idx: number) => {
                        const name = input.name || input.description;
                        const isHighlighted = isPortHighlighted(name);

                        return (
                            <div key={`${reactFlowId}-in-${idx}`} className={`relative flex items-center h-3 transition-all duration-300`} title={name}>
                                <Handle
                                type="target"
                                position={Position.Left}
                                id={name}
                                className={`!w-3 !h-3 !-left-[19px] !border-2 !border-white dark:!border-slate-900 transition-colors !bg-blue-500`}
                                />
                                <div className={`ml-0.5 opacity-50 hover:opacity-100 transition-opacity px-1 rounded-full ${
                                    isHighlighted ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                                }`}>
                                    <TypeIcon type={input.type} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Outputs */}
                <div className="flex flex-col gap-1 flex-1 items-end">
                    {outputs.map((output: any, idx: number) => {
                        const name = output.name || output.description;
                        const isHighlighted = isPortHighlighted(name);

                        return (
                            <div key={`${reactFlowId}-out-${idx}`} className={`relative flex items-center justify-end h-3 transition-all duration-300`} title={name}>
                                <div className={`mr-0.5 opacity-50 hover:opacity-100 transition-opacity px-1 rounded-full ${
                                    isHighlighted ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                                }`}>
                                    <TypeIcon type={output.type} />
                                </div>
                                <Handle
                                type="source"
                                position={Position.Right}
                                id={name}
                                className={`!w-3 !h-3 !-right-[19px] !border-2 !border-white dark:!border-slate-900 transition-colors !bg-emerald-500`}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
         </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  const prevData = prevProps.data;
  const nextData = nextProps.data;
  
  if (prevProps.selected !== nextProps.selected) {
    return false;
  }
  
  if (prevProps.id !== nextProps.id) {
    return false;
  }
  
  if (prevData.hasCompilationError !== nextData.hasCompilationError) {
    return false;
  }
  
  if (prevData.isCompiling !== nextData.isCompiling) {
    return false;
  }
  
  if (prevData.collapsed !== nextData.collapsed) return false;
  if (prevData.metrics !== nextData.metrics) return false;
  if ((prevData.logs as any[])?.length !== (nextData.logs as any[])?.length) return false;
  if (prevData.highlightedPorts !== nextData.highlightedPorts) return false;
  
  if (prevData.currentParameterValues !== nextData.currentParameterValues) return false;
  
  return true;
});
