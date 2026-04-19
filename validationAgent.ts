import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import {
  gateValidations,
  agentSignOffs,
  validationLogs,
  rollbackPoints,
  errorLogs,
  type InsertGateValidation,
  type InsertAgentSignOff,
  type InsertValidationLog,
  type InsertRollbackPoint,
  type InsertErrorLog,
} from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

/**
 * Validation Agent Service
 * 
 * The 12th agent and final quality gatekeeper.
 * Reviews all gate submissions, validates code checkpoints, and ensures compliance.
 */

// 12-Gate Validation Checklists
const GATE_CHECKLISTS = {
  0: [ // Gate 0: Intake
    "User requirements clearly documented",
    "Success criteria defined",
    "Stakeholders identified",
    "Initial feasibility assessed",
  ],
  1: [ // Gate 1: 0-Cost Validation
    "All proposed services are zero-cost (free/open-source)",
    "No paid APIs or services required",
    "Doris approval obtained",
    "Alternative free solutions identified for any paid services",
  ],
  2: [ // Gate 2: Specification
    "Functional requirements documented",
    "Non-functional requirements documented",
    "Technical architecture defined",
    "Data models specified",
  ],
  3: [ // Gate 3: Security
    "Threat modeling completed (STRIDE)",
    "OWASP Top 10 validation passed",
    "Security requirements identified",
    "Guardian approval obtained",
  ],
  4: [ // Gate 4: Design
    "System design documented",
    "UI/UX mockups created",
    "API contracts defined",
    "Auditor review completed",
  ],
  5: [ // Gate 5: Code Generation
    "Code generated following TDD",
    "Unit tests written before implementation",
    "Code quality standards met",
    "The Dr approval obtained",
  ],
  6: [ // Gate 6: Testing
    "All unit tests passing",
    "Integration tests passing",
    "Code coverage >= 80%",
    "Test report generated",
  ],
  7: [ // Gate 7: Dependency Management
    "All dependencies validated by CARL",
    "No malicious packages detected",
    "License compliance verified",
    "Dependency graph documented",
  ],
  8: [ // Gate 8: Build
    "Build successful",
    "No build errors or warnings",
    "Build artifacts generated",
    "Build time within acceptable limits",
  ],
  9: [ // Gate 9: Compliance
    "Regulatory compliance validated (GDPR, SOC 2, etc.)",
    "Senator approval obtained",
    "Compliance gaps documented and addressed",
    "Compliance report generated",
  ],
  10: [ // Gate 10: Legal/IP
    "Legal review completed",
    "IP compliance verified",
    "No patent infringements detected",
    "Justitia and Patent Clerk approval obtained",
  ],
  11: [ // Gate 11: Pre-Deployment
    "Deployment scripts tested",
    "Monitoring configured",
    "Rollback plan documented",
    "Prometheus approval obtained",
  ],
  12: [ // Gate 12: UAT & Go-Live
    "User acceptance testing completed",
    "Customer sign-off obtained",
    "Production deployment successful",
    "Post-deployment monitoring active",
  ],
};

interface ValidationCheckpoint {
  type: 'input' | 'mutation' | 'pipeline' | 'critical';
  entityType: string;
  entityId?: number;
  data: any;
  schema?: any;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number;
}

interface GateSubmission {
  gateId: number;
  submissionId: number;
  evidence: Record<string, any>;
  submittedBy: string;
}

interface GateValidationResult {
  gateId: number;
  status: 'pass' | 'fail' | 'conditional';
  checklist: Array<{
    item: string;
    status: 'pass' | 'fail' | 'conditional';
    reasoning: string;
  }>;
  overallReasoning: string;
  conditions?: string[];
}

/**
 * Validate a code checkpoint (input, mutation, pipeline, critical operation)
 */
