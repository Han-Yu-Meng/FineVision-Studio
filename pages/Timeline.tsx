import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { Upload, RefreshCcw } from 'lucide-react';
import { parseJSONLChunked, ParseStatus, EventData } from '../utils/ganttUtils';
import { stringToColor } from '../utils/ganttUtils';
import { useSystem } from '../context/SystemContext';
import { GanttPlatform } from '../components/GanttPlatform';

// Helper function to adjust HSL color brightness
function adjustColorBrightness(color: string, amount: number): string {
  // Parse HSL color
  const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return color;
  
  const h = parseInt(match[1]);
  const s = parseInt(match[2]);
  let l = parseInt(match[3]);
  
  // Adjust lightness
  l = Math.max(0, Math.min(100, l + amount));
  
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function Timeline() {
  const { theme } = useSystem();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState<ParseStatus | null>(null);
  const [data, setData] = useState<EventData[] | null>(null);

  // GanttViewer state
  const maxTime = useMemo(() => {
    return data ? d3.max(data, d => d.comp) || 0 : 0;
  }, [data]);

  const [windowDomain, setWindowDomain] = useState<[number, number]>([0, 1000]);

  const { allTids, tidLabels } = useMemo(() => {
    if (!data) return { allTids: [], tidLabels: {} };
    
    // Track first appearance time for each tid (for causal ordering)
    const tidFirstRecv: Record<string, number> = {};
    const tidLabels: Record<string, { port_desc?: string, id: string }> = {};
    
    data.forEach(d => {
      const tidStr = String(d.tid);
      if (tidFirstRecv[tidStr] === undefined) {
        tidFirstRecv[tidStr] = d.recv; // First appearance by receive time
      }
      if (!tidLabels[tidStr]) {
        tidLabels[tidStr] = { port_desc: d.port_desc, id: String(d.id) };
      }
    });

    // Sort by first appearance time (earliest first) - causal ordering
    const sortedTids = Object.keys(tidFirstRecv).sort((a, b) => tidFirstRecv[a] - tidFirstRecv[b]);

    return { 
        allTids: sortedTids,
        tidLabels
    };
  }, [data]);

  const [hiddenTids, setHiddenTids] = useState<Set<string>>(new Set());
  const visibleTids = useMemo(() => {
    return allTids.filter(t => !hiddenTids.has(t));
  }, [allTids, hiddenTids]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelected = (file: File) => {
    setIsParsing(true);
    setParseStatus({
      loadedBytes: 0,
      totalBytes: file.size,
      parsedCount: 0,
      isComplete: false,
    });
    
    setTimeout(() => {
      parseJSONLChunked(
        file,
        (status) => setParseStatus(status),
        (parsedData) => {
          setIsParsing(false);
          setData(parsedData);
          setWindowDomain([0, Math.min(1000, d3.max(parsedData, d => d.comp) || 1000)]);
        }
      );
    }, 100);
  };

  const getPercent = () => {
    if (!parseStatus) return 0;
    if (parseStatus.totalBytes === 0) return 0;
    return Math.round((parseStatus.loadedBytes / parseStatus.totalBytes) * 100);
  };

  const handleReset = () => {
    setData(null);
    setHiddenTids(new Set());
    setWindowDomain([0, 1000]);
  };

  const toggleTid = (tid: string) => {
    setHiddenTids(prev => {
      const next = new Set(prev);
      if (next.has(tid)) next.delete(tid);
      else next.add(tid);
      return next;
    });
  };

  if (isParsing) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'} transition-colors duration-200`}>
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-bg-main relative">
          <div className="w-full max-w-md bg-surface rounded-xl border border-border-subtle p-8 space-y-6 shadow-sm">
            <div className="text-center">
              <div className="w-12 h-12 text-text-main mx-auto animate-pulse mb-4 flex items-center justify-center">
                <Upload size={24} />
              </div>
              <h2 className="text-xl font-medium text-text-main tracking-tight">Processing Data</h2>
              <p className="text-[12px] text-text-muted mt-2">Reading performance monitoring logs</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-[12px] font-medium text-text-main">
                <span>{getPercent()}%</span>
                <span className="font-mono">{parseStatus?.parsedCount.toLocaleString()} events</span>
              </div>
              <div className="w-full bg-[#f1f1f0] rounded-full h-2 overflow-hidden border border-border-subtle">
                <div 
                  className="bg-text-main h-full rounded-full transition-all duration-300"
                  style={{ width: `${getPercent()}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (data) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'} transition-colors duration-200`}>
        <div className="flex flex-col h-screen w-full bg-bg-main relative">
          <div className="absolute top-3 left-4 z-50 flex items-center gap-2">
            <button onClick={handleReset} className="flex items-center gap-1.5 text-text-muted hover:text-text-main transition-colors uppercase tracking-widest font-semibold text-[10px] bg-surface/80 backdrop-blur-md px-2 py-1.5 rounded shadow-sm border border-border-subtle cursor-pointer">
              <RefreshCcw className="w-3 h-3" /> New File
            </button>
            {hiddenTids.size > 0 && (
              <button 
                onClick={() => setHiddenTids(new Set())}
                className="flex items-center gap-1.5 text-text-muted hover:text-text-main transition-colors uppercase tracking-widest font-semibold text-[10px] bg-surface/80 backdrop-blur-md px-2 py-1.5 rounded shadow-sm border border-border-subtle cursor-pointer"
              >
                Show All
              </button>
            )}
          </div>
          
          {/* Main Gantt View */}
          <div className="flex-1 overflow-hidden relative bg-bg-main">
            <MainGanttChart 
              data={data} 
              maxTime={maxTime} 
              domain={windowDomain} 
              tids={visibleTids} 
              tidLabels={tidLabels} 
              onDomainChange={setWindowDomain} 
              onHideTid={toggleTid}
            />
          </div>
          
          {/* Minimap View */}
          <div className="h-16 bg-surface border-t border-border-subtle relative z-10 shrink-0">
            <Minimap data={data} maxTime={maxTime} currentDomain={windowDomain} onDomainChange={setWindowDomain} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'} transition-colors duration-200`}>
      <div 
        className="flex-1"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Simple Upload Area */}
          <div className="mb-8 text-center">
            <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-2 border-dashed ${
              isDragOver 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
            } transition-all duration-200 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500`}
            onClick={() => document.getElementById('fileUpload')?.click()}>
              <Upload size={32} className="text-slate-400" />
            </div>
            <input 
              id="fileUpload" 
              type="file" 
              accept=".jsonl,.json,.txt" 
              className="hidden" 
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileSelected(e.target.files[0]);
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// MainGanttChart component (moved from GanttViewer)
function MainGanttChart({ 
  data, maxTime, domain, tids, tidLabels, onDomainChange, onHideTid 
}: { 
  data: EventData[], 
  maxTime: number, 
  domain: [number, number], 
  tids: string[], 
  tidLabels: Record<string, { port_desc?: string, id: string }>, 
  onDomainChange: (d: [number, number]) => void,
  onHideTid: (tid: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredEvent, setHoveredEvent] = useState<EventData | null>(null);
  const [selectedAcqStr, setSelectedAcqStr] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [measureStartPos, setMeasureStartPos] = useState<{ x: number, y: number } | null>(null);
  
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragDomainRef = useRef<[number, number]>([0, 0]);

  const filteredData = useMemo(() => {
    const setTids = new Set(tids);
    return data.filter(d => 
      setTids.has(String(d.tid)) &&
      Math.max(d.recv, d.comp - d.lat_ms) <= domain[1] && 
      d.comp >= domain[0]
    );
  }, [data, domain, tids]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;
    
    const margin = { top: 30, right: 20, bottom: 20, left: 160 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const xScale = d3.scaleLinear()
      .domain(domain)
      .range([0, innerWidth]);
      
    const yScale = d3.scaleBand()
      .domain(tids)
      .range([0, innerHeight])
      .padding(0.2);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);
    
    // Draw grid lines
    ctx.beginPath();
    ctx.strokeStyle = '#e2e2e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    tids.forEach(tid => {
       const y = margin.top + (yScale(tid) || 0) + yScale.bandwidth() / 2;
       ctx.moveTo(margin.left, y);
       ctx.lineTo(margin.left + innerWidth, y);
    });
    ctx.stroke();
    
    const tickValues = xScale.ticks(10);
    ctx.beginPath();
    ctx.strokeStyle = '#e2e2e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 5]);
    tickValues.forEach(val => {
       const x = margin.left + xScale(val);
       ctx.moveTo(x, margin.top);
       ctx.lineTo(x, margin.top + innerHeight);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw bars with cpu_ms (darker) and sched_wait_ms (lighter) segments
    ctx.save();
    ctx.translate(margin.left, margin.top);
    
    for (let i = 0; i < filteredData.length; i++) {
       const d = filteredData[i];
       const x = xScale(d.recv);
       let w = xScale(d.comp) - x;
       if (w < 4) w = 4;
       
       const y = yScale(String(d.tid)) || 0;
       const h = yScale.bandwidth() || 10;
       
       const isGrayscale = selectedAcqStr !== null && selectedAcqStr !== d.acqStr;
       const baseColor = isGrayscale ? '#e5e7eb' : stringToColor(d.acqStr);
       
       // Calculate durations
       const totalDuration = d.comp - d.recv; // total bar width in ms
       const cpuMs = d.cpu_ms ?? 0;
       const schedWaitMs = d.sched_wait_ms ?? 0;
       
       // Convert ms durations to pixel widths
       const msToPixels = (ms: number) => (ms / totalDuration) * w;
       
       const cpuWidth = msToPixels(cpuMs);
       const schedWaitWidth = msToPixels(schedWaitMs);
       const otherWidth = w - cpuWidth - schedWaitWidth;
       
       // Draw other latency (base color) - this is the remaining time
       if (otherWidth > 0) {
         ctx.fillStyle = adjustColorBrightness(baseColor, 15); // adjustColorBrightness(baseColor, -15)
         ctx.shadowColor = isGrayscale ? 'transparent' : 'rgba(0,0,0,0.05)';
         ctx.shadowBlur = isGrayscale ? 0 : 4;
         ctx.shadowOffsetY = isGrayscale ? 0 : 2;
         
         ctx.beginPath();
         ctx.roundRect(x, y, otherWidth, h, 2);
         ctx.fill();
       }
       
       // Draw sched_wait_ms (lighter version - scheduling wait time)
       if (schedWaitWidth > 0) {
         // Lighten the base color for sched_wait_ms
         ctx.fillStyle = isGrayscale ? '#f3f4f6' : adjustColorBrightness(baseColor, 15);
         ctx.shadowColor = 'transparent';
         
         const schedStartX = x + otherWidth;
         ctx.beginPath();
         ctx.roundRect(schedStartX, y, schedWaitWidth, h, 2);
         ctx.fill();
       }
       
       // Draw cpu_ms (darker version - CPU time)
       if (cpuWidth > 0) {
         // Darken the base color for cpu_ms
         ctx.fillStyle = isGrayscale ? '#d1d5db' : adjustColorBrightness(baseColor, -15);
         ctx.shadowColor = isGrayscale ? 'transparent' : 'rgba(0,0,0,0.05)';
         ctx.shadowBlur = isGrayscale ? 0 : 4;
         ctx.shadowOffsetY = isGrayscale ? 0 : 2;
         
         const cpuStartX = x + otherWidth + schedWaitWidth;
         ctx.beginPath();
         ctx.roundRect(cpuStartX, y, cpuWidth, h, 2);
         ctx.fill();
       }
       
       ctx.shadowColor = 'transparent';
    }
    
    ctx.restore();

    // Update SVG axes
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
      
    const xAxis = d3.axisTop(xScale).ticks(10).tickFormat(d => `${Number(d).toFixed(1)} ms`);
    g.append('g')
      .attr('class', 'text-text-muted font-mono text-[10px] opacity-70')
      .call(xAxis)
      .selectAll('.domain, .tick line').attr('stroke', '#e2e2e1');
      
    const yAxis = d3.axisLeft(yScale).tickFormat(() => '');
    
    const yAxisG = g.append('g')
      .attr('class', 'text-text-main font-mono text-[11px] font-semibold')
      .call(yAxis);
      
    yAxisG.selectAll('.tick text')
      .text(null)
      .style('text-anchor', 'start')
      .style('pointer-events', 'auto')
      .attr('x', -margin.left + 16)
      .attr('y', 0)
      .style('cursor', 'pointer')
      .on('mouseover', function() {
         d3.select(this).style('text-decoration', 'line-through').style('opacity', 0.6);
      })
      .on('mouseout', function() {
         d3.select(this).style('text-decoration', 'none').style('opacity', 1);
      })
      .on('click', function(event, d) {
         onHideTid(String(d));
      })
      .each(function(d) {
         const info = tidLabels[String(d)];
         const textNode = d3.select(this);
         
         if (info && info.port_desc) {
             let desc = info.port_desc;
             if (desc.length > 22) desc = desc.substring(0, 19) + '...';
             
             textNode.append('tspan')
               .text(desc)
               .attr('x', -margin.left + 16)
               .attr('dy', '-0.3em');
               
             let idStr = `| ${info.id}`;
             if (idStr.length > 22) {
                 idStr = idStr.substring(0, 19) + '...';
             }
             textNode.append('tspan')
               .text(idStr)
               .attr('x', -margin.left + 16)
               .attr('dy', '1.2em')
               .attr('class', 'opacity-60 text-[9px] font-normal');
         } else {
             const idStr = info?.id || String(d);
             textNode.append('tspan')
               .text(idStr.length > 26 ? idStr.substring(0, 23) + '...' : idStr)
               .attr('x', -margin.left + 16)
               .attr('dy', '0.32em');
         }
      });
      
    g.selectAll('.domain, .tick line').attr('stroke', 'transparent');
      
  }, [dimensions, filteredData, domain, tids, tidLabels, selectedAcqStr, onHideTid]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePos({ x: e.clientX, y: e.clientY });

    const margin = { top: 30, right: 20, bottom: 20, left: 160 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    if (measureStartPos) {
      setHoveredEvent(null);
      return;
    }

    if (isDragging.current) {
        const dx = e.clientX - dragStartX.current;
        const msPerPixel = (dragDomainRef.current[1] - dragDomainRef.current[0]) / innerWidth;
        const msDelta = dx * msPerPixel;
        
        let newD0 = dragDomainRef.current[0] - msDelta;
        let newD1 = dragDomainRef.current[1] - msDelta;
        const windowSize = newD1 - newD0;
        
        if (newD0 < 0) {
            newD0 = 0;
            newD1 = windowSize;
        }
        if (newD1 > maxTime) {
            newD1 = maxTime;
            newD0 = Math.max(0, maxTime - windowSize);
        }
        
        onDomainChange([newD0, newD1]);
        setHoveredEvent(null);
        return;
    }

    if (x < margin.left || x > margin.left + innerWidth || y < margin.top || y > margin.top + innerHeight) {
      setHoveredEvent(null);
      return;
    }

    const xScale = d3.scaleLinear().domain(domain).range([0, innerWidth]);
    const yScale = d3.scaleBand().domain(tids).range([0, innerHeight]).padding(0.2);

    const relativeX = x - margin.left;
    const relativeY = y - margin.top;
    const hoverMs = xScale.invert(relativeX);

    let found = null;
    for (let i = filteredData.length - 1; i >= 0; i--) {
      const d = filteredData[i];
      const tidY = yScale(String(d.tid));
      if (tidY !== undefined) {
        if (relativeY >= tidY && relativeY <= tidY + yScale.bandwidth()) {
           const startPx = xScale(d.recv);
           const endPx = xScale(d.comp);
           let hitWidth = endPx - startPx;
           let hitStart = startPx;
           
           if (hitWidth < 4) {
             hitStart -= (4 - hitWidth) / 2;
             hitWidth = 4;
           }
           
           if (relativeX >= hitStart && relativeX <= hitStart + hitWidth) {
              found = d;
              break;
           }
        }
      }
    }
    
    setHoveredEvent(found);
  };

  const handleMouseLeave = () => {
    setHoveredEvent(null);
    isDragging.current = false;
    setMeasureStartPos(null);
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (e.button === 2) {
      setMeasureStartPos({ x: e.clientX, y: e.clientY });
    } else {
      isDragging.current = true;
      dragStartX.current = e.clientX;
      dragDomainRef.current = [...domain];
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (measureStartPos && e.button === 2) {
      setMeasureStartPos(null);
      return;
    }
    if (isDragging.current) {
       if (Math.abs(e.clientX - dragStartX.current) < 5) {
          if (hoveredEvent) {
             setSelectedAcqStr(prev => prev === hoveredEvent.acqStr ? null : hoveredEvent.acqStr);
          } else {
             setSelectedAcqStr(null);
          }
       }
    }
    isDragging.current = false;
  };
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const margin = { top: 30, right: 20, bottom: 20, left: 160 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    
    const relativeX = (e.clientX - rect.left) - margin.left;
    
    if (relativeX < 0 || relativeX > innerWidth) return;

    const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;
    const [d0, d1] = domain;
    const currentWindowSize = d1 - d0;
    
    const MAX_WINDOW = 1000;
    const MIN_WINDOW = 1;
    
    let newWindowSize = currentWindowSize * zoomFactor;
    if (newWindowSize > MAX_WINDOW) newWindowSize = MAX_WINDOW;
    if (newWindowSize < MIN_WINDOW) newWindowSize = MIN_WINDOW;
    
    const ratio = relativeX / innerWidth;
    const focusTimeMs = d0 + currentWindowSize * ratio;

    let newD0 = focusTimeMs - (newWindowSize * ratio);
    let newD1 = focusTimeMs + (newWindowSize * (1 - ratio));
    
    if (newD0 < 0) {
        newD0 = 0;
        newD1 = newWindowSize;
    }
    if (newD1 > maxTime) {
        newD1 = maxTime;
        newD0 = Math.max(0, maxTime - newWindowSize);
    }
    
    onDomainChange([newD0, newD1]);
  };

  return (
    <div 
      ref={containerRef} 
      className={`absolute inset-0 select-none overflow-hidden cursor-default`} 
      onMouseMove={handleMouseMove} 
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
       <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
       <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none" />
       
       {/* Highlight Selected Element overlay */}
       {hoveredEvent && dimensions.width > 0 && (() => {
         const margin = { top: 30, right: 20, bottom: 20, left: 160 };
         const innerWidth = dimensions.width - margin.left - margin.right;
         const innerHeight = dimensions.height - margin.top - margin.bottom;
         const xScale = d3.scaleLinear().domain(domain).range([0, innerWidth]);
         const yScale = d3.scaleBand().domain(tids).range([0, innerHeight]).padding(0.2);
         
         const startX = xScale(hoveredEvent.recv);
         const w = Math.max(xScale(hoveredEvent.comp) - startX, 4);
         const y = yScale(String(hoveredEvent.tid)) || 0;
         const h = yScale.bandwidth() || 10;
         
         return (
           <div 
             className="absolute border-2 border-black rounded pointer-events-none z-20 shadow-[0_0_12px_rgba(0,0,0,0.15)]"
             style={{
               left: margin.left + startX - 2,
               top: margin.top + y - 2,
               width: w + 4,
               height: h + 4,
               backgroundColor: 'transparent'
             }}
           />
         );
       })()}
       
       {/* Measure Overlay */}
       {measureStartPos && dimensions.width > 0 && (() => {
         const rect = containerRef.current?.getBoundingClientRect();
         if (!rect) return null;
         
         const margin = { top: 30, right: 20, bottom: 20, left: 160 };
         const innerWidth = dimensions.width - margin.left - margin.right;
         const innerHeight = dimensions.height - margin.top - margin.bottom;
         
         const localStartX = measureStartPos.x - rect.left;
         const localCurrentX = mousePos.x - rect.left;
         
         const chartStartX = Math.max(margin.left, Math.min(margin.left + innerWidth, localStartX));
         const chartCurrentX = Math.max(margin.left, Math.min(margin.left + innerWidth, localCurrentX));
         
         const xScale = d3.scaleLinear().domain(domain).range([0, innerWidth]);

         const getSnappedX = (xInsideChart: number, edgeToSnap: 'left' | 'right') => {
             let closestX = xInsideChart;
             let minDiff = 8; // 8px snap threshold
             for (let i = 0; i < filteredData.length; i++) {
                 const d = filteredData[i];
                 const edgePx = edgeToSnap === 'left' ? xScale(d.recv) : xScale(d.comp);
                 
                 if (Math.abs(edgePx - xInsideChart) < minDiff) {
                     minDiff = Math.abs(edgePx - xInsideChart);
                     closestX = edgePx;
                 }
             }
             return closestX;
         };
         
         const snappedStartXInside = getSnappedX(chartStartX - margin.left, 'left');
         const snappedCurrentXInside = getSnappedX(chartCurrentX - margin.left, 'right');

         const left = margin.left + Math.min(snappedStartXInside, snappedCurrentXInside);
         const right = margin.left + Math.max(snappedStartXInside, snappedCurrentXInside);
         const width = right - left;
         
         const timeStart = xScale.invert(left - margin.left);
         const timeEnd = xScale.invert(right - margin.left);
         const durationMs = timeEnd - timeStart;
         
         if (width < 2) return null;

         return (
             <div className="absolute top-0 bottom-0 pointer-events-none z-40" style={{ left: 0, right: 0 }}>
                 <div 
                   className="absolute bg-gray-200/50 border-x-2 border-gray-400 border-dashed border-opacity-60"
                   style={{
                     left: left,
                     width: width,
                     top: margin.top,
                     bottom: margin.bottom
                   }}
                 />
                 <div 
                    className="absolute bg-surface border border-gray-600 text-gray-800 font-mono font-bold tracking-tight text-[11px] px-2 py-1 flex items-center gap-1 rounded shadow text-center transform -translate-x-1/2 -translate-y-1/2"
                    style={{
                        left: left + width / 2,
                        top: margin.top + innerHeight / 2
                    }}
                 >
                   <div className="w-1.5 h-1.5 rounded-full bg-gray-600 opacity-50 shrink-0" />
                   {durationMs >= 10 ? durationMs.toFixed(1) : durationMs.toFixed(3)} ms
                 </div>
             </div>
         );
       })()}
       
       {/* Hover tooltip */}
       {hoveredEvent && !measureStartPos && (
         <div 
          className="fixed z-50 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-3 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 text-sm"
          style={{
            left: mousePos.x + 15,
            top: mousePos.y + 15,
            pointerEvents: 'none'
          }}
        >
          <div className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-1.5 text-[12px]">
            <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] flex items-center">Port Desc</span> 
            <span className="font-mono font-medium">
              {hoveredEvent.port_desc || 'N/A'}
            </span>
            
            <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] flex items-center">Lat</span> 
            <span className="font-mono font-medium" style={{ color: 'var(--color-accent-green)' }}>{hoveredEvent.lat_ms.toFixed(3)} ms</span>
            
            <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] flex items-center">CPU</span> 
            <span className="font-mono font-medium" style={{ color: 'var(--color-accent-blue)' }}>{hoveredEvent.cpu_ms?.toFixed(3) ?? 'N/A'} ms</span>
            
            <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] flex items-center">Sched Wait</span> 
            <span className="font-mono font-medium" style={{ color: 'var(--color-accent-orange)' }}>{hoveredEvent.sched_wait_ms?.toFixed(3) ?? 'N/A'} ms</span>
          </div>
        </div>
       )}
    </div>
  );
}

// Minimap component (moved from GanttViewer)
function Minimap({ data, maxTime, currentDomain, onDomainChange }: { 
  data: EventData[], 
  maxTime: number, 
  currentDomain: [number, number],
  onDomainChange: (domain: [number, number]) => void 
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const histogramBins = useMemo(() => {
    if (dimensions.width === 0 || maxTime === 0) return [];
    
    const binCount = Math.max(50, Math.floor(dimensions.width / 4));
    const binWidth = maxTime / binCount;
    
    const bins = new Array(binCount).fill(0);
    for (let i = 0; i < data.length; i++) {
       const binIdx = Math.floor(data[i].recv / binWidth);
       if (binIdx >= 0 && binIdx < binCount) {
         bins[binIdx]++;
       }
    }
    return bins.map((count, i) => ({
      x0: i * binWidth,
      x1: (i + 1) * binWidth,
      count
    }));
  }, [data, maxTime, dimensions.width]);

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0 || maxTime === 0) return;
    
    const margin = { top: 6, right: 20, bottom: 16, left: 160 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear()
      .domain([0, maxTime])
      .range([0, innerWidth]);

    const maxCount = d3.max(histogramBins, d => d.count) || 1;
    const yScale = d3.scaleLinear()
      .domain([0, maxCount])
      .range([innerHeight, 0]);

    g.selectAll("rect")
      .data(histogramBins)
      .join("rect")
      .attr("x", d => xScale(d.x0) + 1)
      .attr("width", d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
      .attr("y", d => yScale(d.count))
      .attr("height", d => innerHeight - yScale(d.count))
      .attr("fill", "#e2e2e1")
      .attr("rx", 1);
      
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', innerHeight)
      .attr('y2', innerHeight)
      .attr('stroke', '#e2e2e1')
      .attr('stroke-width', 1);

    const brushGroup = g.append("g").attr("class", "brush");

    const brush = d3.brushX()
      .extent([[0, 0], [innerWidth, innerHeight]])
      .on("brush end", (event) => {
        if (!event.selection) return;
        
        let [x0, x1] = event.selection;
        let d0 = xScale.invert(x0);
        let d1 = xScale.invert(x1);
        
        const MAX_WINDOW = 1000;
        if (d1 - d0 > MAX_WINDOW + 0.0001) {
            if (event.sourceEvent) {
                d1 = d0 + MAX_WINDOW;
                x1 = xScale(d1);
                brushGroup.call(brush.move as any, [x0, x1]);
                return;
            } else {
                d1 = Math.min(maxTime, d0 + MAX_WINDOW);
                x1 = xScale(d1);
            }
        }
        
        const newDomain = [d0, d1] as [number, number];
        onDomainChange(newDomain);
      });

    brushGroup.call(brush);
      
    const defaultSelection = [xScale(currentDomain[0]), xScale(currentDomain[1])];
    brushGroup.call(brush.move, defaultSelection as [number, number]);
    
    brushGroup.selectAll(".selection")
      .attr("fill", "#1c1c1c")
      .attr("fill-opacity", 0.05)
      .attr("stroke", "#1c1c1c")
      .attr("stroke-width", 1);

  }, [dimensions, maxTime, histogramBins]);

  return (
    <div ref={containerRef} className="w-full h-full relative p-2 box-border">
       <svg ref={svgRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
