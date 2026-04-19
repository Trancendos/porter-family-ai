/**
 * The Dr - Self-Healing Service
 * 
 * Automatic code fixing, error recovery, and system repair.
 * The Dr monitors the platform and fixes issues automatically.
 */

import { validateCode, autoFixCode, type ValidationResult } from "./codeValidator";
import { invokeLLM } from "../_core/llm";
import * as fs from "fs/promises";
import * as path from "path";

export interface HealingResult {
  healed: boolean;
  method: string;
  changes: string[];
  confidenceBefore: number;
  confidenceAfter: number;
  message: string;
}

export interface HealingStrategy {
  name: string;
  description: string;
  priority: number;
  applicable: (result: ValidationResult) => boolean;
  execute: (filePath: string, result: ValidationResult) => Promise<HealingResult>;
}

/**
 * Auto-fix strategy using ESLint
 */
const autoFixStrategy: HealingStrategy = {
  name: "auto-fix",
  description: "Automatically fix code issues using ESLint",
  priority: 1,
  applicable: (result) => result.errors.some((e) => e.fixable),
  execute: async (filePath, result) => {
    const fixResult = await autoFixCode(filePath);

    if (fixResult.fixed) {
      const newResult = await validateCode(filePath);

      return {
        healed: true,
        method: "auto-fix",
        changes: ["Applied ESLint auto-fixes"],
        confidenceBefore: result.confidenceScore,
        confidenceAfter: newResult.confidenceScore,
        message: "Code issues auto-fixed successfully",
      };
    }

    return {
      healed: false,
      method: "auto-fix",
      changes: [],
      confidenceBefore: result.confidenceScore,
      confidenceAfter: result.confidenceScore,
      message: fixResult.message,
    };
  },
};

/**
 * AI-powered healing strategy
 */
const aiHealingStrategy: HealingStrategy = {
  name: "ai-healing",
  description: "Use AI to fix complex code issues",
  priority: 2,
  applicable: (result) => result.errors.length > 0 && result.confidenceScore < 70,
  execute: async (filePath, result) => {
    try {
      const code = await fs.readFile(filePath, "utf-8");

      // Prepare error context for AI
      const errorContext = result.errors
        .slice(0, 5) // Limit to top 5 errors
        .map(
          (e) =>
            `Line ${e.line}: ${e.message} (${e.rule})`
        )
        .join("\n");

      const prompt = `You are The Dr, a code healing assistant. Fix the following code issues:

File: ${path.basename(filePath)}

Errors:
${errorContext}

Current code:
\`\`\`typescript
${code}
\`\`\`

Please provide the corrected code. Return ONLY the fixed code without explanations.`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are The Dr, an expert code healer. Fix code issues and return only the corrected code.",
          },
          { role: "user", content: prompt },
        ],
      });

      const fixedCode = response.choices[0].message.content;
      if (typeof fixedCode !== 'string') {
        throw new Error('Invalid response from AI');
      }

      // Extract code from markdown if present
      let cleanedCode = fixedCode;
      const codeBlockMatch = fixedCode.match(/```(?:typescript|ts|javascript|js)?\n([\s\S]+?)\n```/);
      if (codeBlockMatch) {
        cleanedCode = codeBlockMatch[1];
      }

      // Write fixed code
      await fs.writeFile(filePath, cleanedCode, "utf-8");

      // Validate fixed code
      const newResult = await validateCode(filePath);

      const changes = [
        `Fixed ${result.errors.length - newResult.errors.length} errors using AI`,
      ];

      return {
        healed: newResult.errors.length < result.errors.length,
        method: "ai-healing",
        changes,
        confidenceBefore: result.confidenceScore,
        confidenceAfter: newResult.confidenceScore,
        message:
          newResult.errors.length === 0
            ? "All errors fixed successfully"
            : `Reduced errors from ${result.errors.length} to ${newResult.errors.length}`,
      };
    } catch (error: any) {
      return {
        healed: false,
        method: "ai-healing",
        changes: [],
        confidenceBefore: result.confidenceScore,
        confidenceAfter: result.confidenceScore,
        message: `AI healing failed: ${error.message}`,
      };
    }
  },
};

/**
 * Refactoring strategy for high complexity
 */
