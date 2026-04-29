
// SystemContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Agent, AgentStatus, Dataflow, SystemMetrics, NodeMetrics, PipeMetric, PipeMetricSample, Capability, AgentCapabilities, ParameterDef, PortDef, LogEntry } from '../types';
import { InspectResult, InspectNode } from '../types_pkg';
import { MOCK_AGENT } from '../services/mockData';
import { mergeCapabilities } from '../utils/dataflowUtils';
// @ts-ignore
import dataflowJson from '../dataflows.json';
import { io, Socket } from 'socket.io-client';
import { packageService } from '../services/packageService';

export interface ParameterConfig {
  name: string;
  content: string;
}


export interface SystemNotification {
    id: string;
    message: string; 
    type: 'success' | 'error' | 'info' | 'loading';
    link?: string; 
    timestamp: number;
}

export interface PackageCompilationState {
    status: 'idle' | 'pending' | 'compiling' | 'success' | 'error';
    logs: string[];
    errorCount: number;
    startTime?: number;
    endTime?: number;
}

export interface CompilationProgress {
    current: number;
    total: number;
}

interface SystemContextType {
  agents: Agent[];
  dataflows: Dataflow[];
  activeDataflow: Dataflow | null;
  packages: any[];
  localCapabilities: Record<string, Capability[]>; 
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  addOrUpdateAgent: (agent: Agent) => void;
  saveDataflow: (flow: Dataflow) => Promise<void>;
  reorderDataflows: (flows: Dataflow[]) => void;
  loadDataflow: (flow: Dataflow) => void;
  deleteDataflow: (name: string) => Promise<void>;
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;
  removeAgent: (agentId: string) => void;
  sendAgentCommand: (agentId: string, path: string, method?: string, body?: any) => Promise<any>;
  deployDataflowToAgent: (agentId: string, flow: Dataflow) => Promise<boolean>;
  deployParameterToAgent: (agentId: string, param: ParameterConfig) => Promise<boolean>;
  setAgentState: (agentId: string, state: 'RUNNING' | 'STOPPED') => Promise<boolean>;
  getAgentDataflow: (agentId: string) => Promise<Dataflow | null>;
  parameters: ParameterConfig[];
  activeParameter: ParameterConfig | null;
  saveParameter: (param: ParameterConfig) => Promise<void>;
  reorderParameters: (params: ParameterConfig[]) => void;
  loadParameter: (param: ParameterConfig) => void;
  deleteParameter: (name: string) => Promise<void>;
  agentActiveFlows: Record<string, string>;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  editorSelectedAgentId: string;
  setEditorSelectedAgentId: (id: string) => void;
  clearAgentMetrics: (agentId: string) => void;
  notifications: SystemNotification[];
  hasUnreadError: boolean;
  addNotification: (notification: Omit<SystemNotification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  markNotificationsRead: () => void;
  compilationState: Record<string, PackageCompilationState>;
  startCompileAll: () => Promise<void>; 
  startCompileBatch: (pkgNames?: string[]) => Promise<void>; 
  startCompilePackage: (pkgName: string) => Promise<void>;
  updateCompilationState: (pkgName: string, state: PackageCompilationState) => void;
  isCompilingGlobal: boolean;
  compilationProgress: CompilationProgress;
  subscribeToMetrics: (callback: () => void) => () => void;
  getAgentRealtime: (agentId: string) => Agent | undefined;
  // Add clear timestamps management
  agentClearTimestamps: Record<string, number>;
  getAgentClearTimestamp: (agentId: string) => number;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

const socket = io({
    path: "/params_socket/",
    transports: ['websocket'],
    reconnection: true
});

const mergeLogs = (existing: LogEntry[], incoming: LogEntry[]): LogEntry[] => {
    if (!existing || existing.length === 0) return incoming;
    if (!incoming || incoming.length === 0) return existing;

    const map = new Map<string, LogEntry>();
    existing.forEach(l => map.set(`${l.timestamp}-${l.message}`, l));
    incoming.forEach(l => map.set(`${l.timestamp}-${l.message}`, l));
    
    const merged = Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
    return merged.slice(-10000);
};

export const SystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [agentsRaw, setAgentsRaw] = useState<Agent[]>([]); 
  const agentsRef = useRef<Agent[]>([]); 
  const [localCapabilities, setLocalCapabilities] = useState<Record<string, Capability[]>>({});
  // Track agent-specific capabilities separately from local capabilities
  const [agentCapabilities, setAgentCapabilities] = useState<Record<string, AgentCapabilities>>({});
  const realtimeAgentsRef = useRef<Map<string, Agent>>(new Map());
  const metricsSubscribers = useRef<Set<() => void>>(new Set());
  const knownAgentIds = useRef<Set<string>>(new Set());
  const lastNotifyTime = useRef<number>(0);
  
  // Add clear timestamps management
  const [agentClearTimestamps, setAgentClearTimestamps] = useState<Record<string, number>>({});

  const notifyMetricsSubscribers = useCallback(() => {
      metricsSubscribers.current.forEach(cb => cb());
  }, []);

  const subscribeToMetrics = useCallback((callback: () => void) => {
      metricsSubscribers.current.add(callback);
      return () => {
          metricsSubscribers.current.delete(callback);
      };
  }, []);

  const getAgentClearTimestamp = useCallback((agentId: string) => {
    return agentClearTimestamps[agentId] || 0;
  }, [agentClearTimestamps]);

  const getAgentRealtime = useCallback((agentId: string) => {
      const raw = realtimeAgentsRef.current.get(agentId);
      if (!raw) return undefined;
      
      const onlineAgentIds = Array.from(realtimeAgentsRef.current.values())
          .filter(a => a.status !== AgentStatus.OFFLINE)
          .map(a => a.id);
      
      const globalCapabilities = mergeCapabilities(
          localCapabilities, 
          agentCapabilities, 
          onlineAgentIds
      );

      return {
          ...raw,
          capabilities: globalCapabilities
      };
  }, [localCapabilities, agentCapabilities]);

  const agents = useMemo(() => {
      const onlineAgentIds = agentsRaw
          .filter(a => a.status !== AgentStatus.OFFLINE)
          .map(a => a.id);
      
      const globalCapabilities = mergeCapabilities(
          localCapabilities, 
          agentCapabilities, 
          onlineAgentIds
      );

      return agentsRaw.map(a => ({
          ...a,
          capabilities: globalCapabilities
      }));
  }, [agentsRaw, localCapabilities, agentCapabilities]);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
      const saved = localStorage.getItem('theme');
      return (saved as 'light' | 'dark') || 'dark';
  });

  const toggleTheme = useCallback(() => {
      setTheme(prev => {
          const newTheme = prev === 'dark' ? 'light' : 'dark';
          localStorage.setItem('theme', newTheme);
          if (newTheme === 'dark') {
              document.documentElement.classList.add('dark');
          } else {
              document.documentElement.classList.remove('dark');
          }
          return newTheme;
      });
  }, []);

  useEffect(() => {
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  const [dataflows, setDataflows] = useState<Dataflow[]>([]);
  const [activeDataflow, setActiveDataflow] = useState<Dataflow | null>(null);

  const [packages, setPackages] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [hasUnreadError, setHasUnreadError] = useState(false);
  const [compilationState, setCompilationState] = useState<Record<string, PackageCompilationState>>({});
  const [isCompilingGlobal, setIsCompilingGlobal] = useState(false);
  const [compilationProgress, setCompilationProgress] = useState<CompilationProgress>({ current: 0, total: 0 });

  const [parameters, setParameters] = useState<ParameterConfig[]>([]);
  
  // Helper function to check if two objects are deeply equal (for metrics comparison)
  const isDeepEqual = (obj1: any, obj2: any): boolean => {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!isDeepEqual(obj1[key], obj2[key])) return false;
    }
    
    return true;
  };
  
  const handleAgentsUpdate = useCallback((updatedAgents: Agent[]) => {
    let hasCapabilitiesChange = false;
    let hasMetricsChange = false;
    
    updatedAgents.forEach(newAgent => {
        const oldAgent = realtimeAgentsRef.current.get(newAgent.id);
        let mergedAgent = newAgent;

        if (oldAgent) {
            // Check if capabilities changed (deep comparison)
            if (!hasCapabilitiesChange && newAgent.capabilities) {
                if (!isDeepEqual(oldAgent.capabilities, newAgent.capabilities)) {
                    hasCapabilitiesChange = true;
                }
            }

            // Check if metrics changed (use deep comparison)
            if (!hasMetricsChange) {
                if (!isDeepEqual(oldAgent.metrics, newAgent.metrics) ||
                    !isDeepEqual(oldAgent.nodeMetrics, newAgent.nodeMetrics) ||
                    !isDeepEqual(oldAgent.pipeMetrics, newAgent.pipeMetrics)) {
                    hasMetricsChange = true;
                }
            }

            const mergedNodeMetrics: NodeMetrics = { ...newAgent.nodeMetrics };
            Object.keys(mergedNodeMetrics).forEach(nodeId => {
                const newLogs = mergedNodeMetrics[nodeId].logs || [];
                const oldLogs = oldAgent.nodeMetrics[nodeId]?.logs || [];
                if (newLogs.length > 0) {
                    mergedNodeMetrics[nodeId].logs = mergeLogs(oldLogs, newLogs);
                } else if (oldLogs.length > 0) {
                    mergedNodeMetrics[nodeId].logs = oldLogs;
                }
            });
            Object.keys(oldAgent.nodeMetrics).forEach(nodeId => {
                if (!mergedNodeMetrics[nodeId]) {
                    mergedNodeMetrics[nodeId] = oldAgent.nodeMetrics[nodeId];
                }
            });
            mergedAgent = {
                ...newAgent,
                nodeMetrics: mergedNodeMetrics,
            };
        } else {
            // New agent - definitely has changes
            hasCapabilitiesChange = true;
            hasMetricsChange = true;
        }
        
        realtimeAgentsRef.current.set(newAgent.id, mergedAgent);

        // Handle agent capabilities - only update if changed
        if (hasCapabilitiesChange && newAgent.capabilities && Object.keys(newAgent.capabilities).length > 0) {
            setAgentCapabilities(prev => {
                // Check if actually different using deep comparison
                const existing = prev[newAgent.id];
                if (existing && isDeepEqual(existing, newAgent.capabilities)) {
                    return prev; // No change
                }
                return {
                    ...prev,
                    [newAgent.id]: newAgent.capabilities
                };
            });
        }

        // Clean up capabilities when agent goes offline
        if (newAgent.status === AgentStatus.OFFLINE) {
            setAgentCapabilities(prev => {
                if (!prev[newAgent.id]) return prev; // Already removed
                const updated = { ...prev };
                delete updated[newAgent.id];
                return updated;
            });
        }
    });

    // Check for structural changes (agent count, status, or capabilities)
    let structuralChange = false;
    if (updatedAgents.length !== agentsRef.current.length) {
        structuralChange = true;
    } else {
        for (let i = 0; i < updatedAgents.length; i++) {
            const newA = updatedAgents[i];
            const oldA = agentsRef.current.find(a => a.id === newA.id);
            if (!oldA || newA.status !== oldA.status) {
                structuralChange = true;
                break;
            }
        }
    }

    // Only update agentsRaw if there's a structural change
    if (structuralChange || hasCapabilitiesChange) {
        setAgentsRaw(prev => {
            return updatedAgents.map(newA => {
                const oldA = prev.find(a => a.id === newA.id);
                if (!oldA) return newA;
                
                const mergedNodeMetrics: NodeMetrics = { ...newA.nodeMetrics };
                Object.keys(mergedNodeMetrics).forEach(nodeId => {
                    const newLogs = mergedNodeMetrics[nodeId].logs || [];
                    const oldLogs = oldA.nodeMetrics[nodeId]?.logs || [];
                    if (newLogs.length > 0) mergedNodeMetrics[nodeId].logs = mergeLogs(oldLogs, newLogs);
                    else if (oldLogs.length > 0) mergedNodeMetrics[nodeId].logs = oldLogs;
                });
                
                Object.keys(oldA.nodeMetrics).forEach(nodeId => {
                    if (!mergedNodeMetrics[nodeId]) mergedNodeMetrics[nodeId] = oldA.nodeMetrics[nodeId];
                });

                return { ...newA, nodeMetrics: mergedNodeMetrics };
            });
        });
    }

    // Only notify subscribers if metrics actually changed and enough time has passed (throttle to 100ms)
    if (hasMetricsChange || structuralChange) {
        const now = Date.now();
        if (now - lastNotifyTime.current > 100) {
            lastNotifyTime.current = now;
            notifyMetricsSubscribers();
        }
    }
  }, [notifyMetricsSubscribers]);

  useEffect(() => {
    const onAgentsUpdate = (updatedAgents: Agent[]) => {
        handleAgentsUpdate(updatedAgents);
    };

    const handlePackagesUpdate = (updatedPackages: any[]) => {
        setPackages(updatedPackages);
    };

    const handleConfigSync = async () => {
        console.log("[Sync] Config sync triggered via WebSocket");
        try {
            const [flows, params] = await Promise.all([
                packageService.getDataflows(),
                packageService.getParameters()
            ]);
            setDataflows(flows);
            setParameters(params);
        } catch (e) {
            console.error("[Sync] Failed to sync data from backend", e);
        }
    };

    socket.on('agents_update', onAgentsUpdate);
    socket.on('packages_update', handlePackagesUpdate);
    socket.on('config_sync', handleConfigSync);

    fetch('/api/agents')
        .then(res => res.json())
        .then(data => { handleAgentsUpdate(data); })
        .catch(console.error);

    fetch('/api/fins/packages')
        .then(res => res.json())
        .then(data => { setPackages(data); })
        .catch(e => console.warn("Backend API not reachable"));

    // Initial load for dataflows and parameters
    handleConfigSync();

    return () => {
        socket.off('agents_update', onAgentsUpdate);
        socket.off('packages_update', handlePackagesUpdate);
        socket.off('config_sync', handleConfigSync);
    };
  }, [handleAgentsUpdate]);

  const [activeParameter, setActiveParameter] = useState<ParameterConfig | null>(null);

  
  const [agentActiveFlows, setAgentActiveFlows] = useState<Record<string, string>>({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const toggleSidebar = useCallback(() => setIsSidebarCollapsed(prev => !prev), []);
  const [editorSelectedAgentId, setEditorSelectedAgentId] = useState<string>('');

  
  // --- Capabilities Logic ---

  const mapInspectNodesToCapabilities = (pkgName: string, nodes: InspectNode[]): Capability[] => {
      return nodes.map(n => ({
          name: n.name, 
          description: n.description,
          category: n.category,
          package_name: n.package_name || pkgName,
          source: n.source || 'workspace',
          version: n.version || 'default',
          inputs: n.inputs || [],
          outputs: n.outputs || [],
          parameters: n.parameters?.map(p => ({
              ...p,
              default_value: p.default_value
          })) || [],
          clients: n.clients || [],
          servers: n.servers || [],
          actors: (n as any).actors || [],
          commanders: (n as any).commanders || []
      }));
  };

  const updateCapabilitiesFromPackage = useCallback(async (pkgName: string) => {
      try {
          const results = await packageService.inspectPackage(pkgName);
          const validResult = results.find(r => r.status === 'VALID' && r.nodes && r.nodes.length > 0);
          
          if (validResult) {
              const capabilities = mapInspectNodesToCapabilities(pkgName, validResult.nodes);
              setLocalCapabilities(prev => ({
                  ...prev,
                  [pkgName]: capabilities
              }));
              console.log(`[Capabilities] Updated ${pkgName} with ${capabilities.length} nodes`);
          }
      } catch (e: any) {
          if (e.message !== "BINARY_NOT_FOUND") {
              console.warn(`[Capabilities] Failed to inspect ${pkgName}:`, e);
          }
      }
  }, []);

  useEffect(() => {
      const initCapabilities = async () => {
          try {
              const pkgs = await packageService.getLocalPackages();
              const candidates = pkgs.filter(p => p.status !== 'Uncompiled');
              
              const CHUNK_SIZE = 5;
              for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
                  const chunk = candidates.slice(i, i + CHUNK_SIZE);
                  await Promise.all(chunk.map(p => updateCapabilitiesFromPackage(p.name)));
              }
          } catch (e) {
              console.error("[Capabilities] Init failed", e);
          }
      };
      initCapabilities();
  }, [updateCapabilitiesFromPackage]);

  // --- Notification Logic ---
  const addNotification = useCallback((notification: Omit<SystemNotification, 'id' | 'timestamp'>) => {
      const id = Math.random().toString(36).substring(7);
      const timestamp = Date.now();
      
      setNotifications(prev => {
          const newList = [{ ...notification, id, timestamp }, ...prev];
          if (newList.length > 30) {
              return newList.slice(0, 30);
          }
          return newList;
      });

      if (notification.type === 'error') {
          setHasUnreadError(true);
      }
  }, []);

  const removeNotification = useCallback((id: string) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
      setNotifications([]);
      setHasUnreadError(false);
  }, []);

  const markNotificationsRead = useCallback(() => {
      setHasUnreadError(false);
  }, []);

  // --- Compilation Logic ---
  const countErrors = (log: string) => {
      const errorRegex = /error[:\s]|failed|exception/gi; 
      const matches = log.match(errorRegex);
      return matches ? matches.length : 0;
  };

  const startCompilePackage = useCallback(async (pkgName: string) => {
      setCompilationState(prev => ({
          ...prev,
          [pkgName]: { status: 'compiling', logs: [], errorCount: 0, startTime: Date.now() }
      }));

      try {
          let errorCount = 0;
          let failureDetected = false;

          await packageService.compilePackage(pkgName, (chunk) => {
              const newErrors = countErrors(chunk);
              errorCount += newErrors;

              if (chunk.includes('[ERROR] Compilation Failed') || chunk.includes('ninja: build stopped')) {
                  failureDetected = true;
              }

              setCompilationState(prev => {
                  const current = prev[pkgName] || { logs: [], errorCount: 0 };
                  return {
                      ...prev,
                      [pkgName]: { 
                          ...current, 
                          status: 'compiling',
                          logs: [...current.logs, chunk],
                          errorCount: current.errorCount + newErrors
                      }
                  };
              });
          });

          const finalStatus = failureDetected ? 'error' : 'success';

          setCompilationState(prev => ({
              ...prev,
              [pkgName]: { 
                  ...prev[pkgName], 
                  status: finalStatus, 
                  errorCount: finalStatus === 'success' ? 0 : prev[pkgName].errorCount, // Reset errorCount on success
                  endTime: Date.now() 
              }
          }));
          
          console.log('[Compilation] Final status:', { pkgName, finalStatus, errorCount: finalStatus === 'success' ? 0 : errorCount });

          if (finalStatus === 'success') {
              updateCapabilitiesFromPackage(pkgName);
          }

          if (finalStatus === 'error') {
               // Split pkgName into source and name (e.g., "workspace/imgui_pointcloud_visualizer")
               const parts = pkgName.split('/');
               const source = parts.length > 1 ? parts[0] : 'local';
               const name = parts.length > 1 ? parts.slice(1).join('/') : pkgName;
               const link = `/package/${encodeURIComponent(source)}/${encodeURIComponent(name)}?tab=compilation`;
               
               console.log('[Compilation] Error notification:', { pkgName, source, name, link });
               
               addNotification({
                  message: `${pkgName} compilation failed.`,
                  type: 'error',
                  link,
              });
          }

      } catch (e: any) {
          const errorMsg = e.message || "Unknown error";
          setCompilationState(prev => ({
              ...prev,
              [pkgName]: { 
                  ...prev[pkgName], 
                  status: 'error', 
                  logs: [...(prev[pkgName]?.logs || []), `\n[System] Exception: ${errorMsg}`],
                  errorCount: (prev[pkgName]?.errorCount || 0) + 1,
                  endTime: Date.now()
              }
          }));
          
          // Split pkgName into source and name
          const parts = pkgName.split('/');
          const source = parts.length > 1 ? parts[0] : 'local';
          const name = parts.length > 1 ? parts.slice(1).join('/') : pkgName;
          
          addNotification({
              message: `${pkgName} compilation exception: ${errorMsg}`,
              type: 'error',
              link: `/package/${encodeURIComponent(source)}/${encodeURIComponent(name)}?tab=compilation`,
          });
      }
  }, [addNotification, updateCapabilitiesFromPackage]);
  
  const updateCompilationState = useCallback((pkgName: string, state: Partial<PackageCompilationState>) => {
      setCompilationState(prev => {
          const existing = prev[pkgName] || { status: 'idle' as const, logs: [], errorCount: 0 };
          return {
              ...prev,
              [pkgName]: {
                  ...existing,
                  ...state
              }
          };
      });
  }, []);

  const startCompileBatch = useCallback(async (pkgNames?: string[]) => {
      const targetPackages = pkgNames 
          ? packages.filter(p => {
              if (pkgNames.includes(p.name)) return true;
              const pShort = p.name.split('/').pop();
              if (pShort && pkgNames.includes(pShort)) return true;
              const requestedShortMatch = pkgNames.some(req => req.split('/').pop() === p.name);
              if (requestedShortMatch) return true;
              return false;
          }) 
          : packages;

      if (targetPackages.length === 0) {
          if (pkgNames && pkgNames.length > 0) {
              addNotification({
                  message: "Requested packages not found locally.",
                  type: 'error',
              });
          } else if (!pkgNames) {
               addNotification({
                  message: "No local packages found to compile.",
                  type: 'info',
              });
          }
          return;
      }
      
      // Don't show batch notification for single package
      const isBatchCompilation = targetPackages.length > 1;
      
      setIsCompilingGlobal(true);
      setCompilationProgress({ current: 0, total: targetPackages.length });
      
      setCompilationState(prev => {
          const next = { ...prev };
          targetPackages.forEach(p => {
              next[p.name] = { status: 'pending', logs: [], errorCount: 0 };
          });
          return next;
      });

      if (isBatchCompilation) {
          addNotification({
              message: `Batch compiling ${targetPackages.length} packages...`,
              type: 'info',
          });
      }

      const CONCURRENCY = 4;
      const queue = [...targetPackages];
      let activeCount = 0;
      let completedCount = 0;

      const processQueue = async () => {
          if (queue.length === 0 && activeCount === 0) {
              return;
          }

          while (activeCount < CONCURRENCY && queue.length > 0) {
              const pkg = queue.shift();
              if (pkg) {
                  activeCount++;
                  startCompilePackage(pkg.name).then(() => {
                      activeCount--;
                      completedCount++;
                      setCompilationProgress(prev => ({ ...prev, current: completedCount }));
                      processQueue();
                  });
              }
          }
      };

      await processQueue();

      await new Promise<void>((resolve) => {
          const checkDone = setInterval(() => {
              if (completedCount >= targetPackages.length) {
                  clearInterval(checkDone);
                  resolve();
              }
          }, 200);
      });

      setTimeout(() => {
          setIsCompilingGlobal(false);
          
          // Only show batch completion notification for multiple packages
          if (isBatchCompilation) {
              setCompilationState(finalState => {
                  // Check compilation results to determine notification type using the freshest state
                  let successCount = 0;
                  let errorCount = 0;
                  
                  targetPackages.forEach(pkg => {
                      const state = finalState[pkg.name];
                      if (state) {
                          if (state.status === 'success') {
                              successCount++;
                          } else if (state.status === 'error') {
                              errorCount++;
                          }
                      }
                  });
                  
                  let notificationType: 'success' | 'error' | 'info' = 'success';
                  let message = '';
                  
                  if (errorCount === targetPackages.length) {
                      // All packages failed
                      notificationType = 'error';
                      message = `${errorCount} packages failed.`;
                  } else if (errorCount > 0) {
                      // Some packages failed
                      notificationType = 'info'; // Use 'info' for warning-like messages
                      message = `${successCount} packages succeeded, ${errorCount} packages failed.`;
                  } else {
                      // All packages succeeded
                      notificationType = 'success';
                      message = `${successCount} packages succeeded.`;
                  }
                  
                  addNotification({
                      message,
                      type: notificationType,
                  });

                  return finalState;
              });
          }
      }, 500);

  }, [packages, startCompilePackage, addNotification, compilationState]);

  const startCompileAll = useCallback(() => startCompileBatch(), [startCompileBatch]);

  const sendAgentCommand = useCallback(async (agentId: string, path: string, method: string = 'GET', body?: any) => {
      let agent = agentsRef.current.find(a => a.id === agentId);
      if (!agent) {
          throw new Error(`Agent ${agentId} not found`);
      }

      const ip = (agent as any).agent_ip || (agent as any).ip || (agent as any).address?.split(':')[0];
      const port = (agent as any).agent_port || (agent as any).port || (agent as any).address?.split(':')[1];

      if (!ip || !port) throw new Error(`Agent IP/Port missing for agent ${agent.id}`);

      const res = await fetch('/api/proxy/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, ip, port: Number(port), path, method, body })
      });

      if (!res.ok) {
          const text = await res.text();
          throw new Error(text || res.statusText);
      }
      return res.json();
  }, []);

  const getAgentDataflow = useCallback(async (agentId: string): Promise<Dataflow | null> => {
      try {
          const flow = await sendAgentCommand(agentId, '/get_dataflow');
          return flow;
      } catch (e) {
          console.error("Get Agent Dataflow Error:", e);
          return null;
      }
  }, [sendAgentCommand]);

  const deployDataflowToAgent = useCallback(async (agentId: string, flow: Dataflow): Promise<boolean> => {
      try {
          console.log(`Deploying dataflow ${flow.config.name} to ${agentId}...`);

          const json = await sendAgentCommand(agentId, '/load_dataflow', 'POST', flow);
          if (json.status === 'success') {
              setAgentActiveFlows(prev => ({ ...prev, [agentId]: flow.config.name }));
              return true;
          } else {
              throw new Error(json.message);
          }
      } catch (e) {
          console.error("Deploy Dataflow Error:", e);
          throw e;
      }
  }, [sendAgentCommand]);

  const deployParameterToAgent = useCallback(async (agentId: string, param: ParameterConfig): Promise<boolean> => {
      try {
          console.log(`Deploying parameter ${param.name} to ${agentId}...`);
          const json = await sendAgentCommand(agentId, '/apply_parameters', 'POST', { name: param.name, content: param.content });
          if (json.status === 'success') {
              return true;
          } else {
              throw new Error(json.message);
          }
      } catch (e) {
          console.error("Deploy Parameter Error:", e);
          throw e;
      }
  }, [sendAgentCommand]);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch('/api/agents');
        if (res.ok) {
          const data = await res.json();
          handleAgentsUpdate(data);

          setAgentActiveFlows(prev => {
              const next = { ...prev };
              let changed = false;
              data.forEach((a: Agent) => {
                  if (a.status !== AgentStatus.RUNNING && next[a.id]) {
                      delete next[a.id];
                      changed = true;
                  }
              });
              return changed ? next : prev;
          });

          data.forEach(async (agent: Agent) => {
              if (!knownAgentIds.current.has(agent.id)) {
                  knownAgentIds.current.add(agent.id);
              }
          });
        }
      } catch (e) {
        console.error("Failed to fetch agents", e);
      }
    };

    fetchAgents();
    const interval = setInterval(fetchAgents, 1000);
    return () => clearInterval(interval);
  }, [dataflows, parameters, deployDataflowToAgent, deployParameterToAgent, handleAgentsUpdate]);

  const addOrUpdateAgent = useCallback((newAgent: Agent) => {
    setAgentsRaw(prev => {
      const idx = prev.findIndex(a => a.id === newAgent.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...newAgent };
        return copy;
      }
      return [...prev, newAgent];
    });
  }, []);

  const removeAgent = useCallback(async (agentId: string) => {
    setAgentsRaw(prev => prev.filter(a => a.id !== agentId));
    realtimeAgentsRef.current.delete(agentId);
    
    // Clean up agent capabilities when agent is removed
    setAgentCapabilities(prev => {
        const updated = { ...prev };
        delete updated[agentId];
        return updated;
    });
    
    try {
        await fetch(`/api/agent?id=${encodeURIComponent(agentId)}`, { method: 'DELETE' });
    } catch (e) {
        console.error("Failed to remove agent from backend", e);
    }
  }, []);

  const saveParameter = useCallback(async (param: ParameterConfig) => {
    try {
        await packageService.saveParameter(param);
        setParameters(prev => {
          const idx = prev.findIndex(p => p.name === param.name);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = param;
            return copy;
          }
          return [...prev, param];
        });
        if (activeParameter?.name === param.name) {
            setActiveParameter(param);
        }
    } catch (e) {
        console.error("Failed to save parameter to backend:", e);
        addNotification({ message: "Failed to save parameter", type: 'error' });
    }
  }, [activeParameter, addNotification]);

  const reorderParameters = useCallback((params: ParameterConfig[]) => {
      setParameters(params);
  }, []);

  const loadParameter = useCallback((param: ParameterConfig) => {
      setActiveParameter(param);
  }, []);

  const deleteParameter = useCallback(async (name: string) => {
    try {
        await packageService.deleteParameter(name);
        setParameters(prev => prev.filter(p => p.name !== name));
        if (activeParameter?.name === name) setActiveParameter(null);
    } catch (e) {
        console.error("Failed to delete parameter from backend:", e);
        addNotification({ message: "Failed to delete parameter", type: 'error' });
    }
  }, [activeParameter, addNotification]);

  const saveDataflow = useCallback(async (flow: Dataflow) => {
    try {
        await packageService.saveDataflow(flow);
        setDataflows(prev => {
          const idx = prev.findIndex(f => f.config.name === flow.config.name);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = flow;
            return copy;
          }
          return [...prev, flow];
        });
        if (activeDataflow?.config.name === flow.config.name) {
            setActiveDataflow(flow);
        }
    } catch (e) {
        console.error("Failed to save dataflow to backend:", e);
        addNotification({ message: "Failed to save dataflow", type: 'error' });
    }
  }, [activeDataflow, addNotification]);

  const reorderDataflows = useCallback((flows: Dataflow[]) => {
      setDataflows(flows);
  }, []);

  const loadDataflow = useCallback((flow: Dataflow) => {
      setActiveDataflow(flow);
  }, []);

  const deleteDataflow = useCallback(async (name: string) => {
    try {
        await packageService.deleteDataflow(name);
        setDataflows(prev => prev.filter(f => f.config.name !== name));
        if (activeDataflow?.config.name === name) setActiveDataflow(null);
    } catch (e) {
        console.error("Failed to delete dataflow from backend:", e);
        addNotification({ message: "Failed to delete dataflow", type: 'error' });
    }
  }, [activeDataflow, addNotification]);

  const updateAgentStatus = useCallback((agentId: string, status: AgentStatus) => {
    setAgentsRaw(prev => prev.map(a => a.id === agentId ? { ...a, status } : a));
  }, []);

  const setAgentState = useCallback(async (agentId: string, state: 'RUNNING' | 'STOPPED'): Promise<boolean> => {
    try {
        const json = await sendAgentCommand(agentId, '/set_status', 'POST', { state });
        if (json.status === 'success') {
            setAgentsRaw(prev => prev.map(a => a.id === agentId ? { ...a, status: state === 'RUNNING' ? AgentStatus.RUNNING : AgentStatus.ONLINE } : a));
            return true;
        } else {
            throw new Error(json.message);
        }
    } catch (e) {
        console.error("Set Agent State Error:", e);
        throw e;
    }
  }, [sendAgentCommand]);

  
  const clearAgentMetrics = useCallback((agentId: string) => {
    const clearTime = Date.now();
    
    // Record the clear timestamp
    setAgentClearTimestamps(prev => ({
      ...prev,
      [agentId]: clearTime
    }));
    
    setAgentsRaw(prev => prev.map(a => {
      if (a.id === agentId) {
        const resetAgent = {
          ...a,
          nodeMetrics: {},
          pipeMetrics: {},
          pipeMetricsHistory: {},
        };
        realtimeAgentsRef.current.set(agentId, resetAgent);
        return resetAgent;
      }
      return a;
    }));
  }, []);

  return (
    <SystemContext.Provider value={{
      agents,
      dataflows,
      activeDataflow,
      packages,
      localCapabilities, 
      theme,
      toggleTheme,
      addOrUpdateAgent,
      removeAgent,
      saveDataflow,
      reorderDataflows,
      loadDataflow,
      deleteDataflow,
      updateAgentStatus,
      sendAgentCommand,
      deployDataflowToAgent,
      deployParameterToAgent,
      setAgentState,
      getAgentDataflow,
      parameters,
      activeParameter,
      saveParameter,
      reorderParameters,
      loadParameter,
      deleteParameter,
      agentActiveFlows,
      isSidebarCollapsed,
      toggleSidebar,
      setSidebarCollapsed: setIsSidebarCollapsed,
      editorSelectedAgentId,
      setEditorSelectedAgentId,
      clearAgentMetrics,
      notifications,
      addNotification,
      removeNotification,
      clearNotifications,
      markNotificationsRead,
      hasUnreadError,
      compilationState,
      startCompileAll,
      startCompileBatch, 
      startCompilePackage,
      updateCompilationState,
      isCompilingGlobal,
      compilationProgress, 
      subscribeToMetrics, 
      getAgentRealtime,
      agentClearTimestamps,
      getAgentClearTimestamp
    }}>
      {children}
    </SystemContext.Provider>
  );
};

export const useSystem = () => {
  const context = useContext(SystemContext);
  if (context === undefined) {
    throw new Error('useSystem must be used within a SystemProvider');
  }
  return context;
};

export const useAgentMetrics = (agentId: string | undefined) => {
    const { getAgentRealtime, subscribeToMetrics } = useSystem();
    const [agent, setAgent] = useState(() => agentId ? getAgentRealtime(agentId) : undefined);

    useEffect(() => {
        if (!agentId) return;

        setAgent(getAgentRealtime(agentId));

        const unsubscribe = subscribeToMetrics(() => {
             setAgent(getAgentRealtime(agentId));
        });

        return unsubscribe;
    }, [agentId, getAgentRealtime, subscribeToMetrics]);

    return agent;
};
