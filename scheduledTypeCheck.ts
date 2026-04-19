/**
 * Scheduled TypeScript Error Monitoring
 * 
 * Integrates with The Dr's error detection system
 * Runs every 2 hours to catch type errors before they accumulate
 */

import { monitorTypeScriptErrors } from "./typeErrorMonitor";

/**
 * Register TypeScript monitoring with the scheduler
 * This should be called during server initialization
 */
export function registerTypeScriptMonitoring() {
  // Run immediately on startup (after 5 minute delay to let server stabilize)
  setTimeout(() => {
    console.log("[Scheduled TypeCheck] Running initial type check...");
    monitorTypeScriptErrors().catch((error) => {
      console.error("[Scheduled TypeCheck] Initial check failed:", error);
    });
  }, 5 * 60 * 1000); // 5 minutes

  // Run every 2 hours
  setInterval(
    () => {
      console.log("[Scheduled TypeCheck] Running scheduled type check...");
      monitorTypeScriptErrors().catch((error) => {
        console.error("[Scheduled TypeCheck] Scheduled check failed:", error);
      });
    },
    2 * 60 * 60 * 1000
  ); // 2 hours

  console.log("[Scheduled TypeCheck] TypeScript monitoring registered (runs every 2 hours)");
}
