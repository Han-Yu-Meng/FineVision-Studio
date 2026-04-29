import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { packageService } from '../services/packageService';
import { HubManifest } from '../types_pkg';
import { ArrowLeft, Box, Github, Copy, Check, BookOpen, Layers, ExternalLink, Download, Monitor, Terminal, Zap, Info, X, Code2, Cpu, Timer, RefreshCw, AlertTriangle, AlertOctagon, Send, Server, Target, Radio, ArrowRight, Play, RotateCw, FileCode } from 'lucide-react';
import { useSystem } from '../context/SystemContext';
import { InspectResult } from '../types_pkg';
import { TypeIcon, ServiceBadge, ActionBadge } from '../components/ServiceBadge';
import { MarkdownViewer } from '../components/MarkdownViewer';
import { PackageNodesView } from '../components/PackageNodesView';

const REPO_URL = "https://cdn.jsdelivr.net/gh/Han-Yu-Meng/FineVision-Source@main/repo_manifest.yaml"; 

export const HubPackageDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addNotification } = useSystem();
    const [loading, setLoading] = useState(true);
    const [manifest, setManifest] = useState<HubManifest | null>(null);
    const [copied, setCopied] = useState(false);
    const [readme, setReadme] = useState<string>("");
    const [readmeLoading, setReadmeLoading] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [isError, setIsError] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [installed, setInstalled] = useState(false);
    const [sysInfo, setSysInfo] = useState<{ os: string, arch: string } | null>(null);

    // Tab State
    const [activeTab, setActiveTab] = useState<'readme' | 'nodes'>('readme');
    
    // Inspect State
    const [inspectData, setInspectData] = useState<InspectResult[] | null>(null);
    const [inspectLoading, setInspectLoading] = useState(false);
    const [inspectError, setInspectError] = useState<string | null>(null);
    const [showDependencies, setShowDependencies] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent.toLowerCase();
        let arch = "amd64";
        if (ua.includes("arm") || ua.includes("aarch64")) arch = "arm64";
        
        let os = "Ubuntu-22.04"; 
        
        if (ua.includes("ubuntu")) {
            if (ua.includes("20.04")) os = "Ubuntu-20.04";
            else if (ua.includes("24.04")) os = "Ubuntu-24.04";
        }
        
        setSysInfo({ os, arch });
    }, []);

    useEffect(() => {
        packageService.fetchHubManifest(REPO_URL)
            .then(setManifest)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const pkg = useMemo(() => {
        if (!manifest || !id) return null;
        return manifest.packages[id];
    }, [manifest, id]);

    // Check installation status
    useEffect(() => {
        if (pkg?.url && id) {
            packageService.checkPluginInstalled(pkg.url, id)
                .then(setInstalled)
                .catch(() => setInstalled(false));
        }
    }, [pkg, id]);

    // 获取 branch，默认 main
    const branch = pkg?.branch || "main";

    const jsDelivrBaseUrl = useMemo(() => {
        if (!pkg?.url) return null;
        const match = pkg.url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (match) {
            return `https://cdn.jsdelivr.net/gh/${match[1]}/${match[2]}@${branch}`;
        }
        return null;
    }, [pkg, branch]);

    useEffect(() => {
        if (pkg?.url) {
            setReadmeLoading(true);
            const rawUrl = pkg.url
                .replace('github.com', 'raw.githubusercontent.com')
                .concat(`/${branch}/README.md`);

            fetch(rawUrl)
                .then(res => res.text())
                .then(text => {
                    if (text.includes("404: Not Found") && branch !== "main") {
                        const fallbackUrl = pkg.url.replace('github.com', 'raw.githubusercontent.com').concat('/main/README.md');
                        return fetch(fallbackUrl).then(r => r.text());
                    }
                    return text;
                })
                .catch(() => "Failed to load README.")
                .then(setReadme)
                .finally(() => setReadmeLoading(false));
        }
    }, [pkg, branch]);

    const cloneCommand = useMemo(() => {
        if (!pkg || !id) return "";
        const branchArg = branch ? `-b ${branch} ` : "";
        return `git clone ${branchArg}${pkg.url} ${id} --recursive`;
    }, [pkg, id, branch]);

    const handleCopy = () => {
        navigator.clipboard.writeText(cloneCommand).then(() => {
            setCopied(true);
            addNotification({ message: "Clone command copied", type: "success" });
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleInstall = async () => {
        setInstalling(true);
        setIsError(false);
        setIsSuccess(false);
        try {
            if (!pkg?.url) throw new Error("Package URL not found");
            
            await packageService.installPlugin(pkg.url, (chunk) => {
                console.log("Install output:", chunk);
            });
            
            setIsSuccess(true);
            addNotification({ message: `Successfully installed ${id}`, type: "success" });
            
            if (activeTab === 'nodes') fetchInspectData();
        } catch (e: any) {
            setIsError(true);
            addNotification({ message: e.message || "Installation failed", type: "error" });
        } finally {
            setInstalling(false);
        }
    };

    const fetchInspectData = async () => {
        if (!id) return;
        setInspectLoading(true);
        setInspectError(null);
        try {
            const match = pkg?.url.match(/github\.com\/([^/]+)\/([^/]+)/);
            if (match) {
                const owner = match[1];
                const repo = match[2];
                
                const exactPath = `libGithub@${owner}@${repo}_${id}.so`;
                
                try {
                    const res = await fetch(`/api/fins/inspect/file?path=${encodeURIComponent(exactPath)}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.length > 0) {
                            setInspectData(data);
                        } else {
                            setInspectError("Binary file analysis returned no nodes.");
                        }
                    } else {
                        setInspectError("Binary file not found. Ensure the package is installed and compiled.");
                    }
                } catch (innerE) {
                    setInspectError("Failed to connect to inspection service.");
                }
            } else {
                setInspectError("Invalid package URL.");
            }
        } catch (e: any) {
            console.error("Failed to inspect package", e);
            setInspectError(e.message || "Analysis failed");
        } finally {
            setInspectLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'nodes' && !inspectData) {
            fetchInspectData();
        }
    }, [activeTab]);

    if (loading) return <div className="p-8 text-center text-slate-500">Loading details...</div>;
    if (!pkg) return <div className="p-8 text-center text-slate-500">Package not found in Hub</div>;

    const iconUrl = pkg.icon || (() => {
        const match = pkg.url.match(/github\.com\/([^/]+)\/([^/]+)/);
        return match ? `https://cdn.jsdelivr.net/gh/${match[1]}/${match[2]}/assets/logo.png` : null;
    })();

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-y-auto relative">
            
            {/* 1. Header Section */}
            <div className="p-8 bg-white dark:bg-slate-900 pb-6">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 mb-6 transition-colors text-sm font-medium">
                    <ArrowLeft size={16} /> Back
                </button>

                <div className="flex gap-6 items-start">
                    <div className="w-32 h-32 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm overflow-hidden p-4 shrink-0">
                        {iconUrl ? (
                            <img 
                                src={iconUrl} 
                                alt={id} 
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    if (img.src.endsWith('.png')) img.src = img.src.replace('.png', '.jpg');
                                    else img.parentElement!.innerHTML = '<div class="text-slate-300"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></div>';
                                }}
                            />
                        ) : <Box size={48} className="text-slate-300" />}
                    </div>
                    
                    <div className="flex-1 min-w-0 pt-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white truncate">
                                {id}
                            </h1>
                            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-xs font-bold uppercase border border-purple-200 dark:border-purple-800">
                                {pkg.category}
                            </span>
                            {branch && (
                                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-xs font-bold uppercase border border-blue-200 dark:border-blue-800">
                                    branch: {branch}
                                </span>
                            )}
                            {/* Node Count */}
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
                        </div>
                        
                        <p className="text-base text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed mb-6">
                            {pkg.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-3">
                            <button 
                                onClick={handleInstall}
                                disabled={installing}
                                className={`group flex items-center gap-2 px-4 py-2 ${
                                    isSuccess || installed
                                    ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20'
                                    : isError 
                                    ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' 
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                                } disabled:bg-slate-400 text-white rounded-lg font-semibold text-sm transition-all active:scale-95 shadow-sm`}
                                title={`Detected: ${sysInfo?.os}-${sysInfo?.arch}`}
                            >
                                {installing ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (isSuccess || installed) ? (
                                    <Check size={16} />
                                ) : isError ? (
                                    <X size={16} />
                                ) : (
                                    <Download size={16} className="group-hover:translate-y-0.5 transition-transform" />
                                )}
                                <span>
                                    {(isSuccess || installed) ? "Installed" : `Install ${sysInfo?.os}-${sysInfo?.arch}`}
                                </span>
                            </button>

                            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

                            <a 
                                href={pkg.url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
                            >
                                <Github size={14} />
                                <span>GitHub</span>
                            </a>
                            
                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 pr-3 border border-slate-200 dark:border-slate-700">
                                <div className="px-3 py-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                    {cloneCommand}
                                </div>
                                <button 
                                    onClick={handleCopy}
                                    className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-slate-900"
                                >
                                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Sticky Tab Bar */}
            <div className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-8 flex justify-between items-center shadow-sm">
                <div className="flex gap-6">
                    <button 
                        onClick={() => setActiveTab('readme')}
                        className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'readme' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <BookOpen size={16} /> README
                    </button>
                    
                    <button 
                        onClick={() => setActiveTab('nodes')}
                        className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'nodes' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <Code2 size={16} /> Nodes
                    </button>
                </div>
            </div>

            {/* 3. Content Section */}
            <div className="flex-1 p-8 max-w-7xl mx-auto w-full">
                {activeTab === 'readme' && (
                    <MarkdownViewer 
                        content={readme} 
                        baseUrl={jsDelivrBaseUrl} 
                    />
                )}

                {activeTab === 'nodes' && (
                    <PackageNodesView 
                        inspectData={inspectData || []}
                        inspectLoading={inspectLoading}
                        inspectError={inspectError}
                        onRefresh={fetchInspectData}
                        emptyMessage="No node definitions found. Install and compile the package to generate binary analysis."
                    />
                )}
            </div>
        </div>
    );
};

