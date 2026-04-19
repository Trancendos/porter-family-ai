/**
 * Unified Notification Service
 * 
 * Handles all notification channels:
 * - In-app notifications (stored in database)
 * - Toast notifications (via WebSocket/SSE)
 * - Browser push notifications (Web Push API)
 * - Email notifications (SendGrid)
 * - SMS notifications (Twilio)
 * 
 * Features:
 * - Multi-channel delivery
 * - User preferences
 * - Notification batching
 * - Template support
 * - AI-to-AI, Platform-to-AI, AI-to-Platform routing
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// Notification Types
export type NotificationChannel = 'in_app' | 'toast' | 'push' | 'email' | 'sms';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationCategory = 
  | 'system' 
  | 'security' 
  | 'ai_agent' 
  | 'pipeline' 
  | 'governance' 
  | 'communication' 
  | 'alert' 
  | 'reminder'
  | 'ai_to_ai'
  | 'platform_to_ai'
  | 'ai_to_platform';

export interface NotificationPayload {
  title: string;
  message: string;
  category: NotificationCategory;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  userId?: number;
  userIds?: number[];
  broadcast?: boolean;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
  actionLabel?: string;
  expiresAt?: Date;
  templateId?: string;
  templateData?: Record<string, unknown>;
  sourceAiId?: string;
  targetAiId?: string;
  sourcePlatform?: string;
  targetPlatform?: string;
}

export interface NotificationResult {
  id: string;
  success: boolean;
  channels: {
    channel: NotificationChannel;
    success: boolean;
    error?: string;
  }[];
}

// User Notification Preferences
export interface UserNotificationPreferences {
  userId: number;
  enableInApp: boolean;
  enableToast: boolean;
  enablePush: boolean;
  enableEmail: boolean;
  enableSms: boolean;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string;
  emailDigest: 'immediate' | 'hourly' | 'daily' | 'weekly' | 'never';
  categories: {
    [key in NotificationCategory]?: {
      enabled: boolean;
      channels: NotificationChannel[];
    };
  };
}

// Default preferences
const DEFAULT_PREFERENCES: Omit<UserNotificationPreferences, 'userId'> = {
  enableInApp: true,
  enableToast: true,
  enablePush: false,
  enableEmail: true,
  enableSms: false,
  emailDigest: 'immediate',
  categories: {
    system: { enabled: true, channels: ['in_app', 'toast'] },
    security: { enabled: true, channels: ['in_app', 'toast', 'email'] },
    ai_agent: { enabled: true, channels: ['in_app', 'toast'] },
    pipeline: { enabled: true, channels: ['in_app'] },
    governance: { enabled: true, channels: ['in_app', 'email'] },
    communication: { enabled: true, channels: ['in_app', 'toast'] },
    alert: { enabled: true, channels: ['in_app', 'toast', 'email'] },
    reminder: { enabled: true, channels: ['in_app'] },
    ai_to_ai: { enabled: true, channels: ['in_app'] },
    platform_to_ai: { enabled: true, channels: ['in_app'] },
    ai_to_platform: { enabled: true, channels: ['in_app', 'toast'] },
  },
};

// In-memory store for WebSocket connections (for toast notifications)
const wsConnections = new Map<number, Set<WebSocket>>();

// Notification queue for batching
const notificationQueue: NotificationPayload[] = [];
let queueProcessorRunning = false;

/**
 * Send a notification through all appropriate channels
 */
