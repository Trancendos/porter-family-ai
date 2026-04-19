import { getDb } from '../db';
import {
  emailDeliveryLogs,
  emailEngagement,
  scheduleAnalytics,
  type ScheduleAnalytics,
  type InsertScheduleAnalytics,
} from '../../drizzle/schema';
import { eq, and, gte, lte, sql, count, avg } from 'drizzle-orm';

/**
 * Analytics period types
 */
export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';

/**
 * Schedule performance metrics
 */
export interface SchedulePerformanceMetrics {
  scheduleId: number;
  period: AnalyticsPeriod;
  periodStart: Date;
  periodEnd: Date;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  bouncedDeliveries: number;
  totalOpens: number;
  uniqueOpens: number;
  totalClicks: number;
  uniqueClicks: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  averageDeliveryTime: number;
}

/**
 * Overall analytics summary
 */
export interface AnalyticsSummary {
  totalSchedules: number;
  totalDeliveries: number;
  successRate: number;
  averageOpenRate: number;
  averageClickRate: number;
  topPerformingSchedules: Array<{
    scheduleId: number;
    scheduleName: string;
    openRate: number;
    deliveries: number;
  }>;
  recentActivity: Array<{
    date: Date;
    deliveries: number;
    opens: number;
    clicks: number;
  }>;
}

/**
 * Delivery timeline data point
 */
export interface DeliveryTimelinePoint {
  timestamp: Date;
  successful: number;
  failed: number;
  bounced: number;
}

/**
 * Analytics Aggregation Service
 * Handles metrics calculation, aggregation, and reporting for email delivery analytics
 */
class AnalyticsAggregationService {
  /**
   * Calculate metrics for a specific schedule and period
   */
  async calculateScheduleMetrics(
    scheduleId: number,
    period: AnalyticsPeriod,
    periodStart: Date,
    periodEnd: Date
  ): Promise<SchedulePerformanceMetrics> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Get delivery statistics
    const deliveryStats = await db
      .select({
        total: count(),
        successful: sql<number>`SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END)`,
        failed: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
        bounced: sql<number>`SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END)`,
        avgDeliveryTime: avg(
          sql<number>`TIMESTAMPDIFF(MILLISECOND, ${emailDeliveryLogs.scheduledFor}, ${emailDeliveryLogs.sentAt})`
        ),
      })
      .from(emailDeliveryLogs)
      .where(
        and(
          eq(emailDeliveryLogs.scheduleId, scheduleId),
          gte(emailDeliveryLogs.createdAt, periodStart),
          lte(emailDeliveryLogs.createdAt, periodEnd)
        )
      );

    const stats = deliveryStats[0];
    const totalDeliveries = Number(stats.total) || 0;
    const successfulDeliveries = Number(stats.successful) || 0;
    const failedDeliveries = Number(stats.failed) || 0;
    const bouncedDeliveries = Number(stats.bounced) || 0;
    const averageDeliveryTime = Number(stats.avgDeliveryTime) || 0;

    // Get engagement statistics
    const deliveryIds = await db
      .select({ id: emailDeliveryLogs.id })
      .from(emailDeliveryLogs)
      .where(
        and(
          eq(emailDeliveryLogs.scheduleId, scheduleId),
          gte(emailDeliveryLogs.createdAt, periodStart),
          lte(emailDeliveryLogs.createdAt, periodEnd)
        )
      );

    const deliveryIdList = deliveryIds.map(d => d.id);

    let totalOpens = 0;
    let uniqueOpens = 0;
    let totalClicks = 0;
    let uniqueClicks = 0;

    if (deliveryIdList.length > 0) {
      const engagementStats = await db
        .select({
          totalOpens: sql<number>`SUM(CASE WHEN event_type = 'opened' THEN 1 ELSE 0 END)`,
          uniqueOpens: sql<number>`COUNT(DISTINCT CASE WHEN event_type = 'opened' THEN delivery_log_id END)`,
          totalClicks: sql<number>`SUM(CASE WHEN event_type = 'clicked' THEN 1 ELSE 0 END)`,
          uniqueClicks: sql<number>`COUNT(DISTINCT CASE WHEN event_type = 'clicked' THEN delivery_log_id END)`,
        })
        .from(emailEngagement)
        .where(sql`delivery_log_id IN (${sql.join(deliveryIdList, sql`, `)})`);

      const engagement = engagementStats[0];
      totalOpens = Number(engagement.totalOpens) || 0;
      uniqueOpens = Number(engagement.uniqueOpens) || 0;
      totalClicks = Number(engagement.totalClicks) || 0;
      uniqueClicks = Number(engagement.uniqueClicks) || 0;
    }

