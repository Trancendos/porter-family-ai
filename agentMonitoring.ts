/**
 * Agent Monitoring & Alerting
 * 
 * Monitors agent health, performance, and errors:
 * - Real-time health checks
 * - Performance metrics (response time, success rate, throughput)
 * - Error tracking and alerting
 * - Resource usage monitoring
 * - SLA compliance tracking
 * - Automated incident response
 */

import { getDb } from '../db';
import { agentTasks, errorLogs } from '../../drizzle/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { notifyOwner } from '../_core/notification';

/**
 * Agent health status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  OFFLINE = 'offline',
}

/**
 * Health check result
 */
export interface HealthCheck {
  agentName: string;
  status: HealthStatus;
  responseTime: number; // ms
  successRate: number; // 0-100
  errorRate: number; // 0-100
  tasksCompleted: number;
  tasksFailed: number;
  lastActive: Date | null;
  issues: string[];
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  agentName: string;
  period: string; // '1h', '24h', '7d', '30d'
  avgResponseTime: number; // ms
  p50ResponseTime: number; // ms (median)
  p95ResponseTime: number; // ms
  p99ResponseTime: number; // ms
  successRate: number; // 0-100
  errorRate: number; // 0-100
  throughput: number; // tasks/hour
  totalTasks: number;
  totalErrors: number;
}

/**
 * Alert severity
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Alert
 */
export interface Alert {
  id: string;
  agentName: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

const activeAlerts: Map<string, Alert> = new Map();

/**
 * SLA thresholds
 */
const SLA_THRESHOLDS = {
  responseTime: {
    healthy: 2000, // <2s
    degraded: 5000, // <5s
    unhealthy: 10000, // <10s
  },
  successRate: {
    healthy: 95, // >95%
    degraded: 90, // >90%
    unhealthy: 80, // >80%
  },
  errorRate: {
    healthy: 5, // <5%
    degraded: 10, // <10%
    unhealthy: 20, // <20%
  },
};

/**
 * Perform health check for agent
 */
export async function checkAgentHealth(agentName: string): Promise<HealthCheck> {
  const db = await getDb();
  if (!db) {
    return {
      agentName,
      status: HealthStatus.OFFLINE,
      responseTime: 0,
      successRate: 0,
      errorRate: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      lastActive: null,
      issues: ['Database unavailable'],
    };
  }
  
  // Get agent from registry
  const { agentRegistry } = await import('../../drizzle/schema');
  const agents = await db
    .select()
    .from(agentRegistry)
    .where(eq(agentRegistry.agentName, agentName))
    .limit(1);
  
  if (agents.length === 0) {
    return {
      agentName,
      status: HealthStatus.OFFLINE,
      responseTime: 0,
      successRate: 0,
      errorRate: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      lastActive: null,
      issues: ['Agent not found in registry'],
    };
  }
  
  const agent = agents[0];
  
  // Get tasks from last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const tasks = await db
    .select()
    .from(agentTasks)
    .where(
      and(
        eq(agentTasks.agentId, agent.id),
        gte(agentTasks.createdAt, oneHourAgo)
      )
    );
  
  if (tasks.length === 0) {
    return {
      agentName,
      status: HealthStatus.OFFLINE,
      responseTime: 0,
      successRate: 0,
      errorRate: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      lastActive: null,
      issues: ['No activity in last hour'],
    };
  }
  
  // Calculate metrics
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const failedTasks = tasks.filter(t => t.status === 'failed');
  
  const responseTimes = completedTasks
    .map(t => {
      if (!t.completedAt || !t.createdAt) return null;
      return t.completedAt.getTime() - t.createdAt.getTime();
    })
    .filter((t): t is number => t !== null);
  
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
    : 0;
  
  const successRate = (completedTasks.length / tasks.length) * 100;
  const errorRate = (failedTasks.length / tasks.length) * 100;
  
  const lastActive = tasks.reduce((latest, task) => {
    const taskDate = task.completedAt || task.createdAt;
    return taskDate && (!latest || taskDate > latest) ? taskDate : latest;
  }, null as Date | null);
  
  // Determine health status
  const issues: string[] = [];
  let status = HealthStatus.HEALTHY;
  
  if (avgResponseTime > SLA_THRESHOLDS.responseTime.unhealthy) {
    status = HealthStatus.UNHEALTHY;
    issues.push(`High response time: ${avgResponseTime.toFixed(0)}ms (threshold: ${SLA_THRESHOLDS.responseTime.unhealthy}ms)`);
  } else if (avgResponseTime > SLA_THRESHOLDS.responseTime.degraded) {
    status = HealthStatus.DEGRADED;
    issues.push(`Elevated response time: ${avgResponseTime.toFixed(0)}ms (threshold: ${SLA_THRESHOLDS.responseTime.degraded}ms)`);
  }
  
  if (successRate < SLA_THRESHOLDS.successRate.unhealthy) {
    status = HealthStatus.UNHEALTHY;
    issues.push(`Low success rate: ${successRate.toFixed(1)}% (threshold: ${SLA_THRESHOLDS.successRate.unhealthy}%)`);
  } else if (successRate < SLA_THRESHOLDS.successRate.degraded) {
    if (status === HealthStatus.HEALTHY) status = HealthStatus.DEGRADED;
    issues.push(`Degraded success rate: ${successRate.toFixed(1)}% (threshold: ${SLA_THRESHOLDS.successRate.degraded}%)`);
  }
  
  if (errorRate > SLA_THRESHOLDS.errorRate.unhealthy) {
    status = HealthStatus.UNHEALTHY;
    issues.push(`High error rate: ${errorRate.toFixed(1)}% (threshold: ${SLA_THRESHOLDS.errorRate.unhealthy}%)`);
  } else if (errorRate > SLA_THRESHOLDS.errorRate.degraded) {
    if (status === HealthStatus.HEALTHY) status = HealthStatus.DEGRADED;
    issues.push(`Elevated error rate: ${errorRate.toFixed(1)}% (threshold: ${SLA_THRESHOLDS.errorRate.degraded}%)`);
  }
  
  return {
    agentName,
    status,
    responseTime: avgResponseTime,
    successRate,
    errorRate,
    tasksCompleted: completedTasks.length,
    tasksFailed: failedTasks.length,
    lastActive,
    issues,
  };
}

/**
 * Get performance metrics for agent
 */
export async function getPerformanceMetrics(
  agentName: string,
  period: '1h' | '24h' | '7d' | '30d' = '24h'
): Promise<PerformanceMetrics> {
  const db = await getDb();
  if (!db) {
    return {
      agentName,
      period,
      avgResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      successRate: 0,
      errorRate: 0,
      throughput: 0,
      totalTasks: 0,
      totalErrors: 0,
    };
  }
  
  // Get agent from registry
  const { agentRegistry } = await import('../../drizzle/schema');
  const agents = await db
    .select()
    .from(agentRegistry)
    .where(eq(agentRegistry.agentName, agentName))
    .limit(1);
  
  if (agents.length === 0) {
    return {
      agentName,
      period,
      avgResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      successRate: 0,
      errorRate: 0,
      throughput: 0,
      totalTasks: 0,
      totalErrors: 0,
    };
  }
  
  const agent = agents[0];
  
  // Calculate time range
  const periodMs = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  }[period];
  
