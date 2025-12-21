/**
 * Estate-Wide Awareness System
 * 
 * Provides platform-wide context sharing across all modules and AI agents.
 * Enables The Hive to understand the entire application estate holistically.
 */

import { getDb } from "../db";
import { eq, sql, desc, and } from "drizzle-orm";
import {
  hiveEstates,
  hiveScannedItems,
  hiveInjectionPoints,
  hiveKnowledge,
  hiveScanHistory,
} from "../../drizzle/hive-schema";

export interface EstateContext {
  estateId: string;
  estateName: string;
  estateType: string;
  totalItems: number;
  itemsByType: Record<string, number>;
  topTags: string[];
  recentActivity: {
    scans: number;
    injections: number;
    approvals: number;
  };
  healthScore: number;
  lastScanDate: Date;
}

export interface PlatformContext {
  totalEstates: number;
  totalItems: number;
  totalKnowledge: number;
  estates: EstateContext[];
  globalTags: string[];
  crossEstatePatterns: {
    pattern: string;
    count: number;
    estates: string[];
  }[];
  platformHealth: {
    overall: number;
    coverage: number;
    freshness: number;
    connectivity: number;
  };
}

export interface CrossModuleContext {
  module: string;
  relatedEstates: string[];
  sharedConcepts: string[];
  integrationPoints: string[];
  recommendations: string[];
}

/**
 * Get comprehensive context for a specific estate
 */
