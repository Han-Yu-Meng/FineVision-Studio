
import React from 'react';
import { 
  Loader2, Square, Play, 
  LayoutTemplate, Download, Save, UploadCloud, Eraser, Hammer, Undo2,
  FileCode
} from 'lucide-react';
import { Agent, AgentStatus } from '../../types';
import { useSystem } from '../../context/SystemContext';
import { useReactFlow } from '@xyflow/react';

interface EditorToolbarProps {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  pendingStatus: string | null;
  selectedAgent: Agent | undefined;
  handleSetStatus: (state: 'RUNNING' | 'STOPPED') => void;
  onLayout: () => void;
  handleClearAgentState: () => void;
  handleSave: () => void;
  handleDownload: () => void;
  handleDownloadPython: () => void;
  handleDeploy: () => void;
  handleRevert: () => void;
  handleCompile: () => void; 
  isDirty: boolean; 
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  isSidebarCollapsed,
  toggleSidebar,
  pendingStatus,
  selectedAgent,
  handleSetStatus,
  onLayout,
  handleClearAgentState,
  handleSave,
  handleDownload,
  handleDownloadPython,
  handleDeploy,
  handleRevert,
  handleCompile,
  isDirty 
}) => {
  const [showRevertButton, setShowRevertButton] = React.useState(false);
  
  const isTimeout = selectedAgent ? (Date.now() - selectedAgent.lastSeen > 25000) : true;
  const isOffline = !selectedAgent || selectedAgent.status === AgentStatus.OFFLINE || isTimeout;
  const { startCompileBatch, isCompilingGlobal, compilationProgress, addNotification } = useSystem();
  const { getNodes } = useReactFlow();

  const handleSmartCompile = () => {
      const nodes = getNodes();
      const requiredPackages = new Set<string>();
      nodes.forEach(n => {
          if (n.data && n.data.package_name) {
              requiredPackages.add(n.data.package_name as string);
          }
      });

      if (requiredPackages.size === 0) {
          addNotification({
              message: "No Packages Found: The current graph does not contain any nodes associated with a compileable package.",
              type: "info"
          });
          return;
      }

      startCompileBatch(Array.from(requiredPackages));
  };

  return (
    <div className="absolute top-4 left-4 right-4 z-10 flex justify-end items-start pointer-events-none">
      <div className="flex gap-2 pointer-events-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-700 p-1.5 rounded-xl shadow-xl">
        
        <div className="flex items-center gap-1">
            {pendingStatus ? (
            <button 
                disabled
                className="bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-3 py-2 rounded-lg flex items-center gap-2 cursor-not-allowed text-xs font-bold"
            >
                <Loader2 size={14} className="animate-spin" /> 
                {pendingStatus === 'RUNNING' ? 'Starting...' : 'Stopping...'}
            </button>
            ) : selectedAgent && selectedAgent.status === AgentStatus.RUNNING && !isOffline ? (
            <button 
                onClick={() => handleSetStatus('STOPPED')}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-xs font-bold"
            >
                <Square size={14} fill="currentColor" /> Stop
            </button>
            ) : (
            <button 
                onClick={() => handleSetStatus('RUNNING')}
                disabled={isOffline}
                className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-xs font-bold ${
                    isOffline 
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed' 
                        : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
                title={isOffline ? "Agent is offline" : "Run Dataflow"}
            >
                <Play size={14} fill="currentColor" /> Run
            </button>
            )}
        </div>

        <div className="w-[1px] bg-slate-200 dark:bg-slate-700 mx-1 my-1"></div>

        <div className="flex items-center gap-1">
            <button onClick={onLayout} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Auto Layout">
                <LayoutTemplate size={16} />
            </button>
            
            <div 
                className="relative"
                onMouseEnter={() => isDirty && setShowRevertButton(true)}
                onMouseLeave={() => setShowRevertButton(false)}
            >
                <button 
                    onClick={handleSave} 
                    className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative group" 
                    title={isDirty ? "Save changes (auto-saved)" : "Save locally"}
                >
                    <Save size={16} />
                    {isDirty && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900 animate-pulse"></span>
                    )}
                </button>
                
                {/* Revert Button - appears below on hover */}
                {showRevertButton && isDirty && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRevert();
                            setShowRevertButton(false);
                        }}
                        className="absolute top-full mt-1 left-0 p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors animate-in fade-in slide-in-from-top-2 duration-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg z-50"
                        title="Revert to saved version"
                    >
                        <Undo2 size={16} />
                    </button>
                )}
            </div>

            <button onClick={handleDownload} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Download JSON">
                <Download size={16} />
            </button>

            <button 
                onClick={handleDownloadPython} 
                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" 
                title="Export Python Launch"
            >
                <FileCode size={16} />
            </button>

            <button
                onClick={handleClearAgentState}
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Clear Metrics & Logs"
            >
                <Eraser size={16} />
            </button>
        </div>

        <div className="w-[1px] bg-slate-200 dark:bg-slate-700 mx-1 my-1"></div>

        <div className="flex items-center gap-1">
            <button 
                onClick={handleSmartCompile} 
                className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                    isCompilingGlobal 
                        ? 'bg-slate-100 dark:bg-slate-800 text-blue-500 animate-pulse cursor-wait' 
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={isCompilingGlobal ? "Compiling..." : "Compile Active Packages"}
                disabled={isCompilingGlobal}
            >
                {isCompilingGlobal ? <Loader2 size={16} className="animate-spin" /> : <Hammer size={16} />}
                {isCompilingGlobal && (
                    <span className="text-xs font-mono font-bold">{compilationProgress.current}/{compilationProgress.total}</span>
                )}
            </button>

            <button 
                onClick={handleDeploy} 
                disabled={isOffline}
                className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-xs font-bold ${
                    isOffline
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                title="Deploy to Agent"
            >
                <UploadCloud size={14} /> Deploy
            </button>
        </div>

      </div>
    </div>
  );
};
