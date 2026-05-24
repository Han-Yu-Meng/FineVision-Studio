
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Server, Network, Settings, Sun, Moon, Sparkles, Box, Layers, AlertCircle, CheckCircle, Info, X, ExternalLink, Bell, Trash2, CheckSquare, BarChart3, BellOff } from 'lucide-react';
import { useSystem } from '../context/SystemContext';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme, toggleTheme, notifications, removeNotification, clearNotifications, hasUnreadError, markNotificationsRead } = useSystem();
  const location = useLocation();
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const isEditor = location.pathname.startsWith('/editor');

  const isSidebarCollapsed = isEditor;

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [latestNotification, setLatestNotification] = useState<any>(null);
  const [isToastLeaving, setIsToastLeaving] = useState(false);
  const [removingNotifIds, setRemovingNotifIds] = useState<Set<string>>(new Set());
  const notifTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const prevNotifCount = useRef(notifications.length);

  useEffect(() => {
      if (notifications.length > prevNotifCount.current) {
          setIsRinging(true);
          setTimeout(() => setIsRinging(false), 1000);
      }
      prevNotifCount.current = notifications.length;

      if (notifications.length > 0) {
          const newest = notifications[0];
          if (Date.now() - newest.timestamp < 1000) {
              setLatestNotification(newest);
              setIsToastLeaving(false);
              if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
              notifTimeoutRef.current = setTimeout(() => {
                  setIsToastLeaving(true);
                  setTimeout(() => {
                      setLatestNotification(null);
                      setIsToastLeaving(false);
                  }, 300); // match pop-out duration
              }, 3000);
          }
      }
  }, [notifications]);

  const handleDismissToast = (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setIsToastLeaving(true);
      setTimeout(() => {
          setLatestNotification(null);
          setIsToastLeaving(false);
      }, 300);
  };

  const handleRemoveHistoryNotif = (id: string) => {
      setRemovingNotifIds(prev => new Set(prev).add(id));
      setTimeout(() => {
          removeNotification(id);
          setRemovingNotifIds(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
          });
      }, 300);
  };

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (notifPanelRef.current && !notifPanelRef.current.contains(event.target as Node) && !(event.target as Element).closest('#notif-bell')) {
              setIsNotifOpen(false);
          }
      };
      if (isNotifOpen) document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotifOpen]);

  const handleToggleNotif = () => {
      if (isNotifOpen) {
          setIsNotifOpen(false);
      } else {
          setIsNotifOpen(true);
          markNotificationsRead();
      }
  };

  const isActiveLink = (path: string, exact: boolean = false) => {
    if (exact) return location.pathname === path;
    
    if (path === '/agents') {
        return location.pathname === '/agents' || location.pathname === '/create-agent' || location.pathname.startsWith('/agent/');
    }
    if (path === '/dataflows') {
        return location.pathname === '/dataflows' || location.pathname.startsWith('/editor') || location.pathname.startsWith('/logs');
    }
    if (path === '/parameters') {
        return location.pathname === '/parameters' || location.pathname.startsWith('/parameter');
    }
    if (path === '/timeline') {
        return location.pathname === '/timeline';
    }
    if (path === '/packages') {
        return location.pathname === '/packages' || location.pathname.startsWith('/package/');
    }

    return location.pathname.startsWith(path);
  };

  const navLinkClass = (path: string, exact: boolean = false) => {
     const active = isActiveLink(path, exact);
     return `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        active
          ? 'bg-blue-600 text-white' 
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
      } ${isSidebarCollapsed ? 'justify-center' : ''}`;
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 relative z-20`}>
        <div className={`p-6 flex ${isSidebarCollapsed ? 'flex-col gap-4 items-center' : 'justify-between items-start'}`}>
          {!isSidebarCollapsed ? (
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-500 bg-clip-text text-transparent flex items-center gap-2">
                <img src="/assets/fins-lab.png" alt="Fins Lab" className="w-8 h-8 object-contain" />
                FineVision
              </h1>
            </div>
          ) : (
             <img src="/assets/fins-lab.png" alt="Fins Lab" className="w-8 h-8 object-contain mb-2" />
          )}
          
          <div className={`flex ${isSidebarCollapsed ? 'flex-col' : 'flex-row'} gap-2`}>
            <button
                onClick={toggleTheme}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <NavLink
            to="/agents"
            className={() => navLinkClass('/agents')}
            title={isSidebarCollapsed ? "Agents" : ""}
          >
            <Server size={20} />
            {!isSidebarCollapsed && <span>Agents</span>}
          </NavLink>
          <NavLink
            to="/dataflows"
            className={() => navLinkClass('/dataflows')}
            title={isSidebarCollapsed ? "Dataflows" : ""}
          >
            <Network size={20} />
            {!isSidebarCollapsed && <span>Dataflows</span>}
          </NavLink>
          <NavLink
            to="/parameters"
            className={() => navLinkClass('/parameters')}
            title={isSidebarCollapsed ? "Parameters" : ""}
          >
            <Settings size={20} />
            {!isSidebarCollapsed && <span>Parameters</span>}
          </NavLink>
          
          <NavLink
            to="/timeline"
            className={() => navLinkClass('/timeline')}
            title={isSidebarCollapsed ? "Timeline" : ""}
          >
            <BarChart3 size={20} />
            {!isSidebarCollapsed && <span>Timeline</span>}
          </NavLink>
          
          <div className="h-px bg-slate-200 dark:bg-slate-800 mx-4 my-2" />

          <NavLink
            to="/packages"
            className={() => navLinkClass('/packages')}
            title={isSidebarCollapsed ? "Local Packages" : ""}
          >
            <Box size={20} />
            {!isSidebarCollapsed && <span>Nodes</span>}
          </NavLink>

          <NavLink
            to="/hub"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`
            }
            title={isSidebarCollapsed ? "Package Hub" : ""}
          >
            <Layers size={20} />
            {!isSidebarCollapsed && <span>Hub</span>}
          </NavLink>

          <NavLink
            to="/llm"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`
            }
            title={isSidebarCollapsed ? "AI Architect" : ""}
          >
            <Sparkles size={20} />
            {!isSidebarCollapsed && <span>AI Architect</span>}
          </NavLink>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          {/* User section removed */}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 relative transition-colors duration-300">
        {children}

        {/* NOTIFICATION SYSTEM */}
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
            
            {/* 1. Transient Toast (Latest) */}
            {latestNotification && !isNotifOpen && (
                <div 
                    key={latestNotification.id}
                    className={`pointer-events-auto shadow-xl rounded-lg border backdrop-blur-md p-3 mb-2 flex items-center gap-3 max-w-[320px] cursor-pointer ${
                        isToastLeaving ? 'animate-pop-out' : 'animate-pop-in'
                    } ${
                        latestNotification.type === 'error' ? 'bg-red-50/95 dark:bg-red-950/95 border-red-200 dark:border-red-900 text-red-900 dark:text-red-100' :
                        latestNotification.type === 'success' ? 'bg-green-50/95 dark:bg-green-950/95 border-green-200 dark:border-green-900 text-green-900 dark:text-green-100' :
                        'bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
                    }`}
                    style={{ perspective: '1000px' }}
                    onClick={() => {
                        handleDismissToast();
                        setIsNotifOpen(true);
                    }}
                >
                    <div className="shrink-0">
                        {latestNotification.type === 'error' ? <AlertCircle size={18} /> : latestNotification.type === 'success' ? <CheckCircle size={18} /> : <Info size={18} />}
                    </div>
                    <div className="text-xs font-medium truncate flex-1">{latestNotification.message}</div>
                    <button onClick={handleDismissToast} className="opacity-50 hover:opacity-100"><X size={14}/></button>
                </div>
            )}

            {/* 2. Notification Panel (History) */}
            {isNotifOpen && (
                <div 
                    ref={notifPanelRef}
                    className="pointer-events-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-80 max-h-[400px] flex flex-col animate-in slide-in-from-bottom-2 zoom-in-95 duration-200 mb-2 origin-bottom-right"
                >
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-xl">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notifications</h4>
                        <button 
                            onClick={() => {
                                clearNotifications();
                                setIsNotifOpen(false);
                            }}
                            disabled={notifications.length === 0}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                            title="Clear All"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-300 dark:text-slate-700">
                                <BellOff size={32} strokeWidth={1.5} />
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div 
                                    key={n.id} 
                                    className={`relative group p-2.5 rounded-lg border flex gap-3 transition-colors ${
                                        removingNotifIds.has(n.id) ? 'animate-pop-out' : 'animate-pop-in'
                                    } ${
                                        n.type === 'error' ? 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' : 
                                        n.type === 'success' ? 'bg-green-50/50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30' :
                                        'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                                    }`}
                                    style={{ perspective: '1000px' }}
                                >
                                    <div className={`mt-0.5 shrink-0 ${
                                        n.type === 'error' ? 'text-red-500' : n.type === 'success' ? 'text-green-500' : 'text-blue-500'
                                    }`}>
                                        {n.type === 'error' ? <AlertCircle size={16} /> : n.type === 'success' ? <CheckCircle size={16} /> : <Info size={16} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-700 dark:text-slate-300 break-words leading-tight">{n.message}</p>
                                        <div className="flex justify-between items-center mt-1.5">
                                            <span className="text-[10px] text-slate-400">{new Date(n.timestamp).toLocaleTimeString()}</span>
                                            {n.link && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        console.log('[Notification] Navigating to:', n.link);
                                                        setIsNotifOpen(false); // Close panel before navigation
                                                        setTimeout(() => navigate(n.link!), 100); // Small delay to ensure panel closes
                                                    }}
                                                    className="text-[10px] flex items-center gap-1 text-blue-500 hover:underline"
                                                >
                                                    View <ExternalLink size={10} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleRemoveHistoryNotif(n.id)}
                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-opacity"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* 3. Floating Action Button (Bell) */}
            <button
                id="notif-bell"
                onClick={handleToggleNotif}
                className={`pointer-events-auto w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 relative ${
                    isNotifOpen 
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white' 
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                } ${isRinging ? 'scale-110 ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' : ''}`}
            >
                {isRinging && (
                    <span className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-25"></span>
                )}
                <Bell size={20} className={isRinging ? 'text-blue-600 dark:text-blue-400 animate-wiggle' : ''} />
                {hasUnreadError && !isNotifOpen && (
                    <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white dark:border-slate-800 rounded-full animate-pulse"></span>
                )}
            </button>
        </div>

      </main>
    </div>
  );
};
