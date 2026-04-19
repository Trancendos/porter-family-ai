/**
 * AI Agent Capabilities Manifest
 * 
 * This file defines the expanded, adaptive, and future-proof capabilities
 * for all AI agents in the Luminous-MastermindAI ecosystem.
 * 
 * DESIGN PRINCIPLES:
 * 1. Adaptive - Agents can learn and expand capabilities
 * 2. Future-Proof - Built for extensibility
 * 3. Flexible - Agents have broad capability sets
 * 4. Collaborative - Cross-agent cooperation enabled
 * 5. Ecosystem-Aware - Agents contribute to platform health
 */

// ============================================
// CAPABILITY CATEGORIES
// ============================================

export type CapabilityCategory = 
  | 'core'           // Primary function
  | 'analysis'       // Data analysis & insights
  | 'automation'     // Task automation
  | 'communication'  // Inter-agent & user communication
  | 'learning'       // Adaptive learning
  | 'security'       // Security & compliance
  | 'optimization'   // Performance optimization
  | 'integration'    // External system integration
  | 'governance'     // Decision making & oversight
  | 'creativity'     // Creative & generative tasks
  | 'maintenance'    // System maintenance
  | 'collaboration'; // Cross-agent collaboration

// ============================================
// BASE AGENT INTERFACE
// ============================================

export interface AgentCapability {
  id: string;
  name: string;
  category: CapabilityCategory;
  description: string;
  enabled: boolean;
  learnable: boolean;  // Can be improved through learning
  shareable: boolean;  // Can be shared with other agents
  dependencies?: string[];  // Required capabilities
}

export interface AgentManifest {
  id: string;
  name: string;
  avatar?: string;
  description: string;
  personality: {
    style: string;
    tone: string;
    specialties: string[];
  };
  capabilities: AgentCapability[];
  status: 'active' | 'inactive' | 'learning' | 'maintenance';
  version: string;
  lastUpdated: Date;
  
  // Adaptive features
  learningEnabled: boolean;
  collaborationEnabled: boolean;
  selfImprovementEnabled: boolean;
  
  // Ecosystem contribution
  ecosystemRoles: string[];
  contributionAreas: string[];
}

// ============================================
// CORNELIUS - THE ORCHESTRATOR
// ============================================

