/**
 * The Dr - Code Validation Service
 * 
 * Code validation, quality checks, security scanning, and confidence scoring.
 * The Dr ensures code quality across the platform.
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";

const execAsync = promisify(exec);

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
  confidenceScore: number;
  metrics: CodeMetrics;
}

export interface ValidationError {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: "error" | "critical";
  rule: string;
  fixable: boolean;
}

export interface ValidationWarning {
  file: string;
  line: number;
  column: number;
  message: string;
  rule: string;
  fixable: boolean;
}

export interface CodeMetrics {
  linesOfCode: number;
  complexity: number;
  maintainabilityIndex: number;
  testCoverage: number;
  securityScore: number;
  performanceScore: number;
}

/**
 * Validate code using ESLint
 */
export async function validateWithESLint(
  filePath: string
): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    const { stdout } = await execAsync(
      `npx eslint "${filePath}" --format json`,
      { cwd: process.cwd() }
    );

    const results = JSON.parse(stdout);

    for (const result of results) {
      for (const message of result.messages) {
        const issue = {
          file: result.filePath,
          line: message.line,
          column: message.column,
          message: message.message,
          rule: message.ruleId || "unknown",
          fixable: message.fix !== undefined,
        };

        if (message.severity === 2) {
          errors.push({ ...issue, severity: "error" });
        } else {
          warnings.push(issue);
        }
      }
    }
  } catch (error: any) {
    // ESLint exits with non-zero code if there are errors
    if (error.stdout) {
      try {
        const results = JSON.parse(error.stdout);
        for (const result of results) {
          for (const message of result.messages) {
            const issue = {
              file: result.filePath,
              line: message.line,
              column: message.column,
              message: message.message,
              rule: message.ruleId || "unknown",
              fixable: message.fix !== undefined,
            };

            if (message.severity === 2) {
              errors.push({ ...issue, severity: "error" });
            } else {
              warnings.push(issue);
            }
          }
        }
      } catch (parseError) {
        console.error("Failed to parse ESLint output:", parseError);
      }
    }
  }

  return { errors, warnings };
}

/**
 * Validate TypeScript code
 */
export async function validateTypeScript(
  filePath: string
): Promise<{ errors: ValidationError[] }> {
  const errors: ValidationError[] = [];

  try {
    const { stdout, stderr } = await execAsync(
      `npx tsc --noEmit "${filePath}"`,
      { cwd: process.cwd() }
    );

    // Parse TypeScript compiler output
    const lines = (stdout + stderr).split("\n");
    for (const line of lines) {
      const match = line.match(/(.+)\((\d+),(\d+)\): error TS\d+: (.+)/);
      if (match) {
        errors.push({
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          message: match[4],
          severity: "error",
          rule: "typescript",
          fixable: false,
        });
      }
    }
  } catch (error: any) {
    // TypeScript compiler exits with non-zero code if there are errors
    if (error.stdout || error.stderr) {
      const lines = (error.stdout + error.stderr).split("\n");
      for (const line of lines) {
        const match = line.match(/(.+)\((\d+),(\d+)\): error TS\d+: (.+)/);
        if (match) {
          errors.push({
            file: match[1],
            line: parseInt(match[2]),
            column: parseInt(match[3]),
            message: match[4],
            severity: "error",
            rule: "typescript",
            fixable: false,
          });
        }
      }
    }
  }

  return { errors };
}

/**
 * Security scanning using OWASP patterns
 */
export async function securityScan(
  filePath: string
): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");

    // Security patterns to check
    const securityPatterns = [
      {
        pattern: /eval\(/g,
        message: "Use of eval() is a security risk",
        severity: "critical" as const,
        rule: "no-eval",
      },
      {
        pattern: /innerHTML\s*=/g,
        message: "Direct innerHTML assignment can lead to XSS",
        severity: "error" as const,
        rule: "no-inner-html",
      },
      {
        pattern: /document\.write\(/g,
        message: "document.write() can be exploited for XSS",
        severity: "error" as const,
        rule: "no-document-write",
      },
      {
        pattern: /password\s*=\s*["'][^"']+["']/gi,
        message: "Hardcoded password detected",
        severity: "critical" as const,
        rule: "no-hardcoded-credentials",
      },
      {
        pattern: /api[_-]?key\s*=\s*["'][^"']+["']/gi,
        message: "Hardcoded API key detected",
        severity: "critical" as const,
        rule: "no-hardcoded-credentials",
      },
      {
        pattern: /Math\.random\(\)/g,
        message: "Math.random() is not cryptographically secure",
        severity: "error" as const,
        rule: "use-crypto-random",
      },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { pattern, message, severity, rule } of securityPatterns) {
        if (pattern.test(line)) {
          errors.push({
            file: filePath,
            line: i + 1,
            column: 0,
            message,
            severity,
            rule,
            fixable: false,
          });
        }
      }
    }
  } catch (error) {
    console.error("Security scan failed:", error);
  }

  return { errors, warnings };
}

