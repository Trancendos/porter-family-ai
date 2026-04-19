/**
 * Infinity-One Account Sync Service
 * 
 * Handles profile synchronization across all connected applications
 * in the Trancendos ecosystem. When a user updates their profile in ANY app,
 * this service propagates the changes to ALL connected apps automatically.
 */

import { nanoid } from "nanoid";
import { getDb } from "../db";
import { infinityOneAccounts, accountSyncLog, appPermissions } from "../../drizzle/infinity-one-schema";
import { eq } from "drizzle-orm";
import { generateLighthouseCertificate, renewCertificate } from "./lighthouseCertificate";

export interface ProfileUpdate {
  infinityOneAccountId: string;
  sourceApp: string;
  changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  triggeredBy?: number; // User ID
}

export interface SyncResult {
  success: boolean;
  syncLogId: string;
  successfulApps: string[];
  failedApps: Array<{
    appId: string;
    error: string;
  }>;
  duration: number;
}

/**
 * Sync profile updates to all connected apps
 */
export async function syncProfileUpdate(update: ProfileUpdate): Promise<SyncResult> {
  const startTime = Date.now();
  const syncLogId = nanoid();
  const db = await getDb();
  
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    // Get Infinity-One account
    const [account] = await db
      .select()
      .from(infinityOneAccounts)
      .where(eq(infinityOneAccounts.id, update.infinityOneAccountId))
      .limit(1);

    if (!account) {
      throw new Error("Infinity-One account not found");
    }

    // Get all connected apps (excluding source app)
    const targetApps = account.connectedApps.filter((app) => app.appId !== update.sourceApp);
    const targetAppIds = targetApps.map((app) => app.appId);

    // Create sync log entry
    await db.insert(accountSyncLog).values({
      id: syncLogId,
      infinityOneAccountId: update.infinityOneAccountId,
      syncType: "profile",
      sourceApp: update.sourceApp,
      targetApps: targetAppIds,
      changeType: "profile_update",
      changes: update.changes,
      status: "in_progress",
      startedAt: new Date(),
      triggeredBy: update.triggeredBy,
    });

    // Apply changes to master profile
    const updatedProfile = { ...account.masterProfile };
    for (const change of update.changes) {
      // Handle nested fields (e.g., "preferences.theme")
      const fieldPath = change.field.split(".");
      let target: any = updatedProfile;
      
      for (let i = 0; i < fieldPath.length - 1; i++) {
        if (!target[fieldPath[i]]) {
          target[fieldPath[i]] = {};
        }
        target = target[fieldPath[i]];
      }
      
      target[fieldPath[fieldPath.length - 1]] = change.newValue;
    }

    // Update master profile
    await db
      .update(infinityOneAccounts)
      .set({
        masterProfile: updatedProfile,
        lastSync: new Date(),
        syncStatus: "in_progress",
      })
      .where(eq(infinityOneAccounts.id, update.infinityOneAccountId));

    // Regenerate Lighthouse certificate with updated identity
    await renewCertificate(update.infinityOneAccountId);

    // Sync to all connected apps
    const successfulApps: string[] = [];
    const failedApps: Array<{ appId: string; error: string }> = [];

    for (const app of targetApps) {
      try {
        await syncToApp(app.appId, updatedProfile, account.openId);
        successfulApps.push(app.appId);
      } catch (error) {
        failedApps.push({
          appId: app.appId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const duration = Date.now() - startTime;
    const status = failedApps.length === 0 ? "success" : failedApps.length < targetApps.length ? "partial" : "failed";

    // Update sync log
    await db
      .update(accountSyncLog)
      .set({
        status,
        successfulApps,
        failedApps,
        completedAt: new Date(),
        duration,
        errors: failedApps.map((f) => ({
          appId: f.appId,
          errorCode: "SYNC_FAILED",
          errorMessage: f.error,
        })),
      })
      .where(eq(accountSyncLog.id, syncLogId));

    // Update account sync status
    await db
      .update(infinityOneAccounts)
      .set({
        syncStatus: status === "success" ? "synced" : "failed",
        lastSync: new Date(),
        syncErrors: failedApps.length > 0 ? failedApps.map((f) => ({
          appId: f.appId,
          error: f.error,
          timestamp: new Date().toISOString(),
        })) : [],
      })
      .where(eq(infinityOneAccounts.id, update.infinityOneAccountId));

    return {
      success: status !== "failed",
      syncLogId,
      successfulApps,
      failedApps,
      duration,
    };
  } catch (error) {
    // Log error and update sync log
    await db
      .update(accountSyncLog)
      .set({
        status: "failed",
        completedAt: new Date(),
        duration: Date.now() - startTime,
        errors: [{
          appId: "system",
          errorCode: "SYNC_ERROR",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        }],
      })
      .where(eq(accountSyncLog.id, syncLogId));

    throw error;
  }
}

/**
 * Sync profile to a specific app
 * This would integrate with each app's API/webhook
 */
async function syncToApp(appId: string, profile: any, openId: string): Promise<void> {
  // TODO: Implement app-specific sync logic
  // This would call each app's API or webhook to update the user profile
  
  // Example implementation:
  // 1. Look up app's sync endpoint from app registry
  // 2. Authenticate with app-specific credentials
  // 3. Send profile update request
  // 4. Handle response and errors
  
  // For now, we'll simulate the sync
  console.log(`[Infinity-One] Syncing to app ${appId} for user ${openId}`);
  
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 100));
  
  // In production, this would be:
  // const appConfig = await getAppSyncConfig(appId);
  // const response = await fetch(appConfig.syncEndpoint, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${appConfig.apiKey}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({ openId, profile }),
  // });
  // 
  // if (!response.ok) {
  //   throw new Error(`Sync failed: ${response.statusText}`);
  // }
}

/**
 * Get sync history for an account
 */
export async function getSyncHistory(infinityOneAccountId: string, limit = 50) {
  const db = await getDb();
  
  if (!db) {
    throw new Error("Database not available");
  }

  return await db
    .select()
    .from(accountSyncLog)
    .where(eq(accountSyncLog.infinityOneAccountId, infinityOneAccountId))
    .orderBy(accountSyncLog.createdAt)
    .limit(limit);
}

/**
 * Retry failed sync
 */
export async function retrySyncLog(syncLogId: string): Promise<SyncResult> {
  const db = await getDb();
  
  if (!db) {
    throw new Error("Database not available");
  }

  // Get original sync log
  const [syncLog] = await db
    .select()
    .from(accountSyncLog)
    .where(eq(accountSyncLog.id, syncLogId))
    .limit(1);

  if (!syncLog) {
    throw new Error("Sync log not found");
  }

  if (syncLog.status === "success") {
    throw new Error("Sync already succeeded");
  }

  // Retry sync with failed apps only
  const [account] = await db
    .select()
    .from(infinityOneAccounts)
    .where(eq(infinityOneAccounts.id, syncLog.infinityOneAccountId))
    .limit(1);

  if (!account) {
    throw new Error("Account not found");
  }

  const failedAppIds = syncLog.failedApps.map((f) => f.appId);
  const successfulApps: string[] = [...(syncLog.successfulApps || [])];
  const failedApps: Array<{ appId: string; error: string }> = [];

  for (const appId of failedAppIds) {
    try {
      await syncToApp(appId, account.masterProfile, account.openId);
      successfulApps.push(appId);
    } catch (error) {
      failedApps.push({
        appId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const status = failedApps.length === 0 ? "success" : "partial";

  // Update sync log
  await db
    .update(accountSyncLog)
    .set({
      status,
      successfulApps,
      failedApps,
      completedAt: new Date(),
    })
    .where(eq(accountSyncLog.id, syncLogId));

  return {
    success: status === "success",
    syncLogId,
    successfulApps,
    failedApps,
    duration: 0,
  };
}

/**
 * Connect a new app to Infinity-One account
 */
export async function connectApp(infinityOneAccountId: string, appId: string, appName: string): Promise<void> {
  const db = await getDb();
  
  if (!db) {
    throw new Error("Database not available");
  }

  const [account] = await db
    .select()
    .from(infinityOneAccounts)
    .where(eq(infinityOneAccounts.id, infinityOneAccountId))
    .limit(1);

  if (!account) {
    throw new Error("Account not found");
  }

  // Check if app already connected
  if (account.connectedApps.some((app) => app.appId === appId)) {
    throw new Error("App already connected");
  }

  // Add app to connected apps
  const updatedApps = [
    ...account.connectedApps,
    {
      appId,
      appName,
      connectedAt: new Date().toISOString(),
    },
  ];

  await db
    .update(infinityOneAccounts)
    .set({
      connectedApps: updatedApps,
    })
    .where(eq(infinityOneAccounts.id, infinityOneAccountId));

  // Sync profile to new app
  await syncToApp(appId, account.masterProfile, account.openId);
}

/**
 * Disconnect app from Infinity-One account
 */
export async function disconnectApp(infinityOneAccountId: string, appId: string): Promise<void> {
  const db = await getDb();
  
  if (!db) {
    throw new Error("Database not available");
  }

  const [account] = await db
    .select()
    .from(infinityOneAccounts)
    .where(eq(infinityOneAccounts.id, infinityOneAccountId))
    .limit(1);

  if (!account) {
    throw new Error("Account not found");
  }

  // Remove app from connected apps
  const updatedApps = account.connectedApps.filter((app) => app.appId !== appId);

  await db
    .update(infinityOneAccounts)
    .set({
      connectedApps: updatedApps,
    })
    .where(eq(infinityOneAccounts.id, infinityOneAccountId));

  // Revoke app permissions
  // This would be handled by the app permissions service
}

/**
 * Get all connected apps for an account
 */
export async function getConnectedApps(infinityOneAccountId: string) {
  const db = await getDb();
  
  if (!db) {
    throw new Error("Database not available");
  }

  const [account] = await db
    .select()
    .from(infinityOneAccounts)
    .where(eq(infinityOneAccounts.id, infinityOneAccountId))
    .limit(1);

  if (!account) {
    throw new Error("Account not found");
  }

  // Get permissions for each app
  const permissions = await db
    .select()
    .from(appPermissions)
    .where(eq(appPermissions.infinityOneAccountId, infinityOneAccountId));

  return account.connectedApps.map((app) => ({
    ...app,
    permissions: permissions.find((p) => p.appId === app.appId),
  }));
}
