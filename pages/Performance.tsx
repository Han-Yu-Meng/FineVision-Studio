
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSystem, useAgentMetrics } from '../context/SystemContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
    Activity, Clock, AlertTriangle, ArrowLeft, Play, Zap, 
    MoveHorizontal, BarChart2, TrendingUp 
} from 'lucide-react';
import { MetricsPoint } from '../utils/performanceUtils';
import { MetricHistogram } from '../components/performance/MetricHistogram';
import { FoldedMiniMap } from '../components/performance/FoldedMiniMap';
import { AgentStatus } from '../types';

// --- 主组件 ---

export const Performance: React.FC = () => {
  const { theme } = useSystem();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const agentId = searchParams.get('agentId') || '';
  const pipeId = searchParams.get('pipeId') || '';
  
  const realtimeAgent = useAgentMetrics(agentId);
  
  const rawHistory = realtimeAgent?.pipeMetricsHistory?.[pipeId] || [];

  const { fullData, compactData, firstValidTime } = useMemo(() => {
    if (!rawHistory.length) return { fullData: [], compactData: [], firstValidTime: 0, lastValidTime: 0 };

    const sorted = [...rawHistory].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)).map(h => {
        let ts = h.timestamp || Date.now();
        if (ts < 10000000000) { 
            ts = ts * 1000;
        }
        return {
            ...h,
            timestamp: ts
        };
    }) as MetricsPoint[];

    const compact: MetricsPoint[] = [];
    let isGap = false;
    
    sorted.forEach((pt) => {
        if (pt.fps > 0) {
            compact.push(pt);
            isGap = false;
        } else {
            if (!isGap) {
                compact.push(pt);
                isGap = true;
            }
        }
    });

    const validPoints = sorted.filter(p => p.fps > 0);
    const start = validPoints.length ? validPoints[0].timestamp : sorted[0].timestamp;
    const end = validPoints.length ? validPoints[validPoints.length - 1].timestamp : sorted[sorted.length - 1].timestamp;

    return { 
        fullData: sorted, 
        compactData: compact,
        firstValidTime: start,
        lastValidTime: end
    };
  }, [rawHistory]);

  const [xDomain, setXDomain] = useState<[number, number] | null>(null);
  const [isLive, setIsLive] = useState(true); 
  const [viewMode, setViewMode] = useState<'line' | 'histogram'>('line');
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastMouseX = useRef<number>(0);

  useEffect(() => {
    if (fullData.length > 0 && xDomain === null) {
        const max = fullData[fullData.length - 1].timestamp;
        const min = Math.max(firstValidTime, max - 30000);
        setXDomain([min, max]);
    }
  }, [fullData, firstValidTime, xDomain]);

  useEffect(() => {
    if (!isLive || !xDomain || fullData.length === 0 || viewMode === 'histogram') return;
    const latestTime = fullData[fullData.length - 1].timestamp;
    const currentEnd = xDomain[1];
    
    if (latestTime > currentEnd) {
        const windowSize = xDomain[1] - xDomain[0];
        setXDomain([latestTime - windowSize, latestTime]);
    }
  }, [fullData, isLive, xDomain, viewMode]);

  const updateDomain = useCallback((newStart: number, newEnd: number, disableLive = true) => {
    if (newEnd <= newStart) return;
    if (newEnd - newStart < 100) return; 
    
    setXDomain([newStart, newEnd]);
    if (disableLive) setIsLive(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!xDomain) return;
    setIsLive(false);
    
    const [start, end] = xDomain;
    const duration = end - start;
    const zoomFactor = 0.2; 
    
    let newDuration = duration;
    if (e.deltaY < 0) newDuration = duration * (1 - zoomFactor);
    else newDuration = duration * (1 + zoomFactor);

    const center = start + duration / 2;
    updateDomain(center - newDuration / 2, center + newDuration / 2, true);
  }, [xDomain, updateDomain]);

  const handleMainMouseDown = (e: React.MouseEvent) => {
    if (viewMode === 'histogram') return; 
    setIsDragging(true);
    lastMouseX.current = e.clientX;
    setIsLive(false);
  };
  
  const handleMainMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !xDomain || !chartContainerRef.current) return;
    const deltaX = lastMouseX.current - e.clientX;
    const width = chartContainerRef.current.clientWidth;
    const duration = xDomain[1] - xDomain[0];
    const msShift = (deltaX / width) * duration;
    
    updateDomain(xDomain[0] + msShift, xDomain[1] + msShift, true);
    lastMouseX.current = e.clientX;
  }, [isDragging, xDomain, updateDomain]);

  const visibleData = useMemo(() => {
      if (!xDomain) return [];
      return fullData.filter(d => d.timestamp >= xDomain[0] && d.timestamp <= xDomain[1]);
  }, [fullData, xDomain]);

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();
  const isDark = theme === 'dark';
  const gridColor = isDark ? "#334155" : "#e2e8f0";

  const isTimeout = realtimeAgent ? (Date.now() - realtimeAgent.lastSeen > 20000) : true;
  const displayStatus = (!realtimeAgent || isTimeout) ? AgentStatus.OFFLINE : realtimeAgent.status;

  if (!agentId || !pipeId) return <div className="p-8">No Pipe Selected</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <header className="flex-none flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 shadow-sm">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/editor')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-lg font-bold flex items-center gap-2">
                        Pipeline Performance
                        {isLive && viewMode === 'line' && <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>}
                    </h1>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                         {agentId} <span className="text-slate-300">/</span> {pipeId}
                         <span className={`px-2 py-0.5 rounded ml-2 font-bold ${displayStatus === AgentStatus.RUNNING ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                             {displayStatus}
                         </span>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                {/* 视图切换按钮 */}
                <div className="flex bg-slate-200 dark:bg-slate-800 rounded-md p-1 gap-1">
                    <button 
                        onClick={() => setViewMode('line')}
                        className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors ${viewMode === 'line' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <TrendingUp size={14} /> TimeSeries
                    </button>
                    <button 
                        onClick={() => { setViewMode('histogram'); setIsLive(false); }}
                        className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors ${viewMode === 'histogram' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <BarChart2 size={14} /> Distribution
                    </button>
                </div>

                <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1"></div>

                <button 
                    onClick={() => {
                        setIsLive(!isLive);
                        if (!isLive && fullData.length && xDomain) {
                            const window = xDomain[1] - xDomain[0];
                            const last = fullData[fullData.length-1].timestamp;
                            updateDomain(last - window, last, false);
                            setIsLive(true);
                            setViewMode('line'); // 点击 Live 自动切回折线图
                        }
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        isLive 
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' 
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                >
                    {isLive ? <Zap size={14} fill="currentColor"/> : <Play size={14} />}
                    {isLive ? 'Live Tracking' : 'Resume Live'}
                </button>
            </div>
        </header>

        {/* Charts Container */}
        <div 
            ref={chartContainerRef}
            className={`flex-1 flex flex-col p-4 gap-2 overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onWheel={handleWheel}
            onMouseDown={handleMainMouseDown}
            onMouseMove={handleMainMouseMove}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
        >
            {viewMode === 'line' ? (
                // --- LINE CHART MODE ---
                <>
                    {/* 1. FPS Chart */}
                    <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 relative shadow-sm">
                        <div className="absolute top-2 left-4 z-10 flex items-center gap-2 opacity-50 pointer-events-none">
                            <Activity className="text-green-500" size={14} />
                            <span className="text-xs font-bold">Throughput</span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={fullData} syncId="main" margin={{top: 20, right: 10, left: -20, bottom: 0}}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                                <XAxis dataKey="timestamp" type="number" domain={xDomain || ['auto', 'auto']} hide allowDataOverflow />
                                <YAxis stroke="#64748b" tick={{fontSize: 10}} width={40} />
                                <Tooltip labelFormatter={formatTime} contentStyle={{backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: '#334155'}} />
                                <Line type="stepAfter" dataKey="fps" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* 2. Latency & Delay Chart */}
                    <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 relative shadow-sm">
                        <div className="absolute top-2 left-4 z-10 flex items-center gap-2 opacity-50 pointer-events-none">
                            <Clock className="text-blue-500" size={14} />
                            <span className="text-xs font-bold">Latency (Blue) & System Delay (Purple)</span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={fullData} syncId="main" margin={{top: 20, right: 10, left: -20, bottom: 0}}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                                <XAxis dataKey="timestamp" type="number" domain={xDomain || ['auto', 'auto']} hide allowDataOverflow />
                                <YAxis stroke="#64748b" tick={{fontSize: 10}} width={40} />
                                <Tooltip labelFormatter={formatTime} contentStyle={{backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: '#334155'}} />
                                {/* AoI (Age of Information) */}
                                <Line type="monotone" dataKey="avg_aoi_ms" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                                <Line type="monotone" dataKey="peak_aoi_ms" stroke="#60a5fa" strokeWidth={1} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                                {/* System Delay - 新增 */}
                                <Line type="step" dataKey="sys_delay_ms" stroke="#8b5cf6" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* 3. Violation Probability */}
                    <div className="h-32 min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 relative shadow-sm">
                        <div className="absolute top-2 left-4 z-10 flex items-center gap-2 opacity-50 pointer-events-none">
                            <AlertTriangle className="text-red-500" size={14} />
                            <span className="text-xs font-bold">Violations</span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={fullData} syncId="main" margin={{top: 20, right: 10, left: -20, bottom: 0}}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                                <XAxis 
                                    dataKey="timestamp" 
                                    type="number" 
                                    domain={xDomain || ['auto', 'auto']} 
                                    tickFormatter={formatTime}
                                    stroke="#64748b"
                                    tick={{fontSize: 10}}
                                    height={20}
                                    allowDataOverflow
                                />
                                <YAxis stroke="#64748b" tick={{fontSize: 10}} domain={[0, 1]} width={40} />
                                <Tooltip labelFormatter={formatTime} contentStyle={{backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: '#334155'}} />
                                <Line type="step" dataKey="violation_prob" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </>
            ) : (
                // --- HISTOGRAM MODE ---
                <div className="flex-1 flex gap-2 min-h-0">
                    <MetricHistogram 
                        data={visibleData} 
                        dataKey="fps" 
                        color="#10b981" 
                        title="FPS" 
                        icon={Activity}
                    />
                    <MetricHistogram 
                        data={visibleData} 
                        dataKey="sys_delay_ms" 
                        color="#8b5cf6" 
                        title="System Delay" 
                        icon={Clock} 
                        unit="ms"
                    />
                    <MetricHistogram 
                        data={visibleData} 
                        dataKey="avg_aoi_ms" 
                        color="#3b82f6" 
                        title="Latency (AoI)" 
                        icon={Clock} 
                        unit="ms"
                    />
                </div>
            )}

            <div className="flex-none pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center text-[10px] text-slate-500 px-1">
                     <span className="flex items-center gap-1"><MoveHorizontal size={10}/> Data Navigator {viewMode === 'histogram' && '(Select range to update distributions)'}</span>
                     <span>Drag to zoom specific range</span>
                </div>
                {compactData.length > 0 && xDomain && (
                    <FoldedMiniMap 
                        compactData={compactData}
                        fullTimeRange={xDomain}
                        onBrushChange={(s, e) => updateDomain(s, e, true)}
                        isDark={isDark}
                    />
                )}
            </div>
        </div>
    </div>
  );
};
