/**
 * The Dr AI - Autonomous Code Healing Service
 * 
 * Integrates with Code Review system to automatically detect, analyze, and fix code issues
 * 
 * Features:
 * - Auto-detection of code issues from scans
 * - AI-powered fix generation
 * - Approval workflow for auto-fixes
 * - Learning from fix success/failure
 * - Integration with Gate 0 validation
 */

import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { codeReviewScans, codeReviewIssues } from "../../drizzle/code-review-schema";
import { eq, and, desc } from "drizzle-orm";
import * as fs from "fs/promises";
import * as path from "path";
import { gate0_ProjectInitiation } from "./gateComplianceSystem";

export interface HealingAttempt {
  issueId: string;
  originalCode: string;
  fixedCode: string;
  explanation: string;
  confidence: number;
  timestamp: Date;
  status: "pending" | "approved" | "rejected" | "applied" | "failed";
  validationResult?: {
    passed: boolean;
    errors?: string[];
  };
}

export interface HealingStats {
  totalAttempts: number;
  successfulFixes: number;
  failedFixes: number;
  pendingApproval: number;
  averageConfidence: number;
  learningRate: number;
}

/**
 * Analyze a code issue and generate an auto-fix
 */
export async function generateAutoFix(issueId: string): Promise<HealingAttempt> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Get issue details
  const issues = await db.select().from(codeReviewIssues).where(eq(codeReviewIssues.id, issueId));
  const issue = issues[0];

  if (!issue) {
    throw new Error("Issue not found");
  }

  // Read the file content
  let fileContent = "";
  try {
    fileContent = await fs.readFile(issue.file, "utf-8");
  } catch (error) {
    throw new Error(`Cannot read file: ${issue.file}`);
  }

  // Generate fix using LLM
  const prompt = `You are The Dr, an expert code healer. Analyze this code issue and generate a fix.

**Issue Details:**
- Severity: ${issue.severity}
- Category: ${issue.category}
- Title: ${issue.title}
- Description: ${issue.description}
- File: ${issue.file}
- Line: ${issue.line || "N/A"}

**Problematic Code:**
\`\`\`
${issue.codeSnippet || "N/A"}
\`\`\`

**Suggestion:**
${issue.suggestion || "N/A"}

**Full File Context:**
\`\`\`
${fileContent}
\`\`\`

Generate a complete fixed version of the file with the issue resolved. Explain your changes and provide a confidence score (0-1).

Respond in JSON format:
{
  "fixedCode": "complete fixed file content",
  "explanation": "detailed explanation of changes",
  "confidence": 0.95
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are The Dr, an expert code healer specializing in autonomous bug fixes." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "auto_fix_response",
        strict: true,
        schema: {
          type: "object",
          properties: {
            fixedCode: { type: "string", description: "Complete fixed file content" },
            explanation: { type: "string", description: "Detailed explanation of changes" },
            confidence: { type: "number", description: "Confidence score from 0 to 1" },
          },
          required: ["fixedCode", "explanation", "confidence"],
          additionalProperties: false,
        },
      },
    },
  });

  const result = JSON.parse((typeof response.choices[0].message.content === "string" ? response.choices[0].message.content : JSON.stringify(response.choices[0].message.content)) || "{}");

  const healingAttempt: HealingAttempt = {
    issueId,
    originalCode: fileContent,
    fixedCode: result.fixedCode,
    explanation: result.explanation,
    confidence: result.confidence,
    timestamp: new Date(),
    status: "pending",
  };

  return healingAttempt;
}

/**
 * Apply an approved auto-fix to the codebase
 */
export async function applyAutoFix(issueId: string, healingAttempt: HealingAttempt): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Get issue details
  const issues = await db.select().from(codeReviewIssues).where(eq(codeReviewIssues.id, issueId));
  const issue = issues[0];

  if (!issue) {
    throw new Error("Issue not found");
  }

  try {
    // Write the fixed code to the file
    await fs.writeFile(issue.file, healingAttempt.fixedCode, "utf-8");

    // Update issue status
    await db
      .update(codeReviewIssues)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy: "the-dr-ai",
      })
      .where(eq(codeReviewIssues.id, issueId));

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Validate a fix before applying it (Gate 0 integration)
 */
export async function validateFix(healingAttempt: HealingAttempt): Promise<{ passed: boolean; errors?: string[] }> {
  const errors: string[] = [];

  // Basic checks
  if (!healingAttempt.fixedCode || healingAttempt.fixedCode.trim().length === 0) {
    errors.push("Fixed code is empty");
  }

  if (healingAttempt.confidence < 0.7) {
    errors.push(`Confidence too low: ${healingAttempt.confidence}`);
  }

  // Gate 0 Integration
  try {
    const gateResult = await gate0_ProjectInitiation(
      `Fix for Issue ${healingAttempt.issueId}`,
      healingAttempt.explanation,
      [`Resolve issue ${healingAttempt.issueId}`, "Ensure code quality"],
      0.1 // Estimated duration in weeks
    );

    if (!gateResult.passed) {
      if (gateResult.blockers && gateResult.blockers.length > 0) {
        errors.push(...gateResult.blockers);
      } else {
        // Fallback if passed is false but no explicit blockers listed
        errors.push("Gate 0 validation failed without specific blockers");
      }
    }
  } catch (error: any) {
    errors.push(`Gate 0 validation failed: ${error.message}`);
  }

  return {
    passed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Learn from fix success/failure to improve future healing
 */
export async function recordHealingOutcome(
  issueId: string,
  success: boolean,
  feedback?: string
): Promise<void> {
  // TODO: Implement learning mechanism
  // Store outcomes in a learning database
  // Adjust confidence thresholds based on historical success rates
  // Identify patterns in successful vs failed fixes

  console.log(`[The Dr] Recorded healing outcome for issue ${issueId}: ${success ? "SUCCESS" : "FAILURE"}`);
  if (feedback) {
    console.log(`[The Dr] Feedback: ${feedback}`);
  }
}

/**
 * Get healing statistics
 */
export async function getHealingStats(): Promise<HealingStats> {
  const db = await getDb();
  if (!db) {
    return {
      totalAttempts: 0,
      successfulFixes: 0,
      failedFixes: 0,
      pendingApproval: 0,
      averageConfidence: 0,
      learningRate: 0,
    };
  }

  // Get all resolved issues by The Dr
  const resolvedIssues = await db
    .select()
    .from(codeReviewIssues)
    .where(eq(codeReviewIssues.resolvedBy, "the-dr-ai"));

  const totalAttempts = resolvedIssues.length;
  const successfulFixes = resolvedIssues.filter((i) => i.status === "resolved").length;

  // Get pending auto-fixable issues
  const pendingIssues = await db
    .select()
    .from(codeReviewIssues)
    .where(
      and(
        eq(codeReviewIssues.autoFixable, true),
        eq(codeReviewIssues.status, "open")
      )
    );

  return {
    totalAttempts,
    successfulFixes,
    failedFixes: totalAttempts - successfulFixes,
    pendingApproval: pendingIssues.length,
    averageConfidence: 0.85, // TODO: Calculate from stored attempts
    learningRate: totalAttempts > 0 ? successfulFixes / totalAttempts : 0,
  };
}

/**
 * Auto-heal all fixable issues in a scan
 */
export async function autoHealScan(scanId: string): Promise<{
  totalIssues: number;
  fixedIssues: number;
  pendingApproval: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Get all auto-fixable issues from the scan
  const issues = await db
    .select()
    .from(codeReviewIssues)
    .where(
      and(
        eq(codeReviewIssues.scanId, scanId),
        eq(codeReviewIssues.autoFixable, true),
        eq(codeReviewIssues.status, "open")
      )
    );

  const errors: string[] = [];
  let fixedCount = 0;
  let pendingCount = 0;

  for (const issue of issues) {
    try {
      // Generate fix
      const healingAttempt = await generateAutoFix(issue.id);

      // Validate fix
      const validation = await validateFix(healingAttempt);

      if (validation.passed) {
        // Apply fix automatically if confidence is high
        if (healingAttempt.confidence >= 0.9) {
          const result = await applyAutoFix(issue.id, healingAttempt);
          if (result.success) {
            fixedCount++;
            await recordHealingOutcome(issue.id, true);
          } else {
            errors.push(`Failed to apply fix for ${issue.id}: ${result.error}`);
            await recordHealingOutcome(issue.id, false, result.error);
          }
        } else {
          // Mark for manual approval
          pendingCount++;
        }
      } else {
        errors.push(`Validation failed for ${issue.id}: ${validation.errors?.join(", ")}`);
      }
    } catch (error: any) {
      errors.push(`Error healing ${issue.id}: ${error.message}`);
    }
  }

  return {
    totalIssues: issues.length,
    fixedIssues: fixedCount,
    pendingApproval: pendingCount,
    errors,
  };
}
