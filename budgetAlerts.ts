/**
 * Budget Alert Service
 * 
 * Real-time monitoring and alerting for budget thresholds
 */

import { notifyOwner } from "../_core/notification";

interface BudgetAlert {
  id: string;
  budgetId: number;
  budgetName: string;
  threshold: number;
  currentSpending: number;
  budgetLimit: number;
  percentageUsed: number;
  severity: 'info' | 'warning' | 'critical';
  timestamp: Date;
}

interface AlertPreferences {
  userId: number;
  enableEmail: boolean;
  enablePush: boolean;
  enableSMS: boolean;
  thresholds: {
    warning: number; // Default: 80%
    critical: number; // Default: 90%
  };
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string; // HH:MM format
  };
}

/**
 * Check budget thresholds and trigger alerts
 */
export async function checkBudgetThresholds(userId: number): Promise<BudgetAlert[]> {
  // TODO: Connect to actual budget database
  // For now, return sample alerts
  
  const alerts: BudgetAlert[] = [];
  const now = new Date();
  
  // Sample budget data
  const budgets = [
    { id: 1, name: 'Marketing', spending: 8500, limit: 10000 },
    { id: 2, name: 'Operations', spending: 15000, limit: 15000 },
    { id: 3, name: 'Development', spending: 12000, limit: 20000 },
  ];
  
  for (const budget of budgets) {
    const percentageUsed = (budget.spending / budget.limit) * 100;
    
    if (percentageUsed >= 90) {
      alerts.push({
        id: `ALERT-${budget.id}-${now.getTime()}`,
        budgetId: budget.id,
        budgetName: budget.name,
        threshold: 90,
        currentSpending: budget.spending,
        budgetLimit: budget.limit,
        percentageUsed,
        severity: 'critical',
        timestamp: now
      });
    } else if (percentageUsed >= 80) {
      alerts.push({
        id: `ALERT-${budget.id}-${now.getTime()}`,
        budgetId: budget.id,
        budgetName: budget.name,
        threshold: 80,
        currentSpending: budget.spending,
        budgetLimit: budget.limit,
        percentageUsed,
        severity: 'warning',
        timestamp: now
      });
    }
  }
  
  return alerts;
}

/**
 * Send budget alert notification
 */
export async function sendBudgetAlert(
  alert: BudgetAlert,
  preferences: AlertPreferences
): Promise<boolean> {
  try {
    // Check quiet hours
    if (preferences.quietHours.enabled && isInQuietHours(preferences.quietHours)) {
      console.log('[Budget Alerts] Skipping alert during quiet hours');
      return false;
    }
    
    // Format alert message
    const message = formatAlertMessage(alert);
    
    // Send notifications based on preferences
    const notifications: Promise<boolean>[] = [];
    
    if (preferences.enableEmail) {
      notifications.push(sendEmailAlert(alert, message));
    }
    
    if (preferences.enablePush) {
      notifications.push(sendPushAlert(alert, message));
    }
    
    if (preferences.enableSMS) {
      notifications.push(sendSMSAlert(alert, message));
    }
    
    // Also notify owner for critical alerts
    if (alert.severity === 'critical') {
      await notifyOwner({
        title: `🚨 Critical Budget Alert: ${alert.budgetName}`,
        content: message
      });
    }
    
    const results = await Promise.all(notifications);
    return results.some(r => r); // Return true if any notification succeeded
    
  } catch (error) {
    console.error('[Budget Alerts] Failed to send alert:', error);
    return false;
  }
}

/**
 * Get user alert preferences
 */
export async function getAlertPreferences(userId: number): Promise<AlertPreferences> {
  // TODO: Load from database
  // For now, return default preferences
  
  return {
    userId,
    enableEmail: true,
    enablePush: true,
    enableSMS: false,
    thresholds: {
      warning: 80,
      critical: 90
    },
    quietHours: {
      enabled: true,
      start: '22:00',
      end: '08:00'
    }
  };
}

/**
 * Update user alert preferences
 */
export async function updateAlertPreferences(
  userId: number,
  preferences: Partial<AlertPreferences>
): Promise<AlertPreferences> {
  // TODO: Save to database
  // For now, return merged preferences
  
  const current = await getAlertPreferences(userId);
  return {
    ...current,
    ...preferences
  };
}

/**
 * Get alert history
 */
export async function getAlertHistory(
  userId: number,
  limit: number = 50
): Promise<BudgetAlert[]> {
  // TODO: Load from database
  // For now, return empty array
  
  return [];
}

/**
 * Monitor budgets continuously (background job)
 */
export async function monitorBudgets(userId: number): Promise<void> {
  try {
    const alerts = await checkBudgetThresholds(userId);
    const preferences = await getAlertPreferences(userId);
    
    for (const alert of alerts) {
      await sendBudgetAlert(alert, preferences);
    }
    
    console.log(`[Budget Alerts] Monitored ${alerts.length} alerts for user ${userId}`);
  } catch (error) {
    console.error('[Budget Alerts] Monitoring failed:', error);
  }
}

// Helper functions

function isInQuietHours(quietHours: { start: string; end: string }): boolean {
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  return currentTime >= quietHours.start || currentTime <= quietHours.end;
}

function formatAlertMessage(alert: BudgetAlert): string {
  const remaining = alert.budgetLimit - alert.currentSpending;
  const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';
  
  return `${emoji} Budget Alert: ${alert.budgetName}

Current Spending: $${alert.currentSpending.toLocaleString()}
Budget Limit: $${alert.budgetLimit.toLocaleString()}
Remaining: $${remaining.toLocaleString()}
Usage: ${alert.percentageUsed.toFixed(1)}%

${alert.severity === 'critical' 
  ? 'CRITICAL: Budget limit reached or exceeded!' 
  : 'WARNING: Approaching budget limit'}`;
}

async function sendEmailAlert(alert: BudgetAlert, message: string): Promise<boolean> {
  // TODO: Implement email sending via SendGrid or similar
  console.log('[Budget Alerts] Email alert sent:', alert.budgetName);
  return true;
}

async function sendPushAlert(alert: BudgetAlert, message: string): Promise<boolean> {
  // TODO: Implement push notification via Firebase or similar
  console.log('[Budget Alerts] Push alert sent:', alert.budgetName);
  return true;
}

async function sendSMSAlert(alert: BudgetAlert, message: string): Promise<boolean> {
  // TODO: Implement SMS via Twilio or similar
  console.log('[Budget Alerts] SMS alert sent:', alert.budgetName);
  return true;
}
