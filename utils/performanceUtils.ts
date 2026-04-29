export interface MetricsPoint {
    timestamp: number;
    fps: number;
    avg_aoi_ms: number;
    peak_aoi_ms: number;
    violation_prob: number;
    sys_delay_ms: number;
}

export interface HistogramBin {
    rangeStart: number;
    rangeEnd: number;
    count: number;
    name: string; 
}

export const calculateStats = (data: MetricsPoint[], key: keyof MetricsPoint) => {
    if (!data.length) return { p99: 0, mean: 0, variance: 0, stdDev: 0 };

    const values = data.map(d => Number(d[key])).sort((a, b) => a - b);
    const count = values.length;

    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / count;

    const sumDiffSq = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
    const variance = sumDiffSq / count;
    const stdDev = Math.sqrt(variance);

    const p99Index = Math.min(Math.floor(count * 0.99), count - 1);
    const p99 = values[p99Index];

    return { p99, mean, variance, stdDev };
};

export const generateHistogramData = (data: MetricsPoint[], key: keyof MetricsPoint, binCount = 20) => {
    if (!data.length) return { bins: [], min: 0, step: 0 };

    const values = data.map(d => Number(d[key]));
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    if (min === max) {
        return {
            bins: [{ rangeStart: min, rangeEnd: max, count: values.length, name: min.toFixed(1) }],
            min,
            step: 0
        };
    }

    const step = (max - min) / binCount;
    const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
        rangeStart: min + i * step,
        rangeEnd: min + (i + 1) * step,
        count: 0,
        name: `${(min + i * step).toFixed(1)}` 
    }));

    values.forEach(v => {
        const idx = Math.min(
            Math.floor((v - min) / step), 
            binCount - 1
        );
        if (idx >= 0) bins[idx].count++;
    });

    return { bins, min, step };
};
