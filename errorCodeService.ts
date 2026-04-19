/**
 * Error Code Service
 * 
 * Generates unique error codes for all errors:
 * Format: ERR-{CATEGORY}-{TIMESTAMP}-{HASH}
 * Example: ERR-DATABASE-1705690000-A7F3E9
 * 
 * Each error code:
 * - Is unique and traceable
 * - Links to error logs
 * - Tracks resolution status
 * - Generates knowledge base articles
 * - Enables self-healing workflows
 */

import { createHash } from "crypto";
import { getDb } from "../db";

export interface ErrorCode {
  code: string;
  category: string;
  message: string;
  stackTrace?: string;
  context?: Record<string, any>;
  
  // Resolution tracking
  resolutionStatus: 'unresolved' | 'researching' | 'fix_available' | 'fix_applied' | 'resolved';
  resolutionType?: 'platform_self_heal' | 'user_manual' | 'user_ai_guided' | 'user_self_repair';
  resolutionSteps?: string[];
  fixImplemented?: boolean;
  fixValidated?: boolean;
  
  // Knowledge base
  kbArticleId?: number;
  wikiArticleId?: number;
  
  // Metadata
  firstOccurrence: Date;
  lastOccurrence: Date;
  occurrenceCount: number;
  affectedUsers: number;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generate unique error code
 */
export function generateErrorCode(category: string, message: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Create hash from message for uniqueness
  const hash = createHash('sha256')
    .update(message)
    .digest('hex')
    .substring(0, 6)
    .toUpperCase();
  
  const categoryCode = category.toUpperCase().replace(/[^A-Z]/g, '');
  
  return `ERR-${categoryCode}-${timestamp}-${hash}`;
}

/**
 * Create or update error code
 */
export async function recordErrorCode(params: {
  category: string;
  message: string;
  stackTrace?: string;
  context?: Record<string, any>;
  userId?: number;
  appId?: number;
}): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { errorCodes } = await import("../../drizzle/platform-schema");
  const { eq } = await import("drizzle-orm");
  
  // Generate error code
  const code = generateErrorCode(params.category, params.message);
  
  // Check if error code already exists
  const existing = await db
    .select()
    .from(errorCodes)
    .where(eq(errorCodes.code, code))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing error code
    await db
      .update(errorCodes)
      .set({
        lastOccurrence: new Date(),
        occurrenceCount: existing[0].occurrenceCount + 1,
        affectedUsers: params.userId 
          ? existing[0].affectedUsers + 1 
          : existing[0].affectedUsers,
      })
      .where(eq(errorCodes.code, code));
    
    return code;
  }
  
  // Create new error code
  await db.insert(errorCodes).values({
    code,
    category: params.category,
    message: params.message,
    stackTrace: params.stackTrace,
    context: params.context ? JSON.stringify(params.context) : null,
    resolutionStatus: 'unresolved',
    occurrenceCount: 1,
    affectedUsers: params.userId ? 1 : 0,
    firstOccurrence: new Date(),
    lastOccurrence: new Date(),
  });
  
  // Trigger resolution research in background
  triggerResolutionResearch(code).catch(console.error);
  
  return code;
}

/**
 * Get error code details
 */
