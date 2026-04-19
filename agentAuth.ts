/**
 * Agent Authentication & Authorization
 * 
 * Controls access to agent operations:
 * - Who can create/modify agents
 * - Who can delegate tasks to agents
 * - Who can view agent conversations
 * - Who can modify agent permissions
 * - Who can access sensitive agent data
 * 
 * Security Model:
 * - **Owner**: Full access (create, modify, delete agents)
 * - **Admin**: Manage agents, view all data, delegate tasks
 * - **User**: View own tasks, delegate to allowed agents
 * - **Guest**: Read-only access to public data
 */

import { User } from '../../drizzle/schema';
import { ENV } from '../_core/env';

/**
 * Permission levels
 */
export enum AgentPermission {
  // Agent Management
  CREATE_AGENT = 'create_agent',
  MODIFY_AGENT = 'modify_agent',
  DELETE_AGENT = 'delete_agent',
  VIEW_AGENT = 'view_agent',
  
  // Task Management
  DELEGATE_TASK = 'delegate_task',
  VIEW_TASK = 'view_task',
  CANCEL_TASK = 'cancel_task',
  
  // Communication
  SEND_MESSAGE = 'send_message',
  VIEW_CONVERSATION = 'view_conversation',
  
  // Configuration
  MODIFY_PERMISSIONS = 'modify_permissions',
  MODIFY_LIMITS = 'modify_limits',
  
  // Sensitive Operations
  VIEW_LOGS = 'view_logs',
  ROLLBACK = 'rollback',
  EXECUTE_SANDBOX = 'execute_sandbox',
}

/**
 * Role-based permissions
 */
const ROLE_PERMISSIONS: Record<string, AgentPermission[]> = {
  owner: [
    // Full access
    AgentPermission.CREATE_AGENT,
    AgentPermission.MODIFY_AGENT,
    AgentPermission.DELETE_AGENT,
    AgentPermission.VIEW_AGENT,
    AgentPermission.DELEGATE_TASK,
    AgentPermission.VIEW_TASK,
    AgentPermission.CANCEL_TASK,
    AgentPermission.SEND_MESSAGE,
    AgentPermission.VIEW_CONVERSATION,
    AgentPermission.MODIFY_PERMISSIONS,
    AgentPermission.MODIFY_LIMITS,
    AgentPermission.VIEW_LOGS,
    AgentPermission.ROLLBACK,
    AgentPermission.EXECUTE_SANDBOX,
  ],
  admin: [
    // Agent management
    AgentPermission.MODIFY_AGENT,
    AgentPermission.VIEW_AGENT,
    AgentPermission.DELEGATE_TASK,
    AgentPermission.VIEW_TASK,
    AgentPermission.CANCEL_TASK,
    AgentPermission.SEND_MESSAGE,
    AgentPermission.VIEW_CONVERSATION,
    AgentPermission.VIEW_LOGS,
    AgentPermission.ROLLBACK,
  ],
  user: [
    // Basic operations
    AgentPermission.VIEW_AGENT,
    AgentPermission.DELEGATE_TASK,
    AgentPermission.VIEW_TASK,
    AgentPermission.SEND_MESSAGE,
    AgentPermission.VIEW_CONVERSATION,
  ],
  guest: [
    // Read-only
    AgentPermission.VIEW_AGENT,
    AgentPermission.VIEW_TASK,
  ],
};

/**
 * Check if user has permission
 */
export function hasPermission(user: User | null, permission: AgentPermission): boolean {
  if (!user) {
    // Unauthenticated users have no permissions
    return false;
  }
  
  // Owner has all permissions
  if (user.openId === ENV.ownerOpenId) {
    return true;
  }
  
  // Check role-based permissions
  const role = user.role || 'user';
  const permissions = ROLE_PERMISSIONS[role] || [];
  
  return permissions.includes(permission);
}

/**
 * Check if user can access agent
 */
export function canAccessAgent(user: User | null, agentName: string): boolean {
  if (!user) {
    return false;
  }
  
  // Owner and admin can access all agents
  if (user.openId === ENV.ownerOpenId || user.role === 'admin') {
    return true;
  }
  
  // Users can access non-sensitive agents
  const publicAgents = ['Cornelius', 'CARL', 'The Dr'];
  return publicAgents.includes(agentName);
}

/**
 * Check if user can access task
 */
export function canAccessTask(user: User | null, taskUserId?: number): boolean {
  if (!user) {
    return false;
  }
  
  // Owner and admin can access all tasks
  if (user.openId === ENV.ownerOpenId || user.role === 'admin') {
    return true;
  }
  
  // Users can only access their own tasks
  return taskUserId === user.id;
}

/**
 * Check if user can access conversation
 */
export function canAccessConversation(
  user: User | null,
  conversationUserId?: number
): boolean {
  if (!user) {
    return false;
  }
  
  // Owner and admin can access all conversations
  if (user.openId === ENV.ownerOpenId || user.role === 'admin') {
    return true;
  }
  
  // Users can only access their own conversations
  return conversationUserId === user.id;
}

/**
 * Get allowed agents for user
 */
