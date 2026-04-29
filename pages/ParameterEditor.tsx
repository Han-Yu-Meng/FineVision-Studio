import React, { useState, useEffect, useCallback } from 'react';
import { useSystem } from '../context/SystemContext';
import { useNavigate } from 'react-router-dom';
import { Save, UploadCloud, ArrowLeft, FileText, AlertCircle, CheckCircle, Info, X, Loader2 } from 'lucide-react';
import Editor, { loader } from '@monaco-editor/react';

loader.config({
  paths: {
    vs: 'https://registry.npmmirror.com/monaco-editor/0.45.0/files/min/vs',
  },
});

export const ParameterEditor: React.FC = () => {
  const { activeParameter, saveParameter, agents, deployParameterToAgent, theme } = useSystem();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [targetAgentId, setTargetAgentId] = useState<string>('');

  // Toast State
  const [toasts, setToasts] = useState<{id: string, message: string, type: 'success' | 'error' | 'info'}[]>([]);

  // Auto-select first available agent
  useEffect(() => {
    const availableAgent = agents.find(a => a.status !== 'OFFLINE');
    if (availableAgent && !targetAgentId) {
      setTargetAgentId(availableAgent.id);
    }
  }, [agents, targetAgentId]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
      const id = Math.random().toString(36).substring(7);
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  useEffect(() => {
    if (activeParameter) {
      setName(activeParameter.name);
      setContent(activeParameter.content);
    } else {
      // Default template if new
      setName('New_Config');
      setContent('# YAML Configuration\nkey: value\n');
    }
  }, [activeParameter]);

  const handleSave = useCallback(() => {
    if (!name) return showToast('Please enter a parameter name', 'error');
    saveParameter({ name, content });
    showToast('Parameter saved successfully!', 'success');
  }, [name, content, saveParameter, showToast]);

  // Add Keyboard Shortcut
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

  const handleDeploy = async () => {
    if (!targetAgentId) return showToast('Please select a target agent', 'error');
    
    try {
      const success = await deployParameterToAgent(targetAgentId, { name, content });
      if (success) {
        showToast('Parameter applied successfully!', 'success');
      }
    } catch (e: any) {
      showToast('Error deploying parameter: ' + e.message, 'error');
    }
  };

  
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 relative">
      {/* Toast Container */}
      <div className="absolute top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none w-80 items-end">
          {toasts.map(t => (
              <div key={t.id} className={`
                  pointer-events-auto flex items-center gap-3 p-3 rounded-lg shadow-xl border backdrop-blur-md transition-all animate-in slide-in-from-right w-full
                  ${t.type === 'error' ? 'bg-red-100 dark:bg-red-900/90 border-red-200 dark:border-red-700 text-red-800 dark:text-red-100' : 
                    t.type === 'success' ? 'bg-green-100 dark:bg-green-900/90 border-green-200 dark:border-green-700 text-green-800 dark:text-green-100' : 
                    'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100'}
              `}>
                  {t.type === 'error' ? <AlertCircle size={18} /> : 
                   t.type === 'success' ? <CheckCircle size={18} /> : 
                   <Info size={18} />}
                  <span className="text-xs font-medium flex-1">{t.message}</span>
                  <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="hover:opacity-70">
                      <X size={14} />
                  </button>
              </div>
          ))}
      </div>

      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <FileText className="text-orange-500 dark:text-orange-400" size={20} />
            <input 
              className="bg-transparent text-lg font-bold text-slate-900 dark:text-white focus:outline-none border-b border-transparent focus:border-slate-400 dark:focus:border-slate-600 placeholder-slate-400 dark:placeholder-slate-600"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Parameter Name"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500"
            value={targetAgentId}
            onChange={e => setTargetAgentId(e.target.value)}
          >
            <option value="">Select Target Agent...</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.id} ({a.status})</option>)}
          </select>
          
          <button 
            onClick={handleDeploy}
            disabled={!targetAgentId}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg transition-all"
          >
            <UploadCloud size={16} /> Deploy
          </button>

          <div className="h-8 w-[1px] bg-slate-300 dark:bg-slate-700 mx-2"></div>
          
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-lg text-sm font-bold flex items-center gap-2 border border-slate-200 dark:border-slate-700 shadow-lg transition-all"
          >
            <Save size={16} /> Save
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
        <Editor
          height="100%"
          defaultLanguage="yaml"
          theme={theme === 'dark' ? "vs-dark" : "light"}
          value={content}
          onChange={(value) => setContent(value || '')}
          loading={
            <div className="flex items-center justify-center h-full text-slate-500 gap-2">
                <Loader2 className="animate-spin" size={24} />
                <span>Loading Editor...</span>
            </div>
          }
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16, bottom: 16 },
            fontFamily: "Consolas, 'Courier New', monospace", 
            fontLigatures: false,
          }}
        />
      </div>
    </div>
  );
};
