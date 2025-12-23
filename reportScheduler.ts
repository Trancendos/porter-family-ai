/**
 * Report Scheduler Service
 * Handles scheduled report generation and delivery
 */

import { getDb } from "../db";
import { eq, and, lte } from "drizzle-orm";
import { porterExportJobs } from "../../drizzle/porter-alerts-schema";
import { generateFinancialReport } from "./porterFamilyExport";
import { notifyOwner } from "../_core/notification";

interface ReportSchedule {
  id: number;
  userId: number;
  name: string;
  description?: string;
  reportType: "forecast" | "cost_optimization" | "budget_summary" | "trading_performance" | "cash_flow" | "full_financial";
  format: "pdf" | "excel" | "csv";
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  scheduleTime: string;
  scheduleDayOfWeek?: number;
  scheduleDayOfMonth?: number;
  recipients?: string;
  parameters?: string;
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
}

/**
 * Calculate next run time based on frequency and schedule settings
 */
export function calculateNextRunTime(schedule: ReportSchedule): Date {
  const now = new Date();
  const [hours, minutes] = schedule.scheduleTime.split(':').map(Number);
  
  const nextRun = new Date(now);
  nextRun.setHours(hours, minutes, 0, 0);

  switch (schedule.frequency) {
    case 'daily':
      // If time has passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;

    case 'weekly':
      // Schedule for specific day of week
      const targetDay = schedule.scheduleDayOfWeek || 1; // Default Monday
      const currentDay = nextRun.getDay();
      let daysUntilTarget = targetDay - currentDay;
      
      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextRun <= now)) {
        daysUntilTarget += 7;
      }
      
      nextRun.setDate(nextRun.getDate() + daysUntilTarget);
      break;

    case 'monthly':
      // Schedule for specific day of month
      const targetDate = schedule.scheduleDayOfMonth || 1;
      nextRun.setDate(targetDate);
      
      if (nextRun <= now) {
        // Move to next month
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;

    case 'quarterly':
      // Schedule for first day of next quarter
      const currentMonth = nextRun.getMonth();
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      nextRun.setMonth(quarterStartMonth);
      nextRun.setDate(schedule.scheduleDayOfMonth || 1);
      
      if (nextRun <= now) {
        // Move to next quarter
        nextRun.setMonth(nextRun.getMonth() + 3);
      }
      break;
  }

  return nextRun;
}

/**
 * Execute a scheduled report
 */
export async function executeScheduledReport(schedule: ReportSchedule): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[Report Scheduler] Database not available");
    return;
  }

  try {
    console.log(`[Report Scheduler] Executing report: ${schedule.name} (ID: ${schedule.id})`);

    // Create export job
    const [job] = await db.insert(porterExportJobs).values({
      userId: schedule.userId,
      reportType: schedule.reportType,
      format: schedule.format,
      isScheduled: true,
      scheduleFrequency: schedule.frequency,
      status: "processing",
      parameters: schedule.parameters,
    }).returning();

    // Generate report
    const parameters = schedule.parameters ? JSON.parse(schedule.parameters) : {};
    const result = await generateFinancialReport({
      reportType: schedule.reportType,
      format: schedule.format,
      userId: schedule.userId,
      ...parameters,
    });

    // Update job with result
    await db.update(porterExportJobs)
      .set({
        status: "completed",
        fileUrl: result.fileUrl,
        fileSize: result.fileSize,
        completedAt: new Date(),
      })
      .where(eq(porterExportJobs.id, job.id));

    // Send notification to recipients
    const recipients = schedule.recipients ? JSON.parse(schedule.recipients) : [];
    if (recipients.length > 0) {
      await notifyOwner({
        title: `Scheduled Report: ${schedule.name}`,
        content: `Your ${schedule.reportType} report has been generated and is ready for download.\n\nFormat: ${schedule.format}\nFile URL: ${result.fileUrl}`,
      });
    }

    console.log(`[Report Scheduler] Report completed: ${schedule.name}`);
  } catch (error) {
    console.error(`[Report Scheduler] Error executing report ${schedule.id}:`, error);
    
    // Update job with error
    await db.update(porterExportJobs)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

    throw error;
  }
}

/**
 * Check and execute due reports
 * This should be called periodically (e.g., every minute) by a cron job
 */
export async function checkAndExecuteDueReports(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[Report Scheduler] Database not available");
    return;
  }

  try {
    const now = new Date();
    
    // Query for due reports (simplified - in production, query report_schedules table)
    // For now, we'll check porter_export_jobs with scheduled flag
    const dueJobs = await db.select()
      .from(porterExportJobs)
      .where(
        and(
          eq(porterExportJobs.isScheduled, true),
          eq(porterExportJobs.status, "pending"),
          lte(porterExportJobs.nextRunAt, now)
        )
      );

    console.log(`[Report Scheduler] Found ${dueJobs.length} due reports`);

    for (const job of dueJobs) {
      try {
        // Convert job to schedule format
        const schedule: ReportSchedule = {
          id: job.id,
          userId: job.userId,
          name: `Scheduled ${job.reportType}`,
          reportType: job.reportType,
          format: job.format,
          frequency: job.scheduleFrequency || "daily",
          scheduleTime: "09:00",
          isActive: true,
          parameters: job.parameters,
        };

        await executeScheduledReport(schedule);

        // Calculate and update next run time
        const nextRun = calculateNextRunTime(schedule);
        await db.update(porterExportJobs)
          .set({
            lastRunAt: now,
            nextRunAt: nextRun,
            status: "pending", // Reset for next run
          })
          .where(eq(porterExportJobs.id, job.id));

      } catch (error) {
        console.error(`[Report Scheduler] Error processing job ${job.id}:`, error);
      }
    }
  } catch (error) {
    console.error("[Report Scheduler] Error checking due reports:", error);
  }
}

/**
 * Start the report scheduler
 * Runs every minute to check for due reports
 */
export function startReportScheduler(): void {
  console.log("[Report Scheduler] Starting scheduler...");

  // Run immediately on start
  checkAndExecuteDueReports().catch(console.error);

  // Then run every minute
  setInterval(() => {
    checkAndExecuteDueReports().catch(console.error);
  }, 60 * 1000); // Every minute

  console.log("[Report Scheduler] Scheduler started");
}
