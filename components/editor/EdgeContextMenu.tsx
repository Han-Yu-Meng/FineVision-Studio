
import React, { useRef, useEffect } from 'react';
import { Trash2, MonitorPlay, Layers, Gauge } from 'lucide-react';

interface EdgeContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onUpdate: (data: any) => void;
  onDelete: () => void;
  onViewPerformance: () => void;
  currentQueue: string;
  currentPriority: string;
  currentSchedule?: string; // Schedule string from target node input
}

export const EdgeContextMenu: React.FC<EdgeContextMenuProps> = ({
  x,
  y,
  onClose,
  onUpdate,
  onDelete,
  onViewPerformance,
  currentQueue,
  currentPriority,
  currentSchedule
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ top: y, left: x }}
      className="absolute z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl w-64 text-sm overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left pointer-events-auto"
    >
      <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300">
        Pipe Configuration
      </div>

      <div className="p-3 space-y-4">
        {/* Queue Strategy */}
        <div>
          <label className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase mb-1">
            <Layers size={12} /> Queue Strategy
          </label>
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded p-1">
            {['FCFS', 'LGFS'].map((q) => (
              <button
                key={q}
                onClick={() => onUpdate({ queue: q })}
                className={`flex-1 py-1 px-2 rounded text-xs font-bold transition-colors ${
                  currentQueue === q
                    ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase mb-1">
            <Gauge size={12} /> Priority
          </label>
          <div className="grid grid-cols-2 gap-1">
            {['Urgent', 'High', 'Medium', 'Low'].map((p) => (
              <button
                key={p}
                onClick={() => onUpdate({ priority: p })}
                className={`py-1 px-2 rounded text-xs font-bold transition-colors border ${
                  currentPriority === p
                    ? p === 'Urgent' ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                    : p === 'High' ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400'
                    : p === 'Medium' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                    : 'bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                    : 'border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800/50">
        <button
            onClick={onViewPerformance}
            className="w-full text-left px-3 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded flex items-center gap-2"
        >
            <MonitorPlay size={14} /> View Performance
        </button>
        <button
          onClick={onDelete}
          className="w-full text-left px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex items-center gap-2"
        >
          <Trash2 size={14} /> Delete Pipe
        </button>
      </div>
    </div>
  );
};