export function getAllowedAgents(user: User | null): string[] {
  if (!user) {
    return [];
  }
  
  // Owner and admin can access all agents
  if (user.openId === ENV.ownerOpenId || user.role === 'admin') {
    return [
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
  }
  
  // Regular users can access public agents
  return ['Cornelius', 'CARL', 'The Dr'];
}

/**
 * Rate limiting per user
 */
const userRateLimits: Map<number, { count: number; resetTime: number }> = new Map();

/**
 * Check rate limit for user
 */
export function checkUserRateLimit(
  userId: number,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const limit = userRateLimits.get(userId);
  
  if (!limit || now > limit.resetTime) {
    // Reset or create new limit
    const resetTime = now + windowMs;
    userRateLimits.set(userId, { count: 1, resetTime });
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
 * Audit log for sensitive operations
 */
export interface AuditLog {
  userId: number;
  userName: string;
  action: string;
  resource: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  details?: Record<string, any>;
}

const auditLogs: AuditLog[] = [];

/**
 * Log sensitive operation
 */
export function logAuditEvent(log: AuditLog): void {
  auditLogs.push(log);
  
  console.log(`[Audit] ${log.userName} ${log.action} ${log.resource} - ${log.success ? 'SUCCESS' : 'FAILED'}`);
  
  // In production, send to external logging service (e.g., Datadog, Sentry)
  // await sendToLoggingService(log);
}

/**
 * Get audit logs (admin only)
 */
export function getAuditLogs(
  user: User | null,
  filters?: {
    userId?: number;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
  }
): AuditLog[] {
  if (!user || (user.openId !== ENV.ownerOpenId && user.role !== 'admin')) {
    throw new Error('Unauthorized: Only admins can view audit logs');
  }
  
  let filtered = auditLogs;
  
  if (filters?.userId) {
    filtered = filtered.filter(log => log.userId === filters.userId);
  }
  
  if (filters?.action) {
    filtered = filtered.filter(log => log.action === filters.action);
  }
  
  if (filters?.resource) {
    filtered = filtered.filter(log => log.resource.includes(filters.resource!));
  }
  
  if (filters?.startDate) {
    filtered = filtered.filter(log => log.timestamp >= filters.startDate!);
  }
  
  if (filters?.endDate) {
    filtered = filtered.filter(log => log.timestamp <= filters.endDate!);
  }
  
  return filtered;
}

/**
 * API Key authentication for external services
 */
export interface ApiKey {
  id: string;
  userId: number;
  name: string;
  key: string;
  permissions: AgentPermission[];
  expiresAt?: Date;
  createdAt: Date;
  lastUsedAt?: Date;
}

const apiKeys: Map<string, ApiKey> = new Map();

/**
 * Create API key
 */
export function createApiKey(
  user: User,
  name: string,
  permissions: AgentPermission[],
  expiresAt?: Date
): ApiKey {
  // Generate secure API key
  const key = `trancendos_${generateSecureToken(32)}`;
  
  const apiKey: ApiKey = {
    id: generateSecureToken(16),
    userId: user.id,
    name,
    key,
    permissions,
    expiresAt,
    createdAt: new Date(),
  };
  
  apiKeys.set(key, apiKey);
  
  logAuditEvent({
    userId: user.id,
    userName: user.name ?? 'Unknown',
    action: 'CREATE_API_KEY',
    resource: `api_key:${apiKey.id}`,
    timestamp: new Date(),
    success: true,
    details: { name, permissions },
  });
  
  return apiKey;
}

/**
 * Validate API key
 */
export function validateApiKey(key: string): ApiKey | null {
  const apiKey = apiKeys.get(key);
  
  if (!apiKey) {
    return null;
  }
  
  // Check expiration
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return null;
  }
  
  // Update last used
  apiKey.lastUsedAt = new Date();
  
  return apiKey;
}

/**
 * Revoke API key
 */
export function revokeApiKey(user: User, keyId: string): boolean {
  // Find key by ID
  for (const [key, apiKey] of Array.from(apiKeys.entries())) {
    if (apiKey.id === keyId) {
      // Check ownership
      if (apiKey.userId !== user.id && user.openId !== ENV.ownerOpenId) {
        throw new Error('Unauthorized: Cannot revoke API key owned by another user');
      }
      
      apiKeys.delete(key);
      
      logAuditEvent({
        userId: user.id,
        userName: user.name ?? 'Unknown',
        action: 'REVOKE_API_KEY',
        resource: `api_key:${keyId}`,
        timestamp: new Date(),
        success: true,
      });
      
      return true;
    }
  }
  
  return false;
}

/**
 * Generate secure token
 */
function generateSecureToken(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    token += chars[randomIndex];
  }
  
  return token;
}

/**
 * Example usage in tRPC procedures
 */
export const authExamples = {
  // Protect agent creation
  createAgent: `
    protectedProcedure
      .input(z.object({ name: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!hasPermission(ctx.user, AgentPermission.CREATE_AGENT)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'No permission to create agents' });
        }
        
        // Create agent...
      })
  `,
  
  // Protect task delegation
  delegateTask: `
    protectedProcedure
      .input(z.object({ agentName: z.string(), prompt: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!hasPermission(ctx.user, AgentPermission.DELEGATE_TASK)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'No permission to delegate tasks' });
        }
        
        if (!canAccessAgent(ctx.user, input.agentName)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'No access to this agent' });
        }
        
        // Check rate limit
        const rateLimit = checkUserRateLimit(ctx.user.id);
        if (!rateLimit.allowed) {
          throw new TRPCError({ 
            code: 'TOO_MANY_REQUESTS', 
            message: \`Rate limit exceeded. Try again in \${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)}s\`
          });
        }
        
        // Delegate task...
        
        // Log audit event
        logAuditEvent({
          userId: ctx.user.id,
          userName: ctx.user.name || 'Unknown',
          action: 'DELEGATE_TASK',
          resource: \`agent:\${input.agentName}\`,
          timestamp: new Date(),
          success: true,
          details: { prompt: input.prompt },
        });
      })
  `,
};
