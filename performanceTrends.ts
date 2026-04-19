/**
 * Performance Trends Aggregation Service
 * 
 * Aggregates agent task execution data into hourly, daily, weekly, and monthly trends
 */

import { getDb } from "../db";
import { agentTaskHistory } from "../../drizzle/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export type TrendPeriod = "hourly" | "daily" | "weekly" | "monthly";

export interface TrendData {
  agentId: string;
  taskName: string;
  period: TrendPeriod;
  periodStart: Date;
  periodEnd: Date;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  totalDuration: number;
}

/**
 * Calculate period boundaries for aggregation
 */
function getPeriodBoundaries(period: TrendPeriod, date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(date);
  const end = new Date(date);

  switch (period) {
    case "hourly":
      start.setMinutes(0, 0, 0);
      end.setMinutes(59, 59, 999);
      break;
    case "daily":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "weekly":
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    case "monthly":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
}

/**
 * Aggregate performance data for a specific period
 */
export async function aggregateTrends(period: TrendPeriod, date: Date = new Date()): Promise<TrendData[]> {
  const db = await getDb();
  if (!db) return [];

  const { start, end } = getPeriodBoundaries(period, date);

  try {
    // Aggregate data from agentTaskHistory
    const results = await db
      .select({
        agentId: agentTaskHistory.agentId,
        taskName: agentTaskHistory.taskName,
        totalExecutions: sql<number>`COUNT(*)`,
        successfulExecutions: sql<number>`SUM(CASE WHEN ${agentTaskHistory.status} = 'completed' THEN 1 ELSE 0 END)`,
        failedExecutions: sql<number>`SUM(CASE WHEN ${agentTaskHistory.status} = 'failed' THEN 1 ELSE 0 END)`,
        avgDuration: sql<number>`AVG(${agentTaskHistory.durationMs})`,
        minDuration: sql<number>`MIN(${agentTaskHistory.durationMs})`,
        maxDuration: sql<number>`MAX(${agentTaskHistory.durationMs})`,
        totalDuration: sql<number>`SUM(${agentTaskHistory.durationMs})`,
      })
      .from(agentTaskHistory)
      .where(
        and(
          gte(agentTaskHistory.startTime, start),
          lte(agentTaskHistory.startTime, end)
        )
      )
      .groupBy(agentTaskHistory.agentId, agentTaskHistory.taskName);

    return results.map(r => ({
      agentId: r.agentId,
      taskName: r.taskName,
      period,
      periodStart: start,
      periodEnd: end,
      totalExecutions: r.totalExecutions,
      successfulExecutions: r.successfulExecutions,
      failedExecutions: r.failedExecutions,
      successRate: r.totalExecutions > 0 ? (r.successfulExecutions / r.totalExecutions) * 100 : 0,
      avgDuration: Math.round(r.avgDuration || 0),
      minDuration: r.minDuration || 0,
      maxDuration: r.maxDuration || 0,
      totalDuration: r.totalDuration || 0,
    }));
  } catch (error) {
    console.error("[Performance Trends] Error aggregating trends:", error);
    return [];
  }
}

/**
 * Get trend data for a specific time range
 */
export async function getTrendsByTimeRange(
  agentId: string | null,
  period: TrendPeriod,
  startDate: Date,
  endDate: Date
): Promise<TrendData[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const conditions = [
      gte(agentTaskHistory.startTime, startDate),
      lte(agentTaskHistory.startTime, endDate),
    ];

    if (agentId) {
      conditions.push(eq(agentTaskHistory.agentId, agentId));
    }

    const results = await db
      .select({
        agentId: agentTaskHistory.agentId,
        taskName: agentTaskHistory.taskName,
        startTime: agentTaskHistory.startTime,
        status: agentTaskHistory.status,
        duration: agentTaskHistory.durationMs,
      })
      .from(agentTaskHistory)
      .where(and(...conditions))
      .orderBy(agentTaskHistory.startTime);

    // Group by period
    const grouped = new Map<string, TrendData>();

    for (const record of results) {
      const { start, end } = getPeriodBoundaries(period, record.startTime);
      const key = `${record.agentId}-${record.taskName}-${start.getTime()}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          agentId: record.agentId,
          taskName: record.taskName,
          period,
          periodStart: start,
          periodEnd: end,
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          successRate: 0,
          avgDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          totalDuration: 0,
        });
      }

      const trend = grouped.get(key)!;
      trend.totalExecutions++;
      if (record.status === "completed") {
        trend.successfulExecutions++;
      } else if (record.status === "failed") {
        trend.failedExecutions++;
      }
      trend.totalDuration += record.duration || 0;
      trend.minDuration = Math.min(trend.minDuration, record.duration || 0);
      trend.maxDuration = Math.max(trend.maxDuration, record.duration || 0);
    }

    // Calculate averages and success rates
    const trends = Array.from(grouped.values()).map(trend => ({
      ...trend,
      avgDuration: trend.totalExecutions > 0 ? Math.round(trend.totalDuration / trend.totalExecutions) : 0,
      successRate: trend.totalExecutions > 0 ? (trend.successfulExecutions / trend.totalExecutions) * 100 : 0,
      minDuration: trend.minDuration === Infinity ? 0 : trend.minDuration,
    }));

    return trends;
  } catch (error) {
    console.error("[Performance Trends] Error getting trends by time range:", error);
    return [];
  }
}

/**
 * Get success rate trends over time
 */
export async function getSuccessRateTrends(
  agentId: string | null,
  period: TrendPeriod,
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; successRate: number; agentId: string; taskName: string }>> {
  const trends = await getTrendsByTimeRange(agentId, period, startDate, endDate);

  return trends.map(t => ({
    date: t.periodStart.toISOString(),
    successRate: t.successRate,
    agentId: t.agentId,
    taskName: t.taskName,
  }));
}

/**
 * Get execution duration trends over time
 */
export async function getDurationTrends(
  agentId: string | null,
  period: TrendPeriod,
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; avgDuration: number; minDuration: number; maxDuration: number; agentId: string; taskName: string }>> {
  const trends = await getTrendsByTimeRange(agentId, period, startDate, endDate);

  return trends.map(t => ({
    date: t.periodStart.toISOString(),
    avgDuration: t.avgDuration,
    minDuration: t.minDuration,
    maxDuration: t.maxDuration,
    agentId: t.agentId,
    taskName: t.taskName,
  }));
}

/**
 * Get failure patterns by agent
 */
export async function getFailurePatterns(
  startDate: Date,
  endDate: Date
): Promise<Array<{ agentId: string; taskName: string; failures: number; totalExecutions: number; failureRate: number }>> {
  const trends = await getTrendsByTimeRange(null, "daily", startDate, endDate);

  // Aggregate by agent and task
  const patterns = new Map<string, { failures: number; total: number }>();

  for (const trend of trends) {
    const key = `${trend.agentId}-${trend.taskName}`;
    if (!patterns.has(key)) {
      patterns.set(key, { failures: 0, total: 0 });
    }
    const pattern = patterns.get(key)!;
    pattern.failures += trend.failedExecutions;
    pattern.total += trend.totalExecutions;
  }

  return Array.from(patterns.entries()).map(([key, data]) => {
    const [agentId, taskName] = key.split("-");
    return {
      agentId,
      taskName,
      failures: data.failures,
      totalExecutions: data.total,
      failureRate: data.total > 0 ? (data.failures / data.total) * 100 : 0,
    };
  });
}

/**
 * Get task completion volume trends
 */
export async function getCompletionVolume(
  agentId: string | null,
  period: TrendPeriod,
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; completed: number; failed: number; total: number; agentId: string }>> {
  const trends = await getTrendsByTimeRange(agentId, period, startDate, endDate);

  // Group by period and agent
  const volumes = new Map<string, { completed: number; failed: number; total: number }>();

  for (const trend of trends) {
    const key = `${trend.periodStart.toISOString()}-${trend.agentId}`;
    if (!volumes.has(key)) {
      volumes.set(key, { completed: 0, failed: 0, total: 0 });
    }
    const volume = volumes.get(key)!;
    volume.completed += trend.successfulExecutions;
    volume.failed += trend.failedExecutions;
    volume.total += trend.totalExecutions;
  }

  return Array.from(volumes.entries()).map(([key, data]) => {
    const [date, agentId] = key.split("-");
    return {
      date,
      agentId,
      ...data,
    };
  });
}
