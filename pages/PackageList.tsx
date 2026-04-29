
import React, { useEffect, useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { PackageInfo } from '../types_pkg';
import { packageService } from '../services/packageService';
import { Search, Box, RotateCw, Terminal, CheckCircle, AlertCircle, Clock, Play, Trash2, RefreshCw, Cloud, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PackageList: React.FC = () => {
    const { packages: rawPackages, compilationState, startCompileAll, startCompilePackage, isCompilingGlobal } = useSystem() as any; 
    const packages = (rawPackages || []) as PackageInfo[];

    const [searchTerm, setSearchTerm] = useState('');
    const [presetData, setPresetData] = useState<{current: string, presets: string[]} | null>(null);
    const [selectedSource, setSelectedSource] = useState<string>('All');

    const navigate = useNavigate();
    
    const normalizeSource = (src: string) => {
         if (!src) return 'Unknown';
         if (src.startsWith('github@')) return 'github';
         return src;
    };

    useEffect(() => {
        packageService.getPresets().then(setPresetData).catch(console.error);
    }, []);

    const changePreset = async (name: string) => {
        if (!presetData) return;
        try {
            await packageService.setPreset(name);
            setPresetData({ ...presetData, current: name });
        } catch (e) {
            console.error(e);
        }
    };

    const handleCompile = (e: React.MouseEvent | null, pkgId: string) => {
        e?.stopPropagation();
        startCompilePackage(pkgId);
    };

    const handleCleanCache = async () => {
        if (!confirm("Are you sure you want to clean all build caches? This will trigger full recompilation next time.")) return;
        try {
            await packageService.cleanBuildCache();
        } catch (e) {
            console.error(e);
            alert("Failed to clean cache");
        }
    };

    const handleRescan = async () => {
        try {
            await packageService.scanPackages();
        } catch (e) {
            console.error(e);
        }
    };

    const getStatusBadge = (pkgName: string, staticStatus: string) => {
        const state = compilationState[pkgName];
        const status = state ? state.status : (staticStatus === 'Compiling' ? 'compiling' : staticStatus.toLowerCase());
        
        const size = 14;

        if (status === 'compiling') {
            return (
                <div className="bg-white dark:bg-slate-900 rounded-full shadow-md border border-slate-100 dark:border-slate-800 p-0.5">
                    <RotateCw className="text-blue-500 animate-spin" size={size} />
                </div>
            );
        }
        
        if (status === 'error' || staticStatus === 'Failed') {
            const errCount = state?.errorCount || 0;
            if (errCount > 0) {
                return (
                    <div className="bg-red-500 text-white px-1.5 rounded-full text-[10px] font-bold shadow-md min-w-[20px] h-[20px] flex items-center justify-center border-2 border-white dark:border-slate-900">
                        {errCount}
                    </div>
                );
            }
            return (
                <div className="bg-white dark:bg-slate-900 rounded-full shadow-md border border-red-100 dark:border-red-900 p-0.5">
                    <AlertCircle className="text-red-500" size={size} />
                </div>
            );
        }

        if (status === 'success') {
            const logs = state?.logs || [];
            let warningCount = 0;
            logs.forEach((l: string) => {
                const matches = l.match(/warning/gi);
                if (matches) warningCount += matches.length;
            });

            if (warningCount > 0) {
                return (
                    <div 
                        className="bg-yellow-500 text-white px-1.5 rounded-full text-[10px] font-bold shadow-md min-w-[20px] h-[20px] flex items-center justify-center border-2 border-white dark:border-slate-900 cursor-help"
                        title={`${warningCount} Warnings`}
                    >
                        {warningCount}
                    </div>
                );
            }

            return (
                <div className="bg-white dark:bg-slate-900 rounded-full shadow-md border border-green-100 dark:border-green-900 p-0.5">
                    <CheckCircle className="text-green-500" size={size} />
                </div>
            );
        }

        if (staticStatus === 'Modified') {
             return (
                <div className="bg-white dark:bg-slate-900 rounded-full shadow-md border border-amber-100 dark:border-amber-900 p-0.5">
                    <Clock className="text-amber-500" size={size} />
                </div>
            );
        }
        
        if (state?.status === 'pending') {
             return (
                <div className="w-3 h-3 bg-slate-300 rounded-full animate-pulse border-2 border-white dark:border-slate-900 shadow-sm" />
            );
        }

        return null; 
    };

    const getCardStyle = (pkgName: string) => {
        const state = compilationState[pkgName];
        if (state?.status === 'pending') return 'opacity-50 grayscale';
        if (state?.status === 'compiling') return 'border-blue-500 shadow-blue-500/20 shadow-md scale-[1.01] z-10';
        if (state?.status === 'error') return 'border-red-300 dark:border-red-900 bg-red-50/10';
        return 'border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500';
    };

    const filtered = packages.filter(p => {
        if (!p) return false;
        const name = p.name || '';
        const desc = p.description || '';
        const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              desc.toLowerCase().includes(searchTerm.toLowerCase());
        
        const normSource = normalizeSource(p.source || '');
        const matchesSource = selectedSource === 'All' || normSource === selectedSource;

        return matchesSearch && matchesSource;
    }).sort((a, b) => a.name.localeCompare(b.name));

    const uniqueSources = Array.from(new Set(packages.map(p => normalizeSource(p.source || '')))).sort();

    const grouped: Record<string, PackageInfo[]> = {};
    filtered.forEach(p => {
        const src = normalizeSource(p.source || 'Unknown');
        if (!grouped[src]) grouped[src] = [];
        grouped[src].push(p);
    });

    return (
        <div className="p-6 h-full flex flex-col gap-6 relative bg-slate-50 dark:bg-slate-950 overflow-y-auto overflow-x-hidden">
            <div className="max-w-7xl mx-auto w-full space-y-6">
                
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                            <Box className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Package Management</h1>
                            <p className="text-slate-500 dark:text-slate-400">Manage local nodes and compilation</p>
                        </div>
                    </div>
                <div className="flex items-center gap-2">
                    {presetData && (
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                             <select 
                                value={presetData.current}
                                onChange={(e) => changePreset(e.target.value)}
                                className="bg-transparent text-sm font-semibold px-2 py-1 outline-none text-slate-700 dark:text-slate-200"
                             >
                                 {presetData.presets.map(p => (
                                     <option key={p} value={p}>{p.toUpperCase()}</option>
                                 ))}
                             </select>
                        </div>
                    )}
                    <button 
                        onClick={() => startCompileAll()}
                        disabled={isCompilingGlobal}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95 ${
                            isCompilingGlobal 
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                    >
                        {isCompilingGlobal ? <RotateCw className="animate-spin" size={16} /> : <Play size={16} fill="currentColor" />}
                        {isCompilingGlobal ? 'Compiling...' : 'Compile All'}
                    </button>
                    <button 
                         onClick={handleRescan}
                         className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-500 rounded-lg transition-colors"
                         title="Rescan Packages"
                    >
                        <RefreshCw size={20} />
                    </button>
                    <button 
                        onClick={handleCleanCache} 
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                        title="Clean Build Cache"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Search packages..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button
                    onClick={() => setSelectedSource('All')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                        selectedSource === 'All' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-blue-500'
                    }`}
                >
                    All Sources
                </button>
                {uniqueSources.map(src => (
                    <button
                        key={src}
                        onClick={() => setSelectedSource(src)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap uppercase tracking-wider ${
                            selectedSource === src 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-blue-500'
                        }`}
                    >
                        {src}
                    </button>
                ))}
            </div>

            <div className="flex-1 space-y-8">
                {Object.keys(grouped).sort((a, b) => {
                    if (a === 'github') return -1;
                    if (b === 'github') return 1;
                    return a.localeCompare(b);
                }).map((source) => {
                    const pkgs = grouped[source];
                    return (
                    <div key={source}>
                        <div className="flex items-center gap-2 mb-3 px-1">
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                                {source === 'github' && <Cloud size={14} className="text-blue-500" fill="currentColor" />}
                                {source}
                            </span>
                            <span className="text-slate-400 text-sm">{pkgs.length} packages</span>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                            {pkgs.map(pkg => {
                                const isCompiling = compilationState[pkg.name]?.status === 'compiling';
                                const badge = getStatusBadge(pkg.name, pkg.status);
                                return (
                                <div 
                                    key={pkg.name} 
                                    onClick={() => navigate(`/package/${encodeURIComponent(pkg.source || 'Unknown')}/${encodeURIComponent(pkg.name.split('/').pop() || pkg.name)}`)}
                                    className={`bg-white dark:bg-slate-900 border rounded-xl p-2 flex flex-col gap-4 cursor-pointer transition-all shadow-sm group relative overflow-visible ${getCardStyle(pkg.name)}`}
                                >
                                    <div className="flex items-start gap-4 h-full relative">
                                        <div className="absolute top-0 right-0 z-20">
                                            <div className="relative">
                                                <button 
                                                    onClick={(e) => handleCompile(e, pkg.name)} 
                                                    disabled={isCompiling}
                                                    className={`p-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 ${
                                                        isCompiling 
                                                            ? 'bg-slate-50 dark:bg-slate-800 text-slate-300'
                                                            : 'hover:bg-green-50 text-green-600 dark:text-green-400 dark:hover:bg-green-900/20'
                                                    }`}
                                                    title="Compile"
                                                >
                                                    <Play size={16} fill="currentColor" className={isCompiling ? 'opacity-50' : ''} />
                                                </button>
                                                {/* Badge Overlay - Adjusted position to prevent clipping */}
                                                {badge && (
                                                    <div className="absolute -top-2 -right-2 pointer-events-none z-30">
                                                        {badge}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="w-16 h-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                                        {pkg.icon_path ? (
                                            <img src={`/api/fins/package/asset/${pkg.name}/${pkg.icon_path.replace(/^\/+/, '')}`} alt={pkg.name} className="w-full h-full object-contain" />
                                        ) : (
                                                <Box className="text-slate-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 pr-12">
                                            <div className="flex justify-between items-start">
                                                <div className="flex flex-col gap-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {/* Display Short Name only */}
                                                        <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm">{pkg.name.split('/').pop()}</h3>
                                                        <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-mono text-[10px] font-bold shrink-0">
                                                            v{pkg.version}
                                                        </span>
                                                        {source === 'github' && (
                                                             <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-[10px] font-medium border border-slate-200 dark:border-slate-700 shrink-0">
                                                                 {pkg.source}
                                                             </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 min-h-[2.5em]">
                                                {pkg.description || "No description provided."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ); })}
                        </div>
                    </div>
                ); })}
            </div>
            </div>
        </div>
    );
};
