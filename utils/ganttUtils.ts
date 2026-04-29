export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use HSL for good, vivid colors
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 55%)`;
}

export interface EventData {
  acqStr: string;
  comp: number; // relative ns from baseTime
  id: string;
  lat_ms: number;
  p: number;
  port_desc?: string;
  recv: number; // relative ns from baseTime
  sys_lat_ms: number;
  tid: number | string;
  cpu_ms?: number;      // CPU time spent (darker color)
  sched_wait_ms?: number; // Scheduling wait time (lighter color)
}

export type ParseStatus = {
  loadedBytes: number;
  totalBytes: number;
  parsedCount: number;
  isComplete: boolean;
};

export async function parseJSONLChunked(
  file: File,
  onProgress: (status: ParseStatus) => void,
  onComplete: (data: EventData[]) => void
) {
  const totalBytes = file.size;
  let loadedBytes = 0;
  let parsedCount = 0;
  
  const results: EventData[] = [];
  let baseTime: bigint | null = null;
  
  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (value) {
        loadedBytes += value.length;
        buffer += decoder.decode(value, { stream: true });
        
        let lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep the last incomplete line
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          // Regex to quote large numbers to avoid precision loss
          const lineStr = trimmed.replace(
            /("acq"|"comp"|"recv"):\s*?(-?\d+)/g,
            '$1:"$2"'
          );
          
          try {
            const raw = JSON.parse(lineStr);
            if (baseTime === null && raw.recv) {
              baseTime = BigInt(raw.recv);
            }
            if (baseTime === null && raw.acq) {
              baseTime = BigInt(raw.acq); // fallback
            }
            
            // if we still don't have baseTime, base is 0 (unlikely for this dataset)
            const currentBase = baseTime || 0n;
            
            const recvNs = raw.recv ? Number(BigInt(raw.recv) - currentBase) / 1000000 : 0;
            const compNs = raw.comp ? Number(BigInt(raw.comp) - currentBase) / 1000000 : 0;
            
            results.push({
              acqStr: String(raw.acq),
              comp: compNs,
              id: String(raw.id),
              lat_ms: Number(raw.lat_ms),
              p: Number(raw.p),
              port_desc: raw.port_desc ? String(raw.port_desc) : undefined,
              recv: recvNs,
              sys_lat_ms: Number(raw.sys_lat_ms),
              tid: raw.tid, // string or number
              cpu_ms: raw.cpu_ms !== undefined ? Number(raw.cpu_ms) : undefined,
              sched_wait_ms: raw.sched_wait_ms !== undefined ? Number(raw.sched_wait_ms) : undefined,
            });
            parsedCount++;
          } catch (e) {
            // handle parse error quietly for individual rows
          }
        }
        
        // Update progress occasionally or every chunk
        onProgress({
          loadedBytes,
          totalBytes,
          parsedCount,
          isComplete: false,
        });
      }
      
      if (done) {
        // flush remaining
        if (buffer.trim()) {
          const lineStr = buffer.trim().replace(
            /("acq"|"comp"|"recv"):\s*?(-?\d+)/g,
            '$1:"$2"'
          );
          try {
            const raw = JSON.parse(lineStr);
            const currentBase = baseTime || 0n;
            const recvNs = raw.recv ? Number(BigInt(raw.recv) - currentBase) / 1000000 : 0;
            const compNs = raw.comp ? Number(BigInt(raw.comp) - currentBase) / 1000000 : 0;
            
            results.push({
              acqStr: String(raw.acq),
              comp: compNs,
              id: String(raw.id),
              lat_ms: Number(raw.lat_ms),
              p: Number(raw.p),
              cpu_ms: raw.cpu_ms !== undefined ? Number(raw.cpu_ms) : undefined,
              sched_wait_ms: raw.sched_wait_ms !== undefined ? Number(raw.sched_wait_ms) : undefined,
              port_desc: raw.port_desc ? String(raw.port_desc) : undefined,
              recv: recvNs,
              sys_lat_ms: Number(raw.sys_lat_ms),
              tid: raw.tid,
            });
            parsedCount++;
          } catch(e) {}
        }
        break;
      }
    }
    
    // Sort results by receive time just in case
    results.sort((a, b) => a.recv - b.recv);
    
    onProgress({
      loadedBytes,
      totalBytes,
      parsedCount,
      isComplete: true,
    });
    
    onComplete(results);
    
  } catch (error) {
    console.error('Error parsing JSONL:', error);
    // Return what we have so far
    onComplete(results);
  }
}
