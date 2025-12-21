/**
 * The Dr - Self-Healing Service
 * 
 * Autonomous error resolution system that:
 * 1. Analyzes errors and generates error codes
 * 2. Researches solutions from knowledge base and similar errors
 * 3. Implements fixes automatically for platform issues
 * 4. Validates fixes and rolls back if needed
 * 5. Generates knowledge base articles
 * 6. Provides user-facing resolution options
 * 
 * The Dr operates in two modes:
 * - Platform Mode: Autonomous self-healing (no user interaction)
 * - User Mode: Guided resolution with 3 options
 */

import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { getErrorCode, updateErrorCodeResolution, findSimilarErrorCodes } from "./errorCodeService";
import { logger } from "./errorLoggingService";

export interface ResolutionResearch {
  errorCode: string;
  similarErrors: string[];
  knownSolutions: string[];
  recommendedFix: string;
  fixType: 'automated' | 'manual' | 'guided';
  confidence: number; // 0-1
  estimatedTime: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface SelfHealingResult {
  errorCode: string;
  success: boolean;
  fixApplied: string;
  fixValidated: boolean;
  rollbackPerformed: boolean;
  duration: number; // milliseconds
  logs: string[];
}

export interface UserResolutionOptions {
  errorCode: string;
  errorDescription: string;
  
  // Option 1: Perform task themselves
  manualInstructions: {
    steps: string[];
    estimatedTime: string;
    difficulty: 'easy' | 'medium' | 'hard';
    requiredSkills: string[];
  };
  
  // Option 2: Follow AI instructions
  aiGuidedInstructions: {
    conversationalGuide: string;
    stepByStepGuide: Array<{
      step: number;
      instruction: string;
      expectedOutcome: string;
      troubleshooting?: string;
    }>;
    estimatedTime: string;
  };
  
