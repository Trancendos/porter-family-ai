/**
 * Hive Smart Notifications Service
 * Intelligent alerts for high-value discoveries and patterns
 */

import { notifyOwner } from '../_core/notification';

export interface HiveNotification {
  id: string;
  type: 'injection_point' | 'pattern' | 'estate_health' | 'scan_complete' | 'knowledge_created';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  data: Record<string, any>;
  createdAt: Date;
  read: boolean;
}

export interface NotificationPreferences {
  userId: number;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  minPriority: 'low' | 'medium' | 'high' | 'urgent';
  categories: {
    injectionPoints: boolean;
    patterns: boolean;
    estateHealth: boolean;
    scanComplete: boolean;
    knowledgeCreated: boolean;
  };
}

class HiveNotificationsService {
  private notifications: HiveNotification[] = [];
  private preferences: Map<number, NotificationPreferences> = new Map();

  /**
   * Send notification for high-value injection point
   */
  async notifyInjectionPoint(data: {
    estateId: number;
    estateName: string;
    injectionPoint: {
      id: number;
      type: string;
      confidence: number;
      description: string;
      estimatedImpact: string;
    };
  }): Promise<void> {
    const priority = this.calculatePriority(data.injectionPoint.confidence);

    const notification: HiveNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'injection_point',
      priority,
      title: `High-Value Injection Point Discovered`,
      message: `Found ${data.injectionPoint.type} in ${data.estateName} with ${data.injectionPoint.confidence}% confidence. ${data.injectionPoint.description}`,
      data: {
        estateId: data.estateId,
        estateName: data.estateName,
        injectionPointId: data.injectionPoint.id,
        type: data.injectionPoint.type,
        confidence: data.injectionPoint.confidence,
        estimatedImpact: data.injectionPoint.estimatedImpact,
      },
      createdAt: new Date(),
      read: false,
    };

