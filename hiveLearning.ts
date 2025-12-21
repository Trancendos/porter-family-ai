/**
 * Hive Self-Learning Knowledge Graph System
 * 
 * This service implements the self-learning capabilities for The Hive:
 * - Relationship strength calculation based on usage patterns
 * - Confidence scoring that improves over time
 * - Pattern recognition and automatic suggestions
 * - Feedback loops for continuous improvement
 */

import { getDb } from "../db";
import { eq, sql, and, desc } from "drizzle-orm";
import {
  hiveScannedItems,
  hiveInjectionPoints,
  hiveKnowledge,
} from "../../drizzle/hive-schema";

export interface RelationshipStrength {
  sourceId: string;
  targetId: string;
  strength: number; // 0-1 scale
  confidence: number; // 0-1 scale
  usageCount: number;
  lastUsed: Date;
  decayFactor: number;
}

export interface LearningPattern {
  patternType: string;
  description: string;
  frequency: number;
  confidence: number;
  examples: string[];
}

export interface UsageMetrics {
  views: number;
  approvals: number;
  rejections: number;
  implementations: number;
  lastInteraction: Date;
}

/**
 * Calculate relationship strength based on multiple factors
 */
export async function calculateRelationshipStrength(
  sourceId: string,
  targetId: string
): Promise<RelationshipStrength> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get usage metrics for this relationship
  const metrics = await getRelationshipMetrics(sourceId, targetId);

  // Base strength from tag similarity (already calculated)
  const tagSimilarity = await getTagSimilarity(sourceId, targetId);

  // Usage factor (more usage = stronger relationship)
  const usageFactor = Math.min(
    1,
    (metrics.views * 0.1 + metrics.approvals * 0.5 + metrics.implementations * 1.0) / 10
  );

  // Recency factor (recent usage = stronger relationship)
  const daysSinceLastUse = Math.floor(
    (Date.now() - metrics.lastInteraction.getTime()) / (1000 * 60 * 60 * 24)
  );
  const recencyFactor = Math.exp(-daysSinceLastUse / 30); // Decay over 30 days

  // Success rate factor
  const totalActions = metrics.approvals + metrics.rejections;
  const successRate = totalActions > 0 ? metrics.approvals / totalActions : 0.5;

  // Combined strength calculation
  const strength =
    tagSimilarity * 0.3 + // Tag similarity baseline
    usageFactor * 0.3 + // Usage frequency
    recencyFactor * 0.2 + // Recency
    successRate * 0.2; // Success rate

  // Confidence increases with more data points
  const confidence = Math.min(1, totalActions / 20);

  // Decay factor for unused relationships
  const decayFactor = recencyFactor;

  return {
    sourceId,
    targetId,
    strength: Math.max(0, Math.min(1, strength)),
    confidence,
    usageCount: metrics.views + metrics.approvals + metrics.implementations,
    lastUsed: metrics.lastInteraction,
    decayFactor,
  };
}

/**
 * Get relationship usage metrics
 */
async function getRelationshipMetrics(
  sourceId: string,
  targetId: string
): Promise<UsageMetrics> {
  const db = await getDb();
  if (!db)
    return {
      views: 0,
      approvals: 0,
      rejections: 0,
      implementations: 0,
      lastInteraction: new Date(0),
    };

  // Query injection points that connect these items
  const injectionPoints = await db
    .select()
    .from(hiveInjectionPoints)
    .where(
      and(
        eq(hiveInjectionPoints.sourceItemId, sourceId),
        eq(hiveInjectionPoints.targetItemId, targetId)
      )
    );

  let views = 0;
  let approvals = 0;
  let rejections = 0;
  let implementations = 0;
  let lastInteraction = new Date(0);

  for (const point of injectionPoints) {
    // Count status changes as interactions
    if (point.status === "approved") approvals++;
    if (point.status === "rejected") rejections++;
    if (point.status === "implemented") implementations++;

    // Update last interaction
    if (point.updatedAt > lastInteraction) {
      lastInteraction = point.updatedAt;
    }
  }

  // Estimate views (in production, track this separately)
  views = injectionPoints.length * 2;

  return {
    views,
    approvals,
    rejections,
    implementations,
    lastInteraction: lastInteraction.getTime() > 0 ? lastInteraction : new Date(),
  };
}

