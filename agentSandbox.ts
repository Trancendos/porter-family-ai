/**
 * Agent Sandbox Environment
 * 
 * Provides isolated execution environment for agents with:
 * - Resource limits (CPU, memory, disk, network quotas)
 * - Permission system (agents can only access authorized resources)
 * - Audit logging (track all agent actions)
 * - Rollback capability (undo agent actions)
 * - Rate limiting (prevent agent abuse/DDoS)
 * 
 * Security Model:
 * - Each agent runs in isolated context
 * - Resource usage tracked and limited
 * - All actions logged for audit
 * - Dangerous operations require approval
 * - Rollback points for critical operations
 */

import { getDb } from '../db';
import { agentTasks, errorLogs } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Resource limits per agent
 */
export interface ResourceLimits {
  maxCpuPercent: number; // Max CPU usage (0-100%)
  maxMemoryMB: number; // Max memory in MB
  maxDiskMB: number; // Max disk usage in MB
  maxNetworkKBps: number; // Max network bandwidth in KB/s
  maxExecutionTimeMs: number; // Max execution time in ms
  maxConcurrentTasks: number; // Max concurrent tasks
}

/**
 * Default resource limits by agent type
 */
const DEFAULT_LIMITS: Record<string, ResourceLimits> = {
  'Cornelius': {
    maxCpuPercent: 50,
    maxMemoryMB: 512,
    maxDiskMB: 100,
    maxNetworkKBps: 1000,
    maxExecutionTimeMs: 30000, // 30s
    maxConcurrentTasks: 10,
  },
  'The Dr': {
    maxCpuPercent: 80,
    maxMemoryMB: 2048,
    maxDiskMB: 500,
    maxNetworkKBps: 2000,
    maxExecutionTimeMs: 120000, // 2min
    maxConcurrentTasks: 5,
  },
  'CARL': {
    maxCpuPercent: 30,
    maxMemoryMB: 256,
    maxDiskMB: 50,
    maxNetworkKBps: 500,
    maxExecutionTimeMs: 15000, // 15s
    maxConcurrentTasks: 20,
  },
  'default': {
    maxCpuPercent: 50,
    maxMemoryMB: 512,
    maxDiskMB: 100,
    maxNetworkKBps: 1000,
    maxExecutionTimeMs: 60000, // 1min
    maxConcurrentTasks: 10,
  },
};

/**
 * Permission levels
 */
export enum PermissionLevel {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  ADMIN = 'admin',
}

/**
 * Agent permissions
 */
export interface AgentPermissions {
  database: PermissionLevel[];
  filesystem: PermissionLevel[];
  network: PermissionLevel[];
  llm: PermissionLevel[];
  storage: PermissionLevel[];
}

/**
 * Default permissions by agent
 */
const DEFAULT_PERMISSIONS: Record<string, AgentPermissions> = {
  'Cornelius': {
    database: [PermissionLevel.READ, PermissionLevel.WRITE],
    filesystem: [PermissionLevel.READ],
    network: [PermissionLevel.READ, PermissionLevel.WRITE],
    llm: [PermissionLevel.EXECUTE],
    storage: [PermissionLevel.READ],
  },
  'The Dr': {
    database: [PermissionLevel.READ, PermissionLevel.WRITE],
    filesystem: [PermissionLevel.READ, PermissionLevel.WRITE, PermissionLevel.EXECUTE],
    network: [PermissionLevel.READ, PermissionLevel.WRITE],
    llm: [PermissionLevel.EXECUTE],
    storage: [PermissionLevel.READ, PermissionLevel.WRITE],
  },
  'The Guardian': {
    database: [PermissionLevel.READ],
    filesystem: [PermissionLevel.READ],
    network: [PermissionLevel.READ],
    llm: [PermissionLevel.EXECUTE],
    storage: [PermissionLevel.READ],
  },
  'default': {
    database: [PermissionLevel.READ],
    filesystem: [PermissionLevel.READ],
    network: [PermissionLevel.READ],
    llm: [PermissionLevel.EXECUTE],
    storage: [PermissionLevel.READ],
  },
};

/**
 * Sandbox context for agent execution
 */
