
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  addEdge, 
  Connection, 
  Edge, 
  Node,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';

import { useSystem, useAgentMetrics } from '../context/SystemContext';
import { CustomNode } from '../components/CustomNode';
import { CustomEdge } from '../components/CustomEdge';
import { AgentStatus, Dataflow, AgentCapabilities, Capability, Agent } from '../types';
import { INITIAL_CAPABILITIES } from '../services/mockData';
import { packageService } from '../services/packageService';
import { Loader2 } from 'lucide-react';
import { useNavigate, useBeforeUnload, useParams } from 'react-router-dom';
import { dataflowToReactFlow, reactFlowToDataflow, normalizeDataflow, getMatchScore, generatePythonLaunch } from '../utils/dataflowUtils';
import { getLayoutedElements } from '../utils/elkLayout';

// Sub-components
import { EditorSidebar } from '../components/editor/EditorSidebar';
import { EditorToolbar } from '../components/editor/EditorToolbar';
import { EditorSearch } from '../components/editor/EditorSearch';
import { PerformanceOverlay } from '../components/editor/PerformanceOverlay';
import { EdgeContextMenu } from '../components/editor/EdgeContextMenu';
import { ViewportOverlay } from '../components/editor/ViewportOverlay';

// Hooks
import { useEditorHistory } from '../hooks/useEditorHistory';
import { useEditorShortcuts } from '../hooks/useEditorShortcuts';

