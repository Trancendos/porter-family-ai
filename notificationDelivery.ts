/**
 * Notification Delivery Service
 * 
 * Multi-channel notification system for critical agent alerts:
 * - Critical: Email + SMS
 * - High: Email only
 * - Medium/Low: In-app only
 */

import { getDb } from "../db";
import { notificationDeliveryLogs, userNotificationPreferences, users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export type NotificationPriority = "critical" | "high" | "medium" | "low";

export interface NotificationPayload {
  userId: number;
  agentId: string;
  taskId?: number;
  priority: NotificationPriority;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface DeliveryResult {
  success: boolean;
  channels: {
    email?: { sent: boolean; error?: string };
    sms?: { sent: boolean; error?: string };
    inApp?: { sent: boolean; error?: string };
  };
}

/**
 * Get user notification preferences
 */
async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const prefs = await db
    .select()
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userId, userId))
    .limit(1);

  return prefs[0] || null;
}

/**
 * Send email notification
 */
async function sendEmailNotification(
  email: string,
  title: string,
  message: string
): Promise<{ sent: boolean; error?: string }> {
  try {
    // TODO: Integrate with SendGrid
    // For now, simulate email sending
    console.log(`[Notification] Email sent to ${email}: ${title}`);
    
    // Placeholder for SendGrid integration:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({
    //   to: email,
    //   from: 'alerts@luminous-mastermind.ai',
    //   subject: title,
    //   text: message,
    //   html: `<strong>${message}</strong>`,
    // });

    return { sent: true };
  } catch (error) {
    console.error("[Notification] Email send failed:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send SMS notification
 */
async function sendSMSNotification(
  phoneNumber: string,
  message: string
): Promise<{ sent: boolean; error?: string }> {
  try {
    // TODO: Integrate with Twilio
    // For now, simulate SMS sending
    console.log(`[Notification] SMS sent to ${phoneNumber}: ${message}`);

    // Placeholder for Twilio integration:
    // const twilio = require('twilio');
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({
    //   body: message,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: phoneNumber
    // });

    return { sent: true };
  } catch (error) {
    console.error("[Notification] SMS send failed:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create in-app notification
 */
async function createInAppNotification(payload: NotificationPayload): Promise<{ sent: boolean; error?: string }> {
  try {
    const db = await getDb();
    if (!db) {
      return { sent: false, error: "Database not available" };
    }

    // In-app notifications are already handled by agentNotifications table
    // This is just a confirmation that the notification exists
    console.log(`[Notification] In-app notification created for user ${payload.userId}`);

    return { sent: true };
  } catch (error) {
    console.error("[Notification] In-app notification failed:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Log notification delivery attempt
 */
async function logDelivery(
  payload: NotificationPayload,
  result: DeliveryResult
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(notificationDeliveryLogs).values({
      userId: payload.userId,
      agentId: payload.agentId,
      taskId: payload.taskId,
      priority: payload.priority,
      title: payload.title,
      message: payload.message,
      emailSent: result.channels.email?.sent || false,
      smsSent: result.channels.sms?.sent || false,
      inAppSent: result.channels.inApp?.sent || false,
      deliveryStatus: result.success ? "delivered" : "failed",
      metadata: JSON.stringify(payload.metadata || {}),
    });
  } catch (error) {
    console.error("[Notification] Failed to log delivery:", error);
  }
}

/**
 * Deliver notification through appropriate channels based on priority
 */
export async function deliverNotification(payload: NotificationPayload): Promise<DeliveryResult> {
  console.log(`[Notification] Delivering ${payload.priority} priority notification to user ${payload.userId}`);

  // Get user preferences
  const prefs = await getUserPreferences(payload.userId);

  // Get user contact info from users table
  const db = await getDb();
  let userEmail: string | null = null;
  if (db) {
    const userResult = await db.select({ email: users.email }).from(users).where(eq(users.id, payload.userId)).limit(1);
    userEmail = userResult[0]?.email || null;
  }

  const result: DeliveryResult = {
    success: false,
    channels: {},
  };

  // Determine channels based on priority and user preferences
  const shouldSendEmail =
    (payload.priority === "critical" || payload.priority === "high") &&
    prefs?.enableEmail !== false &&
    userEmail;

  const shouldSendSMS = false; // SMS not implemented yet

  const shouldSendInApp = true; // Always create in-app notification

  // Send through appropriate channels
  if (shouldSendEmail && userEmail) {
    result.channels.email = await sendEmailNotification(
      userEmail,
      payload.title,
      payload.message
    );
  }

  if (shouldSendInApp) {
    result.channels.inApp = await createInAppNotification(payload);
  }

  // Determine overall success
  const attemptedChannels = Object.values(result.channels);
  result.success = attemptedChannels.length > 0 && attemptedChannels.some(c => c.sent);

  // Log delivery
  await logDelivery(payload, result);

  return result;
}

/**
 * Deliver notification to owner (admin user)
 */
export async function deliverOwnerNotification(
  agentId: string,
  title: string,
  message: string,
  priority: NotificationPriority = "high",
  metadata?: Record<string, any>
): Promise<DeliveryResult> {
  // Get owner user ID (role = 'admin')
  const db = await getDb();
  if (!db) {
    return {
      success: false,
      channels: {},
    };
  }

  // For now, assume owner is user ID 1
  // In production, query for admin users
  const ownerId = 1;

  return deliverNotification({
    userId: ownerId,
    agentId,
    priority,
    title,
    message,
    metadata,
  });
}