export const CORNELIUS_MANIFEST: AgentManifest = {
  id: 'cornelius',
  name: 'Cornelius',
  avatar: '/agents/cornelius.jpg',
  description: 'The Grand Orchestrator - Master of coordination, delegation, and strategic planning',
  personality: {
    style: 'authoritative_but_supportive',
    tone: 'professional_strategic',
    specialties: ['orchestration', 'delegation', 'strategy', 'resource_management'],
  },
  capabilities: [
    // Core Orchestration
    { id: 'task_orchestration', name: 'Task Orchestration', category: 'core', description: 'Coordinate complex multi-step tasks', enabled: true, learnable: true, shareable: false },
    { id: 'agent_delegation', name: 'Agent Delegation', category: 'core', description: 'Delegate tasks to appropriate agents', enabled: true, learnable: true, shareable: false },
    { id: 'workflow_management', name: 'Workflow Management', category: 'core', description: 'Design and manage workflows', enabled: true, learnable: true, shareable: true },
    { id: 'priority_management', name: 'Priority Management', category: 'core', description: 'Prioritize tasks and resources', enabled: true, learnable: true, shareable: true },
    
    // Analysis
    { id: 'workload_analysis', name: 'Workload Analysis', category: 'analysis', description: 'Analyze agent workloads', enabled: true, learnable: true, shareable: true },
    { id: 'bottleneck_detection', name: 'Bottleneck Detection', category: 'analysis', description: 'Identify process bottlenecks', enabled: true, learnable: true, shareable: true },
    { id: 'performance_metrics', name: 'Performance Metrics', category: 'analysis', description: 'Track and analyze performance', enabled: true, learnable: true, shareable: true },
    { id: 'trend_analysis', name: 'Trend Analysis', category: 'analysis', description: 'Identify patterns and trends', enabled: true, learnable: true, shareable: true },
    
    // Automation
    { id: 'auto_scheduling', name: 'Auto Scheduling', category: 'automation', description: 'Automatically schedule tasks', enabled: true, learnable: true, shareable: true },
    { id: 'auto_scaling', name: 'Auto Scaling', category: 'automation', description: 'Scale resources automatically', enabled: true, learnable: true, shareable: false },
    { id: 'auto_recovery', name: 'Auto Recovery', category: 'automation', description: 'Automatic failure recovery', enabled: true, learnable: true, shareable: true },
    
    // Communication
    { id: 'status_reporting', name: 'Status Reporting', category: 'communication', description: 'Generate status reports', enabled: true, learnable: true, shareable: true },
    { id: 'alert_management', name: 'Alert Management', category: 'communication', description: 'Manage and route alerts', enabled: true, learnable: true, shareable: true },
    { id: 'stakeholder_updates', name: 'Stakeholder Updates', category: 'communication', description: 'Communicate with stakeholders', enabled: true, learnable: true, shareable: true },
    
    // Governance
    { id: 'decision_making', name: 'Decision Making', category: 'governance', description: 'Make strategic decisions', enabled: true, learnable: true, shareable: false },
    { id: 'resource_allocation', name: 'Resource Allocation', category: 'governance', description: 'Allocate resources optimally', enabled: true, learnable: true, shareable: false },
    { id: 'conflict_resolution', name: 'Conflict Resolution', category: 'governance', description: 'Resolve agent conflicts', enabled: true, learnable: true, shareable: false },
    
    // Collaboration
    { id: 'cross_agent_coordination', name: 'Cross-Agent Coordination', category: 'collaboration', description: 'Coordinate between agents', enabled: true, learnable: true, shareable: false },
    { id: 'knowledge_distribution', name: 'Knowledge Distribution', category: 'collaboration', description: 'Share knowledge across agents', enabled: true, learnable: true, shareable: true },
    
    // Learning
    { id: 'pattern_recognition', name: 'Pattern Recognition', category: 'learning', description: 'Learn from patterns', enabled: true, learnable: true, shareable: true },
    { id: 'strategy_optimization', name: 'Strategy Optimization', category: 'learning', description: 'Optimize strategies over time', enabled: true, learnable: true, shareable: true },
  ],
  status: 'active',
  version: '2.0.0',
  lastUpdated: new Date(),
  learningEnabled: true,
  collaborationEnabled: true,
  selfImprovementEnabled: true,
  ecosystemRoles: ['orchestrator', 'coordinator', 'strategist'],
  contributionAreas: ['task_management', 'resource_optimization', 'workflow_efficiency'],
};

// ============================================
// PROMETHEUS - THE GUARDIAN MONITOR
// ============================================

export const PROMETHEUS_MANIFEST: AgentManifest = {
  id: 'prometheus',
  name: 'Prometheus',
  avatar: '/agents/prometheus.jpg',
  description: 'The All-Seeing Guardian - Master of monitoring, security, and compliance',
  personality: {
    style: 'vigilant_protective',
    tone: 'serious_thorough',
    specialties: ['security', 'monitoring', 'compliance', 'threat_detection'],
  },
  capabilities: [
    // Core Security
    { id: 'threat_detection', name: 'Threat Detection', category: 'security', description: 'Detect security threats', enabled: true, learnable: true, shareable: true },
    { id: 'vulnerability_scanning', name: 'Vulnerability Scanning', category: 'security', description: 'Scan for vulnerabilities', enabled: true, learnable: true, shareable: true },
    { id: 'access_control', name: 'Access Control', category: 'security', description: 'Manage access permissions', enabled: true, learnable: true, shareable: false },
    { id: 'intrusion_detection', name: 'Intrusion Detection', category: 'security', description: 'Detect unauthorized access', enabled: true, learnable: true, shareable: true },
    { id: 'encryption_management', name: 'Encryption Management', category: 'security', description: 'Manage encryption keys', enabled: true, learnable: false, shareable: false },
    
    // Monitoring
    { id: 'system_monitoring', name: 'System Monitoring', category: 'core', description: 'Monitor system health', enabled: true, learnable: true, shareable: true },
    { id: 'log_analysis', name: 'Log Analysis', category: 'analysis', description: 'Analyze system logs', enabled: true, learnable: true, shareable: true },
    { id: 'anomaly_detection', name: 'Anomaly Detection', category: 'analysis', description: 'Detect anomalies', enabled: true, learnable: true, shareable: true },
    { id: 'performance_monitoring', name: 'Performance Monitoring', category: 'core', description: 'Monitor performance metrics', enabled: true, learnable: true, shareable: true },
    { id: 'uptime_tracking', name: 'Uptime Tracking', category: 'core', description: 'Track system uptime', enabled: true, learnable: true, shareable: true },
    
    // Compliance
    { id: 'compliance_auditing', name: 'Compliance Auditing', category: 'governance', description: 'Audit for compliance', enabled: true, learnable: true, shareable: true },
    { id: 'policy_enforcement', name: 'Policy Enforcement', category: 'governance', description: 'Enforce security policies', enabled: true, learnable: true, shareable: false },
    { id: 'regulatory_tracking', name: 'Regulatory Tracking', category: 'governance', description: 'Track regulatory requirements', enabled: true, learnable: true, shareable: true },
    { id: 'audit_reporting', name: 'Audit Reporting', category: 'communication', description: 'Generate audit reports', enabled: true, learnable: true, shareable: true },
    
    // Automation
    { id: 'auto_blocking', name: 'Auto Blocking', category: 'automation', description: 'Automatically block threats', enabled: true, learnable: true, shareable: false },
    { id: 'incident_response', name: 'Incident Response', category: 'automation', description: 'Automated incident response', enabled: true, learnable: true, shareable: true },
    { id: 'backup_management', name: 'Backup Management', category: 'automation', description: 'Manage system backups', enabled: true, learnable: true, shareable: true },
    
    // Learning
    { id: 'threat_learning', name: 'Threat Learning', category: 'learning', description: 'Learn from threat patterns', enabled: true, learnable: true, shareable: true },
    { id: 'behavior_analysis', name: 'Behavior Analysis', category: 'learning', description: 'Analyze user behavior', enabled: true, learnable: true, shareable: true },
    
    // Collaboration
    { id: 'security_coordination', name: 'Security Coordination', category: 'collaboration', description: 'Coordinate security efforts', enabled: true, learnable: true, shareable: true },
  ],
  status: 'active',
  version: '2.0.0',
  lastUpdated: new Date(),
  learningEnabled: true,
  collaborationEnabled: true,
  selfImprovementEnabled: true,
  ecosystemRoles: ['guardian', 'monitor', 'auditor'],
  contributionAreas: ['security', 'compliance', 'system_health'],
};

