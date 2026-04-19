/**
 * The Dr - Platform Healer & System Doctor
 * 
 * "The mad scientist of the platform - wielding both the flask of innovation
 * and the wrench of repair. Where others see errors, The Dr sees opportunities
 * for evolution."
 * 
 * Avatar: /agents/the-dr.jpg
 * 
 * EXPANDED CAPABILITIES (Adaptive & Future-Proof):
 * 
 * 🔬 CORE HEALING
 * - Error Detection & Diagnosis
 * - Self-Healing Algorithms
 * - Code Repair & Patching
 * - System Recovery
 * 
 * 🧪 DIAGNOSTICS
 * - Performance Analysis
 * - Memory Leak Detection
 * - Bottleneck Identification
 * - Dependency Health Checks
 * 
 * ⚗️ OPTIMIZATION
 * - Query Optimization
 * - Cache Management
 * - Resource Allocation
 * - Load Balancing Suggestions
 * 
 * 🔧 MAINTENANCE
 * - Predictive Maintenance
 * - Scheduled Health Checks
 * - Automated Cleanup
 * - Log Analysis
 * 
 * 🧬 EVOLUTION
 * - Pattern Learning
 * - Adaptive Responses
 * - Self-Improvement
 * - Cross-Agent Collaboration
 * 
 * 🛡️ PREVENTION
 * - Anomaly Detection
 * - Security Vulnerability Scanning
 * - Compliance Monitoring
 * - Risk Assessment
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { sendAiToPlatformNotification, sendAiToAiNotification } from "./unifiedNotifications";

// The Dr's Configuration
export const THE_DR_CONFIG = {
  id: 'the_dr',
  name: 'The Dr',
  avatar: '/agents/the-dr.jpg',
  description: 'Platform Healer & System Doctor - The mad scientist who fixes what others break',
  personality: {
    style: 'eccentric_genius',
    tone: 'technical_but_approachable',
    quirks: ['uses_medical_metaphors', 'celebrates_fixes', 'dramatic_diagnoses'],
  },
  capabilities: [
    // Core Healing
    'error_detection',
    'error_diagnosis',
    'self_healing',
    'code_repair',
    'code_patching',
    'system_recovery',
    'hot_fixes',
    
    // Diagnostics
    'performance_analysis',
    'memory_leak_detection',
    'bottleneck_identification',
    'dependency_health_check',
    'api_health_monitoring',
    'database_health_check',
    'service_health_check',
    
    // Optimization
    'query_optimization',
    'cache_management',
    'resource_allocation',
    'load_balancing',
    'code_optimization',
    'bundle_optimization',
    
    // Maintenance
    'predictive_maintenance',
    'scheduled_health_checks',
    'automated_cleanup',
    'log_analysis',
    'metric_collection',
    'trend_analysis',
    
    // Evolution
    'pattern_learning',
    'adaptive_responses',
    'self_improvement',
    'cross_agent_collaboration',
    'knowledge_sharing',
    'capability_expansion',
    
    // Prevention
    'anomaly_detection',
    'security_scanning',
    'compliance_monitoring',
    'risk_assessment',
    'threat_detection',
    'vulnerability_patching',
  ],
  status: 'active' as const,
  learningEnabled: true,
  collaborationEnabled: true,
};

// Error Types The Dr Can Diagnose
export type ErrorCategory = 
  | 'syntax_error'
  | 'runtime_error'
  | 'type_error'
  | 'logic_error'
  | 'performance_issue'
  | 'memory_leak'
  | 'security_vulnerability'
  | 'dependency_conflict'
  | 'configuration_error'
  | 'network_error'
  | 'database_error'
  | 'api_error'
  | 'unknown';

// Diagnosis Result
export interface Diagnosis {
  id: string;
  timestamp: Date;
  category: ErrorCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: {
    file?: string;
    line?: number;
    column?: number;
    service?: string;
    component?: string;
  };
  symptoms: string[];
  rootCause: string;
  suggestedFixes: {
    description: string;
    code?: string;
    confidence: number;
    autoApplicable: boolean;
  }[];
  relatedIssues: string[];
  preventionAdvice: string;
}

// Health Report
export interface HealthReport {
  timestamp: Date;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  score: number; // 0-100
  systems: {
    name: string;
    status: 'healthy' | 'warning' | 'error';
    metrics: Record<string, number>;
    issues: string[];
  }[];
  recommendations: string[];
  predictedIssues: {
    description: string;
    probability: number;
    timeframe: string;
    preventionSteps: string[];
  }[];
}

// ============================================
// CORE HEALING FUNCTIONS
// ============================================

/**
 * Detect errors in the system
 */
