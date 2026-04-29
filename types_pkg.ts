
export interface PackageMetadata {
    name: string;
    version: string;
    description: string;
    maintainers: { name: string; email: string }[];
    licenses: string[];
}

export interface PackageInfo {
    name: string;
    version: string;
    description: string;
    status: 'Uncompiled' | 'Modified' | 'Ready' | 'Compiling' | 'Failed';
    path: string;
    maintainer: string;
    source: string;
    icon_path?: string;
}

export interface Package {
    path?: string; 
    meta: PackageMetadata;
    readme_content?: string;
    readme_path?: string;
    script_path?: string; 
    icon_path?: string; 
    status?: 'Uncompiled' | 'Modified' | 'Ready' | 'Compiling' | 'Failed';
    source: string; 
}

export interface HubPackageDef {
    category: string;
    description: string;
    url: string;
    display_name?: string;
    tags?: string[];
    icon?: string;
}

export interface HubManifest {
    meta: {
        name: string;
        maintainer: string;
    };
    packages: Record<string, HubPackageDef>;
}

// --- Inspect API Types ---

export interface InspectPort {
    id: number;
    name: string;
    type: string;
}

export interface InspectParameter {
    name: string;
    type: string;
    default_value: string;
}

export interface InspectService {
    name: string;
    request_type: string;
    response_type: string;
}

export interface InspectAction {
    name: string;
    goal_type: string;
    feedback_type: string;
}

// Flattened Node Structure
export interface InspectNode {
    name: string;
    description: string;
    category: string;
    package_name: string;
    source: string;
    version: string;
    inputs: InspectPort[];
    outputs: InspectPort[];
    parameters: InspectParameter[];
    clients: InspectService[];
    servers: InspectService[];
    actors: InspectAction[];
    commanders: InspectAction[];
}

export interface InspectResult {
    status: 'VALID' | 'ERROR';
    architecture: string;
    file_path: string;
    load_time_ms: number;
    dependencies: string; 
    nodes: InspectNode[];
    error: string;
    warnings: string[];
}