    await this.sendNotification(notification);
  }

  /**
   * Send notification for pattern discovery
   */
  async notifyPattern(data: {
    pattern: string;
    estates: string[];
    confidence: number;
    description: string;
    opportunities: string[];
  }): Promise<void> {
    const priority = this.calculatePriority(data.confidence);

    const notification: HiveNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'pattern',
      priority,
      title: `Cross-Estate Pattern Discovered`,
      message: `Pattern "${data.pattern}" found across ${data.estates.length} estates with ${data.confidence}% confidence. ${data.description}`,
      data: {
        pattern: data.pattern,
        estates: data.estates,
        confidence: data.confidence,
        opportunities: data.opportunities,
      },
      createdAt: new Date(),
      read: false,
    };

    await this.sendNotification(notification);
  }

  /**
   * Send notification for estate health issue
   */
  async notifyEstateHealth(data: {
    estateId: number;
    estateName: string;
    health: {
      status: 'healthy' | 'warning' | 'critical';
      score: number;
      issues: string[];
    };
  }): Promise<void> {
    if (data.health.status === 'healthy') return; // Don't notify for healthy estates

    const priority = data.health.status === 'critical' ? 'urgent' : 'high';

    const notification: HiveNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'estate_health',
      priority,
      title: `Estate Health Alert: ${data.estateName}`,
      message: `Estate health is ${data.health.status} (score: ${data.health.score}/100). Issues: ${data.health.issues.join(', ')}`,
      data: {
        estateId: data.estateId,
        estateName: data.estateName,
        status: data.health.status,
        score: data.health.score,
        issues: data.health.issues,
      },
      createdAt: new Date(),
      read: false,
    };

    await this.sendNotification(notification);
  }

  /**
   * Send notification for scan completion
   */
  async notifyScanComplete(data: {
    scanId: string;
    estateId: number;
    estateName: string;
    itemsFound: number;
    injectionsFound: number;
    knowledgeCreated: number;
    duration: number;
  }): Promise<void> {
    const notification: HiveNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'scan_complete',
      priority: 'medium',
      title: `Scan Complete: ${data.estateName}`,
      message: `Found ${data.itemsFound} items, ${data.injectionsFound} injection points, and created ${data.knowledgeCreated} knowledge entries in ${Math.round(data.duration / 1000)}s.`,
      data: {
        scanId: data.scanId,
        estateId: data.estateId,
        estateName: data.estateName,
        itemsFound: data.itemsFound,
        injectionsFound: data.injectionsFound,
        knowledgeCreated: data.knowledgeCreated,
        duration: data.duration,
      },
      createdAt: new Date(),
      read: false,
    };

    await this.sendNotification(notification);
  }

  /**
   * Send notification for knowledge creation
   */
  async notifyKnowledgeCreated(data: {
    estateId: number;
    estateName: string;
    knowledge: {
      id: number;
      title: string;
      confidence: number;
      tags: string[];
    };
  }): Promise<void> {
    const priority = this.calculatePriority(data.knowledge.confidence);

    const notification: HiveNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'knowledge_created',
      priority,
      title: `New Knowledge Created`,
      message: `"${data.knowledge.title}" added to knowledge base from ${data.estateName} with ${data.knowledge.confidence}% confidence.`,
      data: {
        estateId: data.estateId,
        estateName: data.estateName,
        knowledgeId: data.knowledge.id,
        title: data.knowledge.title,
        confidence: data.knowledge.confidence,
        tags: data.knowledge.tags,
      },
      createdAt: new Date(),
      read: false,
    };

    await this.sendNotification(notification);
  }

  /**
   * Send notification through configured channels
   */
  private async sendNotification(notification: HiveNotification): Promise<void> {
    // Store notification
    this.notifications.unshift(notification);
    if (this.notifications.length > 500) {
      this.notifications.pop();
    }

    // Send to owner if high priority
    if (notification.priority === 'urgent' || notification.priority === 'high') {
      await notifyOwner({
        title: notification.title,
        content: notification.message,
      });
    }

    // TODO: Send through other channels (email, push, in-app)
    // This would integrate with the existing notification system
  }

  /**
   * Get all notifications
   */
  getNotifications(filters?: {
    type?: HiveNotification['type'];
    priority?: HiveNotification['priority'];
    unreadOnly?: boolean;
    limit?: number;
  }): HiveNotification[] {
    let filtered = this.notifications;

    if (filters?.type) {
      filtered = filtered.filter((n) => n.type === filters.type);
    }

    if (filters?.priority) {
      filtered = filtered.filter((n) => n.priority === filters.priority);
    }

    if (filters?.unreadOnly) {
      filtered = filtered.filter((n) => !n.read);
    }

    return filtered.slice(0, filters?.limit || 50);
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): void {
    const notification = this.notifications.find((n) => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): void {
    this.notifications.forEach((n) => (n.read = true));
  }

  /**
   * Get unread count
   */
  getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  /**
   * Set notification preferences
   */
  setPreferences(userId: number, preferences: Partial<NotificationPreferences>): void {
    const existing = this.preferences.get(userId) || this.getDefaultPreferences(userId);
    this.preferences.set(userId, { ...existing, ...preferences });
  }

  /**
   * Get notification preferences
   */
  getPreferences(userId: number): NotificationPreferences {
    return this.preferences.get(userId) || this.getDefaultPreferences(userId);
  }

  /**
   * Calculate priority based on confidence
   */
  private calculatePriority(confidence: number): HiveNotification['priority'] {
    if (confidence >= 90) return 'urgent';
    if (confidence >= 75) return 'high';
    if (confidence >= 50) return 'medium';
    return 'low';
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(userId: number): NotificationPreferences {
    return {
      userId,
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      minPriority: 'medium',
      categories: {
        injectionPoints: true,
        patterns: true,
        estateHealth: true,
        scanComplete: true,
        knowledgeCreated: true,
      },
    };
  }
}

// Singleton instance
export const hiveNotificationsService = new HiveNotificationsService();
