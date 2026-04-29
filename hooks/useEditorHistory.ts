
import { useRef, useCallback, useEffect } from 'react';
import { Node, Edge } from '@xyflow/react';

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

export const useEditorHistory = (
  nodes: Node[], 
  edges: Edge[], 
  setNodes: (nodes: Node[]) => void, 
  setEdges: (edges: Edge[]) => void,
  addNotification: (msg: string, type?: 'success' | 'error' | 'info') => void
) => {
  const historyRef = useRef<HistoryState[]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      isUndoRedoRef.current = true;
      historyIndexRef.current -= 1;
      const state = historyRef.current[historyIndexRef.current];
      setNodes(state.nodes);
      setEdges(state.edges);
      addNotification('Undo', 'info');
      setTimeout(() => { isUndoRedoRef.current = false; }, 100);
    }
  }, [setNodes, setEdges, addNotification]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      isUndoRedoRef.current = true;
      historyIndexRef.current += 1;
      const state = historyRef.current[historyIndexRef.current];
      setNodes(state.nodes);
      setEdges(state.edges);
      addNotification('Redo', 'info');
      setTimeout(() => { isUndoRedoRef.current = false; }, 100);
    }
  }, [setNodes, setEdges, addNotification]);

  // Track changes
  useEffect(() => {
    if (isUndoRedoRef.current) return;
    // Skip if empty (initial state before load)
    if (nodes.length === 0 && edges.length === 0 && historyRef.current.length === 0) return;

    const handler = setTimeout(() => {
      const currentSnapshot = { nodes, edges };
      const lastSnapshot = historyRef.current[historyIndexRef.current];
      
      // Simple check to avoid duplicates using JSON stringify (ignores functions in data)
      const isSame = lastSnapshot && JSON.stringify(lastSnapshot) === JSON.stringify(currentSnapshot);

      if (!isSame) {
        const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        newHistory.push(currentSnapshot);
        if (newHistory.length > 50) newHistory.shift(); // Limit history size
        historyRef.current = newHistory;
        historyIndexRef.current = newHistory.length - 1;
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(handler);
  }, [nodes, edges]);

  return {
    undo,
    redo,
    // Helper to reset history when loading new flow
    resetHistory: (initialNodes: Node[], initialEdges: Edge[]) => {
      historyRef.current = [{ nodes: initialNodes, edges: initialEdges }];
      historyIndexRef.current = 0;
      isUndoRedoRef.current = false;
    }
  };
};
