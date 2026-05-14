
import { Node, Edge } from '@xyflow/react';
import { Dataflow, DataflowNode, Capability, DataflowInputDef, AgentCapabilities } from '../types';

export const getMatchScore = (pattern: string, str: string) => {
    const p = pattern.toLowerCase();
    const s = str.toLowerCase();
    
    if (s === p) return 1000; 
    
    const idx = s.indexOf(p);
    if (idx !== -1) {
        return 800 - idx; 
    }
    
    let pIdx = 0;
    let sIdx = 0;
    while (pIdx < p.length && sIdx < s.length) {
        if (p[pIdx] === s[sIdx]) {
            pIdx++;
        }
        sIdx++;
    }
    
    if (pIdx === p.length) {
        return 100; 
    }
    
    return 0;
};

export const dataflowToReactFlow = (flow: Dataflow, agentCapabilities?: any) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  if (!flow.nodes) return { nodes, edges };

  flow.nodes.forEach((n: any) => {
    const label = n.name || n.node || 'Unknown';
    const id = n.id;
    const position = n.position || { x: 0, y: 0 };
    
    let inputsDef = n.inputs && typeof n.inputs === 'object' && !Array.isArray(n.inputs) && Object.values(n.inputs).some((v: any) => v.id !== undefined) 
        ? Object.values(n.inputs) 
        : []; 
    
    let outputsDef = n.outputs && Array.isArray(n.outputs) && typeof n.outputs[0] === 'object'
        ? n.outputs 
        : []; 

    let paramsDef = n.parameters && Array.isArray(n.parameters) 
        ? n.parameters 
        : [];

    if ((inputsDef.length === 0 || outputsDef.length === 0 || paramsDef.length === 0) && agentCapabilities) {
        const cap = agentCapabilities[label]; 
        if (cap) {
            if (inputsDef.length === 0) inputsDef = cap.inputs || [];
            if (outputsDef.length === 0) outputsDef = cap.outputs || [];
            if (paramsDef.length === 0) paramsDef = cap.parameters || [];
        }
    }

    const clients = n.clients || [];
    const servers = n.servers || [];
    const actors = n.actors || [];
    const commanders = n.commanders || [];

    if (n.inputs && typeof n.inputs === 'object') {
        Object.entries(n.inputs).forEach(([targetHandle, val]: [string, any]) => {
            let connectStr: string | null = null;
            let scheduleStr: string | null = null;
            
            if (typeof val === 'string') {
                connectStr = val;
            } else if (val && typeof val === 'object') {
                connectStr = val.connect;
                scheduleStr = val.schedule;
            }

            if (connectStr) {
                const [sourceId, sourceHandle] = connectStr.split('/');
                if (sourceId && sourceHandle) {
                    // Parse schedule information if available
                    let queue = 'FCFS';
                    let priority = 'Medium';
                    
                    if (scheduleStr) {
                        const priorityMatch = scheduleStr.match(/PRIORITY:([^;]+)/);
                        const queueMatch = scheduleStr.match(/QUEUE:([^;]+)/);
                        
                        if (priorityMatch) priority = priorityMatch[1].trim();
                        if (queueMatch) queue = queueMatch[1].trim();
                    }
                    
                    edges.push({
                        id: `e-${sourceId}-${sourceHandle}-${id}-${targetHandle}`,
                        source: sourceId,
                        sourceHandle: sourceHandle,
                        target: id,
                        targetHandle: targetHandle,
                        animated: true,
                        type: 'default',
                        data: {
                            queue,
                            priority
                        }
                    });
                }
            }
        });
    }

    const currentParameterValues: Record<string, any> = {};
    
    const paramSource = n.parameters || n.externs;

    if (Array.isArray(paramSource)) {
        paramSource.forEach((p: any) => {
            if (p.value !== undefined) currentParameterValues[p.name] = p.value;
            else if (p.default_value !== undefined) currentParameterValues[p.name] = p.default_value;
        });
    } else if (paramSource && typeof paramSource === 'object') {
        Object.entries(paramSource).forEach(([k, v]) => {
            currentParameterValues[k] = v;
        });
    }

    nodes.push({
      id: id,
      type: 'custom',
      position,
      data: {
        id: id,
        user_id: id,
        label: label,
        description: n.description || '',
        category: n.category || '',
        
        source: n.source || 'workspace',
        version: n.version || 'default',
        package_name: n.package_name,
        
        inputs: inputsDef,
        outputs: outputsDef,
        parameterDefs: paramsDef,
        clients: clients,
        servers: servers,
        actors: actors,
        commanders: commanders,
        
        currentParameterValues,
        
        onParameterChange: () => {}, 
        onClientChange: () => {},
        onServerChange: () => {},
        onActorChange: () => {},
        onCommanderChange: () => {},
        onIdChange: () => {},
        onCollapseChange: () => {}, 
        onVersionChange: () => {},
        
        collapsed: n.collapsed || false,
        isUnsupported: false 
      },
    });
  });

  return { nodes, edges };
};