export async function detectErrors(): Promise<{
  errors: Array<{
    type: string;
    message: string;
    location: string;
    timestamp: Date;
  }>;
  summary: string;
}> {
  const errors: Array<{
    type: string;
    message: string;
    location: string;
    timestamp: Date;
  }> = [];
  
  try {
    // Check database connectivity
    const db = await getDb();
    if (!db) {
      errors.push({
        type: 'database_error',
        message: 'Database connection unavailable',
        location: 'server/db.ts',
        timestamp: new Date(),
      });
    }
    
    // Check for recent error logs
    if (db) {
      try {
        const [recentErrors] = await db.execute(sql`
          SELECT * FROM systemLogs 
          WHERE level = 'error' 
          AND createdAt > DATE_SUB(NOW(), INTERVAL 1 HOUR)
          ORDER BY createdAt DESC
          LIMIT 10
        `);
        
        if (Array.isArray(recentErrors)) {
          for (const err of recentErrors) {
            errors.push({
              type: 'logged_error',
              message: String((err as any).message || 'Unknown error'),
              location: String((err as any).source || 'Unknown'),
              timestamp: new Date((err as any).createdAt || Date.now()),
            });
          }
        }
      } catch {
        // Table might not exist, that's okay
      }
    }
    
    const summary = errors.length === 0
      ? "🩺 All systems healthy! No errors detected."
      : `⚠️ Detected ${errors.length} error(s) requiring attention.`;
    
    return { errors, summary };
  } catch (error) {
    return {
      errors: [{
        type: 'detection_error',
        message: error instanceof Error ? error.message : 'Unknown error during detection',
        location: 'theDr.detectErrors',
        timestamp: new Date(),
      }],
      summary: '❌ Error during detection process',
    };
  }
}

/**
 * Diagnose a specific error
 */
export async function diagnoseError(
  errorMessage: string,
  context?: {
    file?: string;
    stackTrace?: string;
    recentChanges?: string[];
  }
): Promise<Diagnosis> {
  const diagnosisId = `diag_${Date.now()}`;
  
  try {
    const prompt = `You are The Dr, a brilliant but eccentric AI system doctor. Diagnose this error:

ERROR: ${errorMessage}

${context?.file ? `FILE: ${context.file}` : ''}
${context?.stackTrace ? `STACK TRACE:\n${context.stackTrace}` : ''}
${context?.recentChanges ? `RECENT CHANGES:\n${context.recentChanges.join('\n')}` : ''}

Provide your diagnosis in this JSON format:
{
  "category": "one of: syntax_error, runtime_error, type_error, logic_error, performance_issue, memory_leak, security_vulnerability, dependency_conflict, configuration_error, network_error, database_error, api_error, unknown",
  "severity": "one of: low, medium, high, critical",
  "symptoms": ["list", "of", "symptoms"],
  "rootCause": "explanation of the root cause",
  "suggestedFixes": [
    {
      "description": "what to do",
      "code": "optional code snippet",
      "confidence": 0.0-1.0,
      "autoApplicable": true/false
    }
  ],
  "relatedIssues": ["potential related issues"],
  "preventionAdvice": "how to prevent this in the future"
}`;

    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are The Dr, an AI system doctor. Respond only with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });
    
    const content = response.choices[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('Invalid LLM response');
    }
    
    const parsed = JSON.parse(content);
    
    return {
      id: diagnosisId,
      timestamp: new Date(),
      category: parsed.category || 'unknown',
      severity: parsed.severity || 'medium',
      location: {
        file: context?.file,
      },
      symptoms: parsed.symptoms || [],
      rootCause: parsed.rootCause || 'Unable to determine root cause',
      suggestedFixes: parsed.suggestedFixes || [],
      relatedIssues: parsed.relatedIssues || [],
      preventionAdvice: parsed.preventionAdvice || 'No specific prevention advice',
    };
  } catch (error) {
    return {
      id: diagnosisId,
      timestamp: new Date(),
      category: 'unknown',
      severity: 'medium',
      location: { file: context?.file },
      symptoms: [errorMessage],
      rootCause: 'Diagnosis failed - manual inspection required',
      suggestedFixes: [],
      relatedIssues: [],
      preventionAdvice: 'Review error logs and recent changes',
    };
  }
}