export async function getErrorCode(code: string): Promise<ErrorCode | null> {
  const db = await getDb();
  if (!db) return null;
  
  const { errorCodes } = await import("../../drizzle/platform-schema");
  const { eq } = await import("drizzle-orm");
  
  const results = await db
    .select()
    .from(errorCodes)
    .where(eq(errorCodes.code, code))
    .limit(1);
  
  if (results.length === 0) return null;
  
  const record = results[0];
  
  return {
    code: record.code,
    category: record.category,
    message: record.message,
    stackTrace: record.stackTrace || undefined,
    context: record.context ? JSON.parse(record.context) : undefined,
    resolutionStatus: record.resolutionStatus as any,
    resolutionType: record.resolutionType as any,
    resolutionSteps: record.resolutionSteps ? JSON.parse(record.resolutionSteps) : undefined,
    fixImplemented: record.fixImplemented === 1,
    fixValidated: record.fixValidated === 1,
    kbArticleId: record.kbArticleId || undefined,
    wikiArticleId: record.wikiArticleId || undefined,
    firstOccurrence: record.firstOccurrence,
    lastOccurrence: record.lastOccurrence,
    occurrenceCount: record.occurrenceCount,
    affectedUsers: record.affectedUsers,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Update error code resolution status
 */
export async function updateErrorCodeResolution(
  code: string,
  updates: {
    resolutionStatus?: ErrorCode['resolutionStatus'];
    resolutionType?: ErrorCode['resolutionType'];
    resolutionSteps?: string[];
    fixImplemented?: boolean;
    fixValidated?: boolean;
    kbArticleId?: number;
    wikiArticleId?: number;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { errorCodes } = await import("../../drizzle/platform-schema");
  const { eq } = await import("drizzle-orm");
  
  const updateData: any = {};
  
  if (updates.resolutionStatus) updateData.resolutionStatus = updates.resolutionStatus;
  if (updates.resolutionType) updateData.resolutionType = updates.resolutionType;
  if (updates.resolutionSteps) updateData.resolutionSteps = JSON.stringify(updates.resolutionSteps);
  if (updates.fixImplemented !== undefined) updateData.fixImplemented = updates.fixImplemented ? 1 : 0;
  if (updates.fixValidated !== undefined) updateData.fixValidated = updates.fixValidated ? 1 : 0;
  if (updates.kbArticleId) updateData.kbArticleId = updates.kbArticleId;
  if (updates.wikiArticleId) updateData.wikiArticleId = updates.wikiArticleId;
  
  await db
    .update(errorCodes)
    .set(updateData)
    .where(eq(errorCodes.code, code));
}

/**
 * Search for similar error codes
 */
export async function findSimilarErrorCodes(message: string, limit: number = 5): Promise<ErrorCode[]> {
  const db = await getDb();
  if (!db) return [];
  
  const { errorCodes } = await import("../../drizzle/platform-schema");
  const { like, sql } = await import("drizzle-orm");
  
  // Search for similar messages
  const results = await db
    .select()
    .from(errorCodes)
    .where(like(errorCodes.message, `%${message.substring(0, 50)}%`))
    .orderBy(sql`${errorCodes.occurrenceCount} DESC`)
    .limit(limit);
  
  return results.map(record => ({
    code: record.code,
    category: record.category,
    message: record.message,
    stackTrace: record.stackTrace || undefined,
    context: record.context ? JSON.parse(record.context) : undefined,
    resolutionStatus: record.resolutionStatus as any,
    resolutionType: record.resolutionType as any,
    resolutionSteps: record.resolutionSteps ? JSON.parse(record.resolutionSteps) : undefined,
    fixImplemented: record.fixImplemented === 1,
    fixValidated: record.fixValidated === 1,
    kbArticleId: record.kbArticleId || undefined,
    wikiArticleId: record.wikiArticleId || undefined,
    firstOccurrence: record.firstOccurrence,
    lastOccurrence: record.lastOccurrence,
    occurrenceCount: record.occurrenceCount,
    affectedUsers: record.affectedUsers,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
}

/**
 * Get unresolved error codes
 */
export async function getUnresolvedErrorCodes(limit: number = 50): Promise<ErrorCode[]> {
  const db = await getDb();
  if (!db) return [];
  
  const { errorCodes } = await import("../../drizzle/platform-schema");
  const { eq, sql } = await import("drizzle-orm");
  
  const results = await db
    .select()
    .from(errorCodes)
    .where(eq(errorCodes.resolutionStatus, 'unresolved'))
    .orderBy(sql`${errorCodes.occurrenceCount} DESC`)
    .limit(limit);
  
  return results.map(record => ({
    code: record.code,
    category: record.category,
    message: record.message,
    stackTrace: record.stackTrace || undefined,
    context: record.context ? JSON.parse(record.context) : undefined,
    resolutionStatus: record.resolutionStatus as any,
    resolutionType: record.resolutionType as any,
    resolutionSteps: record.resolutionSteps ? JSON.parse(record.resolutionSteps) : undefined,
    fixImplemented: record.fixImplemented === 1,
    fixValidated: record.fixValidated === 1,
    kbArticleId: record.kbArticleId || undefined,
    wikiArticleId: record.wikiArticleId || undefined,
    firstOccurrence: record.firstOccurrence,
    lastOccurrence: record.lastOccurrence,
    occurrenceCount: record.occurrenceCount,
    affectedUsers: record.affectedUsers,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
}

/**
 * Trigger resolution research (background job)
 */
async function triggerResolutionResearch(code: string): Promise<void> {
  // This will be handled by The Dr self-healing service
  console.log(`[ErrorCode] Triggering resolution research for ${code}`);
  
  // Import and call The Dr's research function
  const { researchErrorResolution } = await import("./theDrSelfHealing");
  await researchErrorResolution(code);
}

/**
 * Get error code statistics
 */
export async function getErrorCodeStats() {
  const db = await getDb();
  if (!db) return null;
  
  const { errorCodes } = await import("../../drizzle/platform-schema");
  const { sql } = await import("drizzle-orm");
  
  const results = await db
    .select({
      total: sql<number>`COUNT(*)`,
      unresolved: sql<number>`SUM(CASE WHEN ${errorCodes.resolutionStatus} = 'unresolved' THEN 1 ELSE 0 END)`,
      researching: sql<number>`SUM(CASE WHEN ${errorCodes.resolutionStatus} = 'researching' THEN 1 ELSE 0 END)`,
      fixAvailable: sql<number>`SUM(CASE WHEN ${errorCodes.resolutionStatus} = 'fix_available' THEN 1 ELSE 0 END)`,
      resolved: sql<number>`SUM(CASE WHEN ${errorCodes.resolutionStatus} = 'resolved' THEN 1 ELSE 0 END)`,
      totalOccurrences: sql<number>`SUM(${errorCodes.occurrenceCount})`,
      totalAffectedUsers: sql<number>`SUM(${errorCodes.affectedUsers})`,
    })
    .from(errorCodes);
  
  return results[0];
}