export const reactFlowToDataflow = (nodes: Node[], edges: Edge[], config: any): Dataflow => {
  const jsonNodes: DataflowNode[] = nodes.map(n => {
    const data = n.data as any;
    
    const inputsMap: Record<string, DataflowInputDef> = {};
    
    if (data.inputs && Array.isArray(data.inputs)) {
        (data.inputs as any[]).forEach(i => {
            inputsMap[i.name] = {
                id: i.id,
                name: i.name,
                type: i.type,
            };
        });
    }

    edges.filter(e => e.target === n.id).forEach(e => {
        if (e.targetHandle && inputsMap[e.targetHandle]) {
            inputsMap[e.targetHandle].connect = `${e.source}/${e.sourceHandle}`;
            
            if (e.data) {
                const priority = e.data.priority || 'Medium';
                const queue = e.data.queue || 'FCFS';
                inputsMap[e.targetHandle].schedule = `PRIORITY:${priority};QUEUE:${queue}`;
            }
        }
    });

    const currentParams = data.currentParameterValues || {};
    const updatedParameters = (data.parameterDefs || []).map((p: any) => ({
        ...p,
        value: currentParams[p.name] !== undefined ? currentParams[p.name] : p.default_value
    }));

    return {
      id: n.id,
      name: data.label,
      description: data.description || '', 
      category: data.category || '',
      package_name: data.package_name,
      source: data.source,
      version: data.version,
      
      inputs: inputsMap,
      outputs: data.outputs || [],
      parameters: updatedParameters,
      clients: data.clients || [],
      servers: data.servers || [],
      actors: data.actors || [],
      commanders: data.commanders || [],

      position: n.position,
      collapsed: !!data.collapsed
    };
  });

  return { config, nodes: jsonNodes}; 
};

export const normalizeDataflow = (flow: Dataflow) => {
    if (!flow) return "";
    const sortedNodes = [...flow.nodes].sort((a, b) => a.id.localeCompare(b.id));
    
    const normalizedNodes = sortedNodes.map(n => {
        const sortedInputs: Record<string, any> = {};
        Object.keys(n.inputs || {}).sort().forEach(k => {
            sortedInputs[k] = n.inputs[k];
        });

        const clients = (n.clients || []).map(c => ({ name: c.name, topic: c.topic || '' })).sort((a, b) => a.name.localeCompare(b.name));
        const servers = (n.servers || []).map(s => ({ name: s.name, topic: s.topic || '' })).sort((a, b) => a.name.localeCompare(b.name));
        const actors = (n.actors || []).map(a => ({ name: a.name, topic: a.topic || '' })).sort((a, b) => a.name.localeCompare(b.name));
        const commanders = (n.commanders || []).map(c => ({ name: c.name, topic: c.topic || '' })).sort((a, b) => a.name.localeCompare(b.name));

        return {
            id: n.id,
            name: n.name,
            inputs: sortedInputs,
            outputs: n.outputs, 
            parameters: n.parameters, 
            clients: clients,
            servers: servers,
            actors: actors,
            commanders: commanders,
            position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
            connects: Object.values(n.inputs || {}).map((i: any) => i.connect).filter(Boolean).sort() 
        };
    });
    
    return JSON.stringify({
        config: flow.config,
        nodes: normalizedNodes
    });
};

export const filterLogsByClearTime = (logs: any[], clearTimestamp: number): any[] => {
  if (!logs || logs.length === 0) return [];
  if (clearTimestamp === 0) return logs; 
  
  return logs.filter(log => {
    const logTime = log.timestamp * 1000; 
    return logTime > clearTimestamp;
  });
};

import DOMPurify from 'dompurify';
import katex from 'katex';

const createCapabilityKey = (name: string, package_source?: string, version?: string): string => {
  const source = package_source || 'workspace';
  const ver = version || 'default';
  return `${source}/${name}@${ver}`;
};

