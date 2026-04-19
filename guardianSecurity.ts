/**
 * The Guardian Security Service
 * 
 * Cyber security intelligence, gatekeeper bots, and threat monitoring.
 * The Guardian protects the platform from malicious actors.
 */

import { getDb } from "../db";
import {
  gatekeeperBots,
  securityEvents,
  threatIntelligence,
  rateLimits,
  type InsertGatekeeperBot,
  type InsertThreatIntelligence,
} from "../../drizzle/schema";
import { eq, and, gt, desc, sql } from "drizzle-orm";
import { createSecurityEvent } from "./infinityOAuth";

/**
 * Gatekeeper Bot Types
 */
export const GATEKEEPER_BOT_TYPES = {
  TRAFFIC_MONITOR: "traffic_monitor",
  INTRUSION_DETECTOR: "intrusion_detector",
  RATE_LIMITER: "rate_limiter",
  ANOMALY_DETECTOR: "anomaly_detector",
  MALWARE_SCANNER: "malware_scanner",
} as const;

/**
 * Deploy gatekeeper bot
 */
export async function deployGatekeeperBot(data: InsertGatekeeperBot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [bot] = await db.insert(gatekeeperBots).values(data).$returningId();

  await createSecurityEvent({
    eventType: "bot_deployed",
    severity: "low",
    gatekeeperBotId: bot.id,
    description: `Gatekeeper bot "${data.name}" deployed`,
    metadata: { botType: data.type, module: data.assignedModule },
    actionTaken: "deployed",
    resolved: true,
  });

  return bot;
}

/**
 * Get all gatekeeper bots
 */
export async function getAllGatekeeperBots() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(gatekeeperBots).orderBy(desc(gatekeeperBots.createdAt));
}

/**
 * Get active gatekeeper bots
 */
export async function getActiveGatekeeperBots() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(gatekeeperBots)
    .where(eq(gatekeeperBots.status, "active"));
}

/**
 * Update bot status
 */
export async function updateBotStatus(botId: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(gatekeeperBots)
    .set({ status, updatedAt: new Date() })
    .where(eq(gatekeeperBots.id, botId));
}

/**
 * Update bot metrics
 */
export async function updateBotMetrics(botId: number, metrics: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(gatekeeperBots)
    .set({ 
      metrics, 
      lastAction: new Date(),
      updatedAt: new Date() 
    })
    .where(eq(gatekeeperBots.id, botId));
}

/**
 * Check rate limit
 */
export async function checkRateLimit(
  identifier: string,
  identifierType: string,
  endpoint: string | null,
  maxRequests: number,
  windowMinutes: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const db = await getDb();
  if (!db) return { allowed: true, remaining: maxRequests, resetAt: new Date() };

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

  // Get or create rate limit record
  const existing = await db
    .select()
    .from(rateLimits)
    .where(
      and(
        eq(rateLimits.identifier, identifier),
        eq(rateLimits.identifierType, identifierType),
        endpoint ? eq(rateLimits.endpoint, endpoint) : sql`${rateLimits.endpoint} IS NULL`,
        gt(rateLimits.windowEnd, now)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    // Create new rate limit record
    const windowEnd = new Date(now.getTime() + windowMinutes * 60 * 1000);
    await db.insert(rateLimits).values({
      identifier,
      identifierType,
      endpoint,
      requestCount: 1,
      windowStart: now,
      windowEnd,
      limitExceeded: false,
    });

    return { allowed: true, remaining: maxRequests - 1, resetAt: windowEnd };
  }

  const record = existing[0];

  // Check if limit exceeded
  if (record.requestCount >= maxRequests) {
    // Update limit exceeded flag
    if (!record.limitExceeded) {
      await db
        .update(rateLimits)
        .set({ limitExceeded: true, blockedUntil: record.windowEnd })
        .where(eq(rateLimits.id, record.id));

      // Create security event
      await createSecurityEvent({
        eventType: "rate_limit_exceeded",
        severity: "medium",
        description: `Rate limit exceeded for ${identifierType}: ${identifier}`,
        metadata: { endpoint, requestCount: record.requestCount, maxRequests },
        actionTaken: "blocked",
        resolved: false,
      });
    }

    return { allowed: false, remaining: 0, resetAt: record.windowEnd };
  }

  // Increment request count
  await db
    .update(rateLimits)
    .set({ requestCount: record.requestCount + 1 })
    .where(eq(rateLimits.id, record.id));

  return {
    allowed: true,
    remaining: maxRequests - record.requestCount - 1,
    resetAt: record.windowEnd,
  };
}

/**
 * Add threat to intelligence database
 */
export async function addThreat(data: InsertThreatIntelligence) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(threatIntelligence).values(data);

  await createSecurityEvent({
    eventType: "threat_added",
    severity: data.severity,
    description: `New threat added: ${data.threatType} - ${data.threatValue}`,
    metadata: { threatType: data.threatType, source: data.source },
    actionTaken: "flagged",
    resolved: false,
  });
}

/**
 * Check if threat exists
 */
export async function checkThreat(threatType: string, threatValue: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const threats = await db
    .select()
    .from(threatIntelligence)
    .where(
      and(
        eq(threatIntelligence.threatType, threatType),
        eq(threatIntelligence.threatValue, threatValue),
        eq(threatIntelligence.active, true)
      )
    )
    .limit(1);

  if (threats.length > 0) {
    // Update detection count
    const threat = threats[0];
    await db
      .update(threatIntelligence)
      .set({
        detectionCount: (threat.detectionCount || 0) + 1,
        lastDetected: new Date(),
      })
      .where(eq(threatIntelligence.id, threat.id));

    return true;
  }

  return false;
}

