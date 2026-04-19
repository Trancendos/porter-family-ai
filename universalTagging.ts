/**
 * Universal Smart Tagging System
 * 
 * AI-powered tagging with human-in-the-loop approval and confidence learning.
 * Works across all entity types (tasks, code, transactions, security events, etc.)
 */

import { getDb } from "../db";
import { invokeLLM } from "../_core/llm";
import { eq, and, desc, gte } from "drizzle-orm";
import { mysqlTable, int, varchar, text, timestamp, decimal, json, boolean } from "drizzle-orm/mysql-core";

// Schema definitions (will be added to main schema)
export const universalTags = mysqlTable("universal_tags", {
  id: int("id").autoincrement().primaryKey(),
  tagName: varchar("tag_name", { length: 255 }).notNull().unique(),
  tagType: varchar("tag_type", { length: 64 }).notNull(),
  category: varchar("category", { length: 64 }),
  description: text("description"),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }).default("50.00"),
  usageCount: int("usage_count").default(0).notNull(),
  approvalCount: int("approval_count").default(0).notNull(),
  rejectionCount: int("rejection_count").default(0).notNull(),
  createdBy: int("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const universalTagApprovals = mysqlTable("universal_tag_approvals", {
  id: int("id").autoincrement().primaryKey(),
  tagId: int("tag_id").notNull(),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: int("entity_id").notNull(),
  suggestedBy: varchar("suggested_by", { length: 64 }).notNull(),
  aiConfidence: decimal("ai_confidence", { precision: 5, scale: 2 }),
  status: varchar("status", { length: 32 }).default("pending").notNull(),
  reviewedBy: int("reviewed_by"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

export const universalEntityTags = mysqlTable("universal_entity_tags", {
  id: int("id").autoincrement().primaryKey(),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: int("entity_id").notNull(),
  tagId: int("tag_id").notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 2 }).default("100.00"),
  appliedBy: varchar("applied_by", { length: 64 }).notNull(),
  verified: boolean("verified").default(false),
  verifiedBy: int("verified_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at"),
});

/**
 * Suggest tags for content using AI
 */
export async function suggestUniversalTags(
  content: string,
  entityType: string,
  context?: Record<string, any>
): Promise<Array<{ tagName: string; confidence: number; reason: string }>> {
  try {
    const prompt = `Analyze the following content and suggest 3-5 relevant tags for categorization and filtering.

Entity Type: ${entityType}
${context ? `Context: ${JSON.stringify(context, null, 2)}` : ""}

Content:
${content}

Suggest tags that are:
1. Concise (1-3 words)
2. Relevant to the entity type
3. Useful for filtering and categorization
4. Consistent with common tagging conventions

Return JSON with confidence scores (0-100) and brief reasons.`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a tagging expert. Suggest accurate, relevant tags for content analysis.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "tag_suggestions",
          strict: true,
          schema: {
            type: "object",
            properties: {
              tags: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    tagName: { type: "string" },
                    confidence: { type: "number" },
                    reason: { type: "string" },
                  },
                  required: ["tagName", "confidence", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["tags"],
            additionalProperties: false,
          },
        },
      },
    });

    const content_str = response.choices[0].message.content;
    if (typeof content_str !== 'string') {
      return [];
    }

    const result = JSON.parse(content_str);
    return result.tags;
  } catch (error) {
    console.error("Failed to suggest universal tags:", error);
    return [];
  }
}

/**
 * Create or get tag
 */
export async function createOrGetUniversalTag(
  tagName: string,
  tagType: string,
  category?: string,
  description?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if tag exists
  const existing = await db
    .select()
    .from(universalTags)
    .where(eq(universalTags.tagName, tagName))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Create new tag
  const [newTag] = await db.insert(universalTags).values({
    tagName,
    tagType,
    category,
    description,
    confidenceScore: "50.00", // Start with neutral confidence
  }).$returningId();

  const created = await db
    .select()
    .from(universalTags)
    .where(eq(universalTags.id, newTag.id))
    .limit(1);

  return created[0];
}

/**
 * Apply tag to entity
 */
export async function applyUniversalTag(
  entityType: string,
  entityId: number,
  tagId: number,
  confidence: number,
  appliedBy: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(universalEntityTags).values({
    entityType,
    entityId,
    tagId,
    confidence: confidence.toFixed(2),
    appliedBy,
  });

  // Increment usage count
  const tag = await db.select().from(universalTags).where(eq(universalTags.id, tagId)).limit(1);
  if (tag.length > 0) {
    await db
      .update(universalTags)
      .set({
        usageCount: tag[0].usageCount + 1,
      })
      .where(eq(universalTags.id, tagId));
  }
}

/**
 * Submit tag approval request
 */
export async function submitUniversalTagApproval(
  tagId: number,
  entityType: string,
  entityId: number,
  suggestedBy: string,
  aiConfidence: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(universalTagApprovals).values({
    tagId,
    entityType,
    entityId,
    suggestedBy,
    aiConfidence: aiConfidence.toFixed(2),
    status: "pending",
  });
}

/**
 * Approve tag suggestion
 */