export const renderTextWithKaTeX = (text: string) => {
  if (!text) return [];
  const parts = text.split(/(\$[^$]+\$)/g);
  
  return parts.map((part, idx) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      const latex = part.slice(1, -1);
      try {
        const html = katex.renderToString(latex, {
          throwOnError: false,
          displayMode: false,
        });
        return {
          type: 'math',
          html: DOMPurify.sanitize(html),
          key: idx
        };
      } catch (e) {
        return { type: 'text', content: part, key: idx };
      }
    }
    return { type: 'text', content: part, key: idx };
  });
};

export const mergeCapabilities = (
  localCapabilities: Record<string, Capability[]>,
  agentCapabilities: Record<string, AgentCapabilities>,
  onlineAgentIds: string[]
): AgentCapabilities => {
  const merged: AgentCapabilities = {};
  const seenKeys = new Set<string>();
  
  Object.values(localCapabilities).forEach(caps => {
    caps.forEach(c => {
      if (c.name) {
        const key = createCapabilityKey(c.name, c.package_name || c.source, c.version);
        if (!seenKeys.has(key)) {
          merged[c.name] = c;
          seenKeys.add(key);
        }
      }
    });
  });

  onlineAgentIds.forEach(agentId => {
    const agentCaps = agentCapabilities[agentId];
    if (agentCaps) {
      Object.entries(agentCaps).forEach(([name, cap]) => {
        const key = createCapabilityKey(cap.name, cap.package_name || cap.source, cap.version);
        
        if (!seenKeys.has(key)) {
          let finalKey = cap.name;
          let counter = 1;
          while (merged[finalKey] && merged[finalKey] !== cap) {
            finalKey = `${cap.name}_${counter}`;
            counter++;
          }
          
          merged[finalKey] = cap;
          seenKeys.add(key);
        }
      });
    }
  });

  return merged;
};

export const generatePythonLaunch = (flow: Dataflow): string => {
  const { nodes, config } = flow;

  const sortedNodes: DataflowNode[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const nodeIdMap = new Map(nodes.map(n => [n.id, n]));

  const topologicalSort = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
        console.warn(`[Launch Export] Cycle detected at node: ${nodeId}`);
        return;
    }

    visiting.add(nodeId);

    const node = nodeIdMap.get(nodeId);
    if (node && node.inputs) {
      Object.values(node.inputs).forEach(input => {
        if (input.connect) {
          const [providerId] = input.connect.split('/');
          if (nodeIdMap.has(providerId)) {
            topologicalSort(providerId);
          }
        }
      });
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    if (node) sortedNodes.push(node);
  };

  nodes.forEach(n => topologicalSort(n.id));

  const sources = new Set(sortedNodes.map(n => n.source || 'nav'));
  const isUniformSource = sources.size === 1;
  const commonSource = isUniformSource ? Array.from(sources)[0] : null;

  const nodeStrings = sortedNodes.map(node => {
    const params = node.parameters && node.parameters.length > 0 
      ? `\n                parameters=${JSON.stringify(
          Object.fromEntries(node.parameters.map(p => [p.name, p.value ?? p.default_value]))
        , null, 2).replace(/\n/g, '\n                ')},`
      : '';

    const remappingEntries: [string, string][] = [];
    
    Object.entries(node.inputs || {}).forEach(([portName, inputDef]) => {
      if (inputDef.connect) {
        remappingEntries.push([portName, inputDef.connect]);
      }
    });

    if (node.outputs) {
      node.outputs.forEach(out => {
        const portName = out.name || out.description;
        remappingEntries.push([portName, `${node.id}/${portName}`]);
      });
    }

    const remappings = remappingEntries.length > 0
      ? `\n                remappings=${JSON.stringify(
          Object.fromEntries(remappingEntries)
        , null, 2).replace(/\n/g, '\n                ')},`
      : '';

    const sourceAttr = isUniformSource ? '' : `\n                source="${node.source || 'nav'}",`;

    return `            Node(${sourceAttr}
                package="${node.package_name || 'unknown'}",
                name="${node.name}",${params}${remappings}
            ),`;
  }).join('\n');

  return `from fins import Node, Group, LaunchDescription, Agent${isUniformSource ? ', DefaultSource' : ''}

def generate_launch():
${isUniformSource ? `    with DefaultSource("${commonSource}"):` : ''}
        main_group = Group(
            [
${nodeStrings}
            ]
        )

        return LaunchDescription(groups=[main_group])

if __name__ == "__main__":
    with Agent(name="${config.name || 'fins'}", port=1896) as agent:
        ld = generate_launch()
        agent.launch(ld)
        agent.spin()
`;
};