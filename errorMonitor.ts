/**
 * Error Monitoring Service for Self-Healing Dr
 * 
 * Monitors application errors, classifies them, and triggers auto-healing workflows.
 */

import { getDb } from "../db";
import { errorLogs, type InsertErrorLog } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";

export interface ErrorContext {
  timestamp: Date;
  errorType: string;
  message: string;
  stackTrace?: string;
  file?: string;
  line?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedUsers?: number;
  metadata?: Record<string, any>;
}

export interface ErrorClassification {
  category: 'syntax' | 'runtime' | 'dependency' | 'configuration' | 'database' | 'network' | 'unknown';
  autoFixable: boolean;
  confidence: number;
  suggestedFix?: string;
  reasoning: string;
}

/**
 * Classify error type and determine if auto-fixable
 */
export function classifyError(error: ErrorContext): ErrorClassification {
  const msg = error.message.toLowerCase();
  const stack = error.stackTrace?.toLowerCase() || '';

  // Syntax errors
  if (msg.includes('syntaxerror') || msg.includes('unexpected token')) {
    return {
      category: 'syntax',
      autoFixable: false, // Requires code analysis
      confidence: 0.95,
      reasoning: 'Syntax error detected - requires manual code review',
    };
  }

  // Type errors (common in TypeScript)
  if (msg.includes('typeerror') || msg.includes('cannot read property') || msg.includes('is not a function')) {
    return {
      category: 'runtime',
      autoFixable: true,
      confidence: 0.85,
      suggestedFix: 'Add null/undefined checks or type guards',
      reasoning: 'Runtime type error - likely missing null check',
    };
  }

  // Dependency errors
  if (msg.includes('cannot find module') || msg.includes('module not found') || msg.includes('enoent')) {
    return {
      category: 'dependency',
      autoFixable: true,
      confidence: 0.9,
      suggestedFix: 'Install missing dependency or fix import path',
      reasoning: 'Missing dependency or incorrect import',
    };
  }

  // Database errors
  if (msg.includes('database') || msg.includes('sql') || msg.includes('connection') || msg.includes('econnrefused')) {
    return {
      category: 'database',
      autoFixable: true,
      confidence: 0.75,
      suggestedFix: 'Check database connection settings or restart connection pool',
      reasoning: 'Database connectivity or query issue',
    };
  }

  // Configuration errors
  if (msg.includes('env') || msg.includes('config') || msg.includes('not configured')) {
    return {
      category: 'configuration',
      autoFixable: true,
      confidence: 0.8,
      suggestedFix: 'Add missing environment variable or configuration',
      reasoning: 'Missing or incorrect configuration',
    };
  }

  // Network errors
  if (msg.includes('network') || msg.includes('timeout') || msg.includes('fetch failed')) {
    return {
      category: 'network',
      autoFixable: true,
      confidence: 0.7,
      suggestedFix: 'Implement retry logic or check network connectivity',
      reasoning: 'Network connectivity issue',
    };
  }

  return {
    category: 'unknown',
    autoFixable: false,
    confidence: 0.5,
    reasoning: 'Unable to classify error type',
  };
}

/**
 * Log error to database
 */
export async function logError(error: ErrorContext): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.error('[ErrorMonitor] Database unavailable, cannot log error');
    return -1;
  }

  const classification = classifyError(error);

  const errorLog: InsertErrorLog = {
    operation: error.errorType,
    errorMessage: error.message,
    errorStack: error.stackTrace || null,
    context: JSON.stringify({
      file: error.file,
      line: error.line,
      category: classification.category,
      autoFixable: classification.autoFixable,
      confidence: classification.confidence,
      suggestedFix: classification.suggestedFix,
      affectedUsers: error.affectedUsers,
      ...error.metadata,
    }),
    severity: error.severity,
    resolved: 0,
    resolution: null,
    learnedFrom: 0,
  };

  const result = await db.insert(errorLogs).values(errorLog);
  return result[0]?.insertId || -1;
}

/**
 * Get recent errors
 */
export async function getRecentErrors(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(errorLogs)
    .orderBy(desc(errorLogs.timestamp))
    .limit(limit);
}

/**
 * Get errors by status
 */
export async function getErrorsByStatus(status: 'detected' | 'diagnosing' | 'fixing' | 'fixed' | 'failed') {
  const db = await getDb();
  if (!db) return [];

  // Map status to resolved field
  const resolvedValue = status === 'fixed' ? 1 : 0;
  
  return await db
    .select()
    .from(errorLogs)
    .where(eq(errorLogs.resolved, resolvedValue))
    .orderBy(desc(errorLogs.timestamp));
}

/**
 * Update error status
 */
export async function updateErrorStatus(
  errorId: number,
  status: 'detected' | 'diagnosing' | 'fixing' | 'fixed' | 'failed',
  fixDetails?: string
) {
  const db = await getDb();
  if (!db) return;

  const updates: any = {};
  
  if (status === 'fixed') {
    updates.resolved = 1;
    updates.resolution = fixDetails || 'Auto-fixed by Self-Healing Dr';
    updates.learnedFrom = 1;
  } else if (status === 'failed') {
    updates.resolved = 0;
    updates.resolution = fixDetails || 'Auto-fix failed';
  }

  await db
    .update(errorLogs)
    .set(updates)
    .where(eq(errorLogs.id, errorId));
}

/**
 * Calculate fix success rate
 */
export async function getFixSuccessRate(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const all = await db.select().from(errorLogs);
  const fixed = all.filter(e => e.resolved === 1);
  const attempted = all.filter(e => e.resolution !== null);

  const total = attempted.length;
  if (total === 0) return 0;

  return (fixed.length / total) * 100;
}