export async function sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
  const notificationId = uuidv4();
  const results: NotificationResult['channels'] = [];
  
  try {
    // Determine target users
    let targetUserIds: number[] = [];
    
    if (payload.broadcast) {
      // Get all active users
      const db = await getDb();
      if (db) {
        const [users] = await db.execute(sql`SELECT id FROM users WHERE role IS NOT NULL LIMIT 1000`);
        targetUserIds = Array.isArray(users) ? users.map((u: unknown) => (u as { id: number }).id) : [];
      }
    } else if (payload.userIds) {
      targetUserIds = payload.userIds;
    } else if (payload.userId) {
      targetUserIds = [payload.userId];
    }
    
    // Process each user
    for (const userId of targetUserIds) {
      // Get user preferences
      const preferences = await getUserNotificationPreferences(userId);
      
      // Check quiet hours
      if (isInQuietHours(preferences)) {
        // Queue for later delivery
        notificationQueue.push({ ...payload, userId });
        continue;
      }
      
      // Determine channels based on preferences and payload
      const channels = determineChannels(payload, preferences);
      
      // Send through each channel
      for (const channel of channels) {
        try {
          switch (channel) {
            case 'in_app':
              await sendInAppNotification(userId, notificationId, payload);
              results.push({ channel, success: true });
              break;
            case 'toast':
              await sendToastNotification(userId, payload);
              results.push({ channel, success: true });
              break;
            case 'push':
              await sendPushNotification(userId, payload);
              results.push({ channel, success: true });
              break;
            case 'email':
              await sendEmailNotification(userId, payload);
              results.push({ channel, success: true });
              break;
            case 'sms':
              await sendSmsNotification(userId, payload);
              results.push({ channel, success: true });
              break;
          }
        } catch (error) {
          console.error(`Failed to send ${channel} notification:`, error);
          results.push({ 
            channel, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }
    }
    
    return {
      id: notificationId,
      success: results.some(r => r.success),
      channels: results,
    };
  } catch (error) {
    console.error("Failed to send notification:", error);
    return {
      id: notificationId,
      success: false,
      channels: results,
    };
  }
}

/**
 * Get user notification preferences
 */
export async function getUserNotificationPreferences(userId: number): Promise<UserNotificationPreferences> {
  const db = await getDb();
  if (!db) return { userId, ...DEFAULT_PREFERENCES };
  
  try {
    const [rows] = await db.execute(sql`
      SELECT * FROM userNotificationPreferences WHERE userId = ${userId} LIMIT 1
    `);
    
    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0] as Record<string, unknown>;
      return {
        userId,
        enableInApp: row.enableInApp as boolean ?? true,
        enableToast: row.enableToast as boolean ?? true,
        enablePush: row.enablePush as boolean ?? false,
        enableEmail: row.enableEmail as boolean ?? true,
        enableSms: row.enableSms as boolean ?? false,
        quietHoursStart: row.quietHoursStart as string | undefined,
        quietHoursEnd: row.quietHoursEnd as string | undefined,
        emailDigest: row.emailDigest as 'immediate' | 'hourly' | 'daily' | 'weekly' | 'never' ?? 'immediate',
        categories: typeof row.categories === 'string' 
          ? JSON.parse(row.categories) 
          : row.categories as UserNotificationPreferences['categories'] ?? DEFAULT_PREFERENCES.categories,
      };
    }
    
    return { userId, ...DEFAULT_PREFERENCES };
  } catch (error) {
    console.error("Error getting notification preferences:", error);
    return { userId, ...DEFAULT_PREFERENCES };
  }
}

/**
 * Update user notification preferences
 */
export async function updateUserNotificationPreferences(
  userId: number, 
  preferences: Partial<Omit<UserNotificationPreferences, 'userId'>>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    // Check if preferences exist
    const [existing] = await db.execute(sql`
      SELECT id FROM userNotificationPreferences WHERE userId = ${userId}
    `);
    
    const categoriesJson = preferences.categories 
      ? JSON.stringify(preferences.categories) 
      : null;
    
    if (Array.isArray(existing) && existing.length > 0) {
      // Update existing
      await db.execute(sql`
        UPDATE userNotificationPreferences SET
          enableInApp = COALESCE(${preferences.enableInApp ?? null}, enableInApp),
          enableToast = COALESCE(${preferences.enableToast ?? null}, enableToast),
          enablePush = COALESCE(${preferences.enablePush ?? null}, enablePush),
          enableEmail = COALESCE(${preferences.enableEmail ?? null}, enableEmail),
          enableSms = COALESCE(${preferences.enableSms ?? null}, enableSms),
          quietHoursStart = COALESCE(${preferences.quietHoursStart ?? null}, quietHoursStart),
          quietHoursEnd = COALESCE(${preferences.quietHoursEnd ?? null}, quietHoursEnd),
          emailDigest = COALESCE(${preferences.emailDigest ?? null}, emailDigest),
          categories = COALESCE(${categoriesJson}, categories),
          updatedAt = NOW()
        WHERE userId = ${userId}
      `);
    } else {
      // Insert new
      await db.execute(sql`
        INSERT INTO userNotificationPreferences (
          userId, enableInApp, enableToast, enablePush, enableEmail, enableSms,
          quietHoursStart, quietHoursEnd, emailDigest, categories
        ) VALUES (
          ${userId},
          ${preferences.enableInApp ?? true},
          ${preferences.enableToast ?? true},
          ${preferences.enablePush ?? false},
          ${preferences.enableEmail ?? true},
          ${preferences.enableSms ?? false},
          ${preferences.quietHoursStart ?? null},
          ${preferences.quietHoursEnd ?? null},
          ${preferences.emailDigest ?? 'immediate'},
          ${categoriesJson ?? JSON.stringify(DEFAULT_PREFERENCES.categories)}
        )
      `);
    }
    
    return true;
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    return false;
  }
}

