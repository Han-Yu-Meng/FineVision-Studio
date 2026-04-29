
import React, { useEffect, useState } from 'react';
import { packageService } from '../services/packageService';
import { HubPackageDef, HubManifest } from '../types_pkg';
import { Search, Download, ExternalLink, Box, Tag, Layers, Star, Github, RefreshCw, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSystem } from '../context/SystemContext';

const REPO_URL = "https://cdn.jsdelivr.net/gh/Han-Yu-Meng/FineVision-Source@main/repo_manifest.yaml"; 
const REPO_API = "https://api.github.com/repos/Han-Yu-Meng/FineVision-Source";
const PURGE_URL = "https://purge.jsdelivr.net/gh/Han-Yu-Meng/FineVision-Source@main/repo_manifest.yaml";

export const PackageHub: React.FC = () => {
    const [manifest, setManifest] = useState<HubManifest | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [stars, setStars] = useState<number | null>(null);
    const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({});
    const navigate = useNavigate();
    const { addNotification } = useSystem();

    const fetchManifest = async () => {
        setLoading(true);
        try {
            const urlWithTs = REPO_URL + (REPO_URL.includes('?') ? '&' : '?') + 'ts=' + Date.now();
            const data = await packageService.fetchHubManifest(urlWithTs);
            setManifest(data);
            
            if (data.packages) {
                const checkStatus = async () => {
                    const statusEntries = await Promise.all(
                        Object.entries(data.packages).map(async ([id, pkg]) => {
                            try {
                                const isInstalled = await packageService.checkPluginInstalled(pkg.url, id);
                                return [id, isInstalled];
                            } catch (e) {
                                return [id, false];
                            }
                        })
                    );
                    setInstalledMap(Object.fromEntries(statusEntries));
                };
                checkStatus();
            }
        } catch (e) {
            console.error(e);
            addNotification({ message: "Failed to fetch hub manifest", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchManifest();

        fetch(REPO_API)
            .then(res => res.json())
            .then(data => {
                if (data.stargazers_count !== undefined) {
                    setStars(data.stargazers_count);
                }
            })
            .catch(e => console.warn("Failed to fetch repo stats", e));
    }, []);

    const handleRefreshCache = async () => {
        setRefreshing(true);
        try {
            await fetch(PURGE_URL);
            
            await fetchManifest();
            
            addNotification({ message: "Hub source updated successfully", type: "success" });
        } catch (e) {
            console.error(e);
            addNotification({ message: "Refresh failed", type: "error" });
        } finally {
            setRefreshing(false);
        }
    };

    const packages = manifest ? Object.entries(manifest.packages).map(([id, def]) => ({ 
        id, 
        ...def,
        display_name: def.display_name || id
    })) : [];
    
    const filtered = packages.filter(p => 
        p.display_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.tags || []).some((t: string) => t.toLowerCase().includes(searchTerm.toLowerCase())) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const grouped: Record<string, typeof filtered> = {};
    filtered.forEach(p => {
        if (!grouped[p.category]) grouped[p.category] = [];
        grouped[p.category].push(p);
    });

    const getJsdelivrIcon = (repoUrl: string) => {
        if (!repoUrl) return null;
        const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (match) {
            return `https://cdn.jsdelivr.net/gh/${match[1]}/${match[2]}/assets/logo.png`;
        }
        return null;
    };

    return (
        <div className="p-6 h-full flex flex-col gap-6 relative bg-slate-50 dark:bg-slate-950 overflow-y-auto">
            <div className="max-w-7xl mx-auto w-full space-y-6">
             <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl shadow-lg">
                        <Layers className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Package Hub
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">Discover community nodes</p>
                    </div>
                </div>
                {manifest && (
                    <div className="flex items-center gap-2">
                        <a 
                            href="https://github.com/Han-Yu-Meng/FineVision-Source" 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-yellow-400 transition-colors group shadow-sm"
                        >
                             <Github size={12} />
                             <span>GitHub</span>
                             {stars !== null && (
                                 <>
                                    <span className="w-px h-3 bg-slate-200 dark:bg-slate-700 mx-1"></span>
                                    <div className="flex items-center gap-1">
                                        <Star size={10} className="text-slate-400 group-hover:text-yellow-500 group-hover:fill-yellow-500 transition-all" />
                                        <span className="font-bold font-mono">{stars}</span>
                                    </div>
                                 </>
                             )}
                        </a>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRefreshCache();
                            }}
                            disabled={refreshing}
                            className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-xs font-medium text-slate-400 hover:text-blue-500 hover:border-blue-500/50 transition-all shadow-sm disabled:opacity-50"
                        >
                            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                            <span>{refreshing ? 'Updating...' : 'Refresh Hub'}</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                    placeholder="Search hub..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-slate-400">Loading catalog...</div>
            ) : (
                <div className="space-y-8 pb-4">
                    {Object.entries(grouped).map(([category, items]) => (
                        <div key={category}>
                             <div className="flex items-center gap-2 mb-4 px-1">
                                <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                    {category}
                                </span>
                                <span className="text-slate-400 text-sm">{items.length} packages</span>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                {items.map((pkg: any) => {
                                    const iconUrl = pkg.icon || getJsdelivrIcon(pkg.url);
                                    return (
                                        <div 
                                            key={pkg.id} 
                                            onClick={() => navigate(`/hub/package/${encodeURIComponent(pkg.id)}`)}
                                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 flex flex-col gap-4 hover:border-purple-500 dark:hover:border-purple-500 transition-all shadow-sm group relative cursor-pointer"
                                        >
                                            <div className="flex items-start gap-4 h-full relative">
                                                <div className="w-16 h-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                                                    {iconUrl ? (
                                                        <img 
                                                            src={iconUrl} 
                                                            alt={pkg.display_name} 
                                                            className="w-full h-full object-contain" 
                                                            onError={(e) => {
                                                                const img = e.target as HTMLImageElement;
                                                                if (img.src.endsWith('.png')) {
                                                                    img.src = img.src.replace('.png', '.jpg');
                                                                } else if (!img.dataset.failed) {
                                                                    img.dataset.failed = 'true';
                                                                    img.parentElement!.innerHTML = '<div class="text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-box"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></div>';
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        <Box className="text-slate-400" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex flex-col gap-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm">{pkg.display_name}</h3>
                                                                {(pkg.tags || []).slice(0, 2).map((tag: string) => (
                                                                    <span key={tag} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded font-medium border border-slate-200 dark:border-slate-700">
                                                                        <Tag size={10} /> {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {installedMap[pkg.id] && (
                                                                <div className="p-1 text-green-500 bg-green-50 dark:bg-green-900/20 rounded-full border border-green-200/50 dark:border-green-800/50 animate-in fade-in zoom-in duration-300" title="Installed">
                                                                    <Check size={14} strokeWidth={3} />
                                                                </div>
                                                            )}
                                                            {pkg.url && (
                                                                <a
                                                                    href={pkg.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                                                                    title="View on GitHub"
                                                                >
                                                                    <ExternalLink size={14} />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 min-h-[2.5em]">
                                                        {pkg.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            </div>
        </div>
    );
};
