import { getDb } from "../db";
import { agileKanbanBoards, agileKanbanCards, agileBacklog } from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  createGateReviewBoard,
  createGateReviewItem,
  getGateReviewItemsByBoard,
  updateGateReviewItem,
} from "../db-gate-review";

/**
 * Gate Review Service
 * Consolidates data from all Kanban boards into a unified gate review board
 */

export interface KanbanBoardSource {
  boardId: string;
  boardName: string;
  category: "requirements" | "incidents" | "problems" | "changes" | "releases" | "knowledge" | "deletions";
}

export interface GateReadinessMetrics {
  totalItems: number;
  readyForReview: number;
  inReview: number;
  approved: number;
  rejected: number;
  averageReadinessScore: number;
  completionRate: number;
}

/**
 * Create a new gate review board that pulls from specified Kanban boards
 */
export async function createGateReview(
  userId: number,
  boardName: string,
  gateType: "stage_gate" | "quality_gate" | "release_gate" | "compliance_gate",
  sourceBoards: KanbanBoardSource[],
  filterCriteria?: any
) {
  const boardId = `GATE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const result = await createGateReviewBoard({
    boardId,
    boardName,
    description: `Gate review board consolidating ${sourceBoards.length} source boards`,
    ownerId: userId,
    gateType,
    sourceBoards: JSON.stringify(sourceBoards),
    filterCriteria: filterCriteria ? JSON.stringify(filterCriteria) : null,
    isActive: "yes",
  });

  return {
    id: result[0].insertId,
    boardId,
  };
}

/**
 * Sync data from all source Kanban boards into the gate review board
 */
export async function syncGateReviewBoard(gateReviewBoardId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the gate review board configuration
  const [gateBoard] = await db
    .select()
    .from(agileKanbanBoards)
    .where(eq(agileKanbanBoards.id, gateReviewBoardId))
    .limit(1);

  if (!gateBoard) {
    throw new Error("Gate review board not found");
  }

  const sourceBoards: KanbanBoardSource[] = gateBoard.teamMembers
    ? JSON.parse(gateBoard.teamMembers)
    : [];

  const syncedItems: any[] = [];

  // Fetch cards from all source boards
  for (const source of sourceBoards) {
    const sourceBoardData = await db
      .select()
      .from(agileKanbanBoards)
      .where(eq(agileKanbanBoards.boardId, source.boardId))
      .limit(1);

    if (sourceBoardData.length === 0) continue;

    const sourceBoardId = sourceBoardData[0].id;

    // Get all cards from this board
    const cards = await db
      .select()
      .from(agileKanbanCards)
      .where(eq(agileKanbanCards.boardId, sourceBoardId));

    // Get backlog items for these cards
    const backlogItemIds = cards.map((c) => c.backlogItemId).filter((id): id is number => id !== null);
    if (backlogItemIds.length === 0) continue;

    const backlogItems = await db
      .select()
      .from(agileBacklog)
      .where(inArray(agileBacklog.id, backlogItemIds));

    // Create gate review items
    for (const card of cards) {
      const backlogItem = backlogItems.find((b) => b.id === card.backlogItemId);
      if (!backlogItem) continue;

      // Calculate gate readiness score
      const readinessScore = calculateGateReadinessScore(backlogItem, card);

      const gateReviewItem = {
        gateReviewBoardId,
        sourceBoard: source.boardId,
        sourceCardId: card.id,
        sourceBacklogId: backlogItem.backlogId,
        title: backlogItem.title,
        description: backlogItem.description || "",
        category: source.category,
        priority: backlogItem.priority,
        gateReadinessScore: readinessScore,
        completionPercentage: calculateCompletionPercentage(backlogItem),
        gateStatus: "pending" as const,
        reviewNotes: null,
        reviewerId: null,
        reviewedAt: null,
      };

      await createGateReviewItem(gateReviewItem);
      syncedItems.push(gateReviewItem);
    }
  }

  return {
    syncedCount: syncedItems.length,
    items: syncedItems,
  };
}

/**
 * Calculate gate readiness score (0-100)
 */
function calculateGateReadinessScore(backlogItem: any, card: any): number {
  let score = 0;

  // Has title and description (20 points)
  if (backlogItem.title && backlogItem.title.length > 10) score += 10;
  if (backlogItem.description && backlogItem.description.length > 50) score += 10;

  // Has acceptance criteria (20 points)
  if (backlogItem.acceptanceCriteria) {
    try {
      const criteria = JSON.parse(backlogItem.acceptanceCriteria);
      if (Array.isArray(criteria) && criteria.length > 0) score += 20;
    } catch (e) {
      // Invalid JSON
    }
  }

  // Has story points (15 points)
  if (backlogItem.storyPoints && backlogItem.storyPoints > 0) score += 15;

  // Has priority set (10 points)
  if (backlogItem.priority && backlogItem.priority !== "medium") score += 10;

  // Has assignee (10 points)
  if (backlogItem.assignedTo) score += 10;

  // Has labels/tags (10 points)
  if (backlogItem.labels) {
    try {
      const labels = JSON.parse(backlogItem.labels);
      if (Array.isArray(labels) && labels.length > 0) score += 10;
    } catch (e) {
      // Invalid JSON
    }
  }

  // Has dependencies documented (15 points)
  if (backlogItem.dependencies) {
    try {
      const deps = JSON.parse(backlogItem.dependencies);
      if (Array.isArray(deps) && deps.length > 0) score += 15;
    } catch (e) {
      // Invalid JSON
    }
  }

  return Math.min(score, 100);
}

/**
 * Calculate completion percentage based on acceptance criteria
 */
function calculateCompletionPercentage(backlogItem: any): number {
  if (!backlogItem.acceptanceCriteria) return 0;

  try {
    const criteria = JSON.parse(backlogItem.acceptanceCriteria);
    if (!Array.isArray(criteria) || criteria.length === 0) return 0;

    const completed = criteria.filter((c: any) => c.completed === true).length;
    return Math.round((completed / criteria.length) * 100);
  } catch (e) {
    return 0;
  }
}

/**
 * Get gate readiness metrics for a gate review board
 */
export async function getGateReadinessMetrics(gateReviewBoardId: number): Promise<GateReadinessMetrics> {
  const items = await getGateReviewItemsByBoard(gateReviewBoardId);

  const totalItems = items.length;
  const readyForReview = items.filter((i) => (i.gateReadinessScore || 0) >= 80).length;
  const inReview = items.filter((i) => i.gateStatus === "in_review").length;
  const approved = items.filter((i) => i.gateStatus === "approved").length;
  const rejected = items.filter((i) => i.gateStatus === "rejected").length;

  const averageReadinessScore =
    totalItems > 0
      ? Math.round(items.reduce((sum, i) => sum + (i.gateReadinessScore || 0), 0) / totalItems)
      : 0;

  const completionRate =
    totalItems > 0
      ? Math.round(items.reduce((sum, i) => sum + (i.completionPercentage || 0), 0) / totalItems)
      : 0;

  return {
    totalItems,
    readyForReview,
    inReview,
    approved,
    rejected,
    averageReadinessScore,
    completionRate,
  };
}

/**
 * Approve a gate review item
 */
export async function approveGateReviewItem(
  itemId: number,
  reviewerId: number,
  reviewNotes?: string
) {
  return updateGateReviewItem(itemId, {
    gateStatus: "approved",
    reviewerId,
    reviewNotes: reviewNotes || null,
    reviewedAt: new Date(),
  });
}

/**
 * Reject a gate review item
 */
export async function rejectGateReviewItem(
  itemId: number,
  reviewerId: number,
  reviewNotes: string
) {
  return updateGateReviewItem(itemId, {
    gateStatus: "rejected",
    reviewerId,
    reviewNotes,
    reviewedAt: new Date(),
  });
}

/**
 * Bulk approve multiple gate review items
 */
export async function bulkApproveGateReviewItems(
  itemIds: number[],
  reviewerId: number,
  reviewNotes?: string
) {
  const results = [];
  for (const itemId of itemIds) {
    const result = await approveGateReviewItem(itemId, reviewerId, reviewNotes);
    results.push(result);
  }
  return results;
}

/**
 * Bulk reject multiple gate review items
 */
export async function bulkRejectGateReviewItems(
  itemIds: number[],
  reviewerId: number,
  reviewNotes: string
) {
  const results = [];
  for (const itemId of itemIds) {
    const result = await rejectGateReviewItem(itemId, reviewerId, reviewNotes);
    results.push(result);
  }
  return results;
}
