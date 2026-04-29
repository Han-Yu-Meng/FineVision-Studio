import React, { useState, useRef, useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { MetricsPoint } from '../../utils/performanceUtils';

interface FoldedMiniMapProps { 
    compactData: MetricsPoint[]; 
    fullTimeRange: [number, number];
    onBrushChange: (start: number, end: number) => void;
    isDark: boolean;
}

export const FoldedMiniMap: React.FC<FoldedMiniMapProps> = ({ 
    compactData, 
    fullTimeRange, 
    onBrushChange, 
    isDark
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dragStartIdx, setDragStartIdx] = useState<number | null>(null);
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const currentWindowIndices = useMemo(() => {
        if (!compactData.length) return [0, 0];
        const start = compactData.findIndex(d => d.timestamp >= fullTimeRange[0]);
        let end = compactData.findIndex(d => d.timestamp >= fullTimeRange[1]);
        if (start === -1) return [0, 0];
        if (end === -1) end = compactData.length - 1;
        return [start, end];
    }, [compactData, fullTimeRange]);

    const getIndexFromEvent = (e: React.MouseEvent) => {
        if (!containerRef.current || compactData.length === 0) return -1;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const ratio = x / rect.width;
        return Math.floor(ratio * (compactData.length - 1));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const idx = getIndexFromEvent(e);
        if (idx !== -1) setDragStartIdx(idx);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const idx = getIndexFromEvent(e);
        setHoverIdx(idx);
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (dragStartIdx !== null) {
            const endIdx = getIndexFromEvent(e);
            if (endIdx !== -1) {
                const start = Math.min(dragStartIdx, endIdx);
                const end = Math.max(dragStartIdx, endIdx);
                const startTime = compactData[start].timestamp;
                const endTime = compactData[end].timestamp;

                if (startTime === endTime) {
                    onBrushChange(startTime - 5000, startTime + 5000);
                } else {
                    onBrushChange(startTime, endTime);
                }
            }
        }
        setDragStartIdx(null);
    };

    const totalCount = compactData.length;
    const [winStartIdx, winEndIdx] = currentWindowIndices;
    const highlightLeft = (winStartIdx / totalCount) * 100;
    const highlightWidth = Math.max(0.5, ((winEndIdx - winStartIdx) / totalCount) * 100);

    let selectionStyle = {};
    if (dragStartIdx !== null && hoverIdx !== null) {
        const s = Math.min(dragStartIdx, hoverIdx);
        const e = Math.max(dragStartIdx, hoverIdx);
        selectionStyle = {
            left: `${(s / totalCount) * 100}%`,
            width: `${((e - s) / totalCount) * 100}%`,
            display: 'block'
        };
    }

    return (
        <div 
            ref={containerRef}
            className="h-16 w-full mt-2 relative select-none cursor-crosshair bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded overflow-hidden group"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { setDragStartIdx(null); setHoverIdx(null); }}
        >
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={compactData}>
                    <defs>
                        <linearGradient id="miniGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        </linearGradient>
                    </defs>
                    <Area 
                        type="monotone" 
                        dataKey="fps" 
                        stroke="#3b82f6" 
                        fill="url(#miniGradient)" 
                        isAnimationActive={false} 
                        strokeWidth={1}
                    />
                </AreaChart>
            </ResponsiveContainer>

            <div 
                className="absolute top-0 bottom-0 border-2 border-yellow-500 bg-yellow-500/10 z-10 pointer-events-none transition-all duration-75"
                style={{ left: `${highlightLeft}%`, width: `${highlightWidth}%` }}
            />

            {dragStartIdx !== null && (
                <div 
                    className="absolute top-0 bottom-0 bg-blue-500/30 border-x border-blue-400 z-20 pointer-events-none"
                    style={selectionStyle}
                />
            )}
            
            <div className="absolute bottom-1 right-2 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Drag to zoom, Click to jump
            </div>
        </div>
    );
};