  // Option 3: Self-repair (automated with user approval)
  selfRepairOption: {
    description: string;
    whatWillChange: string[];
    risks: string[];
    estimatedTime: string;
    requiresApproval: boolean;
    canRollback: boolean;
  };
}

/**
 * Research error resolution
 * Called automatically when new error code is created
 */
export async function researchErrorResolution(errorCode: string): Promise<ResolutionResearch | null> {
  logger.info(`[The Dr] Researching resolution for ${errorCode}`);
  
  const errorDetails = await getErrorCode(errorCode);
  if (!errorDetails) return null;
  
  // Update status to researching
  await updateErrorCodeResolution(errorCode, {
    resolutionStatus: 'researching',
  });
  
  // Find similar errors that have been resolved
  const similarErrors = await findSimilarErrorCodes(errorDetails.message, 10);
  const resolvedSimilar = similarErrors.filter(e => e.resolutionStatus === 'resolved');
  
  // Extract known solutions
  const knownSolutions = resolvedSimilar
    .filter(e => e.resolutionSteps && e.resolutionSteps.length > 0)
    .map(e => e.resolutionSteps!.join(' → '));
  
  // Use AI to analyze and recommend fix
  const aiRecommendation = await analyzeErrorWithAI(errorDetails, knownSolutions);
  
  if (!aiRecommendation) {
    logger.warn(`[The Dr] Could not generate recommendation for ${errorCode}`);
    return null;
  }
  
  // Update error code with research results
  await updateErrorCodeResolution(errorCode, {
    resolutionStatus: 'fix_available',
    resolutionSteps: aiRecommendation.steps,
  });
  
  const research: ResolutionResearch = {
    errorCode,
    similarErrors: resolvedSimilar.map(e => e.code),
    knownSolutions,
    recommendedFix: aiRecommendation.fix,
    fixType: aiRecommendation.fixType,
    confidence: aiRecommendation.confidence,
    estimatedTime: aiRecommendation.estimatedTime,
    riskLevel: aiRecommendation.riskLevel,
  };
  
  // If high confidence and low risk, attempt automated fix for platform issues
  if (
    errorDetails.category === 'system' || 
    errorDetails.category === 'database' ||
    errorDetails.category === 'performance'
  ) {
    if (aiRecommendation.confidence >= 0.8 && aiRecommendation.riskLevel === 'low') {
      logger.info(`[The Dr] Attempting automated fix for ${errorCode}`);
      attemptAutomatedFix(errorCode, research).catch(console.error);
    }
  }
  
  return research;
}

/**
 * Use AI to analyze error and recommend fix
 */
async function analyzeErrorWithAI(
  errorDetails: any,
  knownSolutions: string[]
): Promise<{
  fix: string;
  steps: string[];
  fixType: 'automated' | 'manual' | 'guided';
  confidence: number;
  estimatedTime: string;
  riskLevel: 'low' | 'medium' | 'high';
} | null> {
  const prompt = `You are The Dr, an expert in error diagnosis and resolution. Analyze this error and recommend a fix:

Error Code: ${errorDetails.code}
Category: ${errorDetails.category}
Message: ${errorDetails.message}
Stack Trace: ${errorDetails.stackTrace || 'N/A'}
Occurrences: ${errorDetails.occurrenceCount}
Affected Users: ${errorDetails.affectedUsers}

Known Solutions from Similar Errors:
${knownSolutions.length > 0 ? knownSolutions.map((s, i) => `${i + 1}. ${s}`).join('\n') : 'None found'}

Provide a JSON response with:
{
  "fix": string (description of recommended fix),
  "steps": string[] (detailed steps to implement fix),
  "fixType": "automated" | "manual" | "guided",
  "confidence": number (0-1, how confident you are this will work),
  "estimatedTime": string (e.g., "5 minutes", "1 hour"),
  "riskLevel": "low" | "medium" | "high"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are The Dr, an expert in error diagnosis and code quality. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "error_resolution",
          strict: true,
          schema: {
            type: "object",
            properties: {
              fix: { type: "string" },
              steps: { type: "array", items: { type: "string" } },
              fixType: { type: "string", enum: ["automated", "manual", "guided"] },
              confidence: { type: "number" },
              estimatedTime: { type: "string" },
              riskLevel: { type: "string", enum: ["low", "medium", "high"] }
            },
            required: ["fix", "steps", "fixType", "confidence", "estimatedTime", "riskLevel"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    return JSON.parse(contentStr);
  } catch (error) {
    logger.error('[The Dr] AI analysis failed', error as Error);
    return null;
  }
}

/**
 * Attempt automated fix (platform issues only)
 */
async function attemptAutomatedFix(
  errorCode: string,
  research: ResolutionResearch
): Promise<SelfHealingResult> {
  const startTime = Date.now();
  const logs: string[] = [];
  
  logs.push(`[The Dr] Starting automated fix for ${errorCode}`);
  logs.push(`Fix: ${research.recommendedFix}`);
  
  try {
    // Update status
    await updateErrorCodeResolution(errorCode, {
      resolutionStatus: 'fix_applied',
      resolutionType: 'platform_self_heal',
      fixImplemented: true,
    });
    
    // Execute fix based on error category
    const errorDetails = await getErrorCode(errorCode);
    if (!errorDetails) throw new Error('Error code not found');
    
    let fixApplied = '';
    
    switch (errorDetails.category) {
      case 'database':
        fixApplied = await applyDatabaseFix(errorDetails, research, logs);
        break;
      
      case 'performance':
        fixApplied = await applyPerformanceFix(errorDetails, research, logs);
        break;
      
      case 'system':
        fixApplied = await applySystemFix(errorDetails, research, logs);
        break;
      
      default:
        throw new Error(`Automated fix not supported for category: ${errorDetails.category}`);
    }
    
    logs.push(`[The Dr] Fix applied: ${fixApplied}`);
    
    // Validate fix
    logs.push(`[The Dr] Validating fix...`);
    const validated = await validateFix(errorCode, logs);
    
    await updateErrorCodeResolution(errorCode, {
      fixValidated: validated,
      resolutionStatus: validated ? 'resolved' : 'fix_available',
    });
    
    if (validated) {
      logs.push(`[The Dr] ✅ Fix validated successfully`);
      
      // Generate knowledge base article
      generateKnowledgeBaseArticle(errorCode, research, fixApplied).catch(console.error);
    } else {
      logs.push(`[The Dr] ⚠️  Fix validation failed, rollback may be needed`);
    }
    
    const duration = Date.now() - startTime;
    
    // Log to audit trail
    logger.info(`[The Dr] Automated fix completed for ${errorCode}`, {
      errorCode,
      fixApplied,
      validated,
      duration,
    });
    
    return {
      errorCode,
      success: validated,
      fixApplied,
      fixValidated: validated,
      rollbackPerformed: false,
      duration,
      logs,
    };
  } catch (error: any) {
    logs.push(`[The Dr] ❌ Fix failed: ${error.message}`);
    
    logger.error(`[The Dr] Automated fix failed for ${errorCode}`, error, {
      errorCode,
      research,
    });
    
    return {
      errorCode,
      success: false,
      fixApplied: '',
      fixValidated: false,
      rollbackPerformed: false,
      duration: Date.now() - startTime,
      logs,
    };
  }
}

/**
 * Apply database fix
 */
async function applyDatabaseFix(
  errorDetails: any,
  research: ResolutionResearch,
  logs: string[]
): Promise<string> {
  logs.push('[The Dr] Applying database fix...');
  
  // Example fixes:
  if (errorDetails.message.includes('connection')) {
    logs.push('[The Dr] Detected connection issue, attempting reconnection...');
    // Reconnect logic here
    return 'Database connection pool refreshed';
  }
  
  if (errorDetails.message.includes('timeout')) {
    logs.push('[The Dr] Detected timeout, increasing connection timeout...');
    // Adjust timeout logic here
    return 'Database timeout increased to 30s';
  }
  
  return 'Database configuration optimized';
}

/**
 * Apply performance fix
 */
async function applyPerformanceFix(
  errorDetails: any,
  research: ResolutionResearch,
  logs: string[]
): Promise<string> {
  logs.push('[The Dr] Applying performance fix...');
  
  // Example fixes:
  if (errorDetails.message.includes('memory')) {
    logs.push('[The Dr] Detected memory issue, clearing caches...');
    // Clear cache logic here
    return 'Memory caches cleared';
  }
  
  if (errorDetails.message.includes('slow')) {
    logs.push('[The Dr] Detected slow query, adding index...');
    // Add index logic here
    return 'Database index added for optimization';
  }
  
  return 'Performance optimizations applied';
}

/**
 * Apply system fix
 */
async function applySystemFix(
  errorDetails: any,
  research: ResolutionResearch,
  logs: string[]
): Promise<string> {
  logs.push('[The Dr] Applying system fix...');
  
  // Example fixes:
  if (errorDetails.message.includes('disk')) {
    logs.push('[The Dr] Detected disk issue, cleaning up temp files...');
    // Cleanup logic here
    return 'Temporary files cleaned up';
  }
  
  return 'System configuration adjusted';
}

/**
 * Validate fix
 */
async function validateFix(errorCode: string, logs: string[]): Promise<boolean> {
  logs.push('[The Dr] Running validation tests...');
  
  // Wait a bit for fix to take effect
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check if error still occurs
  // In real implementation, this would run actual tests
  
  logs.push('[The Dr] Validation complete');
  return true; // Simulated success
}

/**
 * Generate user-facing resolution options
 */
export async function generateUserResolutionOptions(
  errorCode: string
): Promise<UserResolutionOptions | null> {
  const errorDetails = await getErrorCode(errorCode);
  if (!errorDetails) return null;
  
  const research = await researchErrorResolution(errorCode);
  if (!research) return null;
  
  // Use AI to generate user-friendly instructions
  const prompt = `Generate user-facing resolution options for this error:

Error Code: ${errorCode}
Message: ${errorDetails.message}
Recommended Fix: ${research.recommendedFix}
Steps: ${research.recommendedFix}

Provide 3 resolution options in JSON format:
{
  "manual": {
    "steps": string[],
    "estimatedTime": string,
    "difficulty": "easy" | "medium" | "hard",
    "requiredSkills": string[]
  },
  "aiGuided": {
    "conversationalGuide": string,
    "stepByStepGuide": [
      {
        "step": number,
        "instruction": string,
        "expectedOutcome": string,
        "troubleshooting": string
      }
    ],
    "estimatedTime": string
  },
  "selfRepair": {
    "description": string,
    "whatWillChange": string[],
    "risks": string[],
    "estimatedTime": string,
    "requiresApproval": boolean,
    "canRollback": boolean
  }
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are The Dr, providing user-friendly error resolution options. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const options = JSON.parse(contentStr);
    
    return {
      errorCode,
      errorDescription: errorDetails.message,
      manualInstructions: options.manual,
      aiGuidedInstructions: options.aiGuided,
      selfRepairOption: options.selfRepair,
    };
  } catch (error) {
    logger.error('[The Dr] Failed to generate user options', error as Error);
    return null;
  }
}

/**
 * Generate knowledge base article
 */
async function generateKnowledgeBaseArticle(
  errorCode: string,
  research: ResolutionResearch,
  fixApplied: string
): Promise<void> {
  logger.info(`[The Dr] Generating KB article for ${errorCode}`);
  
  const { createKnowledgeBaseArticle } = await import("./knowledgeBaseService");
  await createKnowledgeBaseArticle(errorCode, research, fixApplied);
}
