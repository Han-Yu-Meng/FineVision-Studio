
import React from 'react';
import { Search } from 'lucide-react';

interface EditorSearchProps {
  showSearch: boolean;
  searchQuery: string;
  searchPosition: { x: number; y: number };
  searchResults: any[];
  addNode: (name: string, pos: { x: number; y: number }) => void;
  searchRef: React.RefObject<HTMLDivElement>;
}

export const EditorSearch: React.FC<EditorSearchProps> = ({
  showSearch,
  searchQuery,
  searchPosition,
  searchResults,
  addNode,
  searchRef
}) => {
  if (!showSearch) return null;

  return (
    <div 
      ref={searchRef}
      className="absolute z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-2xl w-64 overflow-hidden flex flex-col pointer-events-auto"
      style={{ left: searchPosition.x, top: searchPosition.y }}
    >
      <div className="p-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 bg-slate-100/50 dark:bg-slate-900/50">
        <Search size={14} className="text-slate-400" />
        <span className="text-sm text-slate-900 dark:text-white font-mono">{searchQuery}</span>
        <span className="ml-auto text-[10px] text-slate-500">ESC to close</span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {searchResults.length === 0 ? (
          <div className="p-3 text-xs text-slate-500 italic text-center">No matching nodes</div>
        ) : (
          searchResults.map((item) => (
            <button
              key={item.name}
              onClick={() => addNode(item.name, searchPosition)}
              className="w-full text-left p-2 hover:bg-blue-100 dark:hover:bg-blue-600/20 hover:text-blue-600 dark:hover:text-blue-200 text-slate-700 dark:text-slate-300 text-xs flex flex-col gap-0.5 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0"
            >
              <span className="font-bold">{item.name}</span>
              <span className="text-[10px] opacity-70 truncate w-full">{item.description}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
