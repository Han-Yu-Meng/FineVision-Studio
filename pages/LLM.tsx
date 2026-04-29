
import React, { useState, useEffect } from 'react';
import { useSystem } from '../context/SystemContext';
import * as Config from '../services/config';
import { useNavigate } from 'react-router-dom';

const GEMINI_API_KEY = (Config as any).GEMINI_API_KEY || '';
import { Sparkles, Bot, Send, ArrowRight, Loader2, AlertCircle, Cpu, FilePlus, FileEdit } from 'lucide-react';
import { Dataflow, Capability } from '../types';

export const LLMPage: React.FC = () => {
  const { agents, dataflows, loadDataflow } = useSystem();
  const navigate = useNavigate();

  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedFlow, setGeneratedFlow] = useState<Dataflow | null>(null);
  const [rawResponse, setRawResponse] = useState('');
  
  // Model selection state
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Mode selection state
  const [mode, setMode] = useState<'create' | 'modify'>('create');
  const [selectedDataflowName, setSelectedDataflowName] = useState<string>('');

  useEffect(() => {
    const fetchModels = async () => {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
            const data = await response.json();
            if (data.models) {
                const validModels = data.models.filter((m: any) => 
                    m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")
                );
                setModels(validModels);
                
                if (validModels.length > 0) {
                    const defaultModel = validModels.find((m: any) => m.name.includes('gemini-flash-lite-latest'))
                                      || validModels.find((m: any) => m.name.includes('gemini-1.5-flash')) 
                                      || validModels.find((m: any) => m.name.includes('gemini-pro'))
                                      || validModels[0];
                    setSelectedModel(defaultModel.name);
                }
            }
        } catch (e) {
            console.error("Failed to fetch models", e);
            setModels([{ name: 'models/gemini-pro', displayName: 'Gemini Pro (Fallback)' }]);
            setSelectedModel('models/gemini-pro');
        }
    };
    fetchModels();
  }, []);

  const validateDataflow = (json: any, agent: any) => {
      if (!json.nodes || !Array.isArray(json.nodes)) {
          throw new Error("Invalid JSON format: missing 'nodes' array");
      }

      const hasSourceNode = json.nodes.some((n: any) => !n.inputs || Object.keys(n.inputs).length === 0);
      if (!hasSourceNode) {
          throw new Error("Rule Violation: The dataflow must have at least one source node (a node with no inputs).");
      }

      const connectedSources = new Set<string>();
      json.nodes.forEach((n: any) => {
          if (n.inputs) {
              Object.values(n.inputs).forEach((sourceStr: any) => {
                  const [sourceId] = sourceStr.split('/');
                  connectedSources.add(sourceId);
              });
          }
      });

      for (const n of json.nodes) {
          const cap = agent.capabilities[n.node];
          if (!cap) continue; 
          
          const hasOutputs = cap.outputs && cap.outputs.length > 0;
          if (hasOutputs) {
              if (!connectedSources.has(n.id)) {
                  throw new Error(`Rule Violation: Node '${n.id}' (${n.node}) produces outputs but none are connected to other nodes. All processing nodes must be connected.`);
              }
          }
      }
  };

  const handleGenerate = async () => {
    if (!instruction) return;
    if (!selectedAgentId) {
        setError("Please select an agent first.");
        return;
    }
    if (!selectedModel) {
        setError("Please select a model.");
        return;
    }
    if (mode === 'modify' && !selectedDataflowName) {
        setError("Please select a dataflow to modify.");
        return;
    }

    setLoading(true);
    setError(null);
    setGeneratedFlow(null);
    setRawResponse('');

    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) {
        setError("Agent not found.");
        setLoading(false);
        return;
    }

    let availableNodesStr = "";
    Object.entries(agent.capabilities).forEach(([name, cap]) => {
        const c = cap as Capability;
        availableNodesStr += `- Node Name: "${name}"\n`;
        availableNodesStr += `  Description: ${c.description}\n`;
        if (c.inputs && c.inputs.length > 0) {
            availableNodesStr += `  Inputs: ${c.inputs.map(i => `${i.name || i.description} (type: ${i.type})`).join(', ')}\n`;
        }
        if (c.outputs && c.outputs.length > 0) {
            availableNodesStr += `  Outputs: ${c.outputs.map(o => `${o.name || o.description} (type: ${o.type})`).join(', ')}\n`;
        }
        if (c.parameters && c.parameters.length > 0) {
            availableNodesStr += `  Parameters: ${c.parameters.map(e => `${e.name} (type: ${e.type}, default: ${e.default_value})`).join(', ')}\n`;
        }
        availableNodesStr += "\n";
    });

    let taskDescription = "";
    let contextSection = "";

    if (mode === 'create') {
        taskDescription = "根据用户指令和提供的可用节点列表，生成一个新的数据流 JSON。";
        const examplesStr = JSON.stringify(dataflows.slice(0, 2), null, 2);
        contextSection = `[Examples]\n${examplesStr}`;
    } else {
        taskDescription = "根据用户指令，修改提供的 [Current Dataflow]。保持原有结构，仅根据指令增删改节点或参数。";
        const currentFlow = dataflows.find(f => f.config.name === selectedDataflowName);
        if (!currentFlow) {
             setError("Selected dataflow not found.");
             setLoading(false);
             return;
        }
        contextSection = `[Current Dataflow]\n${JSON.stringify(currentFlow, null, 2)}`;
    }

    // 3. Construct Prompt
    const prompt = `Role: 你是一个机器人数据流调度系统的架构师。
Task: ${taskDescription}
Constraints:
1. 只能使用 [Available Nodes] 中列出的节点。
2. 节点的 parameters 参数必须根据描述或 default_value 填充合理的默认值。
3. 连接线 (inputs -> outputs) 必须严格匹配数据类型 (type)。例如：cv::Mat 只能连 cv::Mat。
4. ID 必须唯一，格式为 "NodeName_RandomSuffix"。
5. 不要计算 position，全部设为 0，由后续程序处理。
6. 只返回 JSON 格式，不要包含 Markdown 代码块标记（如 \`\`\`json）。
7. 对于多输入的函数节点，需要使用 Fusion 节点进行数据融合。
8. 必须有至少一个源节点（没有输入的节点）。
9. 多输出节点输出端口允许部分不连接，但是不允许节点全部输出不连接（即每个产生输出的节点至少要有一个连线指向其他节点）。

[Available Nodes]
${availableNodesStr}

${contextSection}

User Instruction: "${instruction}"

Response Format (JSON):`;

    let chatHistory = [
        {
            role: 'user',
            parts: [{ text: prompt }]
        }
    ];

    const MAX_RETRIES = 3;
    let attempt = 0;

    try {
        while (attempt < MAX_RETRIES) {
            attempt++;
            console.log(`Attempt ${attempt} of ${MAX_RETRIES}`);

            // Use selectedModel in the API URL and use streamGenerateContent
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${selectedModel}:streamGenerateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: chatHistory
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error?.message || response.statusText);
            }

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // Extract text content from the JSON stream using regex
                const textMatches = buffer.matchAll(/"text":\s*"((?:[^"\\]|\\.)*)"/g);
                let currentStreamedText = '';
                for (const match of textMatches) {
                    try {
                        currentStreamedText += JSON.parse(`"${match[1]}"`);
                    } catch (e) {
                        // Ignore parsing errors for partial matches
                    }
                }
                
                if (currentStreamedText) {
                    fullText = currentStreamedText;
                    setRawResponse(fullText); // Real-time update
                }
            }

            let text = fullText;
            // Clean up markdown if present
            text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            
            try {
                const json = JSON.parse(text);
                
                validateDataflow(json, agent);

                json.nodes.forEach((node: any, index: number) => {
                    node.position = { x: 100 + (index * 250), y: 100 + (index % 2) * 100 };

                    if (node.parameters) {
                        const newParams: any = {};
                        Object.entries(node.parameters).forEach(([key, value]) => {
                            newParams[key] = value;
                        });
                        node.parameters = newParams;
                    }
                });

                if (!json.config) {
                    json.config = { name: "AI_Generated_Flow", description: instruction };
                }

                setGeneratedFlow(json);
                return; 

            } catch (validationError: any) {
                console.warn(`Validation failed on attempt ${attempt}:`, validationError.message);
                
                if (attempt === MAX_RETRIES) {
                    throw validationError; // Rethrow on last attempt
                }

                // Add error to chat history for retry
                chatHistory.push({
                    role: 'model',
                    parts: [{ text: fullText }]
                });
                chatHistory.push({
                    role: 'user',
                    parts: [{ text: `The generated JSON is invalid or violates rules. Error: ${validationError.message}. Please fix the JSON and output it again.` }]
                });
                
                setRawResponse(prev => prev + `\n\n[System] Validation failed: ${validationError.message}. Retrying...`);
            }
        }

    } catch (e: any) {
        setError(e.message || "Failed to generate dataflow");
    } finally {
        setLoading(false);
    }
  };

  const handleLoadToEditor = () => {
      if (generatedFlow) {
          loadDataflow(generatedFlow);
          navigate('/editor');
      }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full space-y-6">
            
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl shadow-lg">
                    <Sparkles className="text-white" size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI Dataflow Architect</h1>
                    <p className="text-slate-500 dark:text-slate-400">Describe your task, and let Gemini build the graph for you.</p>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
                
                {/* Mode Selection */}
                <div className="flex gap-4 mb-2">
                    <button 
                        onClick={() => setMode('create')}
                        className={`flex-1 py-3 px-4 rounded-lg border flex items-center justify-center gap-2 transition-all ${mode === 'create' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-600 dark:text-blue-400 font-bold' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <FilePlus size={18} /> Create New
                    </button>
                    <button 
                        onClick={() => setMode('modify')}
                        className={`flex-1 py-3 px-4 rounded-lg border flex items-center justify-center gap-2 transition-all ${mode === 'modify' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500 text-purple-600 dark:text-purple-400 font-bold' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <FileEdit size={18} /> Modify Existing
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Target Agent (Context)</label>
                        <select 
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                            value={selectedAgentId}
                            onChange={(e) => setSelectedAgentId(e.target.value)}
                        >
                            <option value="" disabled>Select an agent...</option>
                            {agents.map(a => (
                                <option key={a.id} value={a.id}>{a.id} ({Object.keys(a.capabilities).length} nodes available)</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">AI Model</label>
                        <div className="relative">
                            <select 
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all appearance-none"
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                disabled={models.length === 0}
                            >
                                {models.length === 0 && <option value="">Loading models...</option>}
                                {models.map(m => (
                                    <option key={m.name} value={m.name}>
                                        {m.displayName} ({m.version})
                                    </option>
                                ))}
                            </select>
                            <Cpu size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Dataflow Selection (Only in Modify Mode) */}
                {mode === 'modify' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Dataflow to Modify</label>
                        <select 
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                            value={selectedDataflowName}
                            onChange={(e) => setSelectedDataflowName(e.target.value)}
                        >
                            <option value="" disabled>Select a dataflow...</option>
                            {dataflows.map(f => (
                                <option key={f.config.name} value={f.config.name}>{f.config.name} ({f.nodes.length} nodes)</option>
                            ))}
                        </select>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Instruction</label>
                    <div className="relative">
                        <textarea 
                            className="w-full h-32 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                            placeholder={mode === 'create' 
                                ? "e.g., I want to replay a ROS bag, filter the point cloud using a voxel grid, and then perform FastLIO mapping."
                                : "e.g., Add a downsampling filter before the mapping node, or change the voxel size to 0.5."
                            }
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                        />
                        <button 
                            onClick={handleGenerate}
                            disabled={loading || !instruction || !selectedAgentId || !selectedModel || (mode === 'modify' && !selectedDataflowName)}
                            className="absolute bottom-4 right-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all font-medium text-sm"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            Generate
                        </button>
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3 text-red-800 dark:text-red-200">
                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-sm">Generation Failed</h3>
                        <p className="text-sm opacity-90">{error}</p>
                    </div>
                </div>
            )}

            {/* Result Display */}
            {generatedFlow && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Bot className="text-purple-500" size={20} />
                            <span className="font-bold text-slate-900 dark:text-white">Generated Solution</span>
                        </div>
                        <button 
                            onClick={handleLoadToEditor}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                        >
                            Open in Editor <ArrowRight size={16} />
                        </button>
                    </div>
                    <div className="p-0">
                        <pre className="bg-slate-950 text-slate-300 p-6 overflow-x-auto text-xs font-mono max-h-[400px]">
                            {JSON.stringify(generatedFlow, null, 2)}
                        </pre>
                    </div>
                </div>
            )}
            
            {/* Raw Response Debug (Optional, hidden if flow parsed correctly) */}
            {!generatedFlow && rawResponse && !loading && (
                 <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Raw Response</h4>
                    <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono">{rawResponse}</pre>
                 </div>
            )}
        </div>
    </div>
  );
};