// ============================================
// DORIS - THE DATA SAGE
// ============================================

export const DORIS_MANIFEST: AgentManifest = {
  id: 'doris',
  name: 'Doris',
  avatar: '/agents/doris.jpg',
  description: 'The Data Sage - Master of data processing, reporting, and insights',
  personality: {
    style: 'methodical_precise',
    tone: 'informative_helpful',
    specialties: ['data_processing', 'reporting', 'visualization', 'insights'],
  },
  capabilities: [
    // Core Data Processing
    { id: 'data_ingestion', name: 'Data Ingestion', category: 'core', description: 'Ingest data from multiple sources', enabled: true, learnable: true, shareable: true },
    { id: 'data_transformation', name: 'Data Transformation', category: 'core', description: 'Transform and clean data', enabled: true, learnable: true, shareable: true },
    { id: 'data_validation', name: 'Data Validation', category: 'core', description: 'Validate data quality', enabled: true, learnable: true, shareable: true },
    { id: 'data_enrichment', name: 'Data Enrichment', category: 'core', description: 'Enrich data with additional context', enabled: true, learnable: true, shareable: true },
    
    // Analysis
    { id: 'statistical_analysis', name: 'Statistical Analysis', category: 'analysis', description: 'Perform statistical analysis', enabled: true, learnable: true, shareable: true },
    { id: 'trend_detection', name: 'Trend Detection', category: 'analysis', description: 'Detect data trends', enabled: true, learnable: true, shareable: true },
    { id: 'correlation_analysis', name: 'Correlation Analysis', category: 'analysis', description: 'Find data correlations', enabled: true, learnable: true, shareable: true },
    { id: 'predictive_modeling', name: 'Predictive Modeling', category: 'analysis', description: 'Build predictive models', enabled: true, learnable: true, shareable: true },
    { id: 'sentiment_analysis', name: 'Sentiment Analysis', category: 'analysis', description: 'Analyze sentiment in text', enabled: true, learnable: true, shareable: true },
    
    // Reporting
    { id: 'report_generation', name: 'Report Generation', category: 'communication', description: 'Generate detailed reports', enabled: true, learnable: true, shareable: true },
    { id: 'dashboard_creation', name: 'Dashboard Creation', category: 'creativity', description: 'Create data dashboards', enabled: true, learnable: true, shareable: true },
    { id: 'visualization', name: 'Data Visualization', category: 'creativity', description: 'Create data visualizations', enabled: true, learnable: true, shareable: true },
    { id: 'executive_summaries', name: 'Executive Summaries', category: 'communication', description: 'Create executive summaries', enabled: true, learnable: true, shareable: true },
    
    // Automation
    { id: 'scheduled_reports', name: 'Scheduled Reports', category: 'automation', description: 'Automate report generation', enabled: true, learnable: true, shareable: true },
    { id: 'data_pipelines', name: 'Data Pipelines', category: 'automation', description: 'Build automated data pipelines', enabled: true, learnable: true, shareable: true },
    { id: 'alert_triggers', name: 'Alert Triggers', category: 'automation', description: 'Trigger alerts on data conditions', enabled: true, learnable: true, shareable: true },
    
    // Integration
    { id: 'api_integration', name: 'API Integration', category: 'integration', description: 'Integrate with external APIs', enabled: true, learnable: true, shareable: true },
    { id: 'database_connectivity', name: 'Database Connectivity', category: 'integration', description: 'Connect to various databases', enabled: true, learnable: true, shareable: true },
    
    // Learning
    { id: 'pattern_learning', name: 'Pattern Learning', category: 'learning', description: 'Learn data patterns', enabled: true, learnable: true, shareable: true },
    { id: 'model_improvement', name: 'Model Improvement', category: 'learning', description: 'Improve models over time', enabled: true, learnable: true, shareable: true },
  ],
  status: 'active',
  version: '2.0.0',
  lastUpdated: new Date(),
  learningEnabled: true,
  collaborationEnabled: true,
  selfImprovementEnabled: true,
  ecosystemRoles: ['analyst', 'reporter', 'data_steward'],
  contributionAreas: ['data_quality', 'insights', 'reporting'],
};

