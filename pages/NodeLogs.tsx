
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSystem, useAgentMetrics } from '../context/SystemContext';
import { ArrowLeft, Terminal, Filter, Download, Search, CheckCircle, Copy } from 'lucide-react';
import { filterLogsByClearTime } from '../utils/dataflowUtils';

const ROW_HEIGHT = 24; 

const getLogKey = (log: { timestamp: number; message: string }, index: number) => {
    return `${log.timestamp}-${log.message}-${index}`; 
};

export const NodeLogs: React.FC = () => {
    const { agentId, nodeId } = useParams<{ agentId: string; nodeId: string }>();
    const navigate = useNavigate();
    const { addNotification, getAgentClearTimestamp } = useSystem(); 

    const agent = useAgentMetrics(agentId);

    const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set(['INFO', 'WARN', 'ERROR', 'DEBUG']));
    const [searchQuery, setSearchQuery] = useState('');
    
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [lastSelectedKey, setLastSelectedKey] = useState<string | null>(null);
    
    const [autoScroll, setAutoScroll] = useState(true);

    const logs = useMemo(() => {
        if (!agent || !agent.nodeMetrics || !nodeId || !agentId) return [];
        const fullLogs = agent.nodeMetrics[nodeId]?.logs || [];
        
        const clearTimestamp = getAgentClearTimestamp(agentId);
        
        const filteredByTime = filterLogsByClearTime(fullLogs, clearTimestamp);
        
        return filteredByTime.slice(-10000); 
    }, [agent, nodeId, agentId, getAgentClearTimestamp]);

    const filteredLogs = useMemo(() => {
        let res = [...logs];
        
        if (selectedLevels.size < 4) { 
            res = res.filter(log => selectedLevels.has(log.level));
        }
        
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            res = res.filter(log => log.message.toLowerCase().includes(lower));
        }
        
        return res.reverse(); 
    }, [logs, selectedLevels, searchQuery]);

    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    useEffect(() => {
        if (containerRef.current) {
            setContainerHeight(containerRef.current.clientHeight);
            const handleResize = () => setContainerHeight(containerRef.current?.clientHeight || 0);
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, []);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        setScrollTop(target.scrollTop);
        
        const isAtTop = target.scrollTop < 20;
        setAutoScroll(isAtTop);
    };

    useEffect(() => {
        if (autoScroll && containerRef.current && filteredLogs.length > 0) {
            containerRef.current.scrollTop = 0;
        }
    }, [filteredLogs.length, autoScroll]);

    const totalHeight = filteredLogs.length * ROW_HEIGHT;
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5); 
    const endIndex = Math.min(filteredLogs.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + 5);
    const visibleLogs = filteredLogs.slice(startIndex, endIndex);
    const offsetY = startIndex * ROW_HEIGHT;

    const [isCtrlDragging, setIsCtrlDragging] = useState(false);
    
    const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);

    const handleMouseDown = (index: number, logKey: string, e: React.MouseEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault(); 
            setIsCtrlDragging(true);
            setDragStartIndex(index);
            
            const newSet = new Set(selectedKeys);
            if (newSet.has(logKey)) newSet.delete(logKey);
            else newSet.add(logKey);
            
            setSelectedKeys(newSet);
            setLastSelectedKey(logKey);
        } else if (e.shiftKey && lastSelectedKey) {
            e.preventDefault();
            const lastIndex = filteredLogs.findIndex((l, i) => getLogKey(l, i) === lastSelectedKey);
            
            if (lastIndex !== -1) {
                const start = Math.min(lastIndex, index);
                const end = Math.max(lastIndex, index);
                const newSet = new Set(selectedKeys);
                
                for (let i = start; i <= end; i++) {
                    newSet.add(getLogKey(filteredLogs[i], i));
                }
                setSelectedKeys(newSet);
            }
        } else {
            setSelectedKeys(new Set([logKey]));
            setLastSelectedKey(logKey);
            setIsCtrlDragging(false); 
        }
    };

    const handleMouseEnter = (index: number) => {
        if (isCtrlDragging && dragStartIndex !== null && (window.event as MouseEvent)?.ctrlKey) {
            const start = Math.min(dragStartIndex, index);
            const end = Math.max(dragStartIndex, index);
            const newSet = new Set(selectedKeys);
            
            for (let i = start; i <= end; i++) {
                newSet.add(getLogKey(filteredLogs[i], i));
            }
            setSelectedKeys(newSet);
        }
    };

    const handleMouseUp = () => {
        setIsCtrlDragging(false);
        setDragStartIndex(null);
    };

    useEffect(() => {
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    const handleCopy = useCallback(() => {
        if (selectedKeys.size === 0) return;

        const logsToCopy = filteredLogs
            .filter((l, i) => selectedKeys.has(getLogKey(l, i)))
            .map(log => {
                const time = new Date(log.timestamp * 1000).toISOString();
                return `[${time}] [${log.level}] ${log.message}`;
            });

        if (logsToCopy.length === 0) return;

        const text = logsToCopy.join('\n');

        const fallbackCopy = (text: string) => {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                textarea.style.top = '0';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textarea);
                if (successful) {
                    addNotification({ message: `Copied ${logsToCopy.length} lines`, type: 'success' });
                } else {
                    addNotification({ message: 'Copy failed (fallback)', type: 'error' });
                }
            } catch (err) {
                console.error("Fallback copy failed", err);
                addNotification({ message: 'Copy failed', type: 'error' });
            }
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                addNotification({ message: `Copied ${logsToCopy.length} lines`, type: 'success' });
            }).catch(err => {
                console.warn("Clipboard API failed, trying fallback", err);
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }, [selectedKeys, filteredLogs, addNotification]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                const allKeys = new Set(filteredLogs.map((l, i) => getLogKey(l, i)));
                setSelectedKeys(allKeys);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                handleCopy();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredLogs, handleCopy]);

    const handleDownload = () => {
        const text = filteredLogs.map(log => {
             const time = new Date(log.timestamp * 1000).toISOString();
             return `[${time}] [${log.level}] ${log.message}`;
        }).join('\n');
        
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${agentId}_${nodeId}_logs.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'ERROR': return 'text-red-500 dark:text-red-400';
            case 'WARN': return 'text-orange-500 dark:text-orange-400';
            case 'DEBUG': return 'text-slate-500 dark:text-slate-400';
            default: return 'text-blue-600 dark:text-blue-400'; 
        }
    };

    if (!agent) {
        return <div className="p-8 text-center text-slate-500">Connecting to agent {agentId}...</div>;
    }

    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold flex items-center gap-2">
                            <Terminal size={18} className="text-slate-500" />
                            Node Logs
                        </h1>
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{agentId}</span>
                            <span className="text-slate-300">/</span>
                            <span className="font-bold text-purple-500">{nodeId}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Search Box */}
                    <div className="relative group">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search logs..." 
                            className="bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-blue-500 dark:focus:border-blue-500 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none transition-all w-48 focus:w-64"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        <Filter size={14} className="ml-2 text-slate-400" />
                        {['INFO', 'DEBUG', 'WARN', 'ERROR'].map(level => (
                            <label key={level} className={`
                                px-2 py-1 rounded text-xs font-bold cursor-pointer transition-colors select-none flex items-center gap-1
                                ${selectedLevels.has(level) 
                                    ? (level === 'ERROR' ? 'bg-red-500 text-white' : 
                                       level === 'WARN' ? 'bg-orange-500 text-white' : 
                                       level === 'INFO' ? 'bg-blue-600 text-white' :
                                       'bg-slate-500 text-white') 
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}
                            `}>
                                <input 
                                    type="checkbox" 
                                    className="hidden" 
                                    checked={selectedLevels.has(level)} 
                                    onChange={() => {
                                        setSelectedLevels(prev => {
                                            const next = new Set(prev);
                                            if (next.has(level)) next.delete(level);
                                            else next.add(level);
                                            return next;
                                        });
                                    }} 
                                />
                                {level}
                            </label>
                        ))}
                    </div>

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>

                     <button 
                        onClick={handleDownload}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                        title="Download All Logs"
                    >
                        <Download size={18} />
                    </button>
                </div>
            </div>

            {/* Log Viewer Container */}
            <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 p-4 font-mono text-xs overflow-y-auto custom-scrollbar"
                     ref={containerRef}
                     onScroll={handleScroll}
                >
                     {/* 
                        Virtual Scrolling Implementation
                     */}
                    <div style={{ height: totalHeight, position: 'relative' }}>
                        <div style={{ transform: `translateY(${offsetY}px)` }}>
                            {visibleLogs.map((log, index) => {
                                const realIndex = startIndex + index;
                                const logKey = getLogKey(log, realIndex);
                                const isSelected = selectedKeys.has(logKey);
                                const levelColor = getLevelColor(log.level);
                                
                                return (
                                    <div 
                                        key={logKey}
                                        className={`
                                            flex gap-3 px-2 rounded cursor-pointer select-none transition-colors border-l-2
                                            ${isSelected 
                                                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500' 
                                                : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 border-transparent'}
                                        `}
                                        style={{ height: ROW_HEIGHT, lineHeight: `${ROW_HEIGHT}px` }}
                                        onMouseDown={(e) => handleMouseDown(realIndex, logKey, e)}
                                        onMouseEnter={() => handleMouseEnter(realIndex)}
                                    >
                                        <span className="text-slate-400 dark:text-slate-500 shrink-0 w-28 select-none">
                                            {new Date(log.timestamp * 1000).toLocaleTimeString([], { hour12: false })} 
                                            <span className="text-[10px] opacity-50 ml-1">.{new Date(log.timestamp * 1000).getMilliseconds().toString().padStart(3, '0')}</span>
                                        </span>
                                        <span className={`truncate flex-1 ${levelColor}`}>
                                            {log.message}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    {filteredLogs.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Filter size={32} className="mb-2 opacity-50" />
                            <p>No logs found matching criteria</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Stats */}
            <div className="px-4 py-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 flex justify-between select-none">
                 <div className="flex gap-4">
                    <span>Total: {filteredLogs.length}</span>
                    <span>{autoScroll ? 'Auto-scrolling (Top)' : 'Scroll Paused'}</span>
                 </div>
                 <div className="flex gap-4 items-center">
                    <span>Ctrl + Click/Drag to select</span>
                    <span>Ctrl + C to copy</span>
                    {selectedKeys.size > 0 && (
                        <span className="text-blue-500 font-bold flex items-center gap-1">
                            <CheckCircle size={10} /> {selectedKeys.size} selected
                        </span>
                    )}
                 </div>
            </div>
        </div>
    );
};