const nodeTypes = {
  custom: CustomNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

export const DataflowEditor: React.FC<{ 
  initialAgentId?: string, 
  hideSidebar?: boolean,
  agent?: Agent,
  readOnly?: boolean
}> = ({ initialAgentId, hideSidebar = false, agent: propsAgent, readOnly = false }) => {
  const { 
    agents, 
    dataflows,
    activeDataflow, 
    loadDataflow,
    saveDataflow, 
    deployDataflowToAgent, 
    setAgentState, 
    theme, 
    setSidebarCollapsed,
    editorSelectedAgentId,
    setEditorSelectedAgentId,
    clearAgentMetrics,
    addNotification,
    localCapabilities,
    getAgentClearTimestamp,
    compilationState,
    updateCompilationState
  } = useSystem();
  
  const navigate = useNavigate();
  const { name: urlParamNameEncoded } = useParams<{ name?: string }>();
  const urlParamName = urlParamNameEncoded ? decodeURIComponent(urlParamNameEncoded) : undefined;
  const { screenToFlowPosition, getNode, fitView, getNodes, getEdges } = useReactFlow();

  // 根据 URL 参数加载对应的 Dataflow
  useEffect(() => {
    if (urlParamName && dataflows.length > 0) {
      const activeName = activeDataflow?.config?.name || (activeDataflow as any)?.name;
      if (!activeDataflow || activeName !== urlParamName) {
        const targetFlow = dataflows.find(f => (f.config?.name || (f as any).name) === urlParamName);
        if (targetFlow) {
          loadDataflow(targetFlow);
        }
      }
    }
  }, [urlParamName, dataflows, activeDataflow, loadDataflow]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [config, setConfig] = useState({ name: '', description: '' });
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [sidebarKey, setSidebarKey] = useState(0);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  useEffect(() => {
      if (initialAgentId) {
          setEditorSelectedAgentId(initialAgentId);
      } else if (!editorSelectedAgentId && agents.length > 0) {
          setEditorSelectedAgentId(agents[0].id);
      }
  }, [agents, editorSelectedAgentId, setEditorSelectedAgentId, initialAgentId]);

  const hookRealtimeAgent = useAgentMetrics(editorSelectedAgentId);
  const realtimeAgent = propsAgent || hookRealtimeAgent;
  const effectiveAgentId = realtimeAgent?.id || editorSelectedAgentId;

  useEffect(() => {
      setSidebarCollapsed(true);
  }, [setSidebarCollapsed]);

  const [isDirty, setIsDirty] = useState(false);
  const [originalDataflow, setOriginalDataflow] = useState<Dataflow | null>(null);
  const [autoSavedDataflow, setAutoSavedDataflow] = useState<Dataflow | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFlowPosition, setSearchFlowPosition] = useState({ x: 0, y: 0 });
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const searchRef = useRef<HTMLDivElement>(null);

  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    edgeId: string | null;
  }>({ visible: false, x: 0, y: 0, edgeId: null });

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
      addNotification({ message, type });
  }, [addNotification]);

  // --- Core Node Handlers ---
  const handleParameterChange = useCallback((nodeId: string, key: string, value: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const currentParams = (node.data.currentParameterValues as any) || {};
          return {
            ...node,
            data: {
              ...node.data,
              currentParameterValues: { ...currentParams, [key]: value },
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const handleClientChange = useCallback((nodeId: string, serviceName: string, topic: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const clients = (node.data.clients as any[]) || [];
          const newClients = clients.map(c => 
              c.name === serviceName ? { ...c, topic } : c
          );
          return {
            ...node,
            data: {
              ...node.data,
              clients: newClients,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const handleServerChange = useCallback((nodeId: string, serviceName: string, topic: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const servers = (node.data.servers as any[]) || [];
          const newServers = servers.map(s => 
              s.name === serviceName ? { ...s, topic } : s
          );
          return {
            ...node,
            data: {
              ...node.data,
              servers: newServers,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const handleActorChange = useCallback((nodeId: string, actionName: string, topic: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const actors = (node.data.actors as any[]) || [];
          const newActors = actors.map(a => 
              a.name === actionName ? { ...a, topic } : a
          );
          return {
            ...node,
            data: {
              ...node.data,
              actors: newActors,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const handleCommanderChange = useCallback((nodeId: string, actionName: string, topic: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const commanders = (node.data.commanders as any[]) || [];
          const newCommanders = commanders.map(c => 
              c.name === actionName ? { ...c, topic } : c
          );
          return {
            ...node,
            data: {
              ...node.data,
              commanders: newCommanders,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const handleIdChange = useCallback((nodeId: string, newId: string) => {
      setNodes((nds) => 
        nds.map((node) => {
            if (node.id === nodeId) {
                return {
                    ...node,
                    data: { ...node.data, user_id: newId }
                };
            }
            return node;
        })
      );
  }, [setNodes]);

  const handleCollapseChange = useCallback((nodeId: string, collapsed: boolean) => {
      setNodes((nds) => 
        nds.map((node) => {
            if (node.id === nodeId) {
                return {
                    ...node,
                    data: { ...node.data, collapsed }
                };
            }
            return node;
        })
      );
  }, [setNodes]);

  const handleClearAgentState = useCallback(() => {
    if (!editorSelectedAgentId) return;
    
    clearAgentMetrics(editorSelectedAgentId);
    
    setNodes(nds => nds.map(node => ({
        ...node,
        data: { 
            ...node.data, 
            logs: [], 
            metrics: null 
        }
    })));
    
    setEdges(eds => eds.map(edge => ({
        ...edge,
        data: { 
            ...edge.data, 
            fps: undefined, 
            delay: undefined 
        }
    })));

    showToast('Agent metrics and logs cleared', 'info');
}, [editorSelectedAgentId, clearAgentMetrics, setNodes, setEdges, showToast]);


  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault(); 
    
    const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    
    setEdgeContextMenu({
      visible: true,
      x: flowPos.x,
      y: flowPos.y,
      edgeId: edge.id,
    });
  }, [screenToFlowPosition]);

  const handleEdgeUpdate = useCallback((data: any) => {
    if (!edgeContextMenu.edgeId) return;
    
    // Get the current edge before updating
    const currentEdge = getEdges().find(e => e.id === edgeContextMenu.edgeId);
    if (!currentEdge) return;
    
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === edgeContextMenu.edgeId) {
          return { ...edge, data: { ...edge.data, ...data } };
        }
        return edge;
      })
    );
    
    // Also update target node's input schedule
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === currentEdge.target) {
          const nodeInputs = node.data.inputs as any[] || [];
          if (currentEdge.targetHandle) {
            const targetInputIndex = nodeInputs.findIndex((input: any) => 
              input.name === currentEdge.targetHandle
            );
            
            if (targetInputIndex !== -1) {
              const priority = data.priority || currentEdge.data.priority || 'Medium';
              const queue = data.queue || currentEdge.data.queue || 'FCFS';
              const updatedInputs = [...nodeInputs];
              updatedInputs[targetInputIndex] = {
                ...updatedInputs[targetInputIndex],
                schedule: `PRIORITY:${priority};QUEUE:${queue}`
              };
              
              return {
                ...node,
                data: {
                  ...node.data,
                  inputs: updatedInputs
                }
              };
            }
          }
        }
        return node;
      })
    );
  }, [setEdges, setNodes, edgeContextMenu.edgeId, getEdges]);

  const handleEdgeDelete = useCallback(() => {
    if (!edgeContextMenu.edgeId) return;
    setEdges((eds) => eds.filter((e) => e.id !== edgeContextMenu.edgeId));
    setEdgeContextMenu({ visible: false, x: 0, y: 0, edgeId: null });
  }, [setEdges, edgeContextMenu.edgeId]);

  const handleViewPerformance = useCallback(() => {
      if (!edgeContextMenu.edgeId) return;
      const edge = getEdges().find(e => e.id === edgeContextMenu.edgeId);
      if (!edge) return;

      const sourceNode = getNode(edge.source);
      const targetNode = getNode(edge.target);
      const sourceId = sourceNode?.data.user_id || edge.source;
      const targetId = targetNode?.data.user_id || edge.target;
      const pipeKey = `${sourceId}/${edge.sourceHandle}->${targetId}/${edge.targetHandle}`;
      
      if (editorSelectedAgentId) {
          navigate(`/performance?agentId=${editorSelectedAgentId}&pipeId=${encodeURIComponent(pipeKey)}`);
          setEdgeContextMenu({ visible: false, x: 0, y: 0, edgeId: null });
      } else {
        showToast('No agent selected to view performance', 'error');
      }
  }, [editorSelectedAgentId, getNode, navigate, edgeContextMenu.edgeId, getEdges, showToast]);

  const onPaneClick = useCallback(() => {
    if (edgeContextMenu.visible) setEdgeContextMenu({ visible: false, x: 0, y: 0, edgeId: null });
    // Reset highlight
    if (highlightedNodeId) setHighlightedNodeId(null);
  }, [edgeContextMenu.visible, highlightedNodeId]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
      setHighlightedNodeId(node.id);
  }, []);

  // --- Highlighting Logic ---
  useEffect(() => {
      if (!highlightedNodeId) {
          // Reset: Clear highlighted ports
          setNodes(nds => nds.map(n => {
              if (n.data.highlightedPorts) {
                  return { ...n, data: { ...n.data, highlightedPorts: undefined } };
              }
              return n;
          }));
          return;
      }

      // 1. Identify Connected Edges
      const connectedEdges = edges.filter(
          e => e.source === highlightedNodeId || e.target === highlightedNodeId
      );

      // 2. Identify Active Ports
      const nodeActivePorts = new Map<string, Set<string>>(); // NodeID -> Set<PortName>

      const addPort = (nodeId: string, handle: string | null | undefined) => {
          if (!handle) return;
          if (!nodeActivePorts.has(nodeId)) nodeActivePorts.set(nodeId, new Set());
          nodeActivePorts.get(nodeId)!.add(handle);
      };

      connectedEdges.forEach(e => {
          if (e.source === highlightedNodeId) {
              addPort(highlightedNodeId, e.sourceHandle);
              addPort(e.target, e.targetHandle);
          } else {
              addPort(highlightedNodeId, e.targetHandle);
              addPort(e.source, e.sourceHandle);
          }
      });

      // 3. Update Nodes with highlighted ports only
      setNodes(nds => nds.map(n => {
          const activePortsSet = nodeActivePorts.get(n.id);
          const highlightedPorts = activePortsSet ? Array.from(activePortsSet) : undefined;

          // Only update if state actually changed
          if (JSON.stringify(n.data.highlightedPorts) !== JSON.stringify(highlightedPorts)) {
              return { 
                  ...n, 
                  data: { 
                      ...n.data, 
                      highlightedPorts
                  } 
              };
          }
          return n;
      }));

  }, [highlightedNodeId, edges.length]); // Depend on edge count to re-calc if connections change, setNodes is stable

  // --- History Hook ---
  const { undo, redo, resetHistory } = useEditorHistory(nodes, edges, setNodes, setEdges, showToast);

  // --- Persistence Handlers ---
  const handleSave = useCallback(() => {
      // Save current state (either auto-saved version or current nodes/edges)
      const flow = autoSavedDataflow || reactFlowToDataflow(getNodes(), getEdges(), config);
      saveDataflow(flow);
      // Update originalDataflow to the newly saved version
      setOriginalDataflow(flow);
      setAutoSavedDataflow(null); // Clear auto-save after explicit save
      setIsDirty(false);
      // Clear working copy from localStorage since we've saved
      const workingKey = `dataflow_working_${config.name}`;
      localStorage.removeItem(workingKey);
      showToast('Dataflow saved.', 'success');
  }, [getNodes, getEdges, config, saveDataflow, showToast, autoSavedDataflow]);

  // --- Shortcuts Hook ---
  useEditorShortcuts({
    showSearch, setShowSearch,
    setSearchQuery,
    mousePositionRef, // Pass ref instead of state
    // Wrapper to set flow position from mouse position
    setSearchPosition: (pos) => setSearchFlowPosition(screenToFlowPosition(pos)),
    getNodes, setNodes,
    screenToFlowPosition,
    handleSave, undo, redo, showToast,
    handleExternChange: handleParameterChange, 
    handleIdChange, handleCollapseChange
  });

  // --- Mouse Position Tracking ---
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          mousePositionRef.current = { x: e.clientX, y: e.clientY }; // Update ref, not state
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // --- Derived State: Agent & Capabilities ---
  
  // 1. Structural Agent (Stable reference, stale lastSeen) - Used for capabilities to prevent re-calc on every metric update
  const structuralAgent = useMemo(() => 
    agents.find(a => a.id === editorSelectedAgentId), 
  [agents, editorSelectedAgentId]);

  // 2. Display Agent (Volatile reference, fresh lastSeen) - Used for Toolbar/Status/PerformanceOverlay
  // If realtimeAgent exists (hook loaded), use it. Otherwise fallback to structural.
  const displayAgent = realtimeAgent || structuralAgent;

  // 3. Merged Capabilities (Local + Agent)
  const allCapabilities = useMemo<AgentCapabilities>(() => {
     // Start with initial caps
     const caps: AgentCapabilities = { ...(INITIAL_CAPABILITIES as AgentCapabilities) };
     
     // Merge local capabilities (baseline)
     Object.values(localCapabilities).forEach(pkgCaps => {
         pkgCaps.forEach(c => {
             if (c.name) caps[c.name] = c;
         });
     });

     // Merge selected agent capabilities (overrides local, but preserve actors/commanders if missing)
     if (structuralAgent) {
         Object.entries(structuralAgent.capabilities).forEach(([name, agentCap]) => {
             const localCap = caps[name];
             
             // If agent capability is missing actors/commanders but local has them, preserve local
             if (localCap) {
                 caps[name] = {
                     ...agentCap,
                     actors: (agentCap as any).actors?.length > 0 ? (agentCap as any).actors : (localCap.actors || []),
                     commanders: (agentCap as any).commanders?.length > 0 ? (agentCap as any).commanders : (localCap.commanders || [])
                 };
             } else {
                 caps[name] = agentCap;
             }
         });
     }
     
     return caps;
  }, [structuralAgent, localCapabilities]);

  // Reset pending status when agent changes
  useEffect(() => setPendingStatus(null), [editorSelectedAgentId]);

  // Refresh sidebar when capabilities change to ensure all nodes are visible
  useEffect(() => {
    setSidebarKey(prev => prev + 1);
  }, [localCapabilities]);

  
  // Update unsupported nodes AND re-hydrate capabilities if missing (fixes load race condition)
  useEffect(() => {
    // If no capabilities loaded yet, don't mark as unsupported abruptly
    // But we have localCapabilities now, so we can check.
    
    setNodes((nds) => nds.map((node) => {
      const funcName = node.data.label as string;
      const nodeData = node.data as any;

      // 1. Find the Best Matching Capability
      const variants = (Object.values(allCapabilities) as Capability[]).filter((c) => c.name === funcName);
      
      let matchedCap: Capability | undefined;
      let isUnsupported = false;

      if (variants.length === 0) {
          isUnsupported = true;
      } else {
          // Try to find exact match by version/source if specified in node
          if (nodeData.source && nodeData.version) {
              matchedCap = variants.find((v: any) => 
                  v.source === nodeData.source && 
                  v.version === nodeData.version && 
                  v.package_name === nodeData.package_name
              );
          }
          // Fallback to default
          if (!matchedCap) {
              matchedCap = variants.find((v: any) => v.version === 'default') || variants[0];
          }
          isUnsupported = false;
      }

      // 2. Determine if we need an update
      let needsUpdate = false;
      const newData = { ...nodeData };

      // Update Unsupported State
      if (nodeData.isUnsupported !== isUnsupported) {
          newData.isUnsupported = isUnsupported;
          needsUpdate = true;
      }

      // Re-hydrate Capabilities (Inputs/Outputs/Params) if they are empty but we found a match
      // This happens when the Editor loads before Agents/Capabilities are fetched.
      if (matchedCap && !isUnsupported) {
          const inputsEmpty = !nodeData.inputs || nodeData.inputs.length === 0;
          const outputsEmpty = !nodeData.outputs || nodeData.outputs.length === 0;
          const capInputs = matchedCap.inputs || [];
          const capOutputs = matchedCap.outputs || [];

          // Check if we need to hydrate (empty on node but exists on capability)
          if ((inputsEmpty && capInputs.length > 0) || (outputsEmpty && capOutputs.length > 0)) {
               newData.inputs = capInputs;
               newData.outputs = capOutputs;
               newData.parameterDefs = matchedCap.parameters || [];
               newData.clients = matchedCap.clients || [];
               newData.servers = matchedCap.servers || [];
               newData.actors = matchedCap.actors || [];
               newData.commanders = matchedCap.commanders || [];
               
               // Also sync version info if it was missing/defaulted
               if (!newData.source) {
                   newData.source = matchedCap.source;
                   newData.version = matchedCap.version;
                   newData.package_name = matchedCap.package_name;
               }
               needsUpdate = true;
          }
      }

      if (needsUpdate) {
          return { ...node, data: newData };
      }
      return node;
    }));
  }, [allCapabilities]); // Remove setNodes from dependencies - it's stable

  // Check pending status resolution
  useEffect(() => {
      // Use realtime agent data for status checks to be responsive
      if (realtimeAgent && pendingStatus) {
          if (realtimeAgent.status === pendingStatus) {
              setPendingStatus(null);
          } else if (pendingStatus === 'STOPPED' && realtimeAgent.status === AgentStatus.ONLINE) {
              // Fix: Agent status usually returns to ONLINE (idle) when stopped, 
              // accept this as a successful stop resolution.
              setPendingStatus(null);
          } else if (realtimeAgent.status === AgentStatus.OFFLINE) {
              setPendingStatus(null);
              showToast('Agent went offline', 'error');
          }
      }
  }, [realtimeAgent, pendingStatus, showToast]);

    // Derived: Capabilities grouped by name (for multi-version support)
  const capabilitiesByName = useMemo(() => {
      const map = new Map<string, Capability[]>();
      (Object.values(allCapabilities) as Capability[]).forEach((cap) => {
          const c = cap;
          const name = c.name || "Unknown";
          if (!map.has(name)) map.set(name, []);
          map.get(name)!.push(c);
      });
      return map;
  }, [allCapabilities]);

  // Group capabilities for Sidebar - Modified to pass raw grouped map for Sidebar to process hierarchically
  const groupedCapabilities = useMemo(() => {
      const grouped: Record<string, any[]> = {};
      
      Array.from(capabilitiesByName.keys()).forEach(name => {
          const variants = capabilitiesByName.get(name)!;
          // Pick default or first for display
          const primary = variants.find(v => v.version === 'default') || variants[0];
          
          const cat = primary.category || 'Uncategorized';
          if (!grouped[cat]) grouped[cat] = [];
          
          // Sidebar expects name to be the generic name
          grouped[cat].push({ name, ...primary });
      });

      // Sorting of leaf items
      Object.values(grouped).forEach(group => group.sort((a, b) => a.name.localeCompare(b.name)));
      return grouped;
  }, [capabilitiesByName]);

  // Search Results
  const searchResults = useMemo(() => {
      if (!searchQuery) return [];
      const results: any[] = [];
      
      Array.from(capabilitiesByName.keys()).forEach((name: string) => {
          const variants = capabilitiesByName.get(name)!;
          const primary = variants.find(v => v.version === 'default') || variants[0];

          const nameScore = getMatchScore(searchQuery, name);
          if (nameScore > 0) results.push({ name, ...primary, score: nameScore });
          else if (primary.description) {
              const descScore = getMatchScore(searchQuery, primary.description);
              if (descScore > 0) results.push({ name, ...primary, score: descScore / 2 });
          }
      });

      results.sort((a, b) => b.score - a.score);
      return results.slice(0, 10); 
  }, [capabilitiesByName, searchQuery]);

  // --- Core Node Handlers ---
  const handleVersionChange = useCallback((nodeId: string, newSource: string, newVersion: string, newPkg: string) => {
        setNodes((nds) => nds.map(node => {
            if (node.id === nodeId) {
                // Find the new capability definition
                const label = node.data.label as string;
                const variants = capabilitiesByName.get(label);
                const newCap = variants?.find(v => v.source === newSource && v.version === newVersion && v.package_name === newPkg);
                
                if (newCap) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            source: newSource,
                            version: newVersion,
                            package_name: newPkg,
                            inputs: newCap.inputs || [],
                            outputs: newCap.outputs || [],
                            parameterDefs: newCap.parameters || [],
                            clients: newCap.clients || [],
                            servers: newCap.servers || [],
                            actors: newCap.actors || [],
                            commanders: newCap.commanders || [],
                            // Note: We keep currentParameterValues, but some might be orphaned if not present in new definition
                        }
                    };
                }
            }
            return node;
        }));
  }, [capabilitiesByName, setNodes]);

  // --- Graph Manipulation Actions ---
  const addNode = useCallback((nodeName: string, positionOrFlowPos: { x: number, y: number }) => {
      const variants = capabilitiesByName.get(nodeName);
      if (!variants || variants.length === 0) {
          showToast(`Capability ${nodeName} not found`, 'error');
          return;
      }
      
      const cap = variants.find(v => v.version === 'default') || variants[0];
      const uniqueId = `${nodeName}_${Date.now().toString().slice(-4)}`;
      // Initialize default values for parameters
      const initialParams: Record<string, any> = {};
      if (cap && cap.parameters) {
          cap.parameters.forEach(p => {
              if (p.default_value !== undefined && p.default_value !== "") {
                  // Attempt to parse number types, keep strings as is
                  if (p.type === 'int' || p.type === 'double' || p.type === 'float') {
                      const num = parseFloat(p.default_value);
                      if (!isNaN(num)) {
                          initialParams[p.name] = num;
                      } else {
                          initialParams[p.name] = p.default_value;
                      }
                  } else {
                      initialParams[p.name] = p.default_value;
                  }
              }
          });
      }

      // Assume input is Flow Coordinates because we control the calls.
      const flowPos = positionOrFlowPos;
      
      const newNode: Node = {
        id: uniqueId, type: 'custom', position: flowPos,
        data: { 
            id: uniqueId, user_id: uniqueId, label: nodeName,
            inputs: cap.inputs || [], outputs: cap.outputs || [], 
            parameterDefs: cap.parameters || [],
            clients: cap.clients || [],
            servers: cap.servers || [],
            actors: cap.actors || [],
            commanders: cap.commanders || [],
            currentParameterValues: initialParams,
            onParameterChange: handleParameterChange, 
            onClientChange: handleClientChange,
            onServerChange: handleServerChange,
            onActorChange: handleActorChange,
            onCommanderChange: handleCommanderChange,
            onIdChange: handleIdChange,
            onCollapseChange: handleCollapseChange, 
            collapsed: false, // 用户手动添加的节点默认展开，方便编辑
            isUnsupported: false,
            onVersionChange: handleVersionChange,
            source: cap.source, 
            version: cap.version,
            package_name: cap.package_name,
            agentId: editorSelectedAgentId
        },
      };
      setNodes((nds) => nds.concat(newNode));
      setShowSearch(false);
      setSearchQuery('');
  }, [capabilitiesByName, handleParameterChange, handleClientChange, handleServerChange, handleActorChange, handleCommanderChange, handleIdChange, handleCollapseChange, handleVersionChange, setNodes, editorSelectedAgentId]);
  
  // --- Revert Handler (must be after handleVersionChange) ---
  const handleRevert = useCallback(() => {
      if (!originalDataflow) return;
      
      // Revert to original version
      const rfData = dataflowToReactFlow(originalDataflow, allCapabilities);
      const hydratedNodes = rfData.nodes.map(n => {
          const data = n.data as any;
          const parameterCount = data.parameterDefs?.length || 0;
          const shouldCollapse = parameterCount > 2;
          
          return {
            ...n,
            data: { 
              ...data, 
              collapsed: data.collapsed !== undefined ? data.collapsed : shouldCollapse,
              onParameterChange: handleParameterChange, 
              onClientChange: handleClientChange,
              onServerChange: handleServerChange,
              onActorChange: handleActorChange,
              onCommanderChange: handleCommanderChange,
              onIdChange: handleIdChange, 
              onCollapseChange: handleCollapseChange,
              onVersionChange: handleVersionChange,
              agentId: editorSelectedAgentId
            }
          };
      });
      setNodes(hydratedNodes);
      setEdges(rfData.edges);
      setConfig(originalDataflow.config || { name: (originalDataflow as any).name || 'untitled', description: (originalDataflow as any).description || '' });
      setAutoSavedDataflow(null); // Clear auto-save
      setIsDirty(false);
      // Clear working copy from localStorage
      const flowName = originalDataflow.config?.name || (originalDataflow as any).name || 'untitled';
      const workingKey = `dataflow_working_${flowName}`;
      localStorage.removeItem(workingKey);
      resetHistory(hydratedNodes, rfData.edges);
      showToast('Reverted to saved version.', 'info');
  }, [originalDataflow, allCapabilities, handleParameterChange, handleClientChange, handleServerChange, 
      handleActorChange, handleCommanderChange, handleIdChange, handleCollapseChange, handleVersionChange, 
      editorSelectedAgentId, setNodes, setEdges, resetHistory, showToast]);

  const onConnect = useCallback((params: Connection) => {
      if (readOnly) return;
      const sourceNode = getNode(params.source);
      const targetNode = getNode(params.target);
      if (!sourceNode || !targetNode) return;

      const sourceOutput = (sourceNode.data.outputs as any[])?.find(o => (o.name || o.description) === params.sourceHandle);
      const targetInput = (targetNode.data.inputs as any[])?.find(i => (i.name || i.description) === params.targetHandle);

      if (sourceOutput && targetInput) {
        if (sourceOutput.type === targetInput.type || sourceOutput.type.includes('tuple')) {
          const edgeData = { queue: 'FCFS', priority: 'Medium' };
          
          setEdges((eds) => addEdge({ 
              ...params, 
              animated: true, 
              type: 'custom', 
              data: edgeData
          }, eds));
          
          // Also update target node input with schedule information
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === params.target) {
                const updatedInputs = [...(node.data.inputs || [])];
                const targetInputIndex = updatedInputs.findIndex((input: any) => 
                  (input.name || input.description) === params.targetHandle
                );
                
                if (targetInputIndex !== -1) {
                  updatedInputs[targetInputIndex] = {
                    ...updatedInputs[targetInputIndex],
                    schedule: `PRIORITY:${edgeData.priority};QUEUE:${edgeData.queue}`
                  };
                }
                
                return {
                  ...node,
                  data: {
                    ...node.data,
                    inputs: updatedInputs
                  }
                };
              }
              return node;
            })
          );
        } else {
          showToast(`Type Mismatch: ${sourceOutput.type} vs ${targetInput.type}`, 'error');
        }
      }
    }, [setEdges, setNodes, getNode, showToast]);

  const onNodesDelete = useCallback((deleted: Node[]) => {
      if (readOnly) return;
      setEdges((eds) => eds.filter((edge) => !deleted.some((node) => node.id === edge.source || node.id === edge.target)));
      // If highlighted node is deleted, clear highlight
      if (deleted.some(n => n.id === highlightedNodeId)) {
          setHighlightedNodeId(null);
      }
    }, [setEdges, highlightedNodeId]);

  // --- Navigation Blocking & Dirty Check ---
  useBeforeUnload(useCallback((e) => { if (isDirty) { e.preventDefault(); e.returnValue = ''; } }, [isDirty]));

  // Auto-save logic: save current state immediately when changes are detected
  useEffect(() => {
    if (!originalDataflow || readOnly) return;
    
    const currentFlow = reactFlowToDataflow(nodes, edges, config);
    const originalJson = normalizeDataflow(originalDataflow);
    const currentJson = normalizeDataflow(currentFlow);
    const hasChanges = originalJson !== currentJson;
    
    setIsDirty(hasChanges);
    
    // Save immediately when there are changes
    if (hasChanges) {
      // Save to autoSavedDataflow state
      setAutoSavedDataflow(currentFlow);
      // Also save to localStorage as working copy (separate from saved version)
      const workingKey = `dataflow_working_${config.name}`;
      localStorage.setItem(workingKey, JSON.stringify(currentFlow));
    } else {
      // No changes, clear auto-save
      setAutoSavedDataflow(null);
      // Also clear working copy from localStorage
      const workingKey = `dataflow_working_${config.name}`;
      localStorage.removeItem(workingKey);
    }
  }, [nodes, edges, config, originalDataflow]);

  // --- Data Loading ---
  useEffect(() => {
    if (activeDataflow) {
      // Normalize dataflow if config is missing (handle flat structure)
      const normalizedDataflow = {
        ...activeDataflow,
        config: activeDataflow.config || { 
          name: (activeDataflow as any).name || 'untitled', 
          description: (activeDataflow as any).description || '' 
        }
      };

      // Check if there's a working copy in localStorage (Skip if in readOnly mode)
      const workingKey = `dataflow_working_${normalizedDataflow.config.name}`;
      const workingCopy = !readOnly ? localStorage.getItem(workingKey) : null;
      
      let dataflowToLoad = normalizedDataflow;
      if (workingCopy) {
        try {
          const parsedWorking = JSON.parse(workingCopy);
          dataflowToLoad = {
            ...parsedWorking,
            config: parsedWorking.config || normalizedDataflow.config
          };
        } catch (e) {
          console.warn('[Editor] Failed to parse working copy, using saved version');
        }
      }
      
      setConfig(dataflowToLoad.config);
      const rfData = dataflowToReactFlow(dataflowToLoad, allCapabilities);
      let hydratedNodes = rfData.nodes.map(n => {
          const data = n.data as any;
          const parameterCount = data.parameterDefs?.length || 0;
          
          // 尊重数据中已有的折叠状态，仅在状态缺失时根据参数数量进行默认折叠
          const shouldCollapse = parameterCount > 2;
          
          return {
            ...n,
            data: { 
              ...data, 
              collapsed: data.collapsed !== undefined ? data.collapsed : shouldCollapse,
              onParameterChange: handleParameterChange, 
              onClientChange: handleClientChange,
              onServerChange: handleServerChange,
              onActorChange: handleActorChange,
              onCommanderChange: handleCommanderChange,
              onIdChange: handleIdChange, 
              onCollapseChange: handleCollapseChange,
              onVersionChange: handleVersionChange,
              agentId: editorSelectedAgentId
            }
          };
      });

      // 自动布局检查：如果所有节点都在 (0,0) 或位置缺失，则调用自动排布
      const needsLayout = hydratedNodes.length > 0 && hydratedNodes.every(n => n.position.x === 0 && n.position.y === 0);
      if (needsLayout) {
          getLayoutedElements(hydratedNodes, rfData.edges).then(layoutedNodes => {
              setNodes(layoutedNodes);
              resetHistory(layoutedNodes, rfData.edges);
              setTimeout(() => fitView({ padding: 0.2, duration: 0 }), 100);
          });
      } else {
          setNodes(hydratedNodes);
          resetHistory(hydratedNodes, rfData.edges);
          setTimeout(() => fitView({ padding: 0.2, duration: 0 }), 100);
      }

      setEdges(rfData.edges);
      // originalDataflow is always the saved version (not working copy)
      // Ensure originalDataflow has the same normalized config as dataflowToLoad
      setOriginalDataflow(normalizedDataflow);
      setHighlightedNodeId(null); // Reset selection on load
      
      // Check compilation status for all packages in the dataflow
      const packageIds = new Set<string>();
      hydratedNodes.forEach(node => {
        const nodeData = node.data as any;
        const packageId = nodeData.package_name && nodeData.source 
          ? `${nodeData.source}/${nodeData.package_name}` 
          : null;
        if (packageId) {
          packageIds.add(packageId);
        }
      });
      
      // Load compilation logs for each package to check for errors
      packageIds.forEach(async (packageId) => {
        // Skip if we already have compilation state for this package
        if (compilationState[packageId]) return;
        
        try {
          const logs = await packageService.getCompileLog(packageId);
          if (logs) {
            // Check if logs contain errors
            const hasErrors = logs.includes('[ERROR]') || logs.includes('error:') || logs.includes('Compilation Failed');
            const errorMatches = logs.match(/error:/gi);
            const errorCount = errorMatches ? errorMatches.length : 0;
            
            if (hasErrors || errorCount > 0) {
              // Set compilation state with error
              updateCompilationState(packageId, {
                status: 'error',
                logs: [logs],
                errorCount: errorCount,
                endTime: Date.now()
              });
            }
          }
        } catch (e) {
          // Ignore errors (package might not have been compiled yet)
        }
      });
    } else {
        // 如果 URL 中有名称，但 activeDataflow 还没加载（可能正在从 backend 获取 dataflows）
        // 则先不初始化为空，避免覆盖即将加载的数据
        if (urlParamName) return;

        const newConfig = { name: `Flow_${Date.now().toString().slice(-4)}`, description: '' };
        setConfig(newConfig);
        setNodes([]);
        setEdges([]);
        setOriginalDataflow({ config: newConfig, nodes: [] });
        resetHistory([], []);
        setHighlightedNodeId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDataflow, urlParamName, allCapabilities]); 

    // --- Telemetry Loop ---
    useEffect(() => {
        if (!realtimeAgent || !effectiveAgentId) {
            return;
        }

        // Get the clear timestamp for this agent
        const clearTimestamp = getAgentClearTimestamp(effectiveAgentId);
        const timeSinceLastClear = Date.now() - clearTimestamp;
        const recentlyClearedMetrics = timeSinceLastClear < 2000;

        if (recentlyClearedMetrics) {
            return;
        }

        const metricsMap = realtimeAgent.nodeMetrics || (realtimeAgent as any).node_metrics || {};
        const pipeMetricsMap = realtimeAgent.pipeMetrics || (realtimeAgent as any).pipe_metrics || {};

        const metricKeys = Object.keys(metricsMap);

        // 1. Update Nodes (Logs & Metrics)
        setNodes(nds => {
            if (!nds || nds.length === 0) {
                return nds;
            }
            
            let changed = false;
            const newNodes = nds.map(node => {
                const userId = node.data.user_id as string;
                const label = node.data.label as string;
                
                // --- ID Matching Strategy ---
                // 1. Exact match (Priority)
                let nodeMetric = metricsMap[userId] || metricsMap[node.id];
                
                // 2. Fuzzy match by prefix (Fallback for dynamic IDs)
                if (!nodeMetric) {
                    const fuzzyKey = metricKeys.find(key => 
                        key === label || 
                        key.startsWith(label + "_") || 
                        (userId.includes("_") && key.startsWith(userId.split("_")[0] + "_"))
                    );
                    if (fuzzyKey) {
                        nodeMetric = metricsMap[fuzzyKey];
                    }
                }
                
                if (nodeMetric) {
                    const incomingLogs = nodeMetric.logs || [];
                    const filteredLogs = incomingLogs.filter((log: any) => {
                        const logTime = log.timestamp * 1000;
                        return logTime > clearTimestamp;
                    });
                    const recentLogs = filteredLogs.slice(-20);
                    
                    // Update if metrics changed or logs content changed
                    const metricsChanged = JSON.stringify(node.data.metrics) !== JSON.stringify(nodeMetric.metrics);
                    
                    const oldLogs = node.data.logs || [];
                    const lastOldLog = oldLogs[oldLogs.length - 1];
                    const lastNewLog = recentLogs[recentLogs.length - 1];
                    const logsChanged = oldLogs.length !== recentLogs.length || 
                                       (lastOldLog?.timestamp !== lastNewLog?.timestamp) ||
                                       (lastOldLog?.message !== lastNewLog?.message);

                    if (metricsChanged || logsChanged) {
                        changed = true;
                        return { 
                            ...node, 
                            data: { 
                                ...node.data, 
                                metrics: nodeMetric.metrics || node.data.metrics, 
                                logs: recentLogs 
                            } 
                        };
                    }
                }
                return node;
            });
            return changed ? newNodes : nds;
        });

        // 2. Update Edges (Pipe Metrics)
        if (realtimeAgent.status === AgentStatus.RUNNING) {
            setEdges(eds => {
                if (!eds || eds.length === 0) return eds;
                
                let changed = false;
                const pipeKeys = Object.keys(pipeMetricsMap);

                const newEdges = eds.map(edge => {
                    const sourceId = edge.source;
                    const targetId = edge.target;
                    const sourceHandle = edge.sourceHandle;
                    const targetHandle = edge.targetHandle;

                    // 1. Exact match
                    const exactPipeKey = `${sourceId}/${sourceHandle}->${targetId}/${targetHandle}`;
                    let metric = pipeMetricsMap[exactPipeKey];

                    // 2. Fuzzy match (match prefixes of IDs)
                    if (!metric && pipeKeys.length > 0) {
                        const sourcePrefix = sourceId.includes('_') ? sourceId.split('_')[0] : sourceId;
                        const targetPrefix = targetId.includes('_') ? targetId.split('_')[0] : targetId;

                        const fuzzyPipeKey = pipeKeys.find(key => {
                            // Key format: "SrcID/SrcHandle->DstID/DstHandle"
                            const [srcPart, dstPart] = key.split('->');
                            if (!srcPart || !dstPart) return false;

                            const [srcIdInKey, srcHandleInKey] = srcPart.split('/');
                            const [dstIdInKey, dstHandleInKey] = dstPart.split('/');

                            const srcMatches = srcHandleInKey === sourceHandle && 
                                             (srcIdInKey === sourceId || srcIdInKey.startsWith(sourcePrefix + "_"));
                            const dstMatches = dstHandleInKey === targetHandle && 
                                             (dstIdInKey === targetId || dstIdInKey.startsWith(targetPrefix + "_"));

                            return srcMatches && dstMatches;
                        });

                        if (fuzzyPipeKey) {
                            metric = pipeMetricsMap[fuzzyPipeKey];
                        }
                    }
                    
                    if (metric) {
                        const delayVal = metric.sys_delay_ms !== undefined ? metric.sys_delay_ms : metric.avg_aoi_ms;
                        if (edge.data?.fps !== metric.fps || edge.data?.delay !== delayVal) {
                            changed = true;
                            return { ...edge, data: { ...edge.data, fps: metric.fps, delay: delayVal } };
                        }
                    }
                    return edge;
                });
                return changed ? newEdges : eds;
            });
        } else {
            setEdges(eds => {
                if (!eds || eds.length === 0) return eds;
                let changed = false;
                const newEdges = eds.map(edge => {
                    if (edge.data?.fps !== undefined || edge.data?.delay !== undefined) {
                        changed = true;
                        return { ...edge, data: { ...edge.data, fps: undefined, delay: undefined } };
                    }
                    return edge;
                });
                return changed ? newEdges : eds;
            });
        }
    }, [realtimeAgent, effectiveAgentId, getAgentClearTimestamp]); // Remove nodes, setNodes, setEdges - they're stable or accessed via functional updates

  // --- Compilation State Sync ---
  // Update nodes when compilation state changes
  useEffect(() => {
    // Batch update to avoid multiple renders
    const updates: { [nodeId: string]: { hasError: boolean; isCompiling: boolean } } = {};
    
    // First pass: collect all updates
    nodes.forEach(node => {
      const packageId = node.data.package_name && node.data.source 
        ? `${node.data.source}/${node.data.package_name}` 
        : null;
      
      if (packageId) {
        const state = compilationState[packageId];
        let hasError = false;
        let isCompiling = false;
        
        if (state) {
          hasError = state.status === 'error' || (state.errorCount && state.errorCount > 0);
          isCompiling = state.status === 'compiling';
        }
        
        // Only record if changed
        if (node.data.hasCompilationError !== hasError || node.data.isCompiling !== isCompiling) {
          updates[node.id] = { hasError, isCompiling };
        }
      }
    });
    
    // Second pass: apply updates if any
    if (Object.keys(updates).length > 0) {
      setNodes(nds => nds.map(node => {
        const update = updates[node.id];
        if (update) {
          return {
            ...node,
            data: {
              ...node.data,
              hasCompilationError: update.hasError,
              isCompiling: update.isCompiling
            }
          };
        }
        return node;
      }));
    }
  }, [compilationState]); // Remove setNodes from dependencies - it's stable

  const handleDownload = () => {
      const flow = reactFlowToDataflow(nodes, edges, config);
      const jsonString = JSON.stringify(flow, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${config.name || 'dataflow'}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

  const handleDownloadPython = () => {
      const flow = reactFlowToDataflow(nodes, edges, config);
      const pythonCode = generatePythonLaunch(flow);
      const blob = new Blob([pythonCode], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${config.name || 'launch'}.py`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

  const handleSetStatus = async (state: 'RUNNING' | 'STOPPED') => {
    // Check against displayAgent status/connection
    if (!displayAgent) return;
    setPendingStatus(state);
    try {
        const success = await setAgentState(displayAgent.id, state);
        if (!success) {
            setPendingStatus(null);
            showToast(`Failed to set agent status to ${state}`, 'error');
        }
    } catch (e: any) {
        setPendingStatus(null);
        showToast(`Error setting status: ${e.message}`, 'error');
    }
  };

  const handleDeploy = async () => {
      if(!displayAgent) return;
      
      // Get the latest flow (either auto-saved or current state)
      const flow = autoSavedDataflow || reactFlowToDataflow(nodes, edges, config);
      
      // Auto-save before deploying
      if (isDirty) {
          saveDataflow(flow);
          setOriginalDataflow(flow);
          setAutoSavedDataflow(null);
          setIsDirty(false);
          // Clear working copy from localStorage since we've saved
          const workingKey = `dataflow_working_${config.name}`;
          localStorage.removeItem(workingKey);
          showToast('Auto-saved before deployment.', 'info');
      }
      
      try {
          const success = await deployDataflowToAgent(displayAgent.id, flow);
          if (success) showToast('Deployed successfully!', 'success');
      } catch (e: any) {
          showToast(`Deploy failed: ${e.message}`, 'error');
      }
  };

  const handleCompileDataflow = async () => {
      // Logic handled via global compilation system in toolbar mostly
  };

  
  const onDragOver = useCallback((event: React.DragEvent) => { 
    if (readOnly) return;
    event.preventDefault(); 
    event.dataTransfer.dropEffect = 'move'; 
  }, [readOnly]);
  const onDrop = useCallback((event: React.DragEvent) => {
      if (readOnly) return;
      event.preventDefault();
      const funcName = event.dataTransfer.getData('application/reactflow');
      if (typeof funcName === 'undefined' || !funcName) return;
      addNode(funcName, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    }, [addNode, screenToFlowPosition, readOnly]);

  const onLayout = useCallback(async () => {
    // 优化排布清晰度：若参数 > 2，则默认折叠以减少视觉复杂度
    const nodesToLayout = nodes.map(node => {
      const data = node.data as any;
      let parameterCount = data.parameterDefs?.length || 0;
      
      if (parameterCount === 0 && allCapabilities) {
        const cap = allCapabilities[data.label];
        if (cap && cap.parameters) {
          parameterCount = cap.parameters.length;
        }
      }

      // 仅在执行自动排布动作时，对参数较多的节点进行折叠优化，以确保拓扑清晰
      // 注意：这里我们只在 layout 计算前临时改变状态，或者如果用户希望这就是 layout 的副作用
      if (parameterCount > 2) {
        return { ...node, data: { ...node.data, collapsed: true } };
      }
      return node;
    });

    const layoutedNodes = await getLayoutedElements(nodesToLayout, edges);
    setNodes(layoutedNodes);
    setTimeout(() => fitView({ duration: 800 }), 10);
  }, [nodes, edges, setNodes, fitView, allCapabilities]);

  // Click outside to close search
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (searchRef.current && !searchRef.current.contains(event.target as unknown as globalThis.Node)) {
              setShowSearch(false);
              setSearchQuery('');
          }
      };
      if (showSearch) document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSearch]);

  
  // Retrieve current edge data for the menu to ensure it displays active state
  const activeContextMenuEdge = useMemo(() => {
      if (!edgeContextMenu.edgeId) return null;
      return edges.find(e => e.id === edgeContextMenu.edgeId);
  }, [edges, edgeContextMenu.edgeId]);

  // Get current schedule from target node input
  const getCurrentSchedule = useCallback((edge: Edge) => {
      const targetNode = getNode(edge.target);
      if (!targetNode || !edge.targetHandle) return null;
      
      const targetInputs = targetNode.data.inputs as any[];
      if (!targetInputs || !Array.isArray(targetInputs)) return null;
      
      const targetInput = targetInputs.find((input: any) => input.name === edge.targetHandle);
      return targetInput?.schedule || null;
  }, [getNode]);

  return (
    <div className="flex h-full relative">
        {/* Sidebar */}
        {!hideSidebar && (
            <EditorSidebar 
              key={sidebarKey}
              config={config} setConfig={setConfig} isDirty={isDirty}
              agents={agents} 
              selectedAgentId={editorSelectedAgentId} 
              setSelectedAgentId={setEditorSelectedAgentId}
              groupedCapabilities={groupedCapabilities} 
              expandedCategories={expandedCategories}
              toggleCategory={(cat) => setExpandedCategories(p => ({...p, [cat]: !p[cat]}))}
              isSidebarCollapsed={false}
            />
        )}

        {/* Canvas Area */}
        <div className="flex-1 h-full relative" onDrop={onDrop} onDragOver={onDragOver}>
            <EditorToolbar 
              isSidebarCollapsed={false} toggleSidebar={() => {}}
              pendingStatus={pendingStatus} selectedAgent={displayAgent}
              handleSetStatus={handleSetStatus} onLayout={onLayout} 
              handleSave={handleSave} handleDownload={handleDownload} handleDeploy={handleDeploy} handleDownloadPython={handleDownloadPython}
              handleRevert={handleRevert}
              handleCompile={handleCompileDataflow}
              handleClearAgentState={handleClearAgentState}
              isDirty={isDirty} // Passed Prop
              readOnly={readOnly}
            />

            <PerformanceOverlay selectedAgent={displayAgent} />

            <ReactFlow
                nodes={nodes} edges={edges}
                onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                onConnect={onConnect} onNodesDelete={onNodesDelete}
                onEdgeContextMenu={onEdgeContextMenu}
                onPaneClick={onPaneClick}
                onNodeClick={onNodeClick} // Added Handler
                deleteKeyCode={['Backspace', 'Delete']}
                nodeTypes={nodeTypes} edgeTypes={edgeTypes}
                fitView
            >
                <Background variant={BackgroundVariant.Dots} color={theme === 'dark' ? "#334155" : "#cbd5e1"} gap={20} />
                <Controls className="!bg-white dark:!bg-slate-800 !border-slate-200 dark:!border-slate-700 [&>button]:!bg-white dark:[&>button]:!bg-slate-800 [&>button]:!border-slate-200 dark:[&>button]:!border-slate-700 [&>button]:text-slate-700 dark:[&>button]:text-slate-200 hover:[&>button]:!bg-slate-100 dark:hover:[&>button]:!bg-slate-700 [&>button]:!fill-slate-700 dark:[&>button]:!fill-slate-200" />
                <Panel position="bottom-right" className="bg-white/50 dark:bg-slate-900/50 p-2 rounded text-[10px] text-slate-500">
                    ID: {config.name || 'Untitled'}
                </Panel>
                
                {/* Viewport Overlay for Zoomable/Pannable Elements */}
                <ViewportOverlay>
                    <EditorSearch 
                        showSearch={showSearch} searchQuery={searchQuery} 
                        searchPosition={searchFlowPosition}
                        searchResults={searchResults} addNode={addNode} searchRef={searchRef}
                    />
                    
                    {edgeContextMenu.visible && activeContextMenuEdge && (
                        <EdgeContextMenu
                            x={edgeContextMenu.x}
                            y={edgeContextMenu.y}
                            onClose={() => setEdgeContextMenu({ visible: false, x: 0, y: 0, edgeId: null })}
                            onUpdate={handleEdgeUpdate}
                            onDelete={handleEdgeDelete}
                            onViewPerformance={handleViewPerformance}
                            currentQueue={activeContextMenuEdge.data?.queue as string || 'FCFS'}
                            currentPriority={activeContextMenuEdge.data?.priority as string || 'Medium'}
                            currentSchedule={getCurrentSchedule(activeContextMenuEdge)}
                        />
                    )}
                </ViewportOverlay>
            </ReactFlow>
        </div>
    </div>
  );
};

export const Editor: React.FC = () => {
  return (
    <ReactFlowProvider>
      <DataflowEditor />
    </ReactFlowProvider>
  );
};
