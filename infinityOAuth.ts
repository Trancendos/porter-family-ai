/**
 * Infinity ♾️ OAuth Service
 * 
 * Central authentication and authorization system.
 * The Guardian lives here and controls all access to modules.
 */

import { getDb } from "../db";
import { 
  oauthTokens, 
  loginAttempts, 
  activeSessions, 
  securityEvents,
  moduleAccessControl,
  infinityAuditTrail,
  type InsertLoginAttempt,
  type InsertActiveSession,
  type InsertSecurityEvent,
  type InsertInfinityAuditTrail
} from "../../drizzle/schema";
import { eq, and, gt, desc, lt } from "drizzle-orm";
import { randomBytes } from "crypto";

/**
 * Record login attempt
 */
export async function recordLoginAttempt(data: InsertLoginAttempt) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(loginAttempts).values(data);

  // Check for suspicious activity (multiple failed attempts)
  if (!data.success) {
    const recentFailures = await db
      .select()
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.ipAddress, data.ipAddress),
          eq(loginAttempts.success, false),
          gt(loginAttempts.attemptedAt, new Date(Date.now() - 15 * 60 * 1000)) // Last 15 minutes
        )
      );

    if (recentFailures.length >= 5) {
      // Trigger security event
      await createSecurityEvent({
        eventType: "multiple_failed_logins",
        severity: "high",
        ipAddress: data.ipAddress,
        description: `${recentFailures.length} failed login attempts from ${data.ipAddress} in the last 15 minutes`,
        metadata: { attempts: recentFailures.length, email: data.email },
        actionTaken: "flagged",
        resolved: false,
      });
    }
  }
}

/**
 * Create active session
 */
export async function createSession(
  userId: number,
  ipAddress: string,
  userAgent: string,
  deviceFingerprint?: string
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const sessionToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.insert(activeSessions).values({
    userId,
    sessionToken,
    ipAddress,
    userAgent,
    deviceFingerprint,
    expiresAt,
    moduleAccess: [],
  });

  // Log audit trail
  await logAuditTrail({
    userId,
    action: "session_created",
    resourceType: "session",
    resourceId: sessionToken,
    ipAddress,
    userAgent,
    success: true,
  });

  return sessionToken;
}

/**
 * Validate session
 */
