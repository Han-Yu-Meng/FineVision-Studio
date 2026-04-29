
import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { Agent } from '../../types';

interface EditorSidebarProps {
  config: { name: string; description: string };
  setConfig: (config: { name: string; description: string }) => void;
  isDirty: boolean;
  agents: Agent[];
  selectedAgentId: string;
  setSelectedAgentId: (id: string) => void;
  groupedCapabilities: Record<string, any[]>;
  expandedCategories: Record<string, boolean>;
  toggleCategory: (cat: string) => void;
  isSidebarCollapsed: boolean;
}

// Data Structure for the Tree
interface CategoryNode {
  name: string;
  fullPath: string;
  items: any[];
  children: Record<string, CategoryNode>;
}

// Recursive Component for Rendering Tree
const CategoryItem: React.FC<{
  node: CategoryNode;
  level: number;
  expandedCategories: Record<string, boolean>;
  toggleCategory: (cat: string) => void;
}> = ({ node, level, expandedCategories, toggleCategory }) => {
  const isExpanded = expandedCategories[node.fullPath];
  const hasChildren = Object.keys(node.children).length > 0;
  const hasItems = node.items.length > 0;
  const isEmpty = !hasChildren && !hasItems;

  if (isEmpty && level === 0) return null; 

  return (
    <div className="select-none">
      <button 
        onClick={() => toggleCategory(node.fullPath)}
        className={`flex items-center gap-1.5 text-xs font-bold w-full hover:text-blue-500 dark:hover:text-blue-300 transition-colors py-1 ${level > 0 ? 'ml-2' : ''} ${isExpanded ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}
        style={{ paddingLeft: `${level * 8}px` }}
      >
        <span className="opacity-70">
           {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className="opacity-80">
            {isExpanded ? <FolderOpen size={12} /> : <Folder size={12} />}
        </span>
        <span>{node.name}</span>
      </button>

      {isExpanded && (
        <div className="border-l border-slate-200 dark:border-slate-800 ml-3.5 my-1">
          {Object.entries(node.children)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, childNode]) => (
              <CategoryItem 
                key={(childNode as CategoryNode).fullPath}
                node={childNode as CategoryNode}
                level={level + 1}
                expandedCategories={expandedCategories}
                toggleCategory={toggleCategory}
              />
            ))
          }

          {node.items.map((item: any) => (
            <div 
              key={item.name}
              draggable
              onDragStart={(event) => event.dataTransfer.setData('application/reactflow', item.name)}
              className="group ml-3 mb-1 p-2 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:border-blue-500/50 hover:bg-white dark:hover:bg-slate-800 cursor-grab active:cursor-grabbing text-xs transition-all"
            >
              <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  {item.name}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {item.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  config,
  setConfig,
  isDirty,
  agents,
  selectedAgentId,
  setSelectedAgentId,
  groupedCapabilities,
  expandedCategories,
  toggleCategory,
  isSidebarCollapsed
}) => {
  
  // Transform flat groupedCapabilities into a Tree
  const categoryTree = useMemo(() => {
    const root: Record<string, CategoryNode> = {};

    Object.entries(groupedCapabilities).forEach(([fullPath, items]) => {
        // e.g. fullPath = "Vision>Calibration"
        const parts = fullPath.split('>'); // ["Vision", "Calibration"]
        
        let currentLevel = root;

        parts.forEach((part, index) => {
            const isLeafCategory = index === parts.length - 1;
            const currentPath = parts.slice(0, index + 1).join('>');

            if (!currentLevel[part]) {
                currentLevel[part] = {
                    name: part,
                    fullPath: currentPath,
                    items: [], 
                    children: {}
                };
            }

            if (isLeafCategory) {
                // If this is the exact category string from the flat map, assign items
                currentLevel[part].items = items as any[];
            }

            // Move deeper
            currentLevel = currentLevel[part].children;
        });
    });

    return root;
  }, [groupedCapabilities]);

  return (
    <div className={`${!isSidebarCollapsed ? 'w-64 border-r' : 'w-0 border-none'} bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 transition-all duration-300 overflow-hidden flex flex-col`}>
      <div className="w-64 h-full p-4 flex flex-col gap-4 select-none">
        <div>
          <div className="flex flex-col gap-1">
            <div className="relative">
              <input 
                className="w-full bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-blue-500 focus:bg-slate-50 dark:focus:bg-slate-800 text-slate-900 dark:text-slate-200 p-1.5 rounded text-2xl font-bold focus:outline-none transition-all placeholder-slate-400"
                placeholder="Name"
                value={config.name}
                onChange={e => setConfig({...config, name: e.target.value})}
              />
            </div>
            <textarea 
              className="w-full bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-blue-500 focus:bg-slate-50 dark:focus:bg-slate-800 text-slate-500 dark:text-slate-400 p-1.5 rounded text-xs focus:outline-none resize-none transition-all placeholder-slate-400/50"
              placeholder="Description..."
              rows={2}
              value={config.description}
              onChange={e => setConfig({...config, description: e.target.value})}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Target Agent</label>
          <select 
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 p-2 rounded mt-1"
            value={selectedAgentId}
            onChange={e => setSelectedAgentId(e.target.value)}
          >
            {agents.map(a => {
                return <option key={a.id} value={a.id}>{a.id} ({a.status})</option>
            })}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Available Nodes</label>
          
          {Object.keys(categoryTree).length === 0 && (
            <div className="text-xs text-slate-500 italic">Select an active agent to see nodes.</div>
          )}

          {Object.values(categoryTree)
            .sort((a: CategoryNode, b: CategoryNode) => a.name.localeCompare(b.name))
            .map((node: CategoryNode) => (
                <CategoryItem 
                    key={node.fullPath}
                    node={node}
                    level={0}
                    expandedCategories={expandedCategories}
                    toggleCategory={toggleCategory}
                />
            ))
          }
        </div>
      </div>
    </div>
  );
};