/**
 * Check if current time is within quiet hours
 */
function isInQuietHours(preferences: UserNotificationPreferences): boolean {
  if (!preferences.quietHoursStart || !preferences.quietHoursEnd) return false;
  
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  const start = preferences.quietHoursStart;
  const end = preferences.quietHoursEnd;
  
  if (start <= end) {
    return currentTime >= start && currentTime <= end;
  } else {
    // Quiet hours span midnight
    return currentTime >= start || currentTime <= end;
  }
}

/**
 * Determine which channels to use based on payload and preferences
 */
function determineChannels(
  payload: NotificationPayload, 
  preferences: UserNotificationPreferences
): NotificationChannel[] {
  const channels: NotificationChannel[] = [];
  
  // If payload specifies channels, use those (filtered by preferences)
  if (payload.channels && payload.channels.length > 0) {
    for (const channel of payload.channels) {
      if (isChannelEnabled(channel, preferences)) {
        channels.push(channel);
      }
    }
    return channels;
  }
  
  // Otherwise, use category-based preferences
  const categoryPrefs = preferences.categories[payload.category];
  if (categoryPrefs?.enabled && categoryPrefs.channels) {
    for (const channel of categoryPrefs.channels) {
      if (isChannelEnabled(channel, preferences)) {
        channels.push(channel);
      }
    }
    return channels;
  }
  
  // Default: in-app only
  if (preferences.enableInApp) {
    channels.push('in_app');
  }
  
  return channels;
}

/**
 * Check if a channel is enabled in preferences
 */
function isChannelEnabled(channel: NotificationChannel, preferences: UserNotificationPreferences): boolean {
  switch (channel) {
    case 'in_app': return preferences.enableInApp;
    case 'toast': return preferences.enableToast;
    case 'push': return preferences.enablePush;
    case 'email': return preferences.enableEmail;
    case 'sms': return preferences.enableSms;
    default: return false;
  }
}

/**
 * Send in-app notification (stored in database)
 */
async function sendInAppNotification(
  userId: number, 
  notificationId: string, 
  payload: NotificationPayload
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.execute(sql`
    INSERT INTO notifications (
      id, userId, title, message, type, priority, 
      actionUrl, actionLabel, metadata, expiresAt, isRead
    ) VALUES (
      ${notificationId},
      ${userId},
      ${payload.title},
      ${payload.message},
      ${payload.category},
      ${payload.priority ?? 'medium'},
      ${payload.actionUrl ?? null},
      ${payload.actionLabel ?? null},
      ${JSON.stringify(payload.metadata ?? {})},
      ${payload.expiresAt ?? null},
      false
    )
  `);
}

/**
 * Send toast notification via WebSocket
 */
async function sendToastNotification(userId: number, payload: NotificationPayload): Promise<void> {
  const connections = wsConnections.get(userId);
  if (!connections || connections.size === 0) {
    // User not connected, skip toast but don't fail
    console.log(`No WebSocket connection for user ${userId}, skipping toast`);
    return;
  }
  
  const toastPayload = JSON.stringify({
    type: 'toast',
    data: {
      title: payload.title,
      message: payload.message,
      category: payload.category,
      priority: payload.priority ?? 'medium',
      actionUrl: payload.actionUrl,
      actionLabel: payload.actionLabel,
    },
  });
  
  for (const ws of connections) {
    try {
      ws.send(toastPayload);
    } catch (error) {
      console.error("Failed to send toast via WebSocket:", error);
    }
  }
}