export async function getEstateContext(estateId: string): Promise<EstateContext | null> {
  const db = await getDb();
  if (!db) return null;

  // Get estate details
  const estate = await db
    .select()
    .from(hiveEstates)
    .where(eq(hiveEstates.id, estateId))
    .limit(1);

  if (!estate[0]) return null;

  // Get all scanned items for this estate
  const items = await db
    .select()
    .from(hiveScannedItems)
    .where(eq(hiveScannedItems.estateId, estateId))
    .limit(10000);

  // Count items by type
  const itemsByType: Record<string, number> = {};
  const allTags: string[] = [];

  for (const item of items) {
    itemsByType[item.type] = (itemsByType[item.type] || 0) + 1;
    if (item.tags) {
      allTags.push(...item.tags);
    }
  }

  // Get top tags
  const tagCounts = new Map<string, number>();
  for (const tag of allTags) {
    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  // Get recent activity
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [recentScans, recentInjections] = await Promise.all([
    db
      .select()
      .from(hiveScanHistory)
      .where(
        and(
          eq(hiveScanHistory.estateId, estateId),
          sql`${hiveScanHistory.scannedAt} >= ${sevenDaysAgo}`
        )
      ),
    db
      .select()
      .from(hiveInjectionPoints)
      .where(
        and(
          sql`${hiveInjectionPoints.sourceItemId} IN (SELECT id FROM ${hiveScannedItems} WHERE estate_id = ${estateId})`,
          sql`${hiveInjectionPoints.createdAt} >= ${sevenDaysAgo}`
        )
      )
      .limit(1000),
  ]);

  const approvals = recentInjections.filter((i) => i.status === "approved").length;

  // Calculate health score
  const daysSinceLastScan = estate[0].lastScanDate
    ? Math.floor((Date.now() - estate[0].lastScanDate.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const freshnessScore = Math.max(0, 1 - daysSinceLastScan / 30); // Decay over 30 days
  const coverageScore = Math.min(1, items.length / 100); // Target 100+ items
  const activityScore = Math.min(1, (recentScans.length + approvals) / 10);

  const healthScore = (freshnessScore + coverageScore + activityScore) / 3;

  return {
    estateId: estate[0].id,
    estateName: estate[0].name,
    estateType: estate[0].type,
    totalItems: items.length,
    itemsByType,
    topTags,
    recentActivity: {
      scans: recentScans.length,
      injections: recentInjections.length,
      approvals,
    },
    healthScore,
    lastScanDate: estate[0].lastScanDate || new Date(0),
  };
}

/**
 * Get platform-wide context across all estates
 */
export async function getPlatformContext(): Promise<PlatformContext> {
  const db = await getDb();
  if (!db)
    return {
      totalEstates: 0,
      totalItems: 0,
      totalKnowledge: 0,
      estates: [],
      globalTags: [],
      crossEstatePatterns: [],
      platformHealth: {
        overall: 0,
        coverage: 0,
        freshness: 0,
        connectivity: 0,
      },
    };

  // Get all estates
  const estates = await db.select().from(hiveEstates).limit(1000);

  // Get estate contexts
  const estateContexts = await Promise.all(
    estates.map((e) => getEstateContext(e.id))
  );

  const validContexts = estateContexts.filter((c): c is EstateContext => c !== null);

  // Get total items and knowledge
  const [items, knowledge] = await Promise.all([
    db.select().from(hiveScannedItems).limit(100000),
    db.select().from(hiveKnowledge).limit(100000),
  ]);

  // Collect all tags
  const allTags: string[] = [];
  for (const item of items) {
    if (item.tags) {
      allTags.push(...item.tags);
    }
  }

  // Get global top tags
  const tagCounts = new Map<string, number>();
  for (const tag of allTags) {
    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }
  const globalTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag]) => tag);

  // Identify cross-estate patterns
  const crossEstatePatterns = identifyCrossEstatePatterns(items);

  // Calculate platform health
  const avgHealthScore =
    validContexts.length > 0
      ? validContexts.reduce((sum, c) => sum + c.healthScore, 0) / validContexts.length
      : 0;

  const coverage = Math.min(1, items.length / 1000); // Target 1000+ items
  const freshness =
    validContexts.length > 0
      ? validContexts.reduce((sum, c) => {
          const daysSince = Math.floor(
            (Date.now() - c.lastScanDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          return sum + Math.max(0, 1 - daysSince / 30);
        }, 0) / validContexts.length
      : 0;

  // Calculate connectivity (how well estates are connected)
  const injectionPoints = await db.select().from(hiveInjectionPoints).limit(10000);
  const connectivity = Math.min(1, injectionPoints.length / (items.length * 0.1));

  return {
    totalEstates: estates.length,
    totalItems: items.length,
    totalKnowledge: knowledge.length,
    estates: validContexts,
    globalTags,
    crossEstatePatterns,
    platformHealth: {
      overall: avgHealthScore,
      coverage,
      freshness,
      connectivity,
    },
  };
}

/**
 * Identify patterns that span multiple estates
 */
function identifyCrossEstatePatterns(
  items: Array<{
    id: string;
    estateId: string;
    name: string;
    type: string;
    tags: string[] | null;
  }>
): { pattern: string; count: number; estates: string[] }[] {
  const patternMap = new Map<
    string,
    { count: number; estates: Set<string> }
  >();

  for (const item of items) {
    if (!item.tags) continue;

    for (const tag of item.tags) {
      if (!patternMap.has(tag)) {
        patternMap.set(tag, { count: 0, estates: new Set() });
      }
      const pattern = patternMap.get(tag)!;
      pattern.count++;
      pattern.estates.add(item.estateId);
    }
  }

  // Filter to patterns that appear in multiple estates
  const crossEstatePatterns: { pattern: string; count: number; estates: string[] }[] = [];

  for (const [pattern, data] of patternMap.entries()) {
    if (data.estates.size >= 2) {
      crossEstatePatterns.push({
        pattern,
        count: data.count,
        estates: Array.from(data.estates),
      });
    }
  }

  return crossEstatePatterns.sort((a, b) => b.count - a.count).slice(0, 20);
}

/**
 * Get cross-module context for AI agents
 */
export async function getCrossModuleContext(
  moduleName: string
): Promise<CrossModuleContext> {
  const db = await getDb();
  if (!db)
    return {
      module: moduleName,
      relatedEstates: [],
      sharedConcepts: [],
      integrationPoints: [],
      recommendations: [],
    };

  // Get all items related to this module (by tag or name)
  const moduleKeywords = moduleName.toLowerCase().split(/[\s-_]/);

  const items = await db.select().from(hiveScannedItems).limit(10000);

  const relatedItems = items.filter((item) => {
    const itemText = `${item.name} ${item.description || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
    return moduleKeywords.some((keyword) => itemText.includes(keyword));
  });

  // Get unique estates
  const relatedEstates = Array.from(new Set(relatedItems.map((i) => i.estateId)));

  // Extract shared concepts (common tags)
  const allTags: string[] = [];
  for (const item of relatedItems) {
    if (item.tags) {
      allTags.push(...item.tags);
    }
  }

  const tagCounts = new Map<string, number>();
  for (const tag of allTags) {
    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }

  const sharedConcepts = Array.from(tagCounts.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  // Identify integration points
  const integrationPoints: string[] = [];
  const apiItems = relatedItems.filter((i) =>
    (i.tags || []).some((t) => t.includes("api") || t.includes("endpoint"))
  );
  for (const item of apiItems) {
    integrationPoints.push(`${item.name} (${item.type})`);
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (relatedEstates.length > 1) {
    recommendations.push(
      `Consider consolidating ${moduleName} functionality across ${relatedEstates.length} estates`
    );
  }

  if (integrationPoints.length > 0) {
    recommendations.push(
      `Found ${integrationPoints.length} API integration points for ${moduleName}`
    );
  }

  if (sharedConcepts.length > 5) {
    recommendations.push(
      `High concept overlap detected - potential for shared library or service`
    );
  }

  return {
    module: moduleName,
    relatedEstates,
    sharedConcepts,
    integrationPoints: integrationPoints.slice(0, 10),
    recommendations,
  };
}

/**
 * Share context with AI agents
 */
export async function shareContextWithAgent(
  agentName: string,
  contextType: "estate" | "platform" | "module",
  contextId?: string
): Promise<string> {
  let context: any;

  switch (contextType) {
    case "estate":
      if (!contextId) throw new Error("Estate ID required");
      context = await getEstateContext(contextId);
      break;
    case "platform":
      context = await getPlatformContext();
      break;
    case "module":
      if (!contextId) throw new Error("Module name required");
      context = await getCrossModuleContext(contextId);
      break;
  }

  // Format context for AI consumption
  return JSON.stringify(
    {
      agentName,
      contextType,
      timestamp: new Date(),
      context,
    },
    null,
    2
  );
}

/**
 * Monitor estate health in real-time
 */
export async function monitorEstateHealth(): Promise<{
  healthy: string[];
  warning: string[];
  critical: string[];
}> {
  const platformContext = await getPlatformContext();

  const healthy: string[] = [];
  const warning: string[] = [];
  const critical: string[] = [];

  for (const estate of platformContext.estates) {
    if (estate.healthScore >= 0.7) {
      healthy.push(estate.estateId);
    } else if (estate.healthScore >= 0.4) {
      warning.push(estate.estateId);
    } else {
      critical.push(estate.estateId);
    }
  }

  return { healthy, warning, critical };
}
