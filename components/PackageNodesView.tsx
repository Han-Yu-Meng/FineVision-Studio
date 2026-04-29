import React, { useState } from 'react';
import { 
    Box, Cpu, Timer, Layers, FileCode, AlertTriangle, Send, Server, Target, Radio 
} from 'lucide-react';
import { InspectResult } from '../types_pkg';
import { TypeIcon, ServiceBadge, ActionBadge } from './ServiceBadge';
import { renderTextWithKaTeX } from '../utils/dataflowUtils';

interface PackageNodesViewProps {
    inspectData: InspectResult[];
    inspectLoading?: boolean;
    inspectError?: string | null;
    onRefresh?: () => void;
    emptyMessage?: string;
}

const renderKaTeX = (text: string) => {
    const parts = renderTextWithKaTeX(text);
    return parts.map((p: any) => {
        if (p.type === 'math') {
            return <span key={p.key} dangerouslySetInnerHTML={{ __html: p.html }} className="inline-block align-middle" />;
        }
        return <span key={p.key}>{p.content}</span>;
    });
};

export const PackageNodesView: React.FC<PackageNodesViewProps> = ({
    inspectData,
    inspectLoading,
    inspectError,
    onRefresh,
    emptyMessage = "No node definitions found"
}) => {
    const [showDependencies, setShowDependencies] = useState(false);

    if (inspectLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
                <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <span className="font-medium animate-pulse">Analyzing package structure...</span>
            </div>
        );
    }

    if (inspectError) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full">
                    <AlertTriangle className="text-red-500" size={32} />
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">Analysis Failed</h3>
                    <p className="text-sm max-w-md mx-auto mb-4">{inspectError}</p>
                    {onRefresh && (
                        <button 
                            onClick={onRefresh}
                            className="text-xs font-bold text-blue-600 hover:underline"
                        >
                            Try Refreshing
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (!inspectData || inspectData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <Code2 size={48} className="mb-4 opacity-20" />
                <p className="font-medium">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {inspectData.map((res, idx) => (
                <div key={idx} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* File Header */}
                    <div className="flex items-center gap-3 mb-4 px-1">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            <FileCode size={20} className="text-slate-500" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg font-mono">
                                {res.file_path.split('/').pop()}
                            </h3>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                <span className="flex items-center gap-1"><Cpu size={12}/> {res.architecture}</span>
                                <span className="flex items-center gap-1"><Timer size={12}/> {res.load_time_ms.toFixed(1)}ms load</span>
                                <button 
                                    onClick={() => setShowDependencies(!showDependencies)}
                                    className="hover:text-blue-500 transition-colors flex items-center gap-1"
                                >
                                    <Layers size={12} /> {showDependencies ? 'Hide Deps' : 'Show Deps'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {showDependencies && (
                        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap overflow-x-auto max-h-48 custom-scrollbar shadow-inner">
                            {res.dependencies}
                        </div>
                    )}

                    {/* Inspect Error Display */}
                    {res.status === 'ERROR' && (
                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 animate-in fade-in zoom-in-95">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400 shrink-0">
                                    <AlertTriangle size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-red-900 dark:text-red-200 text-sm mb-1">Inspection Failed</h4>
                                    <div className="text-xs font-mono text-red-700 dark:text-red-300 break-all whitespace-pre-wrap bg-white dark:bg-slate-950 border border-red-100 dark:border-red-900/30 rounded p-2 shadow-sm">
                                        {res.error}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Nodes Grid */}
                    {res.status === 'VALID' && res.nodes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                            <Box size={32} className="opacity-20 mb-2" />
                            <p className="text-xs">No nodes found in this library.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                            {res.nodes.map((node, nIdx) => (
                                <div key={nIdx} className="bg-white dark:bg-slate-900 rounded-lg border-2 border-slate-200 dark:border-slate-700 shadow-md min-w-[220px] relative transition-all hover:border-blue-500/50">
                                    {/* Header */}
                                    <div className="bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-t-lg border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{renderKaTeX(node.name)}</span>
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="p-3 space-y-4">
                                        {/* IO Container */}
                                        <div className="flex justify-between gap-4">
                                            {/* Inputs */}
                                            <div className="flex flex-col gap-3 flex-1">
                                                {node.inputs.map((input, i) => (
                                                    <div key={i} className="relative flex items-center h-5">
                                                        <div className="w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 bg-blue-500 absolute -left-[19px]"></div>
                                                        <div className="flex items-center gap-1.5 ml-1">
                                                            <TypeIcon type={input.type} size={10} />
                                                            <span className="text-xs text-slate-900 dark:text-white font-bold">{renderKaTeX(input.name)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {node.inputs.length === 0 && <span className="text-slate-300 italic text-xs">No inputs</span>}
                                            </div>

                                            {/* Outputs */}
                                            <div className="flex flex-col gap-3 flex-1 items-end">
                                                {node.outputs.map((output, i) => (
                                                    <div key={i} className="relative flex items-center justify-end h-5">
                                                        <div className="flex items-center gap-1.5 mr-1">
                                                            <span className="text-xs text-slate-900 dark:text-white font-bold">{renderKaTeX(output.name)}</span>
                                                            <TypeIcon type={output.type} size={10} />
                                                        </div>
                                                        <div className="w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500 absolute -right-[19px]"></div>
                                                    </div>
                                                ))}
                                                {node.outputs.length === 0 && <span className="text-slate-300 italic text-xs">No outputs</span>}
                                            </div>
                                        </div>

                                        {/* Parameters */}
                                        {node.parameters && node.parameters.length > 0 && (
                                            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 mt-2">
                                                <div className="space-y-2">
                                                    {node.parameters.map((param, i) => (
                                                        <div key={i} className="flex flex-col gap-1">
                                                            <div className="flex justify-between items-baseline">
                                                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{param.name}</label>
                                                                <span className="text-[9px] text-slate-400 font-mono">{param.type}</span>
                                                            </div>
                                                            <div className="font-mono w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs text-slate-600 dark:text-slate-400 truncate" title={param.default_value}>
                                                                {param.default_value !== undefined && param.default_value !== "" ? param.default_value : <span className="italic opacity-50">Empty</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Services & Actions */}
                                        {((node as any).clients?.length > 0 || (node as any).servers?.length > 0 || (node as any).actors?.length > 0 || (node as any).commanders?.length > 0) && (
                                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 mt-2">
                                                <div className="space-y-2">
                                                    {(node as any).clients?.map((client: any, i: number) => (
                                                        <div key={`client-${i}`} className="bg-indigo-50/50 dark:bg-indigo-900/10 rounded p-1.5 border border-indigo-100 dark:border-indigo-900/30">
                                                            <div className="flex justify-between items-center text-[10px]">
                                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                                    <Send size={12} className="text-indigo-500 shrink-0" />
                                                                    <span className="font-bold text-indigo-700 dark:text-indigo-300 truncate" title={client.name}>{client.name}</span>
                                                                </div>
                                                                <ServiceBadge reqType={client.request_type} resType={client.response_type} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(node as any).servers?.map((server: any, i: number) => (
                                                        <div key={`server-${i}`} className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded p-1.5 border border-emerald-100 dark:border-emerald-900/30">
                                                            <div className="flex justify-between items-center text-[10px]">
                                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                                    <Server size={12} className="text-emerald-500 shrink-0" />
                                                                    <span className="font-bold text-emerald-700 dark:text-emerald-300 truncate" title={server.name}>{server.name}</span>
                                                                </div>
                                                                <ServiceBadge reqType={server.request_type} resType={server.response_type} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(node as any).actors?.map((actor: any, i: number) => (
                                                        <div key={`actor-${i}`} className="bg-purple-50/50 dark:bg-purple-900/10 rounded p-1.5 border border-purple-100 dark:border-purple-900/30">
                                                            <div className="flex justify-between items-center text-[10px]">
                                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                                    <Target size={12} className="text-purple-500 shrink-0" />
                                                                    <span className="font-bold text-purple-700 dark:text-purple-300 truncate" title={actor.name}>{actor.name}</span>
                                                                </div>
                                                                <ActionBadge goalType={actor.goal_type} feedbackType={actor.feedback_type} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(node as any).commanders?.map((commander: any, i: number) => (
                                                        <div key={`commander-${i}`} className="bg-amber-50/50 dark:bg-amber-900/10 rounded p-1.5 border border-amber-100 dark:border-amber-900/30">
                                                            <div className="flex justify-between items-center text-[10px]">
                                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                                    <Radio size={12} className="text-amber-500 shrink-0" />
                                                                    <span className="font-bold text-amber-700 dark:text-amber-300 truncate" title={commander.name}>{commander.name}</span>
                                                                </div>
                                                                <ActionBadge goalType={commander.goal_type} feedbackType={commander.feedback_type} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const Code2 = ({ size, className }: { size: number, className: string }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
    </svg>
);
