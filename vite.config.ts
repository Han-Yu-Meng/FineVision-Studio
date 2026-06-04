
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import ViteYaml from '@modyfi/vite-plugin-yaml';
import { Server } from 'socket.io'; // Import Socket.IO
import zlib from 'zlib';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FINS_ROOT = path.join(os.homedir(), '.fins');
const DATAFLOWS_DIR = path.join(FINS_ROOT, 'dataflows');
const PARAMETERS_DIR = path.join(FINS_ROOT, 'parameters');

// Ensure directories exist
if (!fs.existsSync(DATAFLOWS_DIR)) fs.mkdirSync(DATAFLOWS_DIR, { recursive: true });
if (!fs.existsSync(PARAMETERS_DIR)) fs.mkdirSync(PARAMETERS_DIR, { recursive: true });

// In-memory store for agents (simulating a database)
const agents = new Map();
let io: Server | null = null; // Store Socket.IO instance
let lastPackages = "[]"; // Cache for packages

const Studio = () => {
  const plugin = {
    name: 'studio',
    configurePreviewServer(server) {
      plugin.configureServer(server);
    },
    configureServer(server) {
      if (!server.httpServer) return;

    // Initialize Socket.IO
    io = new Server(server.httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      path: "/params_socket/",
      perMessageDeflate: {
          threshold: 1024 // Compress payloads > 1KB
      }
    });

    console.log("Socket.IO initialized on server");

    // Poll Backend for Packages (Backend Proxy)
    // Minimizes frontend polling traffic
    setInterval(async () => {
        try {
            // Must match the proxy target in vite config
            const res = await fetch('http://localhost:8899/api/packages');
            if (res.ok) {
                const text = await res.text();
                // Simple diff (string comparison)
                if (text !== lastPackages) {
                    lastPackages = text;
                    const json = JSON.parse(text);
                    if (io) io.emit('packages_update', json);
                }
            }
        } catch (e) {
            // Backend might be down
        }
    }, 2000);

    // Heartbeat check for agents (Strict 20s timeout)
    setInterval(() => {
        const now = Date.now();
        let changed = false;
        agents.forEach((agent, id) => {
            // Use 20s timeout
            if (now - agent.lastSeen > 20000 && agent.status !== 'OFFLINE') {
                agents.set(id, { ...agent, status: 'OFFLINE' });
                changed = true;
                console.log(`Agent ${id} timed out (OFFLINE)`);
            }
        });
        if (changed && io) {
            io.emit('agents_update', Array.from(agents.values()));
        }
    }, 1000); // Check every 1s for tighter control

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      // Send initial data
      socket.emit('agents_update', Array.from(agents.values()));
      // Send cached packages if available
      if (lastPackages !== "[]") {
          try {
             socket.emit('packages_update', JSON.parse(lastPackages));
          } catch(e) {}
      }

      socket.on('disconnect', () => {
        // console.log('Client disconnected:', socket.id);
      });
    });

    server.middlewares.use((req, res, next) => {
      if (req.method === 'POST' && (req.url === '/register_agent' || req.url === '/report_telemetry')) {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const agentId = data.agent_id;
            const now = Date.now();
            let hasChange = false;
            
            if (req.url === '/register_agent') {
                console.log(`Agent registering: ${agentId}`);
                const existing = agents.get(agentId) || {};
                
                const mergedCapabilities = {
                    ...(existing.capabilities || {}),
                    ...data.capabilities
                };

                agents.set(agentId, {
                    ...existing,
                    id: agentId,
                    agent_ip: data.agent_ip,
                    agent_port: data.agent_port,
                    capabilities: mergedCapabilities,
                    status: 'ONLINE',
                    lastSeen: now,
                    metrics: existing.metrics || { cpu_usage_percent: 0, memory_usage_percent: 0, memory_used_mb: 0, memory_total_mb: 0 },
                    nodeMetrics: existing.nodeMetrics || {},
                    pipeMetrics: existing.pipeMetrics || {},
                    pipeMetricsHistory: existing.pipeMetricsHistory || {}
                });
                hasChange = true;
            } else if (req.url === '/report_telemetry') {
                const agent = agents.get(agentId);
                if (agent) {
                    // Process Node Metrics (Logs only - Incremental)
                    const nodeMetrics = { ...(agent.nodeMetrics || {}) };
                    if (data.node_metrics) {
                        for (const [nodeId, metrics] of Object.entries(data.node_metrics)) {
                            const newLogs = (metrics as any).logs || [];
                            const incomingMetrics = (metrics as any).metrics;
                            const existingNode = nodeMetrics[nodeId] || { logs: [] };
                            
                            // Fix: Keep the metrics property while merging logs
                            nodeMetrics[nodeId] = {
                                ...existingNode,
                                metrics: incomingMetrics || existingNode.metrics,
                                logs: [...existingNode.logs, ...newLogs].slice(-10000) 
                            };
                        }
                    }

                    // Process Pipe Metrics
                    const newPipeMetrics = data.pipe_metrics || {};
                    const pipeMetricsHistory = agent.pipeMetricsHistory || {};

                    // Append new samples to history
                    for (const [pipeId, metric] of Object.entries(newPipeMetrics)) {
                        if (!pipeMetricsHistory[pipeId]) {
                            pipeMetricsHistory[pipeId] = [];
                        }
                        const sample = { ...(metric as any), timestamp: now };
                        pipeMetricsHistory[pipeId].push(sample);
                        
                        // Keep last 600 samples (~10 minutes at 1Hz)
                        if (pipeMetricsHistory[pipeId].length > 600) {
                            pipeMetricsHistory[pipeId].shift();
                        }
                    }

                    // Recover status from OFFLINE immediately if active
                    // Use reported is_running flag, defaulting to RUNNING if stats are present, or just ONLINE
                    const currentStatus = data.is_running ? 'RUNNING' : 'ONLINE'; 

                    // Check if status actually changed to avoid unnecessary re-renders if just telemetry update
                    // But we MUST update if it was OFFLINE
                    if (agent.status === 'OFFLINE') {
                        console.log(`Agent ${agentId} recovered (ONLINE)`);
                        hasChange = true;
                    } else if (agent.status !== currentStatus) {
                        hasChange = true;
                    }
                    
                    // Always trigger update for telemetry data (high frequency)
                    // In a real optimized system we might separate status update events from metric events
                    // But for this bug fix, we ensure state is pushed.
                    hasChange = true; 

                    agents.set(agentId, {
                        ...agent,
                        agent_ip: data.agent_ip || agent.agent_ip,
                        agent_port: data.agent_port || agent.agent_port,
                        lastSeen: now,
                        metrics: data.system_metrics,
                        nodeMetrics: nodeMetrics,
                        pipeMetrics: newPipeMetrics,
                        pipeMetricsHistory: pipeMetricsHistory,
                        status: currentStatus // Ensure status is fresh
                    });
                }
            }

            // Broadcast change via WebSocket
            if (hasChange && io) {
                io.emit('agents_update', Array.from(agents.values()));
            }
            
            res.statusCode = 200;
            res.end(JSON.stringify({ status: 'ok' }));
          } catch (e) {
            console.error('Error processing request:', e);
            res.statusCode = 500;
            res.end('Error');
          }
        });
      } else if (req.method === 'POST' && req.url?.startsWith('/api/proxy/agent')) {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { agentId, ip, port, path, method, body: payload } = JSON.parse(body);
            
            // Intercept dataflow/run commands to clear memory leak sources
            if (agentId && agents.has(agentId)) {
                let shouldClear = false;
                // Case 1: Load Dataflow (Deploy) - Clear history on new deploy
                if (path === '/load_dataflow') shouldClear = true;
                
                // Note: We DO NOT clear on '/set_status' (Start/Stop) anymore to preserve history 
                // for the "Performance Details" view after stopping.
                // The user can manually clear metrics using the Eraser button in Editor.

                if (shouldClear) {
                     const existing = agents.get(agentId);
                     agents.set(agentId, {
                         ...existing,
                         nodeMetrics: {},
                         pipeMetrics: {},
                         pipeMetricsHistory: {}
                     });
                     console.log(`[Middleware] Cleared metrics for ${agentId}`);
                     
                     // Broadcast clear event
                     if (io) io.emit('agents_update', Array.from(agents.values()));
                }
            }

            const targetUrl = `http://${ip}:${port}${path}`;
            console.log(`Proxying request to: ${targetUrl}`);

            // Using global fetch (Node 18+)
            const response = await fetch(targetUrl, {
              method: method || 'GET',
              headers: { 'Content-Type': 'application/json' },
              body: payload ? JSON.stringify(payload) : undefined
            });

            const responseText = await response.text();
            res.statusCode = response.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(responseText);
          } catch (e: any) {
            console.error('Proxy error:', e);
            res.statusCode = 500;
            res.end(JSON.stringify({ status: 'error', message: e.message }));
          }
        });
      } else if (req.method === 'GET' && req.url === '/api/agents') {
        const agentList = Array.from(agents.values());
        const jsonResponse = JSON.stringify(agentList);
        res.setHeader('Content-Type', 'application/json');

        const acceptEncoding = req.headers['accept-encoding'] || '';
        if (String(acceptEncoding).includes('gzip')) {
            res.setHeader('Content-Encoding', 'gzip');
            try {
                const compressed = zlib.gzipSync(jsonResponse);
                res.end(compressed);
            } catch (e) {
                console.error('Compression failed', e);
                res.end(jsonResponse);
            }
        } else {
            res.end(jsonResponse);
        }
      } else if (req.method === 'DELETE' && req.url?.startsWith('/api/agent')) {
         // Handler for deleting specific agent
         try {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const id = urlObj.searchParams.get('id');
            if (id) {
                const deleted = agents.delete(id);
                if (deleted && io) {
                    io.emit('agents_update', Array.from(agents.values()));
                }
                res.statusCode = 200;
                res.end(JSON.stringify({ status: 'ok', deleted }));
                console.log(`Agent ${id} removed via API`);
            } else {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing id parameter' }));
            }
         } catch (e: any) {
             res.statusCode = 500;
             res.end(JSON.stringify({ error: e.message }));
         }
      } else if (req.method === 'GET' && req.url === '/api/clear_cache') {
        agents.clear();
        if(io) io.emit('agents_update', []);
        console.log('Agents cache cleared via API');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok', message: 'Agents cache cleared' }));
      } else if (req.url?.startsWith('/api/dataflow')) {
          // Internal persistence for dataflows
          const name = req.url.split('/').pop() || '';
          // Path traversal protection: strip path separators and null bytes
          const safeName = name.replace(/[\/\\]/g, '').replace(/\0/g, '');
          const filePath = safeName && safeName !== 'dataflow' ? path.join(DATAFLOWS_DIR, `${decodeURIComponent(safeName)}.json`) : null;

          if (req.method === 'GET' && req.url === '/api/dataflows') {
              const files = fs.readdirSync(DATAFLOWS_DIR).filter(f => f.endsWith('.json'));
              const contents = files.map(f => JSON.parse(fs.readFileSync(path.join(DATAFLOWS_DIR, f), 'utf-8')));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(contents));
          } else if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', () => {
                  try {
                      const data = JSON.parse(body);
                      const targetPath = path.join(DATAFLOWS_DIR, `${data.config.name}.json`);
                      fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));
                      if (io) io.emit('config_sync');
                      res.end(JSON.stringify({ status: 'ok' }));
                  } catch (e: any) {
                      res.statusCode = 500;
                      res.end(JSON.stringify({ error: e.message }));
                  }
              });
          } else if (req.method === 'DELETE' && filePath) {
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
              if (io) io.emit('config_sync');
              res.end(JSON.stringify({ status: 'ok' }));
          }
      } else if (req.url?.startsWith('/api/parameter')) {
          // Internal persistence for parameters
          const name = req.url.split('/').pop() || '';
          // Path traversal protection: strip path separators and null bytes
          const safeName = name.replace(/[\/\\]/g, '').replace(/\0/g, '');
          const filePath = safeName && safeName !== 'parameter' ? path.join(PARAMETERS_DIR, `${decodeURIComponent(safeName)}.yaml`) : null;

          if (req.method === 'GET' && req.url === '/api/parameters') {
              const files = fs.readdirSync(PARAMETERS_DIR).filter(f => f.endsWith('.yaml'));
              const contents = files.map(f => ({
                  name: f.replace('.yaml', ''),
                  content: fs.readFileSync(path.join(PARAMETERS_DIR, f), 'utf-8')
              }));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(contents));
          } else if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', () => {
                  try {
                      const data = JSON.parse(body);
                      const targetPath = path.join(PARAMETERS_DIR, `${data.name}.yaml`);
                      fs.writeFileSync(targetPath, data.content);
                      if (io) io.emit('config_sync');
                      res.end(JSON.stringify({ status: 'ok' }));
                  } catch (e: any) {
                      res.statusCode = 500;
                      res.end(JSON.stringify({ error: e.message }));
                  }
              });
          } else if (req.method === 'DELETE' && filePath) {
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
              if (io) io.emit('config_sync');
              res.end(JSON.stringify({ status: 'ok' }));
          }
      } else {
        next();
      }
    });
  }
};
return plugin;
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 8080,
        host: '0.0.0.0',
        proxy: {
            '/api/fins': {
                target: 'http://localhost:8899',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/fins/, '/api')
            }
        }
      },
      preview: {
        port: 8080,
        host: '0.0.0.0',
        proxy: {
            '/api/fins': {
                target: 'http://localhost:8899',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/fins/, '/api')
            }
        }
      },
      plugins: [react(), ViteYaml(), Studio()],
      build: {
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true
          }
        }
      },
      define: { },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