/**
 * Calculate code metrics
 */
export async function calculateMetrics(filePath: string): Promise<CodeMetrics> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");

    // Count lines of code (excluding comments and blank lines)
    const linesOfCode = lines.filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed.length > 0 &&
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("/*") &&
        !trimmed.startsWith("*")
      );
    }).length;

    // Calculate cyclomatic complexity (simplified)
    const complexity = calculateComplexity(content);

    // Calculate maintainability index (simplified)
    const maintainabilityIndex = Math.max(
      0,
      Math.min(100, 171 - 5.2 * Math.log(linesOfCode) - 0.23 * complexity)
    );

    return {
      linesOfCode,
      complexity,
      maintainabilityIndex: Math.round(maintainabilityIndex),
      testCoverage: 0, // TODO: Implement test coverage calculation
      securityScore: 100, // Will be reduced by security scan
      performanceScore: 100, // TODO: Implement performance analysis
    };
  } catch (error) {
    console.error("Failed to calculate metrics:", error);
    return {
      linesOfCode: 0,
      complexity: 0,
      maintainabilityIndex: 0,
      testCoverage: 0,
      securityScore: 0,
      performanceScore: 0,
    };
  }
}

/**
 * Calculate cyclomatic complexity
 */
function calculateComplexity(code: string): number {
  let complexity = 1; // Base complexity

  // Count decision points
  const patterns = [
    /\bif\b/g,
    /\belse\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\b&&\b/g,
    /\b\|\|\b/g,
    /\?\s*.*\s*:/g, // Ternary operator
  ];

  for (const pattern of patterns) {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

/**
 * Calculate confidence score
 */
export function calculateConfidenceScore(
  errors: ValidationError[],
  warnings: ValidationWarning[],
  metrics: CodeMetrics
): number {
  let score = 100;

  // Deduct for errors
  score -= errors.length * 10;
  score -= errors.filter((e) => e.severity === "critical").length * 20;

  // Deduct for warnings
  score -= warnings.length * 2;

  // Factor in metrics
  score = score * (metrics.maintainabilityIndex / 100);
  score = score * (metrics.securityScore / 100);

  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Comprehensive code validation
 */
export async function validateCode(filePath: string): Promise<ValidationResult> {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  // Run ESLint validation
  const eslintResults = await validateWithESLint(filePath);
  allErrors.push(...eslintResults.errors);
  allWarnings.push(...eslintResults.warnings);

  // Run TypeScript validation
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
    const tsResults = await validateTypeScript(filePath);
    allErrors.push(...tsResults.errors);
  }

  // Run security scan
  const securityResults = await securityScan(filePath);
  allErrors.push(...securityResults.errors);
  allWarnings.push(...securityResults.warnings);

  // Calculate metrics
  const metrics = await calculateMetrics(filePath);

  // Adjust security score based on security scan
  metrics.securityScore = Math.max(
    0,
    100 - securityResults.errors.length * 20 - securityResults.warnings.length * 5
  );

  // Generate suggestions
  if (metrics.complexity > 10) {
    suggestions.push(
      "High complexity detected. Consider refactoring into smaller functions."
    );
  }

  if (metrics.maintainabilityIndex < 50) {
    suggestions.push(
      "Low maintainability index. Consider improving code structure and reducing complexity."
    );
  }

  if (allErrors.filter((e) => e.fixable).length > 0) {
    suggestions.push(
      `${allErrors.filter((e) => e.fixable).length} errors can be auto-fixed.`
    );
  }

  // Calculate confidence score
  const confidenceScore = calculateConfidenceScore(allErrors, allWarnings, metrics);

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    suggestions,
    confidenceScore,
    metrics,
  };
}

/**
 * Auto-fix code issues
 */
export async function autoFixCode(filePath: string): Promise<{ fixed: boolean; message: string }> {
  try {
    // Try ESLint auto-fix
    await execAsync(`npx eslint "${filePath}" --fix`, { cwd: process.cwd() });

    return {
      fixed: true,
      message: "Code issues auto-fixed successfully",
    };
  } catch (error: any) {
    return {
      fixed: false,
      message: error.message || "Auto-fix failed",
    };
  }
}