const refactoringStrategy: HealingStrategy = {
  name: "refactoring",
  description: "Refactor complex code to improve maintainability",
  priority: 3,
  applicable: (result) => result.metrics.complexity > 15,
  execute: async (filePath, result) => {
    try {
      const code = await fs.readFile(filePath, "utf-8");

      const prompt = `You are The Dr, a code refactoring expert. The following code has high cyclomatic complexity (${result.metrics.complexity}). Please refactor it to reduce complexity while maintaining functionality.

File: ${path.basename(filePath)}

Current code:
\`\`\`typescript
${code}
\`\`\`

Refactor the code to:
1. Reduce complexity by extracting functions
2. Improve readability
3. Maintain all functionality
4. Add helpful comments

Return ONLY the refactored code without explanations.`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are The Dr, an expert code refactorer. Simplify complex code while maintaining functionality.",
          },
          { role: "user", content: prompt },
        ],
      });

      const refactoredCode = response.choices[0].message.content;
      if (typeof refactoredCode !== 'string') {
        throw new Error('Invalid response from AI');
      }

      // Extract code from markdown if present
      let cleanedCode = refactoredCode;
      const codeBlockMatch = refactoredCode.match(/```(?:typescript|ts|javascript|js)?\n([\s\S]+?)\n```/);
      if (codeBlockMatch) {
        cleanedCode = codeBlockMatch[1];
      }

      // Write refactored code
      await fs.writeFile(filePath, cleanedCode, "utf-8");

      // Validate refactored code
      const newResult = await validateCode(filePath);

      const changes = [
        `Reduced complexity from ${result.metrics.complexity} to ${newResult.metrics.complexity}`,
        `Improved maintainability index from ${result.metrics.maintainabilityIndex} to ${newResult.metrics.maintainabilityIndex}`,
      ];

      return {
        healed: newResult.metrics.complexity < result.metrics.complexity,
        method: "refactoring",
        changes,
        confidenceBefore: result.confidenceScore,
        confidenceAfter: newResult.confidenceScore,
        message: "Code refactored successfully",
      };
    } catch (error: any) {
      return {
        healed: false,
        method: "refactoring",
        changes: [],
        confidenceBefore: result.confidenceScore,
        confidenceAfter: result.confidenceScore,
        message: `Refactoring failed: ${error.message}`,
      };
    }
  },
};

/**
 * All healing strategies
 */
const healingStrategies: HealingStrategy[] = [
  autoFixStrategy,
  aiHealingStrategy,
  refactoringStrategy,
];

/**
 * Attempt to heal code file
 */
export async function healCode(filePath: string): Promise<HealingResult> {
  // Validate code first
  const validationResult = await validateCode(filePath);

  if (validationResult.valid && validationResult.confidenceScore >= 80) {
    return {
      healed: true,
      method: "none",
      changes: [],
      confidenceBefore: validationResult.confidenceScore,
      confidenceAfter: validationResult.confidenceScore,
      message: "Code is already healthy",
    };
  }

  // Try healing strategies in priority order
  const applicableStrategies = healingStrategies
    .filter((s) => s.applicable(validationResult))
    .sort((a, b) => a.priority - b.priority);

  for (const strategy of applicableStrategies) {
    console.log(`Attempting healing strategy: ${strategy.name}`);

    const result = await strategy.execute(filePath, validationResult);

    if (result.healed) {
      return result;
    }
  }

  // No strategy succeeded
  return {
    healed: false,
    method: "none",
    changes: [],
    confidenceBefore: validationResult.confidenceScore,
    confidenceAfter: validationResult.confidenceScore,
    message: "No healing strategy succeeded",
  };
}

/**
 * Monitor and heal directory
 */
export async function healDirectory(dirPath: string): Promise<HealingResult[]> {
  const results: HealingResult[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and other common directories
        if (
          entry.name === "node_modules" ||
          entry.name === ".git" ||
          entry.name === "dist" ||
          entry.name === "build"
        ) {
          continue;
        }

        // Recursively heal subdirectories
        const subResults = await healDirectory(fullPath);
        results.push(...subResults);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".ts") ||
          entry.name.endsWith(".tsx") ||
          entry.name.endsWith(".js") ||
          entry.name.endsWith(".jsx"))
      ) {
        // Heal code file
        const result = await healCode(fullPath);
        results.push(result);
      }
    }
  } catch (error) {
    console.error(`Failed to heal directory ${dirPath}:`, error);
  }

  return results;
}

/**
 * Get healing statistics
 */
export function getHealingStatistics(results: HealingResult[]) {
  const healed = results.filter((r) => r.healed).length;
  const failed = results.filter((r) => !r.healed).length;

  const methodCounts = results.reduce((acc, r) => {
    acc[r.method] = (acc[r.method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const avgConfidenceBefore =
    results.reduce((sum, r) => sum + r.confidenceBefore, 0) / results.length;

  const avgConfidenceAfter =
    results.reduce((sum, r) => sum + r.confidenceAfter, 0) / results.length;

  const improvement = avgConfidenceAfter - avgConfidenceBefore;

  return {
    total: results.length,
    healed,
    failed,
    successRate: (healed / results.length) * 100,
    methodCounts,
    avgConfidenceBefore: Math.round(avgConfidenceBefore),
    avgConfidenceAfter: Math.round(avgConfidenceAfter),
    improvement: Math.round(improvement),
  };
}
