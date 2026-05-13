import { Agent, AgentStatus } from '../types';

export const INITIAL_CAPABILITIES = {};

const MOCK_AGENT_ID = "fins-001";

const MOCK_AGENT: Agent = {
  id: MOCK_AGENT_ID,
  status: AgentStatus.ONLINE,
  lastSeen: Date.now(),
  url: "http://localhost:2345",
  capabilities: INITIAL_CAPABILITIES,
  metrics: {
    cpu_usage_percent: 12.5,
    memory_usage_percent: 45.2,
    memory_used_mb: 4024,
    memory_total_mb: 16384
  },
  nodeMetrics: {},
  pipeMetrics: {},
  pipeMetricsHistory: {}
};