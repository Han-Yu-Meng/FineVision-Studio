import React, { useMemo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { Sigma } from 'lucide-react';
import { MetricsPoint, HistogramBin, calculateStats, generateHistogramData } from '../../utils/performanceUtils';

interface MetricHistogramProps { 
    data: MetricsPoint[]; 
    dataKey: keyof MetricsPoint; 
    color: string; 
    title: string; 
    icon: any;
    unit?: string;
}

export const MetricHistogram: React.FC<MetricHistogramProps> = ({ 
    data, 
    dataKey, 
    color, 
    title, 
    icon: Icon,
    unit = ''
}) => {
    // 1. 过滤掉严格为 0 的数据 (Filter strictly 0 values)
    const validData = useMemo(() => {
        return data.filter(d => {
            const val = Number(d[dataKey]);
            return val > 0; // 仅保留大于 0 的有效值
        });
    }, [data, dataKey]);

    // 2. 计算统计数据 (基于 validData)
    const stats = useMemo(() => calculateStats(validData, dataKey), [validData, dataKey]);
    
    // 3. 生成分箱数据 (基于 validData)
    const { bins, min, step } = useMemo(() => generateHistogramData(validData, dataKey), [validData, dataKey]);

    // 4. 找到 P99 和 Mean 落在哪个 Bin 里，用于画 ReferenceLine
    const getBinNameForValue = (val: number) => {
        if (!bins.length || step === 0) return bins[0]?.name;
        const idx = Math.min(Math.floor((val - min) / step), bins.length - 1);
        return bins[idx]?.name;
    };

    const p99Bin = getBinNameForValue(stats.p99);
    const meanBin = getBinNameForValue(stats.mean);

    return (
        <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 relative shadow-sm flex flex-col">
            {/* Header Title */}
            <div className="flex items-center gap-2 opacity-70 mb-2 px-2">
                <Icon className={color.replace('stroke-', 'text-').replace('fill-', 'text-')} size={14} style={{ color }} />
                <span className="text-xs font-bold">{title} Distribution</span>
                {validData.length < data.length && (
                    <span className="text-[9px] text-slate-400 border border-slate-200 dark:border-slate-700 px-1 rounded">
                        Excl. 0s
                    </span>
                )}
            </div>

            {/* Statistics Overlay */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 mb-2 text-[10px] font-mono bg-slate-50 dark:bg-slate-800/50 rounded py-1 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1 text-red-500">
                    <span className="font-bold">P99:</span>
                    <span>{stats.p99.toFixed(2)}{unit}</span>
                </div>
                <div className="flex items-center gap-1 text-blue-500">
                    <span className="font-bold">Mean:</span>
                    <span>{stats.mean.toFixed(2)}{unit}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500">
                    <span className="font-bold flex items-center"><Sigma size={10}/> Var:</span>
                    <span>{stats.variance.toFixed(2)}</span>
                </div>
            </div>

            {/* Chart */}
            <div className="flex-1 min-h-0">
                {bins.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bins} margin={{ top: 5, right: 5, left: -25, bottom: 0 }} barCategoryGap={1}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                            <XAxis 
                                dataKey="name" 
                                tick={{ fontSize: 9 }} 
                                axisLine={false} 
                                tickLine={false}
                                interval="preserveStartEnd"
                                minTickGap={20}
                            />
                            <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                            <Tooltip 
                                cursor={{ fill: 'transparent' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const d = payload[0].payload as HistogramBin;
                                        return (
                                            <div className="bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 rounded shadow text-xs z-50">
                                                <div className="font-bold mb-1 text-slate-700 dark:text-slate-200">{title}</div>
                                                <div className="text-slate-500">Range: {d.rangeStart.toFixed(2)} - {d.rangeEnd.toFixed(2)} {unit}</div>
                                                <div className="text-slate-500">Count: <span className="font-mono font-bold text-slate-900 dark:text-white">{d.count}</span></div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="count" fill={color} opacity={0.8} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                            
                            {/* P99 Reference Line */}
                            {p99Bin && (
                                <ReferenceLine x={p99Bin} stroke="#ef4444" strokeDasharray="3 3" />
                            )}

                            {/* Mean Reference Line */}
                            {meanBin && meanBin !== p99Bin && (
                                <ReferenceLine x={meanBin} stroke="#3b82f6" strokeDasharray="3 3" />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                        No valid data ( &gt; 0 ) in range
                    </div>
                )}
            </div>
        </div>
    );
};