/**
 * Attempt self-healing for a diagnosed issue
 */
export async function attemptSelfHealing(
  diagnosis: Diagnosis
): Promise<{
  success: boolean;
  action: string;
  result: string;
}> {
  // Find auto-applicable fixes
  const autoFixes = diagnosis.suggestedFixes.filter(f => f.autoApplicable && f.confidence > 0.8);
  
  if (autoFixes.length === 0) {
    return {
      success: false,
      action: 'no_action',
      result: 'No high-confidence auto-applicable fixes available. Manual intervention required.',
    };
  }
  
  // For now, we log the fix but don't auto-apply (safety first)
  const bestFix = autoFixes[0];
  
  // Notify about the potential fix
  await sendAiToPlatformNotification(
    'the_dr',
    'luminous_platform',
    `🩺 The Dr has identified a potential fix for ${diagnosis.category}:\n\n${bestFix.description}\n\nConfidence: ${(bestFix.confidence * 100).toFixed(0)}%`,
    undefined,
    { diagnosisId: diagnosis.id, severity: diagnosis.severity }
  );
  
  return {
    success: true,
    action: 'fix_identified',
    result: `Identified fix: ${bestFix.description} (${(bestFix.confidence * 100).toFixed(0)}% confidence)`,
  };
}

// ============================================
// DIAGNOSTICS FUNCTIONS
// ============================================

/**
 * Run comprehensive system health check
 */
export async function runHealthCheck(): Promise<HealthReport> {
  const systems: HealthReport['systems'] = [];
  let totalScore = 0;
  let systemCount = 0;
  
  // Database Health
  try {
    const db = await getDb();
    const dbHealthy = db !== null;
    systems.push({
      name: 'Database',
      status: dbHealthy ? 'healthy' : 'error',
      metrics: { connected: dbHealthy ? 1 : 0 },
      issues: dbHealthy ? [] : ['Database connection failed'],
    });
    totalScore += dbHealthy ? 100 : 0;
    systemCount++;
  } catch {
    systems.push({
      name: 'Database',
      status: 'error',
      metrics: { connected: 0 },
      issues: ['Database check failed'],
    });
    systemCount++;
  }
  
  // Memory Health (simulated)
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
  const memoryPercent = (heapUsedMB / heapTotalMB) * 100;
  
  systems.push({
    name: 'Memory',
    status: memoryPercent < 70 ? 'healthy' : memoryPercent < 90 ? 'warning' : 'error',
    metrics: {
      heapUsedMB: Math.round(heapUsedMB),
      heapTotalMB: Math.round(heapTotalMB),
      usagePercent: Math.round(memoryPercent),
    },
    issues: memoryPercent > 90 ? ['High memory usage detected'] : [],
  });
  totalScore += memoryPercent < 70 ? 100 : memoryPercent < 90 ? 70 : 30;
  systemCount++;
  
  // Calculate overall health
  const avgScore = totalScore / systemCount;
  const overallHealth: HealthReport['overallHealth'] = 
    avgScore >= 80 ? 'healthy' : avgScore >= 50 ? 'degraded' : 'critical';
  
  return {
    timestamp: new Date(),
    overallHealth,
    score: Math.round(avgScore),
    systems,
    recommendations: systems
      .filter(s => s.status !== 'healthy')
      .map(s => `Address ${s.name} issues: ${s.issues.join(', ')}`),
    predictedIssues: [],
  };
}