export async function validateCheckpoint(checkpoint: ValidationCheckpoint): Promise<ValidationResult> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Type validation
  if (checkpoint.schema) {
    try {
      // Use zod or similar for schema validation
      // For now, basic type checking
      const dataType = typeof checkpoint.data;
      const expectedType = checkpoint.schema.type;
      if (dataType !== expectedType) {
        errors.push(`Type mismatch: expected ${expectedType}, got ${dataType}`);
      }
    } catch (error) {
      errors.push(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Input sanitization (for input checkpoints)
  if (checkpoint.type === 'input') {
    // Check for SQL injection patterns
    const sqlInjectionPatterns = [
      /(\bOR\b|\bAND\b).*=.*\b/i,
      /UNION.*SELECT/i,
      /DROP.*TABLE/i,
      /INSERT.*INTO/i,
      /DELETE.*FROM/i,
    ];
    
    const dataStr = JSON.stringify(checkpoint.data);
    for (const pattern of sqlInjectionPatterns) {
      if (pattern.test(dataStr)) {
        errors.push(`Potential SQL injection detected: ${pattern}`);
      }
    }
    
    // Check for XSS patterns
    const xssPatterns = [
      /<script[^>]*>.*<\/script>/i,
      /javascript:/i,
      /on\w+\s*=/i, // onclick=, onerror=, etc.
    ];
    
    for (const pattern of xssPatterns) {
      if (pattern.test(dataStr)) {
        errors.push(`Potential XSS attack detected: ${pattern}`);
      }
    }
  }
  
  // Log validation result
  const logEntry: InsertValidationLog = {
    validationType: checkpoint.type,
    entityType: checkpoint.entityType,
    entityId: checkpoint.entityId,
    valid: errors.length === 0 ? 1 : 0,
    errors: errors.length > 0 ? JSON.stringify(errors) : null,
    warnings: warnings.length > 0 ? JSON.stringify(warnings) : null,
    metadata: JSON.stringify({
      checkpoint: checkpoint.type,
      dataSize: JSON.stringify(checkpoint.data).length,
    }),
  };
  
  await db.insert(validationLogs).values(logEntry);
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    confidence: errors.length === 0 ? 1.0 : 0.0,
  };
}

/**
 * Validate a gate submission using AI-powered checklist validation
 */
export async function validateGate(submission: GateSubmission): Promise<GateValidationResult> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  const checklist = GATE_CHECKLISTS[submission.gateId as keyof typeof GATE_CHECKLISTS];
  if (!checklist) {
    throw new Error(`Invalid gate ID: ${submission.gateId}`);
  }
  
  // Use LLM to validate each checklist item
  const checklistResults = [];
  
  for (const item of checklist) {
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `You are the Validation Agent, the final quality gatekeeper. 
Review the evidence provided and determine if the checklist item is satisfied.

Respond in JSON format:
{
  "status": "pass" | "fail" | "conditional",
  "reasoning": "Detailed explanation of your decision",
  "evidence_quality": 0.0-1.0
}`
          },
          {
            role: 'user',
            content: `Checklist Item: ${item}

Evidence Provided:
${JSON.stringify(submission.evidence, null, 2)}

Does the evidence satisfy this checklist item?`
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'checklist_validation',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['pass', 'fail', 'conditional'] },
                reasoning: { type: 'string' },
                evidence_quality: { type: 'number' }
              },
              required: ['status', 'reasoning', 'evidence_quality'],
              additionalProperties: false
            }
          }
        }
      });
      
      const content = response.choices[0].message.content;
      const contentStr = typeof content === 'string' ? content : '';
      const result = JSON.parse(contentStr || '{}');
      
      checklistResults.push({
        item,
        status: result.status,
        reasoning: result.reasoning,
      });
      
      // Store in database
      const validationEntry: InsertGateValidation = {
        gateId: submission.gateId,
        submissionId: submission.submissionId,
        checklistItem: item,
        status: result.status,
        evidence: JSON.stringify(submission.evidence),
        reasoning: result.reasoning,
        validatedBy: 'Validation Agent',
      };
      
      await db.insert(gateValidations).values(validationEntry);
      
    } catch (error) {
      console.error(`[Validation Agent] Error validating checklist item "${item}":`, error);
      checklistResults.push({
        item,
        status: 'fail' as const,
        reasoning: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }
  
  // Determine overall gate status
  const failedItems = checklistResults.filter(r => r.status === 'fail');
  const conditionalItems = checklistResults.filter(r => r.status === 'conditional');
  
  let overallStatus: 'pass' | 'fail' | 'conditional';
  if (failedItems.length > 0) {
    overallStatus = 'fail';
  } else if (conditionalItems.length > 0) {
    overallStatus = 'conditional';
  } else {
    overallStatus = 'pass';
  }
  
  return {
    gateId: submission.gateId,
    status: overallStatus,
    checklist: checklistResults,
    overallReasoning: `Gate ${submission.gateId} validation: ${checklistResults.filter(r => r.status === 'pass').length}/${checklist.length} items passed`,
    conditions: conditionalItems.map(r => r.reasoning),
  };
}

/**
 * Create a digital signature for an agent sign-off
 */
export function createSignature(data: string, secret: string = process.env.JWT_SECRET || 'default-secret'): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Record an agent sign-off for a gate
 */
export async function recordSignOff(
  gateId: number,
  submissionId: number,
  agentName: string,
  signOffType: 'approve' | 'reject' | 'conditional',
  evidence: any[],
  reasoning: string,
  conditions?: string[]
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  // Create digital signature
  const signatureData = JSON.stringify({
    gateId,
    submissionId,
    agentName,
    signOffType,
    timestamp: new Date().toISOString(),
  });
  const signature = createSignature(signatureData);
  
  const signOffEntry: InsertAgentSignOff = {
    gateId,
    submissionId,
    agentName,
    signOffType,
    evidence: JSON.stringify(evidence),
    reasoning,
    conditions: conditions ? JSON.stringify(conditions) : null,
    signature,
  };
  
  await db.insert(agentSignOffs).values(signOffEntry);
}

/**
 * Create a rollback point before a critical operation
 */
export async function createRollbackPoint(
  entityType: string,
  entityId: number | undefined,
  stage: string,
  snapshotData: any
): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  const rollbackEntry: InsertRollbackPoint = {
    entityType,
    entityId,
    stage,
    snapshotData: JSON.stringify(snapshotData),
  };
  
  const [result] = await db.insert(rollbackPoints).values(rollbackEntry);
  return result.insertId;
}

/**
 * Log an error with learning capability
 */
export async function logError(
  operation: string,
  errorMessage: string,
  errorStack: string | undefined,
  context: any,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  const errorEntry: InsertErrorLog = {
    operation,
    errorMessage,
    errorStack: errorStack || null,
    context: JSON.stringify(context),
    severity,
    resolved: 0,
    learnedFrom: 0,
  };
  
  await db.insert(errorLogs).values(errorEntry);
}

/**
 * Check if escalation is needed (3 failures → human review)
 */
export async function checkEscalation(submissionId: number, gateId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  // Count failed validations for this submission
  const failedValidations = await db
    .select()
    .from(gateValidations)
    .where(
      eq(gateValidations.submissionId, submissionId)
    );
  
  const failCount = failedValidations.filter(v => v.status === 'fail').length;
  
  // Escalate if 3 or more failures
  return failCount >= 3;
}