  const startTime = new Date(Date.now() - periodMs);
  
  const tasks = await db
    .select()
    .from(agentTasks)
    .where(
      and(
        eq(agentTasks.agentId, agent.id),
        gte(agentTasks.createdAt, startTime)
      )
    );
  
  if (tasks.length === 0) {
    return {
      agentName,
      period,
      avgResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      successRate: 0,
      errorRate: 0,
      throughput: 0,
      totalTasks: 0,
      totalErrors: 0,
    };
  }
  
  // Calculate response times
  const responseTimes = tasks
    .map(t => {
      if (!t.completedAt || !t.createdAt) return null;
      return t.completedAt.getTime() - t.createdAt.getTime();
    })
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
    : 0;
  
  const p50ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.5)] || 0;
  const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
  const p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;
  
  // Calculate rates
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const failedTasks = tasks.filter(t => t.status === 'failed');
  
  const successRate = (completedTasks.length / tasks.length) * 100;
  const errorRate = (failedTasks.length / tasks.length) * 100;
  
  // Calculate throughput (tasks/hour)
  const periodHours = periodMs / (60 * 60 * 1000);
  const throughput = tasks.length / periodHours;
  
  return {
    agentName,
    period,
    avgResponseTime,
    p50ResponseTime,
    p95ResponseTime,
    p99ResponseTime,
    successRate,
    errorRate,
    throughput,
    totalTasks: tasks.length,
    totalErrors: failedTasks.length,
  };
}

/**
 * Create alert
 */