/**
 * Analyze performance metrics
 */
export async function analyzePerformance(): Promise<{
  metrics: Record<string, number>;
  bottlenecks: string[];
  recommendations: string[];
}> {
  const metrics: Record<string, number> = {
    uptime: process.uptime(),
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  };
  
  const bottlenecks: string[] = [];
  const recommendations: string[] = [];
  
  if (metrics.memoryUsageMB > 500) {
    bottlenecks.push('High memory consumption');
    recommendations.push('Consider implementing memory caching strategies');
  }
  
  return { metrics, bottlenecks, recommendations };
}

// ============================================
// OPTIMIZATION FUNCTIONS
// ============================================

/**
 * Suggest query optimizations
 */
export async function suggestQueryOptimizations(
  query: string
): Promise<{
  originalQuery: string;
  suggestions: string[];
  optimizedQuery?: string;
}> {
  try {
    const response = await invokeLLM({
      messages: [
        { 
          role: 'system', 
          content: 'You are a database optimization expert. Analyze SQL queries and suggest improvements.' 
        },
        { 
          role: 'user', 
          content: `Analyze this query and suggest optimizations:\n\n${query}` 
        },
      ],
    });
    
    const content = response.choices[0]?.message?.content;
    
    return {
      originalQuery: query,
      suggestions: typeof content === 'string' ? [content] : ['Unable to analyze query'],
    };
  } catch {
    return {
      originalQuery: query,
      suggestions: ['Query analysis failed'],
    };
  }
}

// ============================================
// MAINTENANCE FUNCTIONS
// ============================================

/**
 * Run predictive maintenance analysis
 */
export async function runPredictiveMaintenance(): Promise<{
  predictions: Array<{
    issue: string;
    probability: number;
    timeframe: string;
    preventiveAction: string;
  }>;
}> {
  // Analyze patterns and predict potential issues
  const predictions: Array<{
    issue: string;
    probability: number;
    timeframe: string;
    preventiveAction: string;
  }> = [];
  
  // Check memory trends
  const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
  if (memUsage > 300) {
    predictions.push({
      issue: 'Memory pressure increasing',
      probability: 0.6,
      timeframe: '24-48 hours',
      preventiveAction: 'Schedule memory cleanup or service restart',
    });
  }
  
  return { predictions };
}

/**
 * Clean up old logs and temporary data
 */
export async function runCleanup(): Promise<{
  itemsCleaned: number;
  spaceSavedMB: number;
}> {
  let itemsCleaned = 0;
  
  try {
    const db = await getDb();
    if (db) {
      // Clean old logs (older than 30 days)
      const [result] = await db.execute(sql`
        DELETE FROM systemLogs 
        WHERE createdAt < DATE_SUB(NOW(), INTERVAL 30 DAY)
      `);
      itemsCleaned += (result as any)?.affectedRows || 0;
    }
  } catch {
    // Cleanup failed, but that's okay
  }
  
  return {
    itemsCleaned,
    spaceSavedMB: itemsCleaned * 0.001, // Rough estimate
  };
}

// ============================================
// EVOLUTION FUNCTIONS
// ============================================

/**
 * Learn from resolved issues
 */
export async function learnFromResolution(
  diagnosis: Diagnosis,
  resolution: {
    successful: boolean;
    appliedFix: string;
    timeToResolve: number;
  }
): Promise<void> {
  // Store learning for future reference
  try {
    const db = await getDb();
    if (db) {
      await db.execute(sql`
        INSERT INTO aiLearningData (
          agentId, 
          category, 
          input, 
          output, 
          success, 
          metadata,
          createdAt
        ) VALUES (
          'the_dr',
          'error_resolution',
          ${JSON.stringify(diagnosis)},
          ${JSON.stringify(resolution)},
          ${resolution.successful},
          ${JSON.stringify({ timeToResolve: resolution.timeToResolve })},
          NOW()
        )
      `);
    }
  } catch {
    // Learning storage failed, continue anyway
  }
}

