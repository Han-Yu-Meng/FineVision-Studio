
// Data types matching the C++ and JSON structures

export interface ServiceDef {
  name: string;
  type?: string; 
  request_type?: string;
  response_type?: string;
  topic?: string; // Configured topic for dataflow
}

export interface ActionDef {
  name: string;
  goal_type?: string;
  feedback_type?: string;
  topic?: string; // Configured topic for dataflow
}

export interface ParameterDef {
  name: string;
  type: string;
  default_value: string;
  value?: any; // Current value in dataflow
  description?: string;
}

export interface PortDef {
  id: number;
  name: string; 
  type: string;
  description?: string; 
}

export interface Capability {
  name: string;
  description: string;
  category?: string;
  package_name?: string;
  source?: string;
  version?: string;
  
  inputs: PortDef[];
  outputs: PortDef[];
  parameters: ParameterDef[];
  
  clients: ServiceDef[];
  servers: ServiceDef[];
  actors: ActionDef[];
  commanders: ActionDef[];
}

export interface AgentCapabilities {
  [funcName: string]: Capability;
}

export interface SystemMetrics {
  cpu_usage_percent: number;
  memory_usage_percent: number;
  memory_used_mb: number;
  memory_total_mb: number;
  avg_wait_time_ms?: number;
  queue_length?: number;
  thread_pool_utilization?: number;
  dropped_tasks_count?: number;
}

export interface LogEntry {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  timestamp: number;
}

export interface PipeMetric {
  avg_aoi_ms: number;
  peak_aoi_ms: number;
  fps: number;
  sys_delay_ms: number;
  violation_prob: number;
  count: number;
  time_window_s: number;
}

export interface PipeMetricSample extends PipeMetric {
  timestamp: number;
}

export interface NodeMetrics {
  [nodeId: string]: {
    logs?: LogEntry[];
    metrics?: any; // Add generic metrics holder
  };
}

export enum AgentStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED'
}

export interface Agent {
  id: string;
  status: AgentStatus;
  lastSeen: number;
  url: string;
  capabilities: AgentCapabilities;
  metrics: SystemMetrics;
  nodeMetrics: NodeMetrics;
  pipeMetrics: Record<string, PipeMetric>;
  pipeMetricsHistory: Record<string, PipeMetricSample[]>;
}

// --- Dataflow JSON Structure ---

export interface DataflowInputDef {
    id: number;
    name: string;
    type: string;
    connect?: string; // "NodeId/PortName"
}

export interface DataflowNode {
  id: string; // Instance ID
  name: string; // Capability Name
  description: string;
  category?: string;
  package_name?: string;
  source?: string;
  version?: string;

  // New structure: Inputs is a Map with connection info
  inputs: Record<string, DataflowInputDef>;
  outputs: PortDef[]; 
  parameters: ParameterDef[];
  
  clients: ServiceDef[];
  servers: ServiceDef[];
  actors: ActionDef[];
  commanders: ActionDef[];

  position: { x: number, y: number };
  collapsed?: boolean;
}

export interface DataflowConfig {
  name: string;
  description: string;
}

export interface Dataflow {
  nodes: DataflowNode[];
  pipes?: any[]; 
  config: DataflowConfig;
}