export async function createAlert(
  agentName: string,
  severity: AlertSeverity,
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<Alert> {
  const alert: Alert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    agentName,
    severity,
    title,
    message,
    timestamp: new Date(),
    resolved: false,
    metadata,
  };
  
  activeAlerts.set(alert.id, alert);
  
  console.log(`[Alert] ${severity.toUpperCase()} - ${agentName}: ${title}`);
  
  // Send notification for critical/error alerts
  if (severity === AlertSeverity.CRITICAL || severity === AlertSeverity.ERROR) {
    await notifyOwner({
      title: `🚨 ${severity.toUpperCase()}: ${title}`,
      content: `Agent: ${agentName}\n\n${message}`,
    });
  }
  
  return alert;
}

/**
 * Resolve alert
 */
export function resolveAlert(alertId: string): boolean {
  const alert = activeAlerts.get(alertId);
  
  if (!alert) {
    return false;
  }
  
  alert.resolved = true;
  alert.resolvedAt = new Date();
  
  console.log(`[Alert] Resolved: ${alert.title}`);
  
  return true;
}

/**
 * Get active alerts
 */
export function getActiveAlerts(agentName?: string): Alert[] {
  const alerts = Array.from(activeAlerts.values()).filter(a => !a.resolved);
  
  if (agentName) {
    return alerts.filter(a => a.agentName === agentName);
  }
  
  return alerts;
}

/**
 * Monitor all agents (run periodically)
 */
export async function monitorAllAgents(): Promise<void> {
  const agents = [
    'Cornelius',
    'Doris',
    'The Dr',
    'Mercury',
    'CARL',
    'The Guardian',
    'The Senator',
    'Justitia',
    'Patent Clerk',
    'Prometheus',
    'The Auditor',
    'Validation Agent',
  ];
  
  for (const agentName of agents) {
    const health = await checkAgentHealth(agentName);
    
    // Create alerts for unhealthy agents
    if (health.status === HealthStatus.UNHEALTHY) {
      await createAlert(
        agentName,
        AlertSeverity.ERROR,
        `Agent ${agentName} is unhealthy`,
        `Issues:\n${health.issues.join('\n')}`,
        { health }
      );
    } else if (health.status === HealthStatus.DEGRADED) {
      await createAlert(
        agentName,
        AlertSeverity.WARNING,
        `Agent ${agentName} performance degraded`,
        `Issues:\n${health.issues.join('\n')}`,
        { health }
      );
    }
  }
}

/**
 * Start monitoring (call this on server startup)
 */
export function startMonitoring(intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout {
  console.log('[Monitoring] Starting agent monitoring...');
  
  // Initial check
  monitorAllAgents();
  
  // Periodic checks
  const interval = setInterval(() => {
    monitorAllAgents();
  }, intervalMs);
  
  return interval;
}

/**
 * Get system-wide metrics
 */
export async function getSystemMetrics(): Promise<{
  totalAgents: number;
  healthyAgents: number;
  degradedAgents: number;
  unhealthyAgents: number;
  offlineAgents: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  avgResponseTime: number;
  overallSuccessRate: number;
  activeAlerts: number;
}> {
  const agents = [
    'Cornelius',
    'Doris',
    'The Dr',
    'Mercury',
    'CARL',
    'The Guardian',
    'The Senator',
    'Justitia',
    'Patent Clerk',
    'Prometheus',
    'The Auditor',
    'Validation Agent',
  ];
  
  const healthChecks = await Promise.all(
    agents.map(agent => checkAgentHealth(agent))
  );
  
  const healthyAgents = healthChecks.filter(h => h.status === HealthStatus.HEALTHY).length;
  const degradedAgents = healthChecks.filter(h => h.status === HealthStatus.DEGRADED).length;
  const unhealthyAgents = healthChecks.filter(h => h.status === HealthStatus.UNHEALTHY).length;
  const offlineAgents = healthChecks.filter(h => h.status === HealthStatus.OFFLINE).length;
  
  const totalTasks = healthChecks.reduce((sum, h) => sum + h.tasksCompleted + h.tasksFailed, 0);
  const completedTasks = healthChecks.reduce((sum, h) => sum + h.tasksCompleted, 0);
  const failedTasks = healthChecks.reduce((sum, h) => sum + h.tasksFailed, 0);
  
  const avgResponseTime = healthChecks.reduce((sum, h) => sum + h.responseTime, 0) / healthChecks.length;
  const overallSuccessRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  
  const activeAlertsCount = Array.from(activeAlerts.values()).filter(a => !a.resolved).length;
  
  return {
    totalAgents: agents.length,
    healthyAgents,
    degradedAgents,
    unhealthyAgents,
    offlineAgents,
    totalTasks,
    completedTasks,
    failedTasks,
    avgResponseTime,
    overallSuccessRate,
    activeAlerts: activeAlertsCount,
  };
}