/**
 * Get tag similarity between two items
 */
async function getTagSimilarity(sourceId: string, targetId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const [source, target] = await Promise.all([
    db.select().from(hiveScannedItems).where(eq(hiveScannedItems.id, sourceId)).limit(1),
    db.select().from(hiveScannedItems).where(eq(hiveScannedItems.id, targetId)).limit(1),
  ]);

  if (!source[0] || !target[0]) return 0;

  const sourceTags = source[0].tags || [];
  const targetTags = target[0].tags || [];

  const commonTags = sourceTags.filter((tag) => targetTags.includes(tag));
  const allTags = new Set([...sourceTags, ...targetTags]);

  return allTags.size > 0 ? commonTags.length / allTags.size : 0;
}

/**
 * Identify learning patterns from historical data
 */
export async function identifyLearningPatterns(): Promise<LearningPattern[]> {
  const db = await getDb();
  if (!db) return [];

  // Get all approved injection points
  const approvedPoints = await db
    .select()
    .from(hiveInjectionPoints)
    .where(eq(hiveInjectionPoints.status, "approved"))
    .limit(1000);

  // Analyze patterns
  const patterns: Map<string, LearningPattern> = new Map();

  for (const point of approvedPoints) {
    const patternKey = `${point.injectionType}-${point.targetType}`;

    if (!patterns.has(patternKey)) {
      patterns.set(patternKey, {
        patternType: patternKey,
        description: `${point.injectionType} injections into ${point.targetType} items`,
        frequency: 0,
        confidence: 0,
        examples: [],
      });
    }

    const pattern = patterns.get(patternKey)!;
    pattern.frequency++;
    if (pattern.examples.length < 5) {
      pattern.examples.push(point.id);
    }
  }

  // Calculate confidence based on frequency
  const totalPoints = approvedPoints.length;
  for (const pattern of patterns.values()) {
    pattern.confidence = Math.min(1, pattern.frequency / 10);
  }

  return Array.from(patterns.values()).sort((a, b) => b.frequency - a.frequency);
}

/**
 * Generate automatic relationship suggestions based on learned patterns
 */
export async function generateRelationshipSuggestions(
  itemId: string,
  limit: number = 10
): Promise<
  {
    targetId: string;
    targetName: string;
    confidence: number;
    reason: string;
    patternMatch: string;
  }[]
