/**
 * TypeScript Error Monitor Service
 * 
 * Automatically detects TypeScript errors and notifies The Dr for immediate action
 * Runs on a schedule and on file changes
 */

import { exec } from "child_process";
import { promisify } from "util";
import { notifyOwner } from "../_core/notification";

const execAsync = promisify(exec);

interface TypeScriptError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

/**
 * Parse TypeScript compiler output into structured errors
 */
function parseTypeScriptErrors(output: string): TypeScriptError[] {
  const errors: TypeScriptError[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    // Match pattern: file.ts(line,col): error TSxxxx: message
    const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
    if (match) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        code: match[4],
        message: match[5],
      });
    }
  }

  return errors;
}

/**
 * Run TypeScript type checking with timeout
 */
async function checkTypeScript(): Promise<{ errors: TypeScriptError[]; totalCount: number; success: boolean }> {
  try {
    // Use timeout to prevent hanging
    const { stdout, stderr } = await execAsync(
      "timeout 45 npx tsc --noEmit --pretty false 2>&1 || true",
      {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      }
    );

    const output = stdout + stderr;
    const errors = parseTypeScriptErrors(output);

    // Extract total count from summary line
    const summaryMatch = output.match(/Found (\d+) error/);
    const totalCount = summaryMatch ? parseInt(summaryMatch[1]) : errors.length;

    return {
      errors,
      totalCount,
      success: totalCount === 0,
    };
  } catch (error: any) {
    console.error("[TypeScript Monitor] Check failed:", error.message);
    return {
      errors: [],
      totalCount: -1,
      success: false,
    };
  }
}

/**
 * Analyze errors and categorize by severity
 */
function categorizeErrors(errors: TypeScriptError[]): {
  critical: TypeScriptError[];
  high: TypeScriptError[];
  medium: TypeScriptError[];
} {
  const critical: TypeScriptError[] = [];
  const high: TypeScriptError[] = [];
  const medium: TypeScriptError[] = [];

  for (const error of errors) {
    // Critical: Type mismatches that could cause runtime errors
    if (
      error.code === "TS2345" || // Argument type mismatch
      error.code === "TS2322" || // Type assignment error
      error.code === "TS2554" || // Wrong number of arguments
      error.code === "TS2769" // No overload matches
    ) {
      critical.push(error);
    }
    // High: Missing properties or methods
    else if (
      error.code === "TS2339" || // Property does not exist
      error.code === "TS2551" || // Property typo
      error.code === "TS2552" // Cannot find name
    ) {
      high.push(error);
    }
    // Medium: Everything else
    else {
      medium.push(error);
    }
  }

  return { critical, high, medium };
}

/**
 * Generate error report summary
 */
function generateErrorReport(
  totalCount: number,
  categorized: { critical: TypeScriptError[]; high: TypeScriptError[]; medium: TypeScriptError[] }
): string {
  const { critical, high, medium } = categorized;

  let report = `🔴 TypeScript Error Report\n\n`;
  report += `**Total Errors:** ${totalCount}\n`;
  report += `**Critical:** ${critical.length} | **High:** ${high.length} | **Medium:** ${medium.length}\n\n`;

  if (critical.length > 0) {
    report += `### 🚨 Critical Errors (Top 5)\n`;
    critical.slice(0, 5).forEach((err) => {
      report += `- \`${err.file}:${err.line}\` - ${err.code}: ${err.message.substring(0, 100)}\n`;
    });
    report += `\n`;
  }

  if (high.length > 0) {
    report += `### ⚠️ High Priority Errors (Top 5)\n`;
    high.slice(0, 5).forEach((err) => {
      report += `- \`${err.file}:${err.line}\` - ${err.code}: ${err.message.substring(0, 100)}\n`;
    });
    report += `\n`;
  }

  report += `\n**Action Required:** The Dr should investigate and fix these errors to maintain type safety.`;

  return report;
}

/**
 * Main monitoring function - checks TypeScript errors and notifies if threshold exceeded
 */
export async function monitorTypeScriptErrors(): Promise<void> {
  console.log("[TypeScript Monitor] Starting type check...");

  const result = await checkTypeScript();

  if (result.totalCount === -1) {
    console.error("[TypeScript Monitor] Type check failed or timed out");
    await notifyOwner({
      title: "⚠️ TypeScript Check Failed",
      content: "The TypeScript compiler failed or timed out. This may indicate circular dependencies or infinite type recursion.",
    });
    return;
  }

  if (result.success) {
    console.log("[TypeScript Monitor] ✅ No type errors found");
    return;
  }

  console.log(`[TypeScript Monitor] Found ${result.totalCount} type errors`);

  // Categorize errors
  const categorized = categorizeErrors(result.errors);

  // Notify if we have critical errors or total count exceeds threshold
  const CRITICAL_THRESHOLD = 10;
  const TOTAL_THRESHOLD = 50;

  if (categorized.critical.length >= CRITICAL_THRESHOLD || result.totalCount >= TOTAL_THRESHOLD) {
    const report = generateErrorReport(result.totalCount, categorized);
    await notifyOwner({
      title: `🔴 TypeScript Errors Detected: ${result.totalCount} total`,
      content: report,
    });
  }
}

/**
 * Quick check for pre-commit hook (faster, less detailed)
 */
export async function quickTypeCheck(): Promise<{ hasErrors: boolean; errorCount: number }> {
  try {
    const { stdout } = await execAsync(
      "timeout 30 npx tsc --noEmit --pretty false 2>&1 | grep -c 'error TS' || echo 0",
      {
        cwd: process.cwd(),
        maxBuffer: 5 * 1024 * 1024,
      }
    );

    const errorCount = parseInt(stdout.trim()) || 0;
    return {
      hasErrors: errorCount > 0,
      errorCount,
    };
  } catch (error) {
    return {
      hasErrors: false,
      errorCount: 0,
    };
  }
}
