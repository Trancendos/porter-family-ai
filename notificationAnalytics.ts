/**
 * Notification Analytics Service
 * Tracks and analyzes notification metrics, engagement, and trends
 */

import { getDb } from "../db";
import { 
  notificationEvents, 
  notificationAnalytics,
  type InsertNotificationEvent,
  type NotificationEvent,
  type NotificationAnalytic
} from "../../drizzle/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

export const notificationAnalyticsService = {
  /**
   * Track a notification event
   */
  async trackNotification(data: Omit<InsertNotificationEvent, 'id' | 'createdAt' | 'updatedAt'>) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [event] = await db.insert(notificationEvents).values(data);
    return event;
  },

  /**
   * Mark notification as read
   */
  async markAsRead(eventId: number, userId: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const readAt = new Date();
    await db
      .update(notificationEvents)
      .set({ 
        read: true, 
        readAt,
        responseTime: sql`TIMESTAMPDIFF(SECOND, createdAt, ${readAt})`
      })
      .where(and(
        eq(notificationEvents.id, eventId),
        eq(notificationEvents.userId, userId)
      ));
  },

  /**
   * Mark notification as clicked
   */
  async markAsClicked(eventId: number, userId: number, actionTaken?: string) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(notificationEvents)
      .set({ 
        clicked: true, 
        clickedAt: new Date(),
        actionTaken
      })
      .where(and(
        eq(notificationEvents.id, eventId),
        eq(notificationEvents.userId, userId)
      ));
  },

  /**
   * Mark notification as dismissed
   */
  async markAsDismissed(eventId: number, userId: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(notificationEvents)
      .set({ 
        dismissed: true, 
        dismissedAt: new Date()
      })
      .where(and(
        eq(notificationEvents.id, eventId),
        eq(notificationEvents.userId, userId)
      ));
  },

  /**
   * Get notification trends over time
   */
  async getTrends(userId: number, days: number = 30) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trends = await db
      .select({
        date: sql<string>`DATE(createdAt)`,
        total: sql<number>`COUNT(*)`,
        read: sql<number>`SUM(CASE WHEN ${notificationEvents.read} = 1 THEN 1 ELSE 0 END)`,
        clicked: sql<number>`SUM(CASE WHEN ${notificationEvents.clicked} = 1 THEN 1 ELSE 0 END)`,
      })
      .from(notificationEvents)
      .where(and(
        eq(notificationEvents.userId, userId),
        gte(notificationEvents.createdAt, startDate)
      ))
      .groupBy(sql`DATE(createdAt)`)
      .orderBy(sql`DATE(createdAt) ASC`);

    return trends;
  },

  /**
   * Get category distribution
   */
  async getCategoryDistribution(userId: number, days: number = 30) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const distribution = await db
      .select({
        category: notificationEvents.category,
        count: sql<number>`COUNT(*)`,
        readCount: sql<number>`SUM(CASE WHEN ${notificationEvents.read} = 1 THEN 1 ELSE 0 END)`,
      })
      .from(notificationEvents)
      .where(and(
        eq(notificationEvents.userId, userId),
        gte(notificationEvents.createdAt, startDate)
      ))
      .groupBy(notificationEvents.category);

    return distribution;
  },

  /**
   * Get priority breakdown
   */
  async getPriorityBreakdown(userId: number, days: number = 30) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const breakdown = await db
      .select({
        priority: notificationEvents.priority,
        count: sql<number>`COUNT(*)`,
        readCount: sql<number>`SUM(CASE WHEN ${notificationEvents.read} = 1 THEN 1 ELSE 0 END)`,
        avgResponseTime: sql<number>`AVG(${notificationEvents.responseTime})`,
      })
      .from(notificationEvents)
      .where(and(
        eq(notificationEvents.userId, userId),
        gte(notificationEvents.createdAt, startDate)
      ))
      .groupBy(notificationEvents.priority);

    return breakdown;
  },

  /**
   * Get engagement metrics
   */
  async getEngagementMetrics(userId: number, days: number = 30) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [metrics] = await db
      .select({
        totalNotifications: sql<number>`COUNT(*)`,
        deliveredCount: sql<number>`SUM(CASE WHEN ${notificationEvents.delivered} = 1 THEN 1 ELSE 0 END)`,
        readCount: sql<number>`SUM(CASE WHEN ${notificationEvents.read} = 1 THEN 1 ELSE 0 END)`,
        clickedCount: sql<number>`SUM(CASE WHEN ${notificationEvents.clicked} = 1 THEN 1 ELSE 0 END)`,
        dismissedCount: sql<number>`SUM(CASE WHEN ${notificationEvents.dismissed} = 1 THEN 1 ELSE 0 END)`,
        avgResponseTime: sql<number>`AVG(${notificationEvents.responseTime})`,
      })
      .from(notificationEvents)
      .where(and(
        eq(notificationEvents.userId, userId),
        gte(notificationEvents.createdAt, startDate)
      ));

    if (!metrics) {
      return {
        totalNotifications: 0,
        deliveredCount: 0,
        readCount: 0,
        clickedCount: 0,
        dismissedCount: 0,
        readRate: 0,
        clickRate: 0,
        avgResponseTime: 0,
      };
    }

    const readRate = metrics.totalNotifications > 0 
      ? Math.round((metrics.readCount / metrics.totalNotifications) * 100) 
      : 0;
    
    const clickRate = metrics.readCount > 0 
      ? Math.round((metrics.clickedCount / metrics.readCount) * 100) 
      : 0;

    return {
      ...metrics,
      readRate,
      clickRate,
      avgResponseTime: Math.round(metrics.avgResponseTime || 0),
    };
  },

  /**
   * Get most common alert types
   */
  async getCommonAlertTypes(userId: number, days: number = 30, limit: number = 10) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const types = await db
      .select({
        notificationType: notificationEvents.notificationType,
        count: sql<number>`COUNT(*)`,
        readRate: sql<number>`ROUND((SUM(CASE WHEN ${notificationEvents.read} = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100)`,
      })
      .from(notificationEvents)
      .where(and(
        eq(notificationEvents.userId, userId),
        gte(notificationEvents.createdAt, startDate)
      ))
      .groupBy(notificationEvents.notificationType)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(limit);

    return types;
  },

  /**
   * Get recent notifications
   */
  async getRecentNotifications(userId: number, limit: number = 50) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const notifications = await db
      .select()
      .from(notificationEvents)
      .where(eq(notificationEvents.userId, userId))
      .orderBy(desc(notificationEvents.createdAt))
      .limit(limit);

    return notifications;
  },

  /**
   * Export analytics data
   */
  async exportAnalytics(userId: number, days: number = 30) {
    const [trends, categories, priorities, engagement, alertTypes] = await Promise.all([
      this.getTrends(userId, days),
      this.getCategoryDistribution(userId, days),
      this.getPriorityBreakdown(userId, days),
      this.getEngagementMetrics(userId, days),
      this.getCommonAlertTypes(userId, days),
    ]);

    return {
      period: {
        days,
        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
      },
      trends,
      categories,
      priorities,
      engagement,
      alertTypes,
    };
  },
};
