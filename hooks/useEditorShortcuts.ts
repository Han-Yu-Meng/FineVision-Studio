
import React, { useEffect } from 'react';
import { Node, Edge, ReactFlowInstance } from '@xyflow/react';

interface EditorShortcutsProps {
  showSearch: boolean;
  setShowSearch: (show: boolean) => void;
  setSearchQuery: (query: React.SetStateAction<string>) => void;
  mousePositionRef: React.MutableRefObject<{ x: number; y: number }>; // Changed to ref
  setSearchPosition: (pos: { x: number; y: number }) => void;
  
  // React Flow props
  getNodes: () => Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
  
  // Actions
  handleSave: () => void;
  undo: () => void;
  redo: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  
  // Callbacks required for pasted nodes
  handleExternChange: any;
  handleIdChange: any;
  handleCollapseChange: any;
}

export const useEditorShortcuts = ({
  showSearch,
  setShowSearch,
  setSearchQuery,
  mousePositionRef, // Changed to ref
  setSearchPosition,
  getNodes,
  setNodes,
  screenToFlowPosition,
  handleSave,
  undo,
  redo,
  showToast: addNotification, // Renamed for consistency
  handleExternChange,
  handleIdChange,
  handleCollapseChange
}: EditorShortcutsProps) => {

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

        // Undo: Ctrl+Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !isInput) {
            e.preventDefault();
            undo();
            return;
        }

        // Redo: Ctrl+Y or Ctrl+Shift+Z
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && !isInput) {
            e.preventDefault();
            redo();
            return;
        }

        // Save: Ctrl+S or Cmd+S
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleSave();
            return;
        }

        // Copy: Ctrl+C or Cmd+C
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !isInput) {
            const selectedNodes = getNodes().filter(n => n.selected);
            if (selectedNodes.length > 0) {
                const clipboardData = {
                    type: 'fine-vision-nodes',
                    nodes: selectedNodes.map(n => ({
                        ...n,
                        selected: false,
                        data: { ...n.data } // Deep copy data to preserve externs
                    }))
                };
                const jsonString = JSON.stringify(clipboardData);

                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(jsonString);
                        addNotification(`Copied ${selectedNodes.length} nodes`, 'success');
                    } else {
                        throw new Error("Clipboard API unavailable");
                    }
                } catch (err) {
                    // Fallback to LocalStorage for non-HTTPS environments
                    try {
                        localStorage.setItem('fine-vision-clipboard', jsonString);
                        addNotification(`Copied ${selectedNodes.length} nodes (Internal)`, 'success');
                    } catch (storageErr) {
                        console.error('Copy failed', err);
                        addNotification('Copy failed', 'error');
                    }
                }
            }
            return;
        }

        // Paste: Ctrl+V or Cmd+V
        if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !isInput) {
            try {
                let text = '';
                
                // 1. Try System Clipboard
                try {
                    if (navigator.clipboard && navigator.clipboard.readText) {
                        text = await navigator.clipboard.readText();
                    }
                } catch (e) {
                    // Ignore system clipboard errors (permission denied or insecure context)
                }

                // 2. Fallback to Internal Clipboard (LocalStorage)
                if (!text) {
                    text = localStorage.getItem('fine-vision-clipboard') || '';
                }

                if (!text) return;
                
                const clipboardData = JSON.parse(text);
                if (clipboardData?.type === 'fine-vision-nodes' && Array.isArray(clipboardData.nodes)) {
                    const newNodes: Node[] = [];
                    
                    // Use mouse position from ref for paste center
                    const pasteCenter = screenToFlowPosition(mousePositionRef.current);
                    
                    // Calculate bounding box of copied nodes
                    const xs = clipboardData.nodes.map((n: any) => n.position.x);
                    const ys = clipboardData.nodes.map((n: any) => n.position.y);
                    const minX = Math.min(...xs);
                    const minY = Math.min(...ys);
                    
                    clipboardData.nodes.forEach((n: any) => {
                        const uniqueSuffix = `${Date.now().toString().slice(-4)}_${Math.random().toString(36).substr(2, 3)}`;
                        const baseId = n.data.label; 
                        const newId = `${baseId}_${uniqueSuffix}`;

                        // Calculate relative position
                        const relX = n.position.x - minX;
                        const relY = n.position.y - minY;

                        newNodes.push({
                            ...n,
                            id: newId,
                            position: { 
                                x: pasteCenter.x + relX, 
                                y: pasteCenter.y + relY 
                            },
                            data: {
                                ...n.data,
                                id: newId,
                                user_id: newId,
                                // Re-attach handlers
                                onExternChange: handleExternChange,
                                onIdChange: handleIdChange,
                                onCollapseChange: handleCollapseChange, 
                                // Reset runtime status
                                metrics: undefined,
                                logs: []
                            },
                            selected: true // Select the pasted nodes
                        });
                    });

                    setNodes(nds => (nds.map(n => ({...n, selected: false})) as Node[]).concat(newNodes));
                    addNotification(`Pasted ${newNodes.length} nodes`, 'success');
                }
            } catch (err) {
                // Ignore JSON parse errors
            }
            return;
        }

        // Ignore if typing in an input or textarea for search
        if (isInput) {
            return;
        }

        if (e.key === 'Escape') {
            setShowSearch(false);
            setSearchQuery('');
            return;
        }

        if (e.key === 'Backspace') {
            if (showSearch) {
                setSearchQuery(prev => {
                    const next = prev.slice(0, -1);
                    if (next.length === 0) setShowSearch(false);
                    return next;
                });
            }
            return;
        }

        if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (!showSearch) {
                setShowSearch(true);
                setSearchPosition(mousePositionRef.current); // Use ref
            }
            setSearchQuery(prev => prev + e.key);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, getNodes, screenToFlowPosition, handleExternChange, handleIdChange, addNotification, setNodes, handleSave, undo, redo, handleCollapseChange, setShowSearch, setSearchQuery, setSearchPosition]); // Removed mousePosition from dependencies
};
