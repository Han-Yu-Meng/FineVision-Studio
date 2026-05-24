import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSystem } from '../context/SystemContext';
import { useNavigate } from 'react-router-dom';
import { Save, UploadCloud, ArrowLeft, FileText, RefreshCw } from 'lucide-react';
import Editor, { loader } from '@monaco-editor/react';
import yaml from 'js-yaml';

loader.config({
  paths: { vs: 'https://registry.npmmirror.com/monaco-editor/0.45.0/files/min/vs' },
});

interface ParamMeta {
  defaultValue: string;
  type: string;
  isObject: boolean;
}

export const ParameterEditor: React.FC = () => {
  const { activeParameter, saveParameter, agents, deployParameterToAgent, theme, sendAgentCommand, addNotification } = useSystem();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [targetAgentId, setTargetAgentId] = useState<string>('');
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);

  const templateMetaRef = useRef<Map<string, ParamMeta>>(new Map());
  const templateRootsRef = useRef<Set<string>>(new Set());
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const disposablesRef = useRef<any[]>([]);

  // 辅助函数：根据路径获取嵌套对象的值
  const getValueByPath = (obj: any, path: string) => {
    if (!obj) return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  // 辅助函数：类型匹配检查
  const isTypeMatch = (value: any, expectedType: string): boolean => {
    if (value === undefined || value === null) return true;
    const type = expectedType.toLowerCase();

    // 必须先检查集合类型，因为 "vector double" 同时也包含 "double" 关键字
    if (type.includes('vector') || type.includes('array') || type.includes('list')) {
      return Array.isArray(value);
    }
    
    // 检查标量数值类型
    if (type.includes('int') || type.includes('double') || type.includes('float')) {
      return typeof value === 'number';
    }
    
    // 检查布尔
    if (type.includes('bool')) {
      return typeof value === 'boolean';
    }
    
    // 检查字符串
    if (type.includes('string')) {
      return typeof value === 'string';
    }
    
    return true;
  };

  // 辅助函数：获取更友好的 JS 类型名称
  const getFriendlyType = (value: any): string => {
    if (Array.isArray(value)) return "array";
    if (value === null) return "null";
    return typeof value;
  };

  useEffect(() => {
    const availableAgent = agents.find(a => a.status !== 'OFFLINE');
    if (availableAgent && !targetAgentId) setTargetAgentId(availableAgent.id);
  }, [agents, targetAgentId]);

  useEffect(() => {
    if (activeParameter) {
      setName(activeParameter.name);
      setContent(activeParameter.content);
    }
  }, [activeParameter]);

  useEffect(() => {
    if (targetAgentId) fetchRemoteInfo();
  }, [targetAgentId]);

  const clearDisposables = () => {
    disposablesRef.current.forEach(d => d.dispose());
    disposablesRef.current = [];
  };

  useEffect(() => {
    return () => clearDisposables();
  }, []);

  const parseTemplateMetadata = (yamlStr: string) => {
    const metaMap = new Map<string, ParamMeta>();
    const roots = new Set<string>();
    const lines = yamlStr.split('\n');
    const stack: { indent: number; path: string }[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const indent = line.search(/\S/);
      const [keyPart, commentPart] = line.split('#');
      
      // 修复：使用第一个冒号分割，确保数组内容不被截断
      const firstColonIndex = keyPart.indexOf(':');
      if (firstColonIndex === -1) return;

      const key = keyPart.substring(0, firstColonIndex).trim();
      const val = keyPart.substring(firstColonIndex + 1).trim();

      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
      const parentPath = stack.length > 0 ? stack[stack.length - 1].path + "." : "";
      const currentPath = parentPath + key;

      if (stack.length === 0) roots.add(key);

      const type = commentPart?.includes('type:') ? commentPart.split('type:')[1].trim() : 'unknown';
      
      if (val !== "") {
        metaMap.set(currentPath, { defaultValue: val, type, isObject: false });
      } else {
        stack.push({ indent, path: currentPath });
        metaMap.set(currentPath, { defaultValue: '', type: 'object', isObject: true });
      }
    });
    templateMetaRef.current = metaMap;
    templateRootsRef.current = roots;
  };

  const handleSave = useCallback(() => {
    saveParameter({ name, content });
    addNotification({ message: 'Saved', type: 'success' });
  }, [saveParameter, name, content, addNotification]);

  const handleDeploy = useCallback(async () => {
    if (!targetAgentId) {
      addNotification({ message: 'Please select an agent first', type: 'error' });
      return;
    }
    try {
      await deployParameterToAgent(targetAgentId, { name, content });
      addNotification({ message: `Successfully deployed to ${targetAgentId}`, type: 'success' });
    } catch (error) {
      addNotification({ message: 'Deployment failed', type: 'error' });
    }
  }, [deployParameterToAgent, targetAgentId, name, content, addNotification]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const fetchRemoteInfo = useCallback(async () => {
    if (!targetAgentId) return;
    setIsFetchingRemote(true);
    try {
      const res = await sendAgentCommand(targetAgentId, '/get_params_template');
      parseTemplateMetadata(res.template_yaml || '');
      if (editorRef.current) validateYaml();
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsFetchingRemote(false);
    }
  }, [targetAgentId, sendAgentCommand]);

  const validateYaml = () => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor.getModel();
    if (!model) return;

    const markers: any[] = [];
    const templateMap = templateMetaRef.current;
    const templateRoots = templateRootsRef.current;
    
    let userObj: any = {};
    try {
      // 允许解析多行数组
      userObj = yaml.load(model.getValue());
    } catch (e) {}

    const flattenPaths = (obj: any, prefix = "", paths = new Set<string>()) => {
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        Object.keys(obj).forEach(k => {
          const p = prefix ? `${prefix}.${k}` : k;
          paths.add(p);
          flattenPaths(obj[k], p, paths);
        });
      }
      return paths;
    };
    const userPaths = flattenPaths(userObj);

    const lineStack: { indent: number; path: string }[] = [];
    for (let i = 1; i <= model.getLineCount(); i++) {
      const line = model.getLineContent(i);
      const indent = line.search(/\S/);
      // 匹配 key: value 的起始行，不匹配纯数组内容行（如 "  0.0, 1.0 ]"）
      const match = line.match(/^\s*([\w.]+)\s*:(.*)/);
      if (!match || trimmedIsComment(line)) continue;

      const key = match[1];
      const rawValueInLine = match[2].trim();

      while (lineStack.length > 0 && lineStack[lineStack.length - 1].indent >= indent) lineStack.pop();
      const parentPath = lineStack.length > 0 ? lineStack[lineStack.length - 1].path + "." : "";
      const fullPath = parentPath + key;
      const rootKey = fullPath.split('.')[0];

      if (templateRoots.has(rootKey)) {
        lineStack.push({ indent, path: fullPath });
        const meta = templateMap.get(fullPath);
        
        if (!meta) {
          markers.push({
            severity: monaco.MarkerSeverity.Warning,
            message: `Unknown parameter for '${rootKey}'`,
            startLineNumber: i,
            startColumn: indent + 1,
            endLineNumber: i,
            endColumn: indent + key.length + 1,
          });
          continue;
        }

        // 类型检查
        if (!meta.isObject) {
          const actualValue = getValueByPath(userObj, fullPath);
          if (!isTypeMatch(actualValue, meta.type)) {
            markers.push({
              severity: monaco.MarkerSeverity.Error,
              message: `Type mismatch: Expected ${meta.type}, but got ${getFriendlyType(actualValue)}`,
              startLineNumber: i,
              startColumn: line.indexOf(':') + 2,
              endLineNumber: i,
              endColumn: line.length + 1,
            });
          }
        }

        // 缺失字段检查
        if (meta.isObject) {
          const expected = Array.from(templateMap.keys()).filter(p => 
            p.startsWith(fullPath + ".") && p.split('.').length === fullPath.split('.').length + 1
          );
          const missing = expected.filter(c => !userPaths.has(c));
          
          if (missing.length > 0) {
            markers.push({
              severity: monaco.MarkerSeverity.Error,
              message: `Missing fields: ${missing.map(m => m.split('.').pop()).join(', ')}`,
              code: JSON.stringify({
                type: 'quickfix-missing-params',
                missingFields: missing,
                parentIndent: indent
              }),
              startLineNumber: i,
              startColumn: indent + 1,
              endLineNumber: i,
              endColumn: indent + key.length + 1,
            });
          }
        }
      }
    }
    monaco.editor.setModelMarkers(model, "parameter-logic", markers);
  };

  const trimmedIsComment = (s: string) => s.trim().startsWith('#');

  const saveRef = useRef(handleSave);
  useEffect(() => {
    saveRef.current = handleSave;
  }, [handleSave]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    clearDisposables();

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveRef.current();
    });

    const hoverProvider = monaco.languages.registerHoverProvider('yaml', {
      provideHover: (model: any, position: any) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const match = lineContent.match(/^\s*([\w.]+)\s*:/);
        if (!match) return null;
        const key = match[1];
        const indent = lineContent.search(/\S/);
        if (position.column < indent || position.column > indent + key.length + 1) return null;

        let currentIndent = indent;
        let parentPath = "";
        for (let i = position.lineNumber - 1; i >= 1; i--) {
            const prevLine = model.getLineContent(i);
            const prevIndent = prevLine.search(/\S/);
            const prevMatch = prevLine.match(/^\s*([\w.]+)\s*:/);
            if (prevMatch && prevIndent < currentIndent && !trimmedIsComment(prevLine)) {
                parentPath = prevMatch[1] + (parentPath ? "." + parentPath : "");
                currentIndent = prevIndent;
                if (currentIndent === 0) break;
            }
        }
        const fullPath = parentPath ? `${parentPath}.${key}` : key;
        const meta = templateMetaRef.current.get(fullPath);
        if (meta) {
          return {
            contents: [
              { value: `**Path:** \`${fullPath}\`` },
              { value: `**Type:** \`${meta.type}\`` },
              !meta.isObject ? { value: `**Default:** \`${meta.defaultValue}\`` } : { value: '*Object Container*' }
            ]
          };
        }
        return null;
      }
    });

    const codeActionProvider = monaco.languages.registerCodeActionProvider('yaml', {
      provideCodeActions: (model: any, range: any, context: any) => {
        const actions = context.markers
          .filter((m: any) => {
            try { return JSON.parse(m.code).type === 'quickfix-missing-params'; } catch { return false; }
          })
          .map((m: any) => {
            const data = JSON.parse(m.code);
            const missingPaths = data.missingFields as string[];
            const parentIndent = data.parentIndent;
            const parentLine = m.startLineNumber;
            
            // 获取父节点路径
            const firstMissing = missingPaths[0];
            const lastDotIndex = firstMissing.lastIndexOf('.');
            const parentPath = lastDotIndex !== -1 ? firstMissing.substring(0, lastDotIndex) : "";

            // 获取模板中该层级的所有子节点顺序
            const allSiblingsInTemplate = Array.from(templateMetaRef.current.keys()).filter(p => {
              const pDotIndex = p.lastIndexOf('.');
              const pParent = pDotIndex !== -1 ? p.substring(0, pDotIndex) : "";
              return pParent === parentPath;
            });

            // 扫描当前文档，找到已存在子节点的位置
            const existingSiblingLines = new Map<string, number>();
            const lineCount = model.getLineCount();
            const lineStack: { indent: number; path: string }[] = [];
            
            for (let i = 1; i <= lineCount; i++) {
              const line = model.getLineContent(i);
              const indent = line.search(/\S/);
              if (indent === -1) continue;
              const match = line.match(/^\s*([\w.]+)\s*:(.*)/);
              if (!match || trimmedIsComment(line)) continue;

              const key = match[1];
              while (lineStack.length > 0 && lineStack[lineStack.length - 1].indent >= indent) lineStack.pop();
              const pPath = lineStack.length > 0 ? lineStack[lineStack.length - 1].path + "." : "";
              const fullPath = pPath + key;
              lineStack.push({ indent, path: fullPath });

              if (allSiblingsInTemplate.includes(fullPath)) {
                existingSiblingLines.set(fullPath, i);
              }
            }

            // 计算结束行（包括嵌套内容）
            const getEndOfBlock = (lineNum: number) => {
              const startIndent = model.getLineContent(lineNum).search(/\S/);
              let lastLine = lineNum;
              for (let j = lineNum + 1; j <= lineCount; j++) {
                const l = model.getLineContent(j);
                const trimmed = l.trim();
                if (!trimmed) continue;
                if (trimmed.startsWith('#')) {
                    lastLine = j;
                    continue;
                }
                const indent = l.search(/\S/);
                if (indent <= startIndent) break;
                lastLine = j;
              }
              return lastLine;
            };

            const indentSize = 2;
            const spaces = " ".repeat(parentIndent + indentSize);
            
            const edits: any[] = [];
            let currentInsertionLine = parentLine;
            let pendingText = "";

            allSiblingsInTemplate.forEach(path => {
              if (missingPaths.includes(path)) {
                const key = path.split('.').pop();
                const meta = templateMetaRef.current.get(path);
                let valuePart = "";
                if (!meta?.isObject) {
                  const def = meta?.defaultValue || '';
                  const isString = meta?.type.toLowerCase().includes('string');
                  valuePart = isString ? ` "${def}"` : ` ${def}`;
                }
                pendingText += `\n${spaces}${key}:${valuePart}`;
              } else if (existingSiblingLines.has(path)) {
                if (pendingText) {
                  edits.push({
                    range: new monaco.Range(currentInsertionLine, model.getLineMaxColumn(currentInsertionLine) + 1, currentInsertionLine, model.getLineMaxColumn(currentInsertionLine) + 1),
                    text: pendingText
                  });
                  pendingText = "";
                }
                currentInsertionLine = getEndOfBlock(existingSiblingLines.get(path)!);
              }
            });

            if (pendingText) {
              edits.push({
                range: new monaco.Range(currentInsertionLine, model.getLineMaxColumn(currentInsertionLine) + 1, currentInsertionLine, model.getLineMaxColumn(currentInsertionLine) + 1),
                text: pendingText
              });
            }

            return {
              title: `✨ Insert missing parameters (Ordered)`,
              diagnostics: [m],
              kind: "quickfix",
              edit: {
                edits: edits.map(e => ({
                  resource: model.uri,
                  textEdit: {
                    range: e.range,
                    text: e.text
                  }
                }))
              },
              isPreferred: true
            };
          });
        return { actions, dispose: () => {} };
      }
    });
    
    disposablesRef.current.push(hoverProvider, codeActionProvider);
    editor.onDidChangeModelContent(() => validateYaml());
    setTimeout(() => { editor.layout(); validateYaml(); }, 100);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <FileText className="text-orange-500" size={20} />
            <input 
              className="bg-transparent text-lg font-bold outline-none dark:text-white border-b border-transparent focus:border-slate-400"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Parameter Name"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm dark:text-white outline-none focus:border-blue-500"
            value={targetAgentId}
            onChange={e => setTargetAgentId(e.target.value)}
          >
            <option value="">Select Agent...</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.id}</option>)}
          </select>
          <button onClick={handleDeploy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-md">
            <UploadCloud size={16} /> Deploy
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
            <Save size={16} /> Save
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="yaml"
          theme={theme === 'dark' ? "vs-dark" : "light"}
          value={content}
          onChange={(v) => setContent(v || '')}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineHeight: 22,
            automaticLayout: true,
            fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
            fontWeight: "500",
            scrollBeyondLastLine: false,
            fixedOverflowWidgets: true,
            renderLineHighlight: "all",
            fontLigatures: false,
            lightbulb: { enabled: 'on' as any }
          }}
        />
      </div>
    </div>
  );
};