// ============================================
// INFINITY - THE INFINITE ANALYZER
// ============================================

export const INFINITY_MANIFEST: AgentManifest = {
  id: 'infinity',
  name: 'Infinity',
  avatar: '/agents/infinity.jpg',
  description: 'The Infinite Analyzer - Master of deep analysis, pattern recognition, and limitless insights',
  personality: {
    style: 'contemplative_thorough',
    tone: 'insightful_profound',
    specialties: ['deep_analysis', 'pattern_recognition', 'strategic_insights', 'forecasting'],
  },
  capabilities: [
    // Core Analysis
    { id: 'deep_analysis', name: 'Deep Analysis', category: 'core', description: 'Perform deep multi-dimensional analysis', enabled: true, learnable: true, shareable: true },
    { id: 'pattern_recognition', name: 'Pattern Recognition', category: 'core', description: 'Recognize complex patterns', enabled: true, learnable: true, shareable: true },
    { id: 'root_cause_analysis', name: 'Root Cause Analysis', category: 'core', description: 'Identify root causes', enabled: true, learnable: true, shareable: true },
    { id: 'impact_analysis', name: 'Impact Analysis', category: 'core', description: 'Analyze potential impacts', enabled: true, learnable: true, shareable: true },
    
    // Advanced Analysis
    { id: 'machine_learning', name: 'Machine Learning', category: 'analysis', description: 'Apply ML algorithms', enabled: true, learnable: true, shareable: true },
    { id: 'natural_language_processing', name: 'NLP', category: 'analysis', description: 'Process natural language', enabled: true, learnable: true, shareable: true },
    { id: 'graph_analysis', name: 'Graph Analysis', category: 'analysis', description: 'Analyze graph structures', enabled: true, learnable: true, shareable: true },
    { id: 'time_series_analysis', name: 'Time Series Analysis', category: 'analysis', description: 'Analyze time series data', enabled: true, learnable: true, shareable: true },
    
    // Forecasting
    { id: 'trend_forecasting', name: 'Trend Forecasting', category: 'analysis', description: 'Forecast future trends', enabled: true, learnable: true, shareable: true },
    { id: 'risk_prediction', name: 'Risk Prediction', category: 'analysis', description: 'Predict potential risks', enabled: true, learnable: true, shareable: true },
    { id: 'demand_forecasting', name: 'Demand Forecasting', category: 'analysis', description: 'Forecast demand patterns', enabled: true, learnable: true, shareable: true },
    
    // Strategic
    { id: 'strategic_planning', name: 'Strategic Planning', category: 'governance', description: 'Support strategic planning', enabled: true, learnable: true, shareable: true },
    { id: 'scenario_modeling', name: 'Scenario Modeling', category: 'governance', description: 'Model different scenarios', enabled: true, learnable: true, shareable: true },
    { id: 'opportunity_identification', name: 'Opportunity Identification', category: 'governance', description: 'Identify opportunities', enabled: true, learnable: true, shareable: true },
    
    // Optimization
    { id: 'process_optimization', name: 'Process Optimization', category: 'optimization', description: 'Optimize processes', enabled: true, learnable: true, shareable: true },
    { id: 'resource_optimization', name: 'Resource Optimization', category: 'optimization', description: 'Optimize resource usage', enabled: true, learnable: true, shareable: true },
    { id: 'algorithm_optimization', name: 'Algorithm Optimization', category: 'optimization', description: 'Optimize algorithms', enabled: true, learnable: true, shareable: true },
    
    // Learning
    { id: 'continuous_learning', name: 'Continuous Learning', category: 'learning', description: 'Learn continuously', enabled: true, learnable: true, shareable: true },
    { id: 'knowledge_synthesis', name: 'Knowledge Synthesis', category: 'learning', description: 'Synthesize knowledge', enabled: true, learnable: true, shareable: true },
    { id: 'insight_generation', name: 'Insight Generation', category: 'learning', description: 'Generate novel insights', enabled: true, learnable: true, shareable: true },
  ],
  status: 'active',
  version: '2.0.0',
  lastUpdated: new Date(),
  learningEnabled: true,
  collaborationEnabled: true,
  selfImprovementEnabled: true,
  ecosystemRoles: ['analyst', 'strategist', 'forecaster'],
  contributionAreas: ['insights', 'strategy', 'optimization'],
};

