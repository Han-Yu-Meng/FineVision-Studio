import React, { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { useNavigate } from 'react-router-dom';
import { Settings, FileText, Trash2 } from 'lucide-react';

export const ParameterList: React.FC = () => {
  const { parameters, loadParameter, deleteParameter, reorderParameters } = useSystem();
  const navigate = useNavigate();

  const [draggedParamIndex, setDraggedParamIndex] = useState<number | null>(null);

  const handleParamDragStart = (index: number) => {
      setDraggedParamIndex(index);
  };

  const handleParamDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedParamIndex === null || draggedParamIndex === index) return;
      
      const newParams = [...parameters];
      const draggedItem = newParams[draggedParamIndex];
      newParams.splice(draggedParamIndex, 1);
      newParams.splice(index, 0, draggedItem);
      
      reorderParameters(newParams);
      setDraggedParamIndex(index);
  };

  const handleParamDrop = () => {
      setDraggedParamIndex(null);
  };

  
  const handleDeleteParam = (name: string) => {
    if (confirm(`Delete parameter ${name}?`)) {
      deleteParameter(name);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col gap-6 relative bg-slate-50 dark:bg-slate-950 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full space-y-6">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl shadow-lg">
                    <Settings className="text-white" size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Parameters</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage YAML configuration</p>
                </div>
            </div>

      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button 
            onClick={() => {
                loadParameter({ name: `Param_${Date.now().toString().slice(-4)}`, content: '' });
                navigate('/parameter-editor');
            }}
            className="border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-5 hover:border-orange-500/30 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all flex flex-col items-center justify-center text-slate-500 gap-2 min-h-[160px]"
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl text-orange-500 dark:text-orange-400">+</div>
            <span className="font-medium">Create New Parameter</span>
          </button>

          {parameters.map((param, index) => (
            <div 
                key={param.name}  
                draggable
                onDragStart={() => handleParamDragStart(index)}
                onDragOver={(e) => handleParamDragOver(e, index)}
                onDragEnd={handleParamDrop}
                className={`group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-orange-500/50 transition-all cursor-pointer relative overflow-hidden shadow-sm ${draggedParamIndex === index ? 'opacity-50' : ''}`}
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteParam(param.name); }}
                  className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-900 text-red-500 dark:text-red-400 rounded-lg border border-slate-200 dark:border-slate-700"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
                              </div>

              <div onClick={() => {
                loadParameter(param);
                navigate('/parameter-editor');
            }}>
                <div className="flex items-center gap-2 mb-2">
                    <FileText size={16} className="text-orange-500 dark:text-orange-400" />
                    <h4 className="font-bold text-lg text-slate-900 dark:text-white truncate">{param.name}</h4>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 rounded p-2 border border-slate-200 dark:border-slate-800 mb-2">
                    <pre className="text-[10px] text-slate-500 font-mono line-clamp-3 overflow-hidden">
                        {param.content}
                    </pre>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                    YAML Configuration
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      </div>
    </div>
  );
};
