
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { packageService } from '../services/packageService';
import { useSystem } from '../context/SystemContext';
import { Package, InspectResult } from '../types_pkg';
import { 
    ArrowLeft, Box, Shield, BookOpen, AlertCircle, AlertTriangle, Terminal, Code2, RotateCw, RefreshCw, Play, Cpu, Timer, FileCode, Layers, Info, Copy, Check, Download, AlertOctagon, Send, Server, Target, Radio, ArrowRight
} from 'lucide-react';
import { LogViewer } from '../components/LogViewer';
import { ServiceBadge, ActionBadge, TypeIcon } from '../components/ServiceBadge';
import { MarkdownViewer } from '../components/MarkdownViewer';
import { PackageNodesView } from '../components/PackageNodesView';

const REPO_URL = "https://cdn.jsdelivr.net/gh/Han-Yu-Meng/FineVision-Source@main/repo_manifest.yaml"; 

export const PackageDetail: React.FC = () => {
    const { source, name } = useParams<{ source: string; name: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    const [pkg, setPkg] = useState<Package | null>(null);
    const [loading, setLoading] = useState(true);
    const [repoBaseUrl, setRepoBaseUrl] = useState<string | null>(null);
    
    const [activeTab, setActiveTab] = useState<'readme' | 'compilation' | 'nodes'>('readme');
    
    const [historicalLogs, setHistoricalLogs] = useState<string>("");
    
    const logScrollRef = useRef<HTMLDivElement>(null);
    const shouldAutoScrollRef = useRef<boolean>(true);

    const { theme, compilationState, startCompilePackage, addNotification } = useSystem();

    const pkgId = useMemo(() => {
        if (!name || !source) return '';
        return `${decodeURIComponent(source)}/${name}`;
    }, [source, name]);

    const remoteBaseUrl = useMemo(() => {
        if (!repoBaseUrl) return null;
        if (repoBaseUrl.includes('raw.githubusercontent.com')) {
            return repoBaseUrl
                .replace('raw.githubusercontent.com', 'cdn.jsdelivr.net/gh')
                .replace(/\/([^/]+)\/([^/]+)\/([^/]+)/, '/$1/$2@$3');
        }
        return repoBaseUrl;
    }, [repoBaseUrl]);

    const liveState = compilationState[pkgId || ''];
    const isCompiling = liveState?.status === 'compiling';
    const prevStatusRef = useRef<string>('idle');

    const handleLogScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 10;
        shouldAutoScrollRef.current = isAtBottom;
    };

    useEffect(() => {
        if (activeTab === 'compilation' && shouldAutoScrollRef.current && logScrollRef.current) {
            logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
        }
    }, [historicalLogs, liveState?.logs, activeTab]);
    
    const [inspectData, setInspectData] = useState<InspectResult[] | null>(null);
    const [inspectLoading, setInspectLoading] = useState(false);
    const [inspectError, setInspectError] = useState<string | null>(null);
    const [showDependencies, setShowDependencies] = useState(false);

    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'logs') setActiveTab('compilation'); 
        else if (tab === 'compilation') setActiveTab('compilation');
        else if (tab === 'nodes') setActiveTab('nodes');
    }, [searchParams]);

    const fetchLogs = useCallback(async () => {
        if (!name || !source) return;
        try {
            const logs = await packageService.getCompileLog(`${decodeURIComponent(source)}/${name}`);
            setHistoricalLogs(logs);
        } catch (e) {
            console.error("Failed to fetch logs", e);
        }
    }, [name, source]);

    const fetchInspectData = useCallback(async () => {
        if (!name || !source) return;
        setInspectLoading(true);
        setInspectError(null);
        try {
            const fullId = `${decodeURIComponent(source)}/${name}`;
            const data = await packageService.inspectPackage(fullId);
            setInspectData(data);
        } catch (e: any) {
            console.error("Failed to inspect package", e);
            if (e.message === "BINARY_NOT_FOUND") {
                setInspectError("Binary not found");
            } else {
                setInspectError(e.message || "Analysis failed");
            }
        } finally {
            setInspectLoading(false);
        }
    }, [name, source]);

    useEffect(() => {
        if (!name || !source) return;
        
        const load = async () => {
            setLoading(true);
            setRepoBaseUrl(null); 
            try {
                const localData = await packageService.getPackageDetail(name, decodeURIComponent(source));
                
                let base = "";

                if (localData.source && localData.source.startsWith('github@')) {
                    const repoPath = localData.source.replace('github@', '');
                    base = `https://cdn.jsdelivr.net/gh/${repoPath}@main`;
                }

                if (!base) {
                    try {
                        const manifest = await packageService.fetchHubManifest(REPO_URL);
                        const hubPkg = manifest.packages[name];
                        if (hubPkg && hubPkg.url && hubPkg.url.includes('github.com')) {
                            base = hubPkg.url.replace("github.com", "cdn.jsdelivr.net/gh").replace(".git", "") + "@main";
                        }
                    } catch (e) {
                    }
                }

                if (!base) {
                    base = `/api/fins/package/asset/${localData.meta.name}`;
                }

                setRepoBaseUrl(base);
                setPkg(localData);
                
                packageService.getCompileLog(`${decodeURIComponent(source)}/${name}`).then(setHistoricalLogs).catch(() => {});
            } catch (e) {
                console.error(e);
                setPkg(null);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [name, source]);

    
    useEffect(() => {
        const currentStatus = liveState?.status || 'idle';
        if (prevStatusRef.current === 'compiling' && currentStatus !== 'compiling') {
            fetchLogs();
            setInspectError(null);
            fetchInspectData();
        }
        prevStatusRef.current = currentStatus;
    }, [liveState?.status, fetchLogs, fetchInspectData]);

    useEffect(() => {
        if (activeTab === 'nodes') {
            fetchInspectData();
        }
    }, [activeTab, fetchInspectData]);

    const displayLogs = isCompiling ? (liveState?.logs?.join('') || '') : (liveState?.logs?.length ? liveState.logs.join('') : historicalLogs);
    
    useEffect(() => {
        if (!pkgId) return;

        let interval: NodeJS.Timeout | null = null;

        const refresh = async () => {
            try {
                const logs = await packageService.getCompileLog(pkgId);
                if (logs) {
                    setHistoricalLogs(logs);
                    
                    if (!isCompiling) {
                        const isError = logs.includes('error:') || logs.includes('FAILED');
                        const isSuccess = logs.includes('Built target') || logs.includes('Finished');
                    }
                }
            } catch (e) {
                console.error("Auto-refresh failed", e);
            }
        };

        const delay = isCompiling ? 1000 : 5000;
        
        refresh();
        
        interval = setInterval(refresh, delay);

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [pkgId, isCompiling]);

    const handleCopyTitle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!pkgId) return;
        const text = pkgId; 

        const fallbackCopy = (text: string) => {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                textarea.style.top = '0';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textarea);
                if (successful) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                } else {
                    addNotification({ message: 'Copy failed (fallback)', type: 'error' });
                }
            } catch (err) {
                console.error("Fallback copy failed", err);
                addNotification({ message: 'Copy failed', type: 'error' });
            }
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }).catch(err => {
                console.warn("Clipboard API failed, trying fallback", err);
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    };

    const handleCompile = () => {
        if (pkg && pkgId) {
            startCompilePackage(pkgId);
            setActiveTab('compilation');
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading details...</div>;
    if (!pkg) return <div className="p-8 text-center text-slate-500">Package not found</div>;

    const { meta, readme_content, icon_path } = pkg;
    const iconUrl = icon_path ? `/api/fins/package/asset/${meta.name}/${icon_path.replace(/^\/+/, '')}` : null;

    // --- Status Capsules Logic ---
    const getStatusCapsules = () => {
        const capsules = [];

        // 1. Compilation Status
        const status = liveState?.status || pkg.status || 'Uncompiled';
        const errorCount = liveState?.errorCount || 0;
        // Count warnings from logs roughly
        const warningCount = (displayLogs.match(/warning:/gi) || []).length;

        if (status === 'compiling') {
            capsules.push(
                <div key="status" className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-xs font-bold border border-blue-200 dark:border-blue-800">
                    <RotateCw size={12} className="animate-spin" /> Compiling...
                </div>
            );
        } else if (status === 'error' || errorCount > 0) {
            capsules.push(
                <div key="status" className="flex items-center gap-1.5 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-xs font-bold border border-red-200 dark:border-red-800">
                    <AlertCircle size={12} /> {errorCount} Errors
                </div>
            );
        } else if (status === 'success' || (status as string) === 'Ready') {
            capsules.push(
                <div key="status" className="flex items-center gap-1.5 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md text-xs font-bold border border-green-200 dark:border-green-800">
                    <Check size={12} /> Success
                </div>
            );
        }

        if (warningCount > 0) {
            capsules.push(
                <div key="warn" className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-md text-xs font-bold border border-amber-200 dark:border-amber-800">
                    <AlertTriangle size={12} /> {warningCount} Warnings
                </div>
            );
        }

        // 2. Inspect Fail Status
        const hasInspectDataError = inspectData?.some(r => r.status === 'ERROR');
        if (inspectError || hasInspectDataError) {
             capsules.push(
                <div key="inspect-err" className="flex items-center gap-1.5 px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-xs font-bold border border-red-200 dark:border-red-800">
                    <AlertOctagon size={12} /> Inspect Failed
                </div>
            );
        }

        return capsules;
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-y-auto relative">
            
            <div className="p-8 bg-white dark:bg-slate-900 pb-6">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 mb-6 transition-colors text-sm font-medium">
                    <ArrowLeft size={16} /> Back
                </button>

                <div className="flex gap-6 items-start">
                    <div className="w-32 h-32 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm overflow-hidden p-4 shrink-0">
                        {iconUrl ? <img src={iconUrl} alt={meta.name} className="w-full h-full object-contain" /> : <Box size={48} className="text-slate-300" />}
                    </div>
                    
                    <div className="flex-1 min-w-0 pt-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 text-left break-all select-text">
                                {pkgId}
                            </h1>
                            
                            <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full font-mono text-sm font-medium border border-slate-200 dark:border-slate-700">
                                v{meta.version}
                            </span>

                            {(() => {
                                const nodeCount = inspectData?.reduce((acc, curr) => acc + (curr.nodes?.length || 0), 0) || 0;
                                if (nodeCount > 0) {
                                    return (
                                        <div key="nodes" className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs font-bold border border-slate-200 dark:border-slate-700">
                                            <Box size={12} /> {nodeCount} Nodes
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {meta.licenses && meta.licenses.length > 0 && (
                                <div key="license" className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs font-bold border border-slate-200 dark:border-slate-700">
                                    <Shield size={12} /> {meta.licenses.join(', ')}
                                </div>
                            )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                            {getStatusCapsules()}
                        </div>

                        <p className="text-base text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
                            {meta.description || "No description provided."}
                        </p>
                    </div>
                </div>
            </div>

            <div className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-8 flex justify-between items-center shadow-sm">
                <div className="flex gap-6">
                    <button 
                        onClick={() => setActiveTab('readme')}
                        className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'readme' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <BookOpen size={16} /> README
                    </button>
                    
                    <button 
                        onClick={() => setActiveTab('compilation')}
                        className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'compilation' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <Terminal size={16} /> Compilation
                    </button>
                    
                    <button 
                        onClick={() => setActiveTab('nodes')}
                        className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'nodes' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <Code2 size={16} /> Nodes
                    </button>
                </div>

                <div className="py-2">
                    <button 
                        onClick={handleCompile}
                        disabled={isCompiling}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95 ${
                            isCompiling 
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                    >
                        {isCompiling ? <RotateCw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                        {isCompiling ? 'Compiling...' : 'Compile'}
                    </button>
                </div>
            </div>

            <div className="flex-1 p-8 max-w-7xl mx-auto w-full">
                {activeTab === 'readme' && (
                    <MarkdownViewer 
                        content={readme_content} 
                        baseUrl={remoteBaseUrl} 
                    />
                )}

                {activeTab === 'compilation' && (
                    <LogViewer 
                        logs={displayLogs} 
                        title="Compilation Output" 
                        subtitle={isCompiling ? "Compiling..." : "Build finished"}
                        className="min-h-[600px]"
                    />
                )}

                {activeTab === 'nodes' && (
                    <PackageNodesView 
                        inspectData={inspectData}
                        inspectLoading={inspectLoading}
                        inspectError={inspectError}
                        onRefresh={fetchInspectData}
                        emptyMessage="No node definitions found. Compile the package to generate binary analysis."
                    />
                )}
            </div>
        </div>
    );
};

