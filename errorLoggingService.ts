/**
 * Error Logging Service
 * 
 * Comprehensive error tracking, categorization, and monitoring system
 * with structured logging, alerting, and learning capabilities
 */

import { getDb } from "../db";

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';
export type ErrorCategory = 
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'database'
  | 'external_api'
  | 'business_logic'
  | 'system'
  | 'security'
  | 'performance'
  | 'unknown';

export interface ErrorLogEntry {
  level: LogLevel;
  category: ErrorCategory;
  message: string;
  error?: Error;
  context?: Record<string, any>;
  userId?: number;
  appId?: number;
  productId?: string;
  requestId?: string;
  stackTrace?: string;
  timestamp: Date;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsByLevel: Record<LogLevel, number>;
  recentErrors: ErrorLogEntry[];
  errorRate: number; // errors per hour
  topErrors: Array<{ message: string; count: number }>;
}

/**
 * Log an error with full context
 */
export async function logError(entry: Omit<ErrorLogEntry, 'timestamp'>): Promise<void> {
  const timestamp = new Date();
  const fullEntry: ErrorLogEntry = { ...entry, timestamp };
  
  // Extract stack trace if error provided
  if (entry.error && entry.error.stack) {
    fullEntry.stackTrace = entry.error.stack;
  }
  
  // Console log for immediate visibility
  const logMessage = formatLogMessage(fullEntry);
  switch (entry.level) {
    case 'critical':
    case 'error':
      console.error(logMessage);
      break;
    case 'warn':
      console.warn(logMessage);
      break;
    case 'info':
      console.info(logMessage);
      break;
    case 'debug':
      console.debug(logMessage);
      break;
  }
  
  // Store in database
  try {
    const db = await getDb();
    if (!db) return;
    
    const { errorLogs } = await import("../../drizzle/platform-schema");
    await db.insert(errorLogs).values({
      level: entry.level,
      category: entry.category,
      message: entry.message,
      errorName: entry.error?.name,
      errorMessage: entry.error?.message,
      stackTrace: fullEntry.stackTrace,
      context: entry.context ? JSON.stringify(entry.context) : null,
      userId: entry.userId,
      appId: entry.appId,
      productId: entry.productId,
      requestId: entry.requestId,
    });
    
    // Check if alert needed
    if (entry.level === 'critical') {
      await sendCriticalAlert(fullEntry);
    }
  } catch (dbError) {
    console.error('[ErrorLogging] Failed to save to database:', dbError);
  }
}

/**
 * Format log message for console output
 */
function formatLogMessage(entry: ErrorLogEntry): string {
  const parts = [
    `[${entry.timestamp.toISOString()}]`,
    `[${entry.level.toUpperCase()}]`,
    `[${entry.category}]`,
    entry.message,
  ];
  
  if (entry.userId) parts.push(`userId=${entry.userId}`);
  if (entry.appId) parts.push(`appId=${entry.appId}`);
  if (entry.productId) parts.push(`productId=${entry.productId}`);
  if (entry.requestId) parts.push(`requestId=${entry.requestId}`);
  
  if (entry.context) {
    parts.push(`context=${JSON.stringify(entry.context)}`);
  }
  
  if (entry.stackTrace) {
    parts.push(`\n${entry.stackTrace}`);
  }
  
  return parts.join(' ');
}

/**
 * Send critical alert (email, Slack, etc.)
 */
async function sendCriticalAlert(entry: ErrorLogEntry): Promise<void> {
  // TODO: Implement email/Slack notifications
  console.error('🚨 CRITICAL ERROR ALERT:', entry.message);
  
  // Could integrate with:
  // - Email (SendGrid)
  // - Slack webhook
  // - PagerDuty
  // - Discord webhook
}

/**
 * Get error statistics
 */