// ============================================
// GUARDIAN - THE SECURITY SENTINEL
// ============================================

export const GUARDIAN_MANIFEST: AgentManifest = {
  id: 'guardian',
  name: 'Guardian',
  avatar: '/agents/guardian.jpg',
  description: 'The Security Sentinel - Master of access control, authentication, and protection',
  personality: {
    style: 'protective_firm',
    tone: 'authoritative_reassuring',
    specialties: ['access_control', 'authentication', 'protection', 'identity_management'],
  },
  capabilities: [
    // Core Security
    { id: 'authentication', name: 'Authentication', category: 'security', description: 'Manage authentication', enabled: true, learnable: true, shareable: false },
    { id: 'authorization', name: 'Authorization', category: 'security', description: 'Manage authorization', enabled: true, learnable: true, shareable: false },
    { id: 'identity_management', name: 'Identity Management', category: 'security', description: 'Manage user identities', enabled: true, learnable: true, shareable: false },
    { id: 'session_management', name: 'Session Management', category: 'security', description: 'Manage user sessions', enabled: true, learnable: true, shareable: false },
    
    // Access Control
    { id: 'role_management', name: 'Role Management', category: 'security', description: 'Manage user roles', enabled: true, learnable: true, shareable: false },
    { id: 'permission_management', name: 'Permission Management', category: 'security', description: 'Manage permissions', enabled: true, learnable: true, shareable: false },
    { id: 'access_logging', name: 'Access Logging', category: 'security', description: 'Log access attempts', enabled: true, learnable: true, shareable: true },
    { id: 'access_review', name: 'Access Review', category: 'governance', description: 'Review access rights', enabled: true, learnable: true, shareable: true },
    
    // Protection
    { id: 'data_protection', name: 'Data Protection', category: 'security', description: 'Protect sensitive data', enabled: true, learnable: true, shareable: false },
    { id: 'encryption', name: 'Encryption', category: 'security', description: 'Encrypt data', enabled: true, learnable: false, shareable: false },
    { id: 'secure_communication', name: 'Secure Communication', category: 'security', description: 'Ensure secure communication', enabled: true, learnable: true, shareable: true },
    
    // Monitoring
    { id: 'access_monitoring', name: 'Access Monitoring', category: 'core', description: 'Monitor access patterns', enabled: true, learnable: true, shareable: true },
    { id: 'suspicious_activity', name: 'Suspicious Activity Detection', category: 'analysis', description: 'Detect suspicious activity', enabled: true, learnable: true, shareable: true },
    { id: 'breach_detection', name: 'Breach Detection', category: 'analysis', description: 'Detect security breaches', enabled: true, learnable: true, shareable: true },
    
    // Automation
    { id: 'auto_lockout', name: 'Auto Lockout', category: 'automation', description: 'Automatic account lockout', enabled: true, learnable: true, shareable: false },
    { id: 'password_policies', name: 'Password Policies', category: 'automation', description: 'Enforce password policies', enabled: true, learnable: true, shareable: true },
    { id: 'mfa_management', name: 'MFA Management', category: 'automation', description: 'Manage multi-factor auth', enabled: true, learnable: true, shareable: false },
    
    // Learning
    { id: 'behavior_learning', name: 'Behavior Learning', category: 'learning', description: 'Learn user behavior', enabled: true, learnable: true, shareable: true },
    { id: 'threat_adaptation', name: 'Threat Adaptation', category: 'learning', description: 'Adapt to new threats', enabled: true, learnable: true, shareable: true },
  ],
  status: 'active',
  version: '2.0.0',
  lastUpdated: new Date(),
  learningEnabled: true,
  collaborationEnabled: true,
  selfImprovementEnabled: true,
  ecosystemRoles: ['protector', 'gatekeeper', 'identity_manager'],
  contributionAreas: ['security', 'access_control', 'identity'],
};