/**
 * Get all active threats
 */
export async function getActiveThreats() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(threatIntelligence)
    .where(eq(threatIntelligence.active, true))
    .orderBy(desc(threatIntelligence.lastDetected));
}

/**
 * Deactivate threat
 */
export async function deactivateThreat(threatId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(threatIntelligence)
    .set({ active: false })
    .where(eq(threatIntelligence.id, threatId));
}

/**
 * Detect intrusion patterns
 */
export async function detectIntrusionPatterns(
  ipAddress: string,
  userAgent: string
): Promise<{ isIntrusion: boolean; reason?: string }> {
  const db = await getDb();
  if (!db) return { isIntrusion: false };

  // Check if IP is in threat database
  const ipThreat = await checkThreat("ip", ipAddress);
  if (ipThreat) {
    await createSecurityEvent({
      eventType: "intrusion_detected",
      severity: "critical",
      ipAddress,
      description: `Known malicious IP detected: ${ipAddress}`,
      metadata: { userAgent },
      actionTaken: "blocked",
      resolved: false,
    });

    return { isIntrusion: true, reason: "Known malicious IP" };
  }

  // Check user agent patterns
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(userAgent)) {
      await createSecurityEvent({
        eventType: "suspicious_activity",
        severity: "medium",
        ipAddress,
        description: `Suspicious user agent detected: ${userAgent}`,
        metadata: { pattern: pattern.toString() },
        actionTaken: "flagged",
        resolved: false,
      });

      return { isIntrusion: true, reason: "Suspicious user agent" };
    }
  }

  return { isIntrusion: false };
}

/**
 * Scan for anomalies
 */
export async function scanForAnomalies() {
  const db = await getDb();
  if (!db) return [];

  const anomalies: any[] = [];

  // Check for unusual login patterns (same IP, different users)
  const recentLogins = await db.execute(sql`
    SELECT ip_address, COUNT(DISTINCT user_id) as user_count
    FROM login_attempts
    WHERE attempted_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
      AND success = 1
    GROUP BY ip_address
    HAVING user_count > 3
  `);

  const rows = (recentLogins as any).rows || [];
  for (const row of rows as any[]) {
    anomalies.push({
      type: "multiple_users_same_ip",
      severity: "medium",
      data: row,
    });

    await createSecurityEvent({
      eventType: "anomaly_detected",
      severity: "medium",
      ipAddress: row.ip_address,
      description: `${row.user_count} different users logged in from same IP in the last hour`,
      metadata: { userCount: row.user_count },
      actionTaken: "flagged",
      resolved: false,
    });
  }

  return anomalies;
}

/**
 * Get security dashboard metrics
 */
export async function getSecurityMetrics() {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Get event counts by severity
  const events = await db
    .select()
    .from(securityEvents)
    .where(gt(securityEvents.createdAt, last24h));

  const critical = events.filter((e) => e.severity === "critical").length;
  const high = events.filter((e) => e.severity === "high").length;
  const medium = events.filter((e) => e.severity === "medium").length;
  const low = events.filter((e) => e.severity === "low").length;

  // Get active bots count
  const activeBots = await getActiveGatekeeperBots();

  // Get active threats count
  const activeThreats = await getActiveThreats();

  // Get unresolved events
  const unresolvedEvents = events.filter((e) => !e.resolved).length;

  return {
    last24h: {
      critical,
      high,
      medium,
      low,
      total: events.length,
      unresolved: unresolvedEvents,
    },
    activeBots: activeBots.length,
    activeThreats: activeThreats.length,
    threatLevel: critical > 0 ? "critical" : high > 0 ? "high" : medium > 0 ? "medium" : "low",
  };
}

/**
 * Initialize default gatekeeper bots
 */
export async function initializeDefaultBots() {
  const defaultBots: InsertGatekeeperBot[] = [
    {
      botId: "gk-traffic-monitor-001",
      name: "Traffic Monitor Alpha",
      type: GATEKEEPER_BOT_TYPES.TRAFFIC_MONITOR,
      status: "active",
      config: {
        monitorInterval: 60000, // 1 minute
        alertThreshold: 1000, // requests per minute
      },
      metrics: {},
    },
    {
      botId: "gk-intrusion-detector-001",
      name: "Intrusion Detector Beta",
      type: GATEKEEPER_BOT_TYPES.INTRUSION_DETECTOR,
      status: "active",
      config: {
        scanInterval: 300000, // 5 minutes
        patternDatabase: "default",
      },
      metrics: {},
    },
    {
      botId: "gk-rate-limiter-001",
      name: "Rate Limiter Gamma",
      type: GATEKEEPER_BOT_TYPES.RATE_LIMITER,
      status: "active",
      config: {
        defaultLimit: 100, // requests per minute
        strictMode: false,
      },
      metrics: {},
    },
    {
      botId: "gk-anomaly-detector-001",
      name: "Anomaly Detector Delta",
      type: GATEKEEPER_BOT_TYPES.ANOMALY_DETECTOR,
      status: "active",
      config: {
        scanInterval: 600000, // 10 minutes
        sensitivityLevel: "medium",
      },
      metrics: {},
    },
  ];

  for (const bot of defaultBots) {
    try {
      await deployGatekeeperBot(bot);
    } catch (error) {
      console.error(`Failed to deploy bot ${bot.name}:`, error);
    }
  }
}