    // Calculate rates
    const openRate = successfulDeliveries > 0 ? (uniqueOpens / successfulDeliveries) * 100 : 0;
    const clickRate = uniqueOpens > 0 ? (uniqueClicks / uniqueOpens) * 100 : 0;
    const bounceRate = totalDeliveries > 0 ? (bouncedDeliveries / totalDeliveries) * 100 : 0;

    return {
      scheduleId,
      period,
      periodStart,
      periodEnd,
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      bouncedDeliveries,
      totalOpens,
      uniqueOpens,
      totalClicks,
      uniqueClicks,
      openRate: Number(openRate.toFixed(2)),
      clickRate: Number(clickRate.toFixed(2)),
      bounceRate: Number(bounceRate.toFixed(2)),
      averageDeliveryTime: Math.round(averageDeliveryTime),
    };
  }

  /**
   * Store calculated metrics in the database
   */
  async storeMetrics(metrics: SchedulePerformanceMetrics): Promise<ScheduleAnalytics> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const analyticsData: InsertScheduleAnalytics = {
      scheduleId: metrics.scheduleId,
      period: metrics.period,
      periodStart: metrics.periodStart,
      periodEnd: metrics.periodEnd,
      totalDeliveries: metrics.totalDeliveries,
      successfulDeliveries: metrics.successfulDeliveries,
      failedDeliveries: metrics.failedDeliveries,
      bouncedDeliveries: metrics.bouncedDeliveries,
      totalOpens: metrics.totalOpens,
      uniqueOpens: metrics.uniqueOpens,
      totalClicks: metrics.totalClicks,
      uniqueClicks: metrics.uniqueClicks,
      openRate: metrics.openRate.toString(),
      clickRate: metrics.clickRate.toString(),
      bounceRate: metrics.bounceRate.toString(),
      averageDeliveryTime: metrics.averageDeliveryTime,
    };

    const [result] = await db
      .insert(scheduleAnalytics)
      .values(analyticsData)
      .$returningId();

    const [stored] = await db
      .select()
      .from(scheduleAnalytics)
      .where(eq(scheduleAnalytics.id, result.id))
      .limit(1);

    return stored;
  }

  /**
   * Get analytics summary for all schedules
   */
  async getAnalyticsSummary(days: number = 30): Promise<AnalyticsSummary> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get total deliveries and success rate
    const deliveryStats = await db
      .select({
        total: count(),
        successful: sql<number>`SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END)`,
      })
      .from(emailDeliveryLogs)
      .where(gte(emailDeliveryLogs.createdAt, startDate));

    const totalDeliveries = Number(deliveryStats[0].total) || 0;
    const successfulDeliveries = Number(deliveryStats[0].successful) || 0;
    const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

    // Get average open and click rates from recent analytics
    const recentAnalytics = await db
      .select({
        avgOpenRate: avg(scheduleAnalytics.openRate),
        avgClickRate: avg(scheduleAnalytics.clickRate),
      })
      .from(scheduleAnalytics)
      .where(gte(scheduleAnalytics.periodStart, startDate));

    const averageOpenRate = Number(recentAnalytics[0]?.avgOpenRate) || 0;
    const averageClickRate = Number(recentAnalytics[0]?.avgClickRate) || 0;

    // Get top performing schedules
    const topSchedules = await db
      .select({
        scheduleId: scheduleAnalytics.scheduleId,
        avgOpenRate: avg(scheduleAnalytics.openRate),
        totalDeliveries: sql<number>`SUM(${scheduleAnalytics.totalDeliveries})`,
      })
      .from(scheduleAnalytics)
      .where(gte(scheduleAnalytics.periodStart, startDate))
      .groupBy(scheduleAnalytics.scheduleId)
      .orderBy(sql`avg_open_rate DESC`)
      .limit(5);

    const topPerformingSchedules = topSchedules.map(s => ({
      scheduleId: s.scheduleId,
      scheduleName: `Schedule #${s.scheduleId}`,
      openRate: Number(s.avgOpenRate) || 0,
      deliveries: Number(s.totalDeliveries) || 0,
    }));

    // Get recent activity (last 7 days)
    const recentDays = 7;
    const recentStartDate = new Date();
    recentStartDate.setDate(recentStartDate.getDate() - recentDays);

    const recentActivity = await db
      .select({
        date: sql<Date>`DATE(${emailDeliveryLogs.createdAt})`,
        deliveries: count(),
      })
      .from(emailDeliveryLogs)
      .where(gte(emailDeliveryLogs.createdAt, recentStartDate))
      .groupBy(sql`DATE(${emailDeliveryLogs.createdAt})`)
      .orderBy(sql`DATE(${emailDeliveryLogs.createdAt}) DESC`);

    // Get unique schedule count
    const scheduleCount = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${emailDeliveryLogs.scheduleId})`,
      })
      .from(emailDeliveryLogs)
      .where(gte(emailDeliveryLogs.createdAt, startDate));

    const totalSchedules = Number(scheduleCount[0].count) || 0;

    return {
      totalSchedules,
      totalDeliveries,
      successRate: Number(successRate.toFixed(2)),
      averageOpenRate: Number(averageOpenRate.toFixed(2)),
      averageClickRate: Number(averageClickRate.toFixed(2)),
      topPerformingSchedules,
      recentActivity: recentActivity.map(a => ({
        date: a.date,
        deliveries: Number(a.deliveries),
        opens: 0, // TODO: Join with engagement data
        clicks: 0,
      })),
    };
  }

  /**
   * Get delivery timeline for visualization
   */
  async getDeliveryTimeline(
    scheduleId: number | null,
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'week' = 'day'
  ): Promise<DeliveryTimelinePoint[]> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const dateFormat = granularity === 'hour'
      ? sql`DATE_FORMAT(${emailDeliveryLogs.createdAt}, '%Y-%m-%d %H:00:00')`
      : granularity === 'day'
      ? sql`DATE(${emailDeliveryLogs.createdAt})`
      : sql`DATE_FORMAT(${emailDeliveryLogs.createdAt}, '%Y-%U')`;

    const query = db
      .select({
        timestamp: dateFormat,
        successful: sql<number>`SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END)`,
        failed: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
        bounced: sql<number>`SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END)`,
      })
      .from(emailDeliveryLogs)
      .where(
        and(
          gte(emailDeliveryLogs.createdAt, startDate),
          lte(emailDeliveryLogs.createdAt, endDate),
          scheduleId ? eq(emailDeliveryLogs.scheduleId, scheduleId) : sql`1=1`
        )
      )
      .groupBy(dateFormat)
      .orderBy(dateFormat);

    const results = await query;

    return results.map(r => ({
      timestamp: new Date(r.timestamp as any),
      successful: Number(r.successful) || 0,
      failed: Number(r.failed) || 0,
      bounced: Number(r.bounced) || 0,
    }));
  }

  /**
   * Aggregate metrics for all schedules (cron job helper)
   */
  async aggregateAllSchedules(period: AnalyticsPeriod): Promise<void> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Get all unique schedule IDs
    const schedules = await db
      .select({
        scheduleId: emailDeliveryLogs.scheduleId,
      })
      .from(emailDeliveryLogs)
      .groupBy(emailDeliveryLogs.scheduleId);

    const { periodStart, periodEnd } = this.getPeriodDates(period);

    for (const schedule of schedules) {
      if (schedule.scheduleId) {
        try {
          const metrics = await this.calculateScheduleMetrics(
            schedule.scheduleId,
            period,
            periodStart,
            periodEnd
          );
          await this.storeMetrics(metrics);
          console.log(`[Analytics] Aggregated ${period} metrics for schedule ${schedule.scheduleId}`);
        } catch (error) {
          console.error(`[Analytics] Failed to aggregate schedule ${schedule.scheduleId}:`, error);
        }
      }
    }
  }

  /**
   * Get period start and end dates
   */
  private getPeriodDates(period: AnalyticsPeriod): { periodStart: Date; periodEnd: Date } {
    const now = new Date();
    const periodEnd = new Date(now);
    const periodStart = new Date(now);

    switch (period) {
      case 'daily':
        periodStart.setDate(periodStart.getDate() - 1);
        break;
      case 'weekly':
        periodStart.setDate(periodStart.getDate() - 7);
        break;
      case 'monthly':
        periodStart.setMonth(periodStart.getMonth() - 1);
        break;
    }

    return { periodStart, periodEnd };
  }
}

// Singleton instance
export const analyticsAggregationService = new AnalyticsAggregationService();