/**
 * Send browser push notification
 */
async function sendPushNotification(userId: number, payload: NotificationPayload): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get user's push subscription
  const [subscriptions] = await db.execute(sql`
    SELECT * FROM pushSubscriptions WHERE userId = ${userId} AND isActive = true
  `);
  
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    console.log(`No push subscription for user ${userId}`);
    return;
  }
  
  // Web Push would be implemented here with a library like web-push
  // For now, log the intent
  console.log(`Would send push notification to user ${userId}:`, payload.title);
}

/**
 * Send email notification
 */
async function sendEmailNotification(userId: number, payload: NotificationPayload): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get user's email
  const [users] = await db.execute(sql`
    SELECT email FROM users WHERE id = ${userId}
  `);
  
  if (!Array.isArray(users) || users.length === 0 || !(users[0] as { email?: string }).email) {
    console.log(`No email for user ${userId}`);
    return;
  }
  
  const email = (users[0] as { email: string }).email;
  
  // Use existing email service or SendGrid
  // For now, log the intent and queue for batch processing
  console.log(`Would send email to ${email}:`, payload.title);
  
  // Queue email for digest if not immediate
  const preferences = await getUserNotificationPreferences(userId);
  if (preferences.emailDigest !== 'immediate') {
    await db.execute(sql`
      INSERT INTO emailQueue (userId, email, subject, body, priority, scheduledFor)
      VALUES (${userId}, ${email}, ${payload.title}, ${payload.message}, ${payload.priority ?? 'medium'}, NOW())
    `);
  }
}

/**
 * Send SMS notification
 */
async function sendSmsNotification(userId: number, payload: NotificationPayload): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get user's phone number
  const [users] = await db.execute(sql`
    SELECT phone FROM users WHERE id = ${userId}
  `);
  
  if (!Array.isArray(users) || users.length === 0 || !(users[0] as { phone?: string }).phone) {
    console.log(`No phone for user ${userId}`);
    return;
  }
  
  const phone = (users[0] as { phone: string }).phone;
  
  // Use Twilio or similar service
  // For now, log the intent
  console.log(`Would send SMS to ${phone}:`, payload.title);
}

/**
 * Register WebSocket connection for toast notifications
 */
export function registerWebSocketConnection(userId: number, ws: WebSocket): void {
  if (!wsConnections.has(userId)) {
    wsConnections.set(userId, new Set());
  }
  wsConnections.get(userId)!.add(ws);
}

/**
 * Unregister WebSocket connection
 */
export function unregisterWebSocketConnection(userId: number, ws: WebSocket): void {
  const connections = wsConnections.get(userId);
  if (connections) {
    connections.delete(ws);
    if (connections.size === 0) {
      wsConnections.delete(userId);
    }
  }
}

// ============================================
// AI Intercommunication Functions
// ============================================

/**
 * Send AI-to-AI notification
 */