> {
  const db = await getDb();
  if (!db) return [];

  // Get the source item
  const sourceItem = await db
    .select()
    .from(hiveScannedItems)
    .where(eq(hiveScannedItems.id, itemId))
    .limit(1);

  if (!sourceItem[0]) return [];

  // Get learned patterns
  const patterns = await identifyLearningPatterns();

  // Get all other items
  const allItems = await db
    .select()
    .from(hiveScannedItems)
    .where(sql`${hiveScannedItems.id} != ${itemId}`)
    .limit(1000);

  const suggestions: {
    targetId: string;
    targetName: string;
    confidence: number;
    reason: string;
    patternMatch: string;
  }[] = [];

  for (const targetItem of allItems) {
    // Calculate tag similarity
    const sourceTags = sourceItem[0].tags || [];
    const targetTags = targetItem.tags || [];
    const commonTags = sourceTags.filter((tag) => targetTags.includes(tag));
    const allTags = new Set([...sourceTags, ...targetTags]);
    const tagSimilarity = allTags.size > 0 ? commonTags.length / allTags.size : 0;

    if (tagSimilarity < 0.2) continue; // Skip low similarity

    // Find matching pattern
    const patternKey = `${sourceItem[0].type}-${targetItem.type}`;
    const matchingPattern = patterns.find((p) => p.patternType === patternKey);

    const confidence = matchingPattern
      ? (tagSimilarity + matchingPattern.confidence) / 2
      : tagSimilarity * 0.7;

    if (confidence >= 0.3) {
      suggestions.push({
        targetId: targetItem.id,
        targetName: targetItem.name,
        confidence,
        reason: `Shares ${commonTags.length} common tags: ${commonTags.slice(0, 3).join(", ")}`,
        patternMatch: matchingPattern?.description || "No pattern match",
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}

/**
 * Update relationship strength based on user feedback
 */
export async function updateRelationshipFromFeedback(
  injectionPointId: string,
  action: "approve" | "reject" | "implement"
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Get the injection point
  const injectionPoint = await db
    .select()
    .from(hiveInjectionPoints)
    .where(eq(hiveInjectionPoints.id, injectionPointId))
    .limit(1);

  if (!injectionPoint[0]) return;

  // Update status
  const newStatus =
    action === "approve"
      ? "approved"
      : action === "reject"
        ? "rejected"
        : "implemented";

  await db
    .update(hiveInjectionPoints)
    .set({
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(hiveInjectionPoints.id, injectionPointId));

  // Store learning in knowledge base
  await db.insert(hiveKnowledge).values({
    id: `learn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: `Feedback: ${action} injection ${injectionPoint[0].injectionType}`,
    content: JSON.stringify({
      action,
      injectionType: injectionPoint[0].injectionType,
      sourceId: injectionPoint[0].sourceItemId,
      targetId: injectionPoint[0].targetItemId,
      timestamp: new Date(),
    }),
    type: "feedback",
    source: "user_feedback",
    confidence: action === "implement" ? 1.0 : action === "approve" ? 0.8 : 0.3,
    metadata: JSON.stringify({
      injectionPointId,
      action,
    }),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/**
 * Apply decay to unused relationships
 */
export async function applyRelationshipDecay(): Promise<{
  processed: number;
  decayed: number;
}> {
  const db = await getDb();
  if (!db) return { processed: 0, decayed: 0 };

  // Get all injection points
  const allPoints = await db.select().from(hiveInjectionPoints).limit(10000);

  let processed = 0;
  let decayed = 0;

  for (const point of allPoints) {
    const daysSinceUpdate = Math.floor(
      (Date.now() - point.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Decay after 60 days of inactivity
    if (daysSinceUpdate > 60 && point.status === "pending") {
      await db
        .update(hiveInjectionPoints)
        .set({
          status: "archived",
          updatedAt: new Date(),
        })
        .where(eq(hiveInjectionPoints.id, point.id));

      decayed++;
    }

    processed++;
  }

  return { processed, decayed };
}

/**
 * Get learning statistics
 */
export async function getLearningStatistics(): Promise<{
  totalRelationships: number;
  strongRelationships: number;
  learningPatterns: number;
  averageConfidence: number;
  recentFeedback: number;
}> {
  const db = await getDb();
  if (!db)
    return {
      totalRelationships: 0,
      strongRelationships: 0,
      learningPatterns: 0,
      averageConfidence: 0,
      recentFeedback: 0,
    };

  const [injectionPoints, patterns, recentKnowledge] = await Promise.all([
    db.select().from(hiveInjectionPoints).limit(10000),
    identifyLearningPatterns(),
    db
      .select()
      .from(hiveKnowledge)
      .where(eq(hiveKnowledge.type, "feedback"))
      .orderBy(desc(hiveKnowledge.createdAt))
      .limit(100),
  ]);

  // Calculate strong relationships (confidence > 0.7)
  let strongCount = 0;
  let totalConfidence = 0;

  for (const point of injectionPoints) {
    if (point.confidence && point.confidence > 0.7) {
      strongCount++;
    }
    totalConfidence += point.confidence || 0;
  }

  // Count recent feedback (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentFeedbackCount = recentKnowledge.filter(
    (k) => k.createdAt >= sevenDaysAgo
  ).length;

  return {
    totalRelationships: injectionPoints.length,
    strongRelationships: strongCount,
    learningPatterns: patterns.length,
    averageConfidence:
      injectionPoints.length > 0 ? totalConfidence / injectionPoints.length : 0,
    recentFeedback: recentFeedbackCount,
  };
}