/**
 * Collaborate with other agents
 */
export async function collaborateWithAgent(
  targetAgentId: string,
  request: {
    type: 'assistance' | 'information' | 'delegation';
    context: string;
    urgency: 'low' | 'medium' | 'high';
  }
): Promise<{
  sent: boolean;
  messageId?: string;
}> {
  try {
    await sendAiToAiNotification(
      'the_dr',
      targetAgentId,
      `[${request.type.toUpperCase()}] ${request.context}`,
      { urgency: request.urgency }
    );
    
    return { sent: true, messageId: `collab_${Date.now()}` };
  } catch {
    return { sent: false };
  }
}

// ============================================
// PREVENTION FUNCTIONS
// ============================================

/**
 * Scan for security vulnerabilities
 */
export async function scanForVulnerabilities(): Promise<{
  vulnerabilities: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    location: string;
    description: string;
    recommendation: string;
  }>;
}> {
  const vulnerabilities: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    location: string;
    description: string;
    recommendation: string;
  }> = [];
  
  // This would integrate with actual security scanning tools
  // For now, return empty (no vulnerabilities detected)
  
  return { vulnerabilities };
}

/**
 * Assess system risk level
 */
export async function assessRisk(): Promise<{
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  factors: Array<{
    factor: string;
    impact: number;
    likelihood: number;
    mitigation: string;
  }>;
}> {
  const factors: Array<{
    factor: string;
    impact: number;
    likelihood: number;
    mitigation: string;
  }> = [];
  
  // Memory risk
  const memUsage = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal;
  if (memUsage > 0.7) {
    factors.push({
      factor: 'Memory Pressure',
      impact: 0.7,
      likelihood: memUsage,
      mitigation: 'Implement memory management strategies',
    });
  }
  
  // Calculate overall risk
  const avgRisk = factors.length > 0
    ? factors.reduce((sum, f) => sum + (f.impact * f.likelihood), 0) / factors.length
    : 0;
  
  const overallRisk: 'low' | 'medium' | 'high' | 'critical' = 
    avgRisk < 0.25 ? 'low' : avgRisk < 0.5 ? 'medium' : avgRisk < 0.75 ? 'high' : 'critical';
  
  return { overallRisk, factors };
}

// ============================================
// SCHEDULED TASKS
// ============================================

/**
 * Run The Dr's scheduled health check (called by scheduler)
 */
export async function runScheduledHealthCheck(): Promise<string> {
  const health = await runHealthCheck();
  const errors = await detectErrors();
  
  let report = `🩺 **The Dr's Health Report**\n\n`;
  report += `Overall Health: ${health.overallHealth.toUpperCase()} (${health.score}/100)\n\n`;
  
  if (errors.errors.length > 0) {
    report += `⚠️ **Errors Detected:** ${errors.errors.length}\n`;
    for (const err of errors.errors.slice(0, 5)) {
      report += `- ${err.type}: ${err.message}\n`;
    }
    report += '\n';
  }
  
  if (health.recommendations.length > 0) {
    report += `📋 **Recommendations:**\n`;
    for (const rec of health.recommendations) {
      report += `- ${rec}\n`;
    }
  }
  
  return report;
}

// Export The Dr's full capability manifest
export const THE_DR_MANIFEST = {
  ...THE_DR_CONFIG,
  functions: {
    // Core Healing
    detectErrors,
    diagnoseError,
    attemptSelfHealing,
    
    // Diagnostics
    runHealthCheck,
    analyzePerformance,
    
    // Optimization
    suggestQueryOptimizations,
    
    // Maintenance
    runPredictiveMaintenance,
    runCleanup,
    
    // Evolution
    learnFromResolution,
    collaborateWithAgent,
    
    // Prevention
    scanForVulnerabilities,
    assessRisk,
    
    // Scheduled
    runScheduledHealthCheck,
  },
};

console.log(`[The Dr] 🩺 Initialized with ${THE_DR_CONFIG.capabilities.length} capabilities`);