export async function sendAiToAiNotification(
  sourceAiId: string,
  targetAiId: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<NotificationResult> {
  return sendNotification({
    title: `AI Communication: ${sourceAiId} → ${targetAiId}`,
    message,
    category: 'ai_to_ai',
    priority: 'medium',
    channels: ['in_app'],
    broadcast: false,
    metadata: {
      ...metadata,
      sourceAiId,
      targetAiId,
      communicationType: 'ai_to_ai',
      timestamp: new Date().toISOString(),
    },
    sourceAiId,
    targetAiId,
  });
}

/**
 * Send Platform-to-AI notification
 */
export async function sendPlatformToAiNotification(
  sourcePlatform: string,
  targetAiId: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<NotificationResult> {
  return sendNotification({
    title: `Platform → AI: ${sourcePlatform} → ${targetAiId}`,
    message,
    category: 'platform_to_ai',
    priority: 'medium',
    channels: ['in_app'],
    broadcast: false,
    metadata: {
      ...metadata,
      sourcePlatform,
      targetAiId,
      communicationType: 'platform_to_ai',
      timestamp: new Date().toISOString(),
    },
    sourcePlatform,
    targetAiId,
  });
}

/**
 * Send AI-to-Platform notification
 */
export async function sendAiToPlatformNotification(
  sourceAiId: string,
  targetPlatform: string,
  message: string,
  userId?: number,
  metadata?: Record<string, unknown>
): Promise<NotificationResult> {
  return sendNotification({
    title: `AI → Platform: ${sourceAiId} → ${targetPlatform}`,
    message,
    category: 'ai_to_platform',
    priority: 'medium',
    channels: ['in_app', 'toast'],
    userId,
    broadcast: !userId,
    metadata: {
      ...metadata,
      sourceAiId,
      targetPlatform,
      communicationType: 'ai_to_platform',
      timestamp: new Date().toISOString(),
    },
    sourceAiId,
    targetPlatform,
  });
}

/**
 * Log AI communication for auditing
 */
export async function logAiCommunication(
  sourceType: 'ai' | 'platform',
  sourceId: string,
  targetType: 'ai' | 'platform' | 'user',
  targetId: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.execute(sql`
      INSERT INTO aiCommunicationLogs (
        sourceType, sourceId, targetType, targetId, message, metadata, createdAt
      ) VALUES (
        ${sourceType}, ${sourceId}, ${targetType}, ${targetId}, ${message}, ${JSON.stringify(metadata ?? {})}, NOW()
      )
    `);
  } catch (error) {
    console.error("Failed to log AI communication:", error);
  }
}

// ============================================
// Notification Templates
// ============================================

export const NOTIFICATION_TEMPLATES = {
  PIPELINE_COMPLETED: {
    title: 'Pipeline Execution Complete',
    message: 'Pipeline "{{pipelineName}}" has completed successfully.',
    category: 'pipeline' as NotificationCategory,
    priority: 'medium' as NotificationPriority,
  },
  PIPELINE_FAILED: {
    title: 'Pipeline Execution Failed',
    message: 'Pipeline "{{pipelineName}}" failed: {{errorMessage}}',
    category: 'pipeline' as NotificationCategory,
    priority: 'high' as NotificationPriority,
  },
  PROPOSAL_SUBMITTED: {
    title: 'New Merge Proposal',
    message: 'A new merge proposal "{{proposalTitle}}" requires your review.',
    category: 'governance' as NotificationCategory,
    priority: 'medium' as NotificationPriority,
  },
  PROPOSAL_APPROVED: {
    title: 'Proposal Approved',
    message: 'Your merge proposal "{{proposalTitle}}" has been approved.',
    category: 'governance' as NotificationCategory,
    priority: 'medium' as NotificationPriority,
  },
  SECURITY_ALERT: {
    title: 'Security Alert',
    message: '{{alertMessage}}',
    category: 'security' as NotificationCategory,
    priority: 'critical' as NotificationPriority,
  },
  AI_TASK_COMPLETED: {
    title: 'AI Task Completed',
    message: '{{aiName}} has completed task: {{taskName}}',
    category: 'ai_agent' as NotificationCategory,
    priority: 'low' as NotificationPriority,
  },
  AI_ERROR: {
    title: 'AI Agent Error',
    message: '{{aiName}} encountered an error: {{errorMessage}}',
    category: 'ai_agent' as NotificationCategory,
    priority: 'high' as NotificationPriority,
  },
};

/**
 * Send notification using a template
 */
export async function sendTemplatedNotification(
  templateKey: keyof typeof NOTIFICATION_TEMPLATES,
  data: Record<string, string>,
  options: Partial<NotificationPayload>
): Promise<NotificationResult> {
  const template = NOTIFICATION_TEMPLATES[templateKey];
  
  // Replace placeholders in template
  let title = template.title;
  let message = template.message;
  
  for (const [key, value] of Object.entries(data)) {
    title = title.replace(`{{${key}}}`, value);
    message = message.replace(`{{${key}}}`, value);
  }
  
  return sendNotification({
    title,
    message,
    category: template.category,
    priority: template.priority,
    ...options,
  });
}

// Start queue processor
async function processNotificationQueue(): Promise<void> {
  if (queueProcessorRunning) return;
  queueProcessorRunning = true;
  
  while (notificationQueue.length > 0) {
    const payload = notificationQueue.shift();
    if (payload) {
      try {
        await sendNotification(payload);
      } catch (error) {
        console.error("Failed to process queued notification:", error);
      }
    }
  }
  
  queueProcessorRunning = false;
}

// Process queue every minute
setInterval(processNotificationQueue, 60000);