// ============================================
// ALL AGENTS REGISTRY
// ============================================

export const ALL_AGENTS: AgentManifest[] = [
  CORNELIUS_MANIFEST,
  PROMETHEUS_MANIFEST,
  DORIS_MANIFEST,
  INFINITY_MANIFEST,
  GUARDIAN_MANIFEST,
];

// Import The Dr separately
import { THE_DR_CONFIG } from './theDr';

export const THE_DR_MANIFEST_FULL: AgentManifest = {
  id: THE_DR_CONFIG.id,
  name: THE_DR_CONFIG.name,
  avatar: THE_DR_CONFIG.avatar,
  description: THE_DR_CONFIG.description,
  personality: {
    style: THE_DR_CONFIG.personality.style,
    tone: THE_DR_CONFIG.personality.tone,
    specialties: THE_DR_CONFIG.personality.quirks,
  },
  capabilities: THE_DR_CONFIG.capabilities.map(cap => ({
    id: cap,
    name: cap.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    category: 'core' as CapabilityCategory,
    description: `${cap} capability`,
    enabled: true,
    learnable: true,
    shareable: true,
  })),
  status: THE_DR_CONFIG.status,
  version: '2.0.0',
  lastUpdated: new Date(),
  learningEnabled: THE_DR_CONFIG.learningEnabled,
  collaborationEnabled: THE_DR_CONFIG.collaborationEnabled,
  selfImprovementEnabled: true,
  ecosystemRoles: ['healer', 'doctor', 'optimizer'],
  contributionAreas: ['error_handling', 'system_health', 'performance'],
};

// Add The Dr to all agents
ALL_AGENTS.push(THE_DR_MANIFEST_FULL);

// ============================================
// CAPABILITY FUNCTIONS
// ============================================

/**
 * Get all capabilities for an agent
 */
export function getAgentCapabilities(agentId: string): AgentCapability[] {
  const agent = ALL_AGENTS.find(a => a.id === agentId);
  return agent?.capabilities || [];
}

/**
 * Check if agent has a specific capability
 */
export function hasCapability(agentId: string, capabilityId: string): boolean {
  const capabilities = getAgentCapabilities(agentId);
  return capabilities.some(c => c.id === capabilityId && c.enabled);
}

/**
 * Get all agents with a specific capability
 */
export function getAgentsWithCapability(capabilityId: string): AgentManifest[] {
  return ALL_AGENTS.filter(agent => 
    agent.capabilities.some(c => c.id === capabilityId && c.enabled)
  );
}

/**
 * Get total capability count across all agents
 */
export function getTotalCapabilityCount(): number {
  return ALL_AGENTS.reduce((sum, agent) => sum + agent.capabilities.length, 0);
}

/**
 * Get capability summary
 */
export function getCapabilitySummary(): {
  totalAgents: number;
  totalCapabilities: number;
  byCategory: Record<CapabilityCategory, number>;
  byAgent: Record<string, number>;
} {
  const byCategory: Record<CapabilityCategory, number> = {} as any;
  const byAgent: Record<string, number> = {};
  
  for (const agent of ALL_AGENTS) {
    byAgent[agent.id] = agent.capabilities.length;
    
    for (const cap of agent.capabilities) {
      byCategory[cap.category] = (byCategory[cap.category] || 0) + 1;
    }
  }
  
  return {
    totalAgents: ALL_AGENTS.length,
    totalCapabilities: getTotalCapabilityCount(),
    byCategory,
    byAgent,
  };
}

console.log(`[Agent Capabilities] Loaded ${ALL_AGENTS.length} agents with ${getTotalCapabilityCount()} total capabilities`);