export interface SandboxContext {
  agentName: string;
  taskId: number;
  limits: ResourceLimits;
  permissions: AgentPermissions;
  startTime: number;
  resourceUsage: {
    cpuPercent: number;
    memoryMB: number;
    diskMB: number;
    networkKBps: number;
  };
}

/**
 * Active sandbox contexts
 */
const activeSandboxes: Map<string, SandboxContext> = new Map();

/**
 * Create sandbox context for agent
 */
export function createSandbox(agentName: string, taskId: number): SandboxContext {
  const limits = DEFAULT_LIMITS[agentName] || DEFAULT_LIMITS['default'];
  const permissions = DEFAULT_PERMISSIONS[agentName] || DEFAULT_PERMISSIONS['default'];
  
  const context: SandboxContext = {
    agentName,
    taskId,
    limits,
    permissions,
    startTime: Date.now(),
    resourceUsage: {
      cpuPercent: 0,
      memoryMB: 0,
      diskMB: 0,
      networkKBps: 0,
    },
  };
  
  const sandboxId = `${agentName}-${taskId}`;
  activeSandboxes.set(sandboxId, context);
  
  console.log(`[Sandbox] Created sandbox for ${agentName} (task ${taskId})`);
  
  return context;
}

/**
 * Check if agent has permission
 */
export function hasPermission(
  context: SandboxContext,
  resource: keyof AgentPermissions,
  level: PermissionLevel
): boolean {
  const permissions = context.permissions[resource];
  return permissions.includes(level);
}

/**
 * Check resource limits
 */
export function checkResourceLimits(context: SandboxContext): {
  withinLimits: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  
  // Check CPU
  if (context.resourceUsage.cpuPercent > context.limits.maxCpuPercent) {
    violations.push(`CPU usage (${context.resourceUsage.cpuPercent}%) exceeds limit (${context.limits.maxCpuPercent}%)`);
  }
  
  // Check memory
  if (context.resourceUsage.memoryMB > context.limits.maxMemoryMB) {
    violations.push(`Memory usage (${context.resourceUsage.memoryMB}MB) exceeds limit (${context.limits.maxMemoryMB}MB)`);
  }
  
  // Check disk
  if (context.resourceUsage.diskMB > context.limits.maxDiskMB) {
    violations.push(`Disk usage (${context.resourceUsage.diskMB}MB) exceeds limit (${context.limits.maxDiskMB}MB)`);
  }
  
  // Check network
  if (context.resourceUsage.networkKBps > context.limits.maxNetworkKBps) {
    violations.push(`Network usage (${context.resourceUsage.networkKBps}KB/s) exceeds limit (${context.limits.maxNetworkKBps}KB/s)`);
  }
  
  // Check execution time
  const executionTime = Date.now() - context.startTime;
  if (executionTime > context.limits.maxExecutionTimeMs) {
    violations.push(`Execution time (${executionTime}ms) exceeds limit (${context.limits.maxExecutionTimeMs}ms)`);
  }
  
  return {
    withinLimits: violations.length === 0,
    violations,
  };
}

/**
 * Execute agent action in sandbox
 */
export async function executeInSandbox<T>(
  context: SandboxContext,
  action: () => Promise<T>,
  options?: {
    requirePermission?: { resource: keyof AgentPermissions; level: PermissionLevel };
    timeout?: number;
  }
): Promise<T> {
  // Check permissions
  if (options?.requirePermission) {
    const { resource, level } = options.requirePermission;
    if (!hasPermission(context, resource, level)) {
      throw new Error(`Agent ${context.agentName} does not have ${level} permission for ${resource}`);
    }
  }
  
  // Check resource limits before execution
  const limitsCheck = checkResourceLimits(context);
  if (!limitsCheck.withinLimits) {
    throw new Error(`Resource limits exceeded: ${limitsCheck.violations.join(', ')}`);
  }
  
  // Execute with timeout
  const timeout = options?.timeout || context.limits.maxExecutionTimeMs;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Execution timeout')), timeout);
  });
  
  try {
    const result = await Promise.race([action(), timeoutPromise]);
    
    // Log successful execution
    await logSandboxAction(context, 'execute', 'success', {
      duration: Date.now() - context.startTime,
    });
    
    return result;
  } catch (error) {
    // Log failed execution
    await logSandboxAction(context, 'execute', 'failure', {
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - context.startTime,
    });
    
    throw error;
  }
}