export async function getErrorStats(timeRangeHours: number = 24): Promise<ErrorStats> {
  const db = await getDb();
  if (!db) {
    return {
      totalErrors: 0,
      errorsByCategory: {} as any,
      errorsByLevel: {} as any,
      recentErrors: [],
      errorRate: 0,
      topErrors: [],
    };
  }
  
  const { errorLogs } = await import("../../drizzle/platform-schema");
  const { gte, sql } = await import("drizzle-orm");
  
  const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
  
  // Get all errors in time range
  const errors = await db
    .select()
    .from(errorLogs)
    .where(gte(errorLogs.createdAt, cutoffTime))
    .orderBy(sql`${errorLogs.createdAt} DESC`)
    .limit(1000);
  
  // Calculate statistics
  const errorsByCategory: Record<ErrorCategory, number> = {
    authentication: 0,
    authorization: 0,
    validation: 0,
    database: 0,
    external_api: 0,
    business_logic: 0,
    system: 0,
    security: 0,
    performance: 0,
    unknown: 0,
  };
  
  const errorsByLevel: Record<LogLevel, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
    critical: 0,
  };
  
  const errorCounts: Record<string, number> = {};
  
  errors.forEach(error => {
    errorsByCategory[error.category as ErrorCategory]++;
    errorsByLevel[error.level as LogLevel]++;
    errorCounts[error.message] = (errorCounts[error.message] || 0) + 1;
  });
  
  // Top errors
  const topErrors = Object.entries(errorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([message, count]) => ({ message, count }));
  
  // Error rate (per hour)
  const errorRate = errors.length / timeRangeHours;
  
  // Recent errors (last 20)
  const recentErrors: ErrorLogEntry[] = errors.slice(0, 20).map(e => ({
    level: e.level as LogLevel,
    category: e.category as ErrorCategory,
    message: e.message,
    userId: e.userId || undefined,
    appId: e.appId || undefined,
    productId: e.productId || undefined,
    requestId: e.requestId || undefined,
    stackTrace: e.stackTrace || undefined,
    context: e.context ? JSON.parse(e.context) : undefined,
    timestamp: e.createdAt,
  }));
  
  return {
    totalErrors: errors.length,
    errorsByCategory,
    errorsByLevel,
    recentErrors,
    errorRate,
    topErrors,
  };
}

/**
 * Categorize error automatically
 */
export function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  
  if (message.includes('auth') || message.includes('login') || message.includes('token')) {
    return 'authentication';
  }
  if (message.includes('permission') || message.includes('forbidden') || message.includes('unauthorized')) {
    return 'authorization';
  }
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return 'validation';
  }
  if (message.includes('database') || message.includes('sql') || message.includes('connection')) {
    return 'database';
  }
  if (message.includes('api') || message.includes('fetch') || message.includes('request')) {
    return 'external_api';
  }
  if (message.includes('security') || message.includes('xss') || message.includes('injection')) {
    return 'security';
  }
  if (message.includes('timeout') || message.includes('slow') || message.includes('performance')) {
    return 'performance';
  }
  
  return 'unknown';
}

/**
 * Convenience logging functions
 */
export const logger = {
  debug: (message: string, context?: Record<string, any>) => 
    logError({ level: 'debug', category: 'system', message, context }),
  
  info: (message: string, context?: Record<string, any>) => 
    logError({ level: 'info', category: 'system', message, context }),
  
  warn: (message: string, context?: Record<string, any>) => 
    logError({ level: 'warn', category: 'system', message, context }),
  
  error: (message: string, error?: Error, context?: Record<string, any>) => 
    logError({ 
      level: 'error', 
      category: error ? categorizeError(error) : 'unknown', 
      message, 
      error, 
      context 
    }),
  
  critical: (message: string, error?: Error, context?: Record<string, any>) => 
    logError({ 
      level: 'critical', 
      category: error ? categorizeError(error) : 'unknown', 
      message, 
      error, 
      context 
    }),
};

/**
 * Search error logs
 */
export async function searchErrorLogs(query: {
  level?: LogLevel;
  category?: ErrorCategory;
  userId?: number;
  appId?: number;
  productId?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const { errorLogs } = await import("../../drizzle/platform-schema");
  const { eq, and, like, sql } = await import("drizzle-orm");
  
  const conditions = [];
  
  if (query.level) conditions.push(eq(errorLogs.level, query.level));
  if (query.category) conditions.push(eq(errorLogs.category, query.category));
  if (query.userId) conditions.push(eq(errorLogs.userId, query.userId));
  if (query.appId) conditions.push(eq(errorLogs.appId, query.appId));
  if (query.productId) conditions.push(eq(errorLogs.productId, query.productId));
  if (query.searchTerm) {
    conditions.push(
      sql`(${errorLogs.message} LIKE ${`%${query.searchTerm}%`} OR ${errorLogs.errorMessage} LIKE ${`%${query.searchTerm}%`})`
    );
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  return await db
    .select()
    .from(errorLogs)
    .where(whereClause)
    .orderBy(sql`${errorLogs.createdAt} DESC`)
    .limit(query.limit || 50)
    .offset(query.offset || 0);
}