export async function validateSession(sessionToken: string) {
  const db = await getDb();
  if (!db) return null;

  const sessions = await db
    .select()
    .from(activeSessions)
    .where(
      and(
        eq(activeSessions.sessionToken, sessionToken),
        gt(activeSessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (sessions.length === 0) return null;

  const session = sessions[0];

  // Update last activity
  await db
    .update(activeSessions)
    .set({ lastActivity: new Date() })
    .where(eq(activeSessions.id, session.id));

  return session;
}

/**
 * Destroy session
 */
export async function destroySession(sessionToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const session = await validateSession(sessionToken);
  if (!session) return;

  await db.delete(activeSessions).where(eq(activeSessions.sessionToken, sessionToken));

  // Log audit trail
  await logAuditTrail({
    userId: session.userId,
    action: "session_destroyed",
    resourceType: "session",
    resourceId: sessionToken,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent || undefined,
    success: true,
  });
}

/**
 * Check module access
 */
export async function checkModuleAccess(
  userId: number,
  moduleId: string
): Promise<{ granted: boolean; accessLevel: string }> {
  const db = await getDb();
  if (!db) return { granted: false, accessLevel: "none" };

  const access = await db
    .select()
    .from(moduleAccessControl)
    .where(
      and(
        eq(moduleAccessControl.userId, userId),
        eq(moduleAccessControl.moduleId, moduleId),
        eq(moduleAccessControl.granted, true)
      )
    )
    .limit(1);

  if (access.length === 0) {
    return { granted: false, accessLevel: "none" };
  }

  const accessRecord = access[0];

  // Check if access has expired
  if (accessRecord.expiresAt && accessRecord.expiresAt < new Date()) {
    return { granted: false, accessLevel: "none" };
  }

  return { granted: true, accessLevel: accessRecord.accessLevel };
}

/**
 * Grant module access
 */
export async function grantModuleAccess(
  userId: number,
  moduleId: string,
  accessLevel: string,
  grantedBy: number,
  expiresAt?: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(moduleAccessControl).values({
    userId,
    moduleId,
    accessLevel,
    grantedBy,
    expiresAt,
    granted: true,
  });

  // Log audit trail
  await logAuditTrail({
    userId: grantedBy,
    action: "module_access_granted",
    resourceType: "module",
    resourceId: moduleId,
    details: { targetUserId: userId, accessLevel },
    success: true,
  });
}

/**
 * Revoke module access
 */
export async function revokeModuleAccess(userId: number, moduleId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(moduleAccessControl)
    .set({ granted: false })
    .where(
      and(
        eq(moduleAccessControl.userId, userId),
        eq(moduleAccessControl.moduleId, moduleId)
      )
    );
}

/**
 * Create security event
 */
export async function createSecurityEvent(data: InsertSecurityEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(securityEvents).values(data);

  // If critical, trigger immediate alert
  if (data.severity === "critical") {
    // TODO: Send alert to The Guardian and admins
    console.error(`[CRITICAL SECURITY EVENT] ${data.description}`);
  }
}

/**
 * Get recent security events
 */
export async function getRecentSecurityEvents(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(securityEvents)
    .orderBy(desc(securityEvents.createdAt))
    .limit(limit);
}

/**
 * Get security events by severity
 */
export async function getSecurityEventsBySeverity(severity: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(securityEvents)
    .where(eq(securityEvents.severity, severity))
    .orderBy(desc(securityEvents.createdAt))
    .limit(100);
}

/**
 * Resolve security event
 */
export async function resolveSecurityEvent(eventId: number, resolvedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(securityEvents)
    .set({
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy,
    })
    .where(eq(securityEvents.id, eventId));
}

/**
 * Log audit trail
 */
export async function logAuditTrail(data: InsertInfinityAuditTrail) {
  const db = await getDb();
  if (!db) return;

  await db.insert(infinityAuditTrail).values(data);
}

/**
 * Get audit trail for user
 */
export async function getUserAuditTrail(userId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(infinityAuditTrail)
    .where(eq(infinityAuditTrail.userId, userId))
    .orderBy(desc(infinityAuditTrail.createdAt))
    .limit(limit);
}

/**
 * Get all active sessions
 */
export async function getActiveSessions() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(activeSessions)
    .where(gt(activeSessions.expiresAt, new Date()))
    .orderBy(desc(activeSessions.lastActivity));
}

/**
 * Get user's active sessions
 */
export async function getUserSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(activeSessions)
    .where(
      and(
        eq(activeSessions.userId, userId),
        gt(activeSessions.expiresAt, new Date())
      )
    )
    .orderBy(desc(activeSessions.lastActivity));
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions() {
  const db = await getDb();
  if (!db) return 0;

  await db
    .delete(activeSessions)
    .where(lt(activeSessions.expiresAt, new Date()));

  return 0; // Return count not available in MySQL
}

/**
 * Get login statistics
 */
export async function getLoginStatistics(days: number = 7) {
  const db = await getDb();
  if (!db) return { total: 0, successful: 0, failed: 0, uniqueUsers: 0 };

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const attempts = await db
    .select()
    .from(loginAttempts)
    .where(gt(loginAttempts.attemptedAt, since));

  const successful = attempts.filter((a) => a.success).length;
  const failed = attempts.filter((a) => !a.success).length;
  const uniqueUsers = new Set(
    attempts.filter((a) => a.userId).map((a) => a.userId)
  ).size;

  return {
    total: attempts.length,
    successful,
    failed,
    uniqueUsers,
  };
}