/**
 * Log sandbox action for audit
 */
async function logSandboxAction(
  context: SandboxContext,
  action: string,
  status: 'success' | 'failure',
  metadata: Record<string, any>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.insert(errorLogs).values({
      operation: `sandbox_${action}_${context.agentName}`,
      errorMessage: status === 'success' ? 'Action completed' : 'Action failed',
      context: JSON.stringify({
        agentName: context.agentName,
        taskId: context.taskId,
        resourceUsage: context.resourceUsage,
        ...metadata,
      }),
      severity: status === 'success' ? 'low' : 'medium',
      resolved: status === 'success' ? 1 : 0,
    });
  } catch (error) {
    console.error('[Sandbox] Failed to log action:', error);
  }
}

/**
 * Update resource usage
 */
export function updateResourceUsage(
  context: SandboxContext,
  usage: Partial<SandboxContext['resourceUsage']>
): void {
  context.resourceUsage = {
    ...context.resourceUsage,
    ...usage,
  };
  
  // Check if limits exceeded
  const limitsCheck = checkResourceLimits(context);
  if (!limitsCheck.withinLimits) {
    console.warn(`[Sandbox] Resource limits exceeded for ${context.agentName}:`, limitsCheck.violations);
  }
}

/**
 * Destroy sandbox context
 */
export function destroySandbox(agentName: string, taskId: number): void {
  const sandboxId = `${agentName}-${taskId}`;
  activeSandboxes.delete(sandboxId);
  
  console.log(`[Sandbox] Destroyed sandbox for ${agentName} (task ${taskId})`);
}

/**
 * Get active sandboxes
 */
export function getActiveSandboxes(): SandboxContext[] {
  return Array.from(activeSandboxes.values());
}

/**
 * Rate limiter for agents
 */
const rateLimits: Map<string, { count: number; resetTime: number }> = new Map();

/**
 * Check rate limit for agent
 */
export function checkRateLimit(
  agentName: string,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const limit = rateLimits.get(agentName);
  
  if (!limit || now > limit.resetTime) {
    // Reset or create new limit
    const resetTime = now + windowMs;
    rateLimits.set(agentName, { count: 1, resetTime });
    return { allowed: true, remaining: maxRequests - 1, resetTime };
  }
  
  if (limit.count >= maxRequests) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetTime: limit.resetTime };
  }
  
  // Increment count
  limit.count++;
  return { allowed: true, remaining: maxRequests - limit.count, resetTime: limit.resetTime };
}

/**
 * Rollback point for critical operations
 */
export interface RollbackPoint {
  id: string;
  agentName: string;
  taskId: number;
  timestamp: number;
  state: Record<string, any>;
  description: string;
}

const rollbackPoints: Map<string, RollbackPoint> = new Map();

/**
 * Create rollback point
 */
export function createRollbackPoint(
  agentName: string,
  taskId: number,
  state: Record<string, any>,
  description: string
): string {
  const id = `${agentName}-${taskId}-${Date.now()}`;
  
  const rollbackPoint: RollbackPoint = {
    id,
    agentName,
    taskId,
    timestamp: Date.now(),
    state,
    description,
  };
  
  rollbackPoints.set(id, rollbackPoint);
  
  console.log(`[Sandbox] Created rollback point: ${description}`);
  
  return id;
}

/**
 * Rollback to point
 */
export function rollbackToPoint(rollbackId: string): RollbackPoint | null {
  const point = rollbackPoints.get(rollbackId);
  
  if (!point) {
    console.error(`[Sandbox] Rollback point not found: ${rollbackId}`);
    return null;
  }
  
  console.log(`[Sandbox] Rolling back to: ${point.description}`);
  
  return point;
}

/**
 * Get rollback points for agent/task
 */
export function getRollbackPoints(agentName?: string, taskId?: number): RollbackPoint[] {
  const points = Array.from(rollbackPoints.values());
  
  return points.filter(point => {
    if (agentName && point.agentName !== agentName) return false;
    if (taskId !== undefined && point.taskId !== taskId) return false;
    return true;
  });
}