export async function approveUniversalTag(approvalId: number, reviewedBy: number, notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const approval = await db
    .select()
    .from(universalTagApprovals)
    .where(eq(universalTagApprovals.id, approvalId))
    .limit(1);

  if (approval.length === 0) throw new Error("Approval not found");

  // Update approval status
  await db
    .update(universalTagApprovals)
    .set({
      status: "approved",
      reviewedBy,
      reviewNotes: notes,
      reviewedAt: new Date(),
    })
    .where(eq(universalTagApprovals.id, approvalId));

  // Apply tag to entity
  await applyUniversalTag(
    approval[0].entityType,
    approval[0].entityId,
    approval[0].tagId,
    parseFloat(approval[0].aiConfidence?.toString() || "100"),
    "user"
  );

  // Update tag confidence (increase on approval)
  const tag = await db
    .select()
    .from(universalTags)
    .where(eq(universalTags.id, approval[0].tagId))
    .limit(1);

  if (tag.length > 0 && tag[0].confidenceScore) {
    const currentConfidence = parseFloat(tag[0].confidenceScore.toString());
    const newConfidence = Math.min(100, currentConfidence + 5); // Increase by 5%

    await db
      .update(universalTags)
      .set({
        confidenceScore: newConfidence.toFixed(2),
        approvalCount: tag[0].approvalCount + 1,
      })
      .where(eq(universalTags.id, approval[0].tagId));
  }
}

/**
 * Reject tag suggestion
 */
export async function rejectUniversalTag(approvalId: number, reviewedBy: number, reason: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const approval = await db
    .select()
    .from(universalTagApprovals)
    .where(eq(universalTagApprovals.id, approvalId))
    .limit(1);

  if (approval.length === 0) throw new Error("Approval not found");

  // Update approval status
  await db
    .update(universalTagApprovals)
    .set({
      status: "rejected",
      reviewedBy,
      reviewNotes: reason,
      reviewedAt: new Date(),
    })
    .where(eq(universalTagApprovals.id, approvalId));

  // Update tag confidence (decrease on rejection)
  const tag = await db
    .select()
    .from(universalTags)
    .where(eq(universalTags.id, approval[0].tagId))
    .limit(1);

  if (tag.length > 0 && tag[0].confidenceScore) {
    const currentConfidence = parseFloat(tag[0].confidenceScore.toString());
    const newConfidence = Math.max(0, currentConfidence - 10); // Decrease by 10%

    await db
      .update(universalTags)
      .set({
        confidenceScore: newConfidence.toFixed(2),
        rejectionCount: tag[0].rejectionCount + 1,
      })
      .where(eq(universalTags.id, approval[0].tagId));
  }
}

/**
 * Get pending tag approvals
 */
export async function getPendingUniversalApprovals(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(universalTagApprovals)
    .where(eq(universalTagApprovals.status, "pending"))
    .orderBy(desc(universalTagApprovals.createdAt))
    .limit(limit);
}

/**
 * Get tags for entity
 */
export async function getUniversalEntityTags(entityType: string, entityId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(universalEntityTags)
    .where(
      and(
        eq(universalEntityTags.entityType, entityType),
        eq(universalEntityTags.entityId, entityId)
      )
    );
}

/**
 * Get high-confidence tags
 */
export async function getHighConfidenceUniversalTags(minConfidence: number = 80) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(universalTags)
    .where(gte(universalTags.confidenceScore, minConfidence.toFixed(2)))
    .orderBy(desc(universalTags.confidenceScore));
}

/**
 * Auto-tag content with AI suggestions
 */
export async function autoTagUniversalContent(
  content: string,
  entityType: string,
  entityId: number,
  autoApprove: boolean = false
): Promise<number> {
  const suggestions = await suggestUniversalTags(content, entityType);

  let appliedCount = 0;

  for (const suggestion of suggestions) {
    // Create or get tag
    const tag = await createOrGetUniversalTag(suggestion.tagName, entityType);

    if (autoApprove && suggestion.confidence >= 90) {
      // Auto-approve high-confidence tags
      await applyUniversalTag(entityType, entityId, tag.id, suggestion.confidence, "ai");
      appliedCount++;
    } else {
      // Submit for human approval
      await submitUniversalTagApproval(
        tag.id,
        entityType,
        entityId,
        "ai",
        suggestion.confidence
      );
    }
  }

  return appliedCount;
}

/**
 * Get tagging statistics
 */
export async function getTaggingStatistics() {
  const db = await getDb();
  if (!db) return null;

  const allTags = await db.select().from(universalTags);
  const pendingApprovals = await getPendingUniversalApprovals();

  const totalTags = allTags.length;
  const totalUsage = allTags.reduce((sum, tag) => sum + tag.usageCount, 0);
  const totalApprovals = allTags.reduce((sum, tag) => sum + tag.approvalCount, 0);
  const totalRejections = allTags.reduce((sum, tag) => sum + tag.rejectionCount, 0);
  const avgConfidence =
    totalTags > 0
      ? allTags.reduce((sum, tag) => sum + parseFloat(tag.confidenceScore?.toString() || '0'), 0) / totalTags
      : 0;

  return {
    totalTags,
    totalUsage,
    totalApprovals,
    totalRejections,
    pendingApprovals: pendingApprovals.length,
    avgConfidence: Math.round(avgConfidence),
    approvalRate:
      totalApprovals + totalRejections > 0
        ? Math.round((totalApprovals / (totalApprovals + totalRejections)) * 100)
        : 0,
  };
}
