
import { Package, PackageInfo, HubManifest, InspectResult } from '../types_pkg';
import yaml from 'js-yaml';

const API_BASE = '/api/fins';

export interface BuildPresets {
    current: string;
    presets: string[];
}

export const packageService = {
    async getPresets(): Promise<BuildPresets> {
        const res = await fetch(`${API_BASE}/presets`);
        if (!res.ok) throw new Error("Failed to fetch presets");
        return res.json();
    },

    async getCompileLog(name: string): Promise<string> {
        const res = await fetch(`${API_BASE}/package/log/${encodeURIComponent(name)}`);
        if (res.ok) {
            return res.text();
        }
        return "";
    },

    async setPreset(name: string): Promise<void> {
        const res = await fetch(`${API_BASE}/preset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!res.ok) throw new Error("Failed to set preset");
    },

    async cleanBuildCache(): Promise<void> {
        const res = await fetch(`${API_BASE}/clean`, { method: 'POST' });
        if (!res.ok) throw new Error("Failed to clean build cache");
    },
    
    async scanPackages(): Promise<void> {
        const res = await fetch(`${API_BASE}/scan`, { method: 'POST' });
        if (!res.ok) throw new Error("Failed to trigger scan");
    },

    async checkPluginInstalled(repoUrl: string, packageId?: string): Promise<boolean> {
        if (!packageId) return false;
        
        try {
            // Normalize URL
            const cleanUrl = repoUrl.replace(/\/$/, '').replace(/\.git$/, '');
            const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
            if (!match) return false;
            
            const owner = match[1];
            const repo = match[2];
            
            // 遵循 HubPackageDetail 中的逻辑：libGithub@owner@repo_packageId.so
            const exactSoName = `libGithub@${owner}@${repo}_${packageId}.so`;
            
            // 使用 inspect/file 接口探测文件物理是否存在
            const res = await fetch(`${API_BASE}/inspect/file?path=${encodeURIComponent(exactSoName)}`);
            
            // 如果接口返回 200，说明文件物理存在
            const isInstalled = res.ok;
            
            return isInstalled;
        } catch (e) {
            console.error("Error checking plugin file via inspect:", e);
            return false;
        }
    },

    async installPlugin(repo: string, onOutput: (chunk: string) => void): Promise<void> {
        const res = await fetch(`${API_BASE}/install`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repo })
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || "Installation failed");
        }

        if (!res.body) return;
        
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullOutput = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            fullOutput += chunk;
            onOutput(chunk);
        }

        // Check for error markers in the stream output (ANSI colored or plain)
        // \u2718 is the heavy ballot X (✘) used in the output
        if (fullOutput.includes("✘") || fullOutput.includes("Failed") || fullOutput.includes("Error") || fullOutput.includes("404 Not Found")) {
            const lines = fullOutput.trim().split('\n');
            // Find the most relevant error line
            const errorLine = lines.reverse().find(l => 
                l.includes("✘") || l.includes("Failed") || l.includes("Error")
            ) || "Installation encountered an error";
            
            // Strip ANSI colors and the error symbol for the final message
            const cleanMessage = errorLine
                .replace(/[\u001b\u009b]\[[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
                .replace(/✘/g, '')
                .trim();
                
            throw new Error(cleanMessage);
        }
    },

    async getPackages(): Promise<PackageInfo[]> {
        const res = await fetch(`${API_BASE}/packages`);
        if (!res.ok) throw new Error("Failed to fetch packages");
        return res.json();
    },

    async getLocalPackages(): Promise<PackageInfo[]> {
        console.log("Fetching local packages from:", `${API_BASE}/packages`);
        const res = await fetch(`${API_BASE}/packages`);
        if (!res.ok) throw new Error("Failed to fetch local packages");
        const list = await res.json();
        console.log("Local packages received:", list);
        return list; 
    },

    async getPackageDetail(name: string, source?: string): Promise<Package> {
        let url = `${API_BASE}/package/detail/${encodeURIComponent(name)}`;
        if (source) {
            url += `?source=${encodeURIComponent(source)}`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch package details");
        return res.json();
    },

    async compilePackage(name: string, onOutput: (chunk: string) => void): Promise<void> {
        const res = await fetch(`${API_BASE}/build/${encodeURIComponent(name)}`, { method: 'POST' });
        
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `Compilation failed with status ${res.status}`);
        }

        if (!res.body) return;
        
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            onOutput(decoder.decode(value));
        }
    },

    async fetchHubManifest(url: string): Promise<HubManifest> {
        // Convert github blob to raw if needed
        let targetUrl = url;
        if (url.includes('github.com') && url.includes('/blob/')) {
            targetUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
        }

        const res = await fetch(targetUrl);
        if (!res.ok) throw new Error("Failed to fetch manifest");
        const text = await res.text();
        return yaml.load(text) as HubManifest;
    },

    async inspectPackage(name: string): Promise<InspectResult[]> {
        // Add timestamp to prevent caching
        const res = await fetch(`${API_BASE}/inspect/analyze/${encodeURIComponent(name)}?t=${Date.now()}`);
        if (!res.ok) {
            const errorText = await res.text();
            // Try to parse JSON error if possible
            let errorMessage = errorText;
            try {
                const json = JSON.parse(errorText);
                if (json.error) errorMessage = json.error;
            } catch (e) {}

            if (res.status === 404) {
                throw new Error("BINARY_NOT_FOUND");
            }
            throw new Error(errorMessage || "Failed to inspect package");
        }
        return res.json();
    },

    // --- Dataflow & Parameter File Operations ---
    async getDataflows(): Promise<any[]> {
        const res = await fetch(`/api/dataflows`);
        if (!res.ok) throw new Error("Failed to fetch dataflows");
        return res.json();
    },

    async saveDataflow(flow: any): Promise<void> {
        const res = await fetch(`/api/dataflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(flow)
        });
        if (!res.ok) throw new Error("Failed to save dataflow");
    },

    async deleteDataflow(name: string): Promise<void> {
        const res = await fetch(`/api/dataflow/${encodeURIComponent(name)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error("Failed to delete dataflow");
    },

    async getParameters(): Promise<any[]> {
        const res = await fetch(`/api/parameters`);
        if (!res.ok) throw new Error("Failed to fetch parameters");
        return res.json();
    },

    async saveParameter(param: any): Promise<void> {
        const res = await fetch(`/api/parameter`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(param)
        });
        if (!res.ok) throw new Error("Failed to save parameter");
    },

    async deleteParameter(name: string): Promise<void> {
        const res = await fetch(`/api/parameter/${encodeURIComponent(name)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error("Failed to delete parameter");
    }
};
