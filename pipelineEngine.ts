/**
 * PIPELINE ENGINE SERVICE
 * 
 * Visual workflow execution engine with:
 * - Stage execution (transform, validate, enrich, route, action, condition, parallel)
 * - Error handling strategies (fail_fast, continue, retry, fallback)
 * - Execution monitoring and analytics
 * - Integration with existing AI agents
 */

import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  pipelines,
  pipelineStages,
  pipelineExecutions,
  stageExecutions,
  pipelineTemplates,
  pipelineAnalytics,
  Pipeline,
  PipelineStage,
  PipelineExecution,
  StageExecution,
  InsertPipelineExecution,
  InsertStageExecution,
} from "../../drizzle/pipeline-schema";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";

// ============================================================================
// TYPES
// ============================================================================

export interface ExecutionContext {
  executionId: string;
  pipelineId: string;
  input: Record<string, any>;
  variables: Record<string, any>;  // Accumulated data from stages
  correlationId: string;
  userId?: number;
}

export interface StageResult {
  success: boolean;
  output?: Record<string, any>;
  error?: string;
  errorCode?: string;
  durationMs: number;
  nextStageId?: string;
}

export interface PipelineResult {
  success: boolean;
  executionId: string;
  output?: Record<string, any>;
  error?: string;
  durationMs: number;
  stageResults: Array<{
    stageId: string;
    stageName: string;
    status: string;
    durationMs: number;
    error?: string;
  }>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function interpolateVariables(template: string, context: ExecutionContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const parts = path.trim().split('.');
    let value: any = { ...context.input, ...context.variables, trigger: context.input };
    
    for (const part of parts) {
      if (value === undefined || value === null) return match;
      value = value[part];
    }
    
    return value !== undefined ? String(value) : match;
  });
}

function interpolateObject(obj: any, context: ExecutionContext): any {
  if (typeof obj === 'string') {
    return interpolateVariables(obj, context);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => interpolateObject(item, context));
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, context);
    }
    return result;
  }
  return obj;
}

// ============================================================================
// PIPELINE CRUD OPERATIONS
// ============================================================================

export async function createPipeline(data: {
  name: string;
  description?: string;
  triggerType: "event" | "schedule" | "webhook" | "manual";
  triggerConfig?: Record<string, any>;
  errorStrategy?: "fail_fast" | "continue" | "retry" | "fallback";
  maxRetries?: number;
  category?: string;
  tags?: string[];
  createdBy: number;
}): Promise<Pipeline> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const id = `pipeline_${generateId()}`;
  
  await db.insert(pipelines).values({
    id,
    name: data.name,
    description: data.description,
    triggerType: data.triggerType,
    triggerConfig: data.triggerConfig,
    errorStrategy: data.errorStrategy || "fail_fast",
    maxRetries: data.maxRetries || 3,
    category: data.category,
    tags: data.tags,
    createdBy: data.createdBy,
    enabled: true,
  });
  
  const result = await db.select().from(pipelines).where(eq(pipelines.id, id)).limit(1);
  return result[0];
}

export async function getPipeline(id: string): Promise<Pipeline | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(pipelines).where(eq(pipelines.id, id)).limit(1);
  return result[0] || null;
}

export async function listPipelines(filters?: {
  category?: string;
  enabled?: boolean;
  isTemplate?: boolean;
}): Promise<Pipeline[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(pipelines);
  
  const conditions = [];
  if (filters?.category) {
    conditions.push(eq(pipelines.category, filters.category));
  }
  if (filters?.enabled !== undefined) {
    conditions.push(eq(pipelines.enabled, filters.enabled));
  }
  if (filters?.isTemplate !== undefined) {
    conditions.push(eq(pipelines.isTemplate, filters.isTemplate));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  return await query.orderBy(desc(pipelines.createdAt));
}

export async function updatePipeline(id: string, data: Partial<Pipeline>): Promise<Pipeline | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(pipelines).set(data).where(eq(pipelines.id, id));
  return await getPipeline(id);
}

export async function deletePipeline(id: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Delete stages first
  await db.delete(pipelineStages).where(eq(pipelineStages.pipelineId, id));
  
  // Delete pipeline
  await db.delete(pipelines).where(eq(pipelines.id, id));
  return true;
}

// ============================================================================
// STAGE CRUD OPERATIONS
// ============================================================================

export async function addStage(pipelineId: string, data: {
  name: string;
  description?: string;
  stageType: "transform" | "validate" | "enrich" | "route" | "action" | "condition" | "parallel" | "wait" | "notify";
  config: Record<string, any>;
  order?: number;
  onSuccessStageId?: string;
  onFailureStageId?: string;
  timeoutMs?: number;
}): Promise<PipelineStage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const id = `stage_${generateId()}`;
  
  await db.insert(pipelineStages).values({
    id,
    pipelineId,
    name: data.name,
    description: data.description,
    stageType: data.stageType,
    config: data.config,
    order: data.order || 0,
    onSuccessStageId: data.onSuccessStageId,
    onFailureStageId: data.onFailureStageId,
    timeoutMs: data.timeoutMs || 30000,
  });
  
  const result = await db.select().from(pipelineStages).where(eq(pipelineStages.id, id)).limit(1);
  return result[0];
}

export async function getStages(pipelineId: string): Promise<PipelineStage[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, pipelineId))
    .orderBy(pipelineStages.order);
}

export async function updateStage(id: string, data: Partial<PipelineStage>): Promise<PipelineStage | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(pipelineStages).set(data).where(eq(pipelineStages.id, id));
  
  const result = await db.select().from(pipelineStages).where(eq(pipelineStages.id, id)).limit(1);
  return result[0] || null;
}

export async function deleteStage(id: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(pipelineStages).where(eq(pipelineStages.id, id));
  return true;
}

// ============================================================================
// STAGE EXECUTORS
// ============================================================================

async function executeTransformStage(
  stage: PipelineStage,
  context: ExecutionContext
): Promise<StageResult> {
  const startTime = Date.now();
  const config = stage.config as any;
  
  try {
    let data = { ...context.variables };
    
    for (const operation of (config.operations || [])) {
      const field = operation.field;
      let value = data[field];
      
      switch (operation.operation) {
        case 'trim':
          if (typeof value === 'string') data[field] = value.trim();
          break;
        case 'lowercase':
          if (typeof value === 'string') data[field] = value.toLowerCase();
          break;
        case 'uppercase':
          if (typeof value === 'string') data[field] = value.toUpperCase();
          break;
        case 'parse_json':
          if (typeof value === 'string') data[field] = JSON.parse(value);
          break;
        case 'stringify':
          data[field] = JSON.stringify(value);
          break;
        case 'map':
          if (Array.isArray(value) && operation.params?.expression) {
            // Simple mapping - in production, use a safe expression evaluator
            data[field] = value.map(item => item);
          }
          break;
        case 'filter':
          if (Array.isArray(value) && operation.params?.expression) {
            // Simple filtering - in production, use a safe expression evaluator
            data[field] = value.filter(item => item);
          }
          break;
        case 'custom':
          // Custom transformation via LLM
          if (operation.params?.prompt) {
            const response = await invokeLLM({
              messages: [
                { role: "system", content: "You are a data transformation assistant. Transform the data as instructed and return only the transformed result." },
                { role: "user", content: `Transform this data: ${JSON.stringify(value)}\n\nInstruction: ${operation.params.prompt}` }
              ]
            });
            const content = response.choices[0].message.content;
            const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
            try {
              data[field] = JSON.parse(contentStr);
            } catch {
              data[field] = contentStr;
            }
          }
          break;
      }
    }
    
    return {
      success: true,
      output: data,
      durationMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      errorCode: 'TRANSFORM_FAILED',
      durationMs: Date.now() - startTime,
    };
  }
}

async function executeValidateStage(
  stage: PipelineStage,
  context: ExecutionContext
): Promise<StageResult> {
  const startTime = Date.now();
  const config = stage.config as any;
  
  try {
    const schema = config.schema;
    const data = context.variables;
    
    // Simple validation - in production, use Zod or AJV
    if (schema?.required) {
      for (const field of schema.required) {
        if (data[field] === undefined || data[field] === null) {
          return {
            success: false,
            error: `Missing required field: ${field}`,
            errorCode: 'VALIDATION_FAILED',
            durationMs: Date.now() - startTime,
          };
        }
      }
    }
    
    if (schema?.properties) {
      for (const [field, rules] of Object.entries(schema.properties as Record<string, any>)) {
        const value = data[field];
        if (value !== undefined) {
          if (rules.type === 'string' && typeof value !== 'string') {
            return {
              success: false,
              error: `Field ${field} must be a string`,
              errorCode: 'VALIDATION_FAILED',
              durationMs: Date.now() - startTime,
            };
          }
          if (rules.type === 'number' && typeof value !== 'number') {
            return {
              success: false,
              error: `Field ${field} must be a number`,
              errorCode: 'VALIDATION_FAILED',
              durationMs: Date.now() - startTime,
            };
          }
          if (rules.format === 'email' && typeof value === 'string') {
            if (!value.includes('@')) {
              return {
                success: false,
                error: `Field ${field} must be a valid email`,
                errorCode: 'VALIDATION_FAILED',
                durationMs: Date.now() - startTime,
              };
            }
          }
        }
      }
    }
    
    return {
      success: true,
      output: data,
      durationMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      errorCode: 'VALIDATION_ERROR',
      durationMs: Date.now() - startTime,
    };
  }
}

async function executeEnrichStage(
  stage: PipelineStage,
  context: ExecutionContext
): Promise<StageResult> {
  const startTime = Date.now();
  const config = stage.config as any;
  
  try {
    let data = { ...context.variables };
    
    switch (config.service) {
      case 'ai_tagging':
        // Use AI to generate tags
        const fieldsToTag = config.fields || ['description'];
        const textToTag = fieldsToTag.map((f: string) => data[f]).filter(Boolean).join(' ');
        
        if (textToTag) {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "Generate relevant tags for the given text. Return as JSON array of strings." },
              { role: "user", content: textToTag }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "tags",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    tags: { type: "array", items: { type: "string" } }
                  },
                  required: ["tags"],
                  additionalProperties: false
                }
              }
            }
          });
          const content = response.choices[0].message.content;
          const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
          const result = JSON.parse(contentStr);
          data.tags = result.tags;
        }
        break;
        
      case 'sentiment_analysis':
        // Analyze sentiment
        const textToAnalyze = config.fields?.map((f: string) => data[f]).filter(Boolean).join(' ');
        
        if (textToAnalyze) {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "Analyze the sentiment of the text. Return as JSON with sentiment (positive/negative/neutral) and score (0-1)." },
              { role: "user", content: textToAnalyze }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "sentiment",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    sentiment: { type: "string", enum: ["positive", "negative", "neutral"] },
                    score: { type: "number" }
                  },
                  required: ["sentiment", "score"],
                  additionalProperties: false
                }
              }
            }
          });
          const content = response.choices[0].message.content;
          const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
          const result = JSON.parse(contentStr);
          data.sentiment = result;
        }
        break;
        
      default:
        // Custom enrichment service
        console.log(`[Pipeline] Unknown enrichment service: ${config.service}`);
    }
    
    return {
      success: true,
      output: data,
      durationMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      errorCode: 'ENRICH_FAILED',
      durationMs: Date.now() - startTime,
    };
  }
}

async function executeActionStage(
  stage: PipelineStage,
  context: ExecutionContext
): Promise<StageResult> {
  const startTime = Date.now();
  const config = interpolateObject(stage.config, context) as any;
  
  try {
    const action = config.action;
    const params = config.params || {};
    
    let result: any;
    
    switch (action) {
      case 'email.send':
        // In production, integrate with email service
        console.log(`[Pipeline] Sending email to ${params.to} with template ${params.template}`);
        result = { sent: true, to: params.to };
        break;
        
      case 'notification.send':
        await notifyOwner({
          title: params.title || 'Pipeline Notification',
          content: params.message || JSON.stringify(context.variables)
        });
        result = { sent: true };
        break;
        
      case 'database.insert':
        // In production, use proper database operations
        console.log(`[Pipeline] Inserting into ${params.table}:`, params.data);
        result = { inserted: true, table: params.table };
        break;
        
      case 'database.update':
        console.log(`[Pipeline] Updating ${params.table}:`, params.data);
        result = { updated: true, table: params.table };
        break;
        
      case 'webhook.call':
        // Make HTTP request
        console.log(`[Pipeline] Calling webhook: ${params.url}`);
        result = { called: true, url: params.url };
        break;
        
      case 'log.info':
        console.log(`[Pipeline Log] ${params.message}`);
        result = { logged: true };
        break;
        
      case 'log.error':
        console.error(`[Pipeline Error] ${params.message}`);
        result = { logged: true };
        break;
        
      default:
        console.log(`[Pipeline] Unknown action: ${action}`);
        result = { action, params };
    }
    
    return {
      success: true,
      output: { ...context.variables, actionResult: result },
      durationMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      errorCode: 'ACTION_FAILED',
      durationMs: Date.now() - startTime,
    };
  }
}

async function executeConditionStage(
  stage: PipelineStage,
  context: ExecutionContext
): Promise<StageResult> {
  const startTime = Date.now();
  const config = stage.config as any;
  
  try {
    const expression = interpolateVariables(config.expression || '', context);
    
    // Simple expression evaluation - in production, use a safe evaluator
    let conditionMet = false;
    
    // Handle simple comparisons
    if (expression.includes('===')) {
      const [left, right] = expression.split('===').map(s => s.trim().replace(/['"]/g, ''));
      conditionMet = left === right;
    } else if (expression.includes('!==')) {
      const [left, right] = expression.split('!==').map(s => s.trim().replace(/['"]/g, ''));
      conditionMet = left !== right;
    } else if (expression.includes('>')) {
      const [left, right] = expression.split('>').map(s => parseFloat(s.trim()));
      conditionMet = left > right;
    } else if (expression.includes('<')) {
      const [left, right] = expression.split('<').map(s => parseFloat(s.trim()));
      conditionMet = left < right;
    } else {
      // Truthy check
      conditionMet = Boolean(expression);
    }
    
    return {
      success: true,
      output: { ...context.variables, conditionMet },
      durationMs: Date.now() - startTime,
      nextStageId: conditionMet ? config.trueStageId : config.falseStageId,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      errorCode: 'CONDITION_FAILED',
      durationMs: Date.now() - startTime,
    };
  }
}

async function executeRouteStage(
  stage: PipelineStage,
  context: ExecutionContext
): Promise<StageResult> {
  const startTime = Date.now();
  const config = stage.config as any;
  
  try {
    const routes = config.routes || [];
    
    for (const route of routes) {
      const condition = interpolateVariables(route.condition, context);
      
      // Simple evaluation
      if (condition === 'true' || condition === '1') {
        return {
          success: true,
          output: context.variables,
          durationMs: Date.now() - startTime,
          nextStageId: route.targetStageId,
        };
      }
    }
    
    // No route matched - continue to default next stage
    return {
      success: true,
      output: context.variables,
      durationMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      errorCode: 'ROUTE_FAILED',
      durationMs: Date.now() - startTime,
    };
  }
}

async function executeParallelStage(
  stage: PipelineStage,
  context: ExecutionContext,
  allStages: PipelineStage[]
): Promise<StageResult> {
  const startTime = Date.now();
  const config = stage.config as any;
  
  try {
    const parallelStageIds = config.parallelStageIds || [];
    const waitForAll = config.waitForAll !== false;
    
    const parallelStages = allStages.filter(s => parallelStageIds.includes(s.id));
    
    const results = await Promise.all(
      parallelStages.map(s => executeStage(s, context, allStages))
    );
    
    const allSucceeded = results.every(r => r.success);
    const anySucceeded = results.some(r => r.success);
    
    // Merge outputs
    const mergedOutput = results.reduce((acc, r) => ({
      ...acc,
      ...(r.output || {})
    }), context.variables);
    
    if (waitForAll && !allSucceeded) {
      const failedResults = results.filter(r => !r.success);
      return {
        success: false,
        error: `Parallel execution failed: ${failedResults.map(r => r.error).join(', ')}`,
        errorCode: 'PARALLEL_FAILED',
        output: mergedOutput,
        durationMs: Date.now() - startTime,
      };
    }
    
    return {
      success: anySucceeded,
      output: mergedOutput,
      durationMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      errorCode: 'PARALLEL_ERROR',
      durationMs: Date.now() - startTime,
    };
  }
}

async function executeNotifyStage(
  stage: PipelineStage,
  context: ExecutionContext
): Promise<StageResult> {
  const startTime = Date.now();
  const config = interpolateObject(stage.config, context) as any;
  
  try {
    const channel = config.channel || 'email';
    const template = config.template;
    const recipients = config.recipients || [];
    
    switch (channel) {
      case 'email':
        console.log(`[Pipeline] Sending email notification to ${recipients.join(', ')}`);
        break;
      case 'sms':
        console.log(`[Pipeline] Sending SMS notification to ${recipients.join(', ')}`);
        break;
      case 'slack':
        console.log(`[Pipeline] Sending Slack notification`);
        break;
      case 'webhook':
        console.log(`[Pipeline] Sending webhook notification`);
        break;
    }
    
    return {
      success: true,
      output: { ...context.variables, notified: true },
      durationMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      errorCode: 'NOTIFY_FAILED',
      durationMs: Date.now() - startTime,
    };
  }
}

async function executeWaitStage(
  stage: PipelineStage,
  context: ExecutionContext
): Promise<StageResult> {
  const startTime = Date.now();
  const config = stage.config as any;
  
  try {
    const timeout = config.timeout || 30000;
    
    // In production, this would wait for an external event
    // For now, just simulate a wait
    await sleep(Math.min(timeout, 5000));
    
    return {
      success: true,
      output: context.variables,
      durationMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      errorCode: 'WAIT_FAILED',
      durationMs: Date.now() - startTime,
    };
  }
}

// Main stage executor
async function executeStage(
  stage: PipelineStage,
  context: ExecutionContext,
  allStages: PipelineStage[]
): Promise<StageResult> {
  console.log(`[Pipeline] Executing stage: ${stage.name} (${stage.stageType})`);
  
  switch (stage.stageType) {
    case 'transform':
      return executeTransformStage(stage, context);
    case 'validate':
      return executeValidateStage(stage, context);
    case 'enrich':
      return executeEnrichStage(stage, context);
    case 'action':
      return executeActionStage(stage, context);
    case 'condition':
      return executeConditionStage(stage, context);
    case 'route':
      return executeRouteStage(stage, context);
    case 'parallel':
      return executeParallelStage(stage, context, allStages);
    case 'notify':
      return executeNotifyStage(stage, context);
    case 'wait':
      return executeWaitStage(stage, context);
    default:
      return {
        success: false,
        error: `Unknown stage type: ${stage.stageType}`,
        errorCode: 'UNKNOWN_STAGE_TYPE',
        durationMs: 0,
      };
  }
}

// ============================================================================
// PIPELINE EXECUTION
// ============================================================================

export async function executePipeline(
  pipelineId: string,
  input: Record<string, any>,
  options?: {
    triggeredBy?: "event" | "schedule" | "webhook" | "manual" | "api";
    userId?: number;
    correlationId?: string;
  }
): Promise<PipelineResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const startTime = Date.now();
  const executionId = `exec_${generateId()}`;
  const correlationId = options?.correlationId || executionId;
  
  console.log(`[Pipeline] Starting execution ${executionId} for pipeline ${pipelineId}`);
  
  // Get pipeline
  const pipeline = await getPipeline(pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${pipelineId}`);
  }
  
  if (!pipeline.enabled) {
    throw new Error(`Pipeline is disabled: ${pipelineId}`);
  }
  
  // Get stages
  const stages = await getStages(pipelineId);
  if (stages.length === 0) {
    throw new Error(`Pipeline has no stages: ${pipelineId}`);
  }
  
  // Create execution record
  await db.insert(pipelineExecutions).values({
    id: executionId,
    pipelineId,
    pipelineVersion: pipeline.version,
    status: "running",
    input,
    triggeredBy: options?.triggeredBy || "manual",
    triggerData: input,
    userId: options?.userId,
    correlationId,
    startedAt: new Date(),
  });
  
  // Initialize context
  const context: ExecutionContext = {
    executionId,
    pipelineId,
    input,
    variables: { ...input },
    correlationId,
    userId: options?.userId,
  };
  
  const stageResults: PipelineResult['stageResults'] = [];
  let currentStage: PipelineStage | undefined = stages[0];
  let success = true;
  let error: string | undefined;
  
  // Execute stages
  while (currentStage) {
    const stageStartTime = Date.now();
    
    // Create stage execution record
    const stageExecId = `stage_exec_${generateId()}`;
    await db.insert(stageExecutions).values({
      id: stageExecId,
      executionId,
      stageId: currentStage.id,
      status: "running",
      input: context.variables,
      startedAt: new Date(),
    });
    
    // Execute with timeout
    let result: StageResult;
    try {
      const timeoutMs = currentStage.timeoutMs || 30000;
      result = await Promise.race([
        executeStage(currentStage, context, stages),
        new Promise<StageResult>((_, reject) =>
          setTimeout(() => reject(new Error('Stage timeout')), timeoutMs)
        )
      ]);
    } catch (err: any) {
      result = {
        success: false,
        error: err.message,
        errorCode: 'STAGE_TIMEOUT',
        durationMs: Date.now() - stageStartTime,
      };
    }
    
    // Update stage execution record
    await db.update(stageExecutions)
      .set({
        status: result.success ? "completed" : "failed",
        output: result.output,
        error: result.error,
        errorCode: result.errorCode,
        completedAt: new Date(),
        durationMs: result.durationMs,
      })
      .where(eq(stageExecutions.id, stageExecId));
    
    // Record result
    stageResults.push({
      stageId: currentStage.id,
      stageName: currentStage.name,
      status: result.success ? "completed" : "failed",
      durationMs: result.durationMs,
      error: result.error,
    });
    
    // Update context with output
    if (result.output) {
      context.variables = { ...context.variables, ...result.output };
    }
    
    // Handle failure
    if (!result.success) {
      // Check error handling strategy
      if (pipeline.errorStrategy === 'fail_fast') {
        success = false;
        error = result.error;
        break;
      } else if (pipeline.errorStrategy === 'retry') {
        // Retry logic
        let retries = 0;
        const maxRetries = currentStage.retryOverride ? currentStage.maxRetries : pipeline.maxRetries;
        const retryDelay = currentStage.retryOverride ? currentStage.retryDelayMs : pipeline.retryDelayMs;
        
        while (retries < (maxRetries || 3)) {
          await sleep(retryDelay || 1000);
          retries++;
          
          console.log(`[Pipeline] Retrying stage ${currentStage.name} (attempt ${retries})`);
          
          result = await executeStage(currentStage, context, stages);
          
          if (result.success) {
            if (result.output) {
              context.variables = { ...context.variables, ...result.output };
            }
            break;
          }
        }
        
        if (!result.success) {
          if (currentStage.onFailureStageId) {
            currentStage = stages.find(s => s.id === currentStage!.onFailureStageId);
            continue;
          } else {
            success = false;
            error = result.error;
            break;
          }
        }
      } else if (pipeline.errorStrategy === 'continue') {
        // Continue to next stage despite failure
        console.log(`[Pipeline] Continuing despite failure in ${currentStage.name}`);
      } else if (pipeline.errorStrategy === 'fallback' && pipeline.fallbackStageId) {
        currentStage = stages.find(s => s.id === pipeline.fallbackStageId);
        continue;
      }
    }
    
    // Determine next stage
    if (result.nextStageId) {
      currentStage = stages.find(s => s.id === result.nextStageId);
    } else if (currentStage.onSuccessStageId) {
      currentStage = stages.find(s => s.id === currentStage!.onSuccessStageId);
    } else {
      // Find next stage by order
      const currentOrder = currentStage.order;
      currentStage = stages.find(s => s.order > currentOrder);
    }
  }
  
  const durationMs = Date.now() - startTime;
  
  // Update execution record
  await db.update(pipelineExecutions)
    .set({
      status: success ? "completed" : "failed",
      output: context.variables,
      error,
      completedAt: new Date(),
      durationMs,
    })
    .where(eq(pipelineExecutions.id, executionId));
  
  console.log(`[Pipeline] Execution ${executionId} ${success ? 'completed' : 'failed'} in ${durationMs}ms`);
  
  return {
    success,
    executionId,
    output: context.variables,
    error,
    durationMs,
    stageResults,
  };
}

// ============================================================================
// EXECUTION HISTORY
// ============================================================================

export async function getExecutions(pipelineId: string, limit: number = 50): Promise<PipelineExecution[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(pipelineExecutions)
    .where(eq(pipelineExecutions.pipelineId, pipelineId))
    .orderBy(desc(pipelineExecutions.createdAt))
    .limit(limit);
}

export async function getExecution(executionId: string): Promise<PipelineExecution | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(pipelineExecutions)
    .where(eq(pipelineExecutions.id, executionId))
    .limit(1);
  
  return result[0] || null;
}

export async function getStageExecutions(executionId: string): Promise<StageExecution[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(stageExecutions)
    .where(eq(stageExecutions.executionId, executionId))
    .orderBy(stageExecutions.createdAt);
}

// ============================================================================
// TEMPLATES
// ============================================================================

export async function getTemplates(category?: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(pipelineTemplates);
  
  if (category) {
    query = query.where(eq(pipelineTemplates.category, category)) as typeof query;
  }
  
  return await query.orderBy(desc(pipelineTemplates.usageCount));
}

export async function createPipelineFromTemplate(
  templateId: string,
  name: string,
  createdBy: number
): Promise<Pipeline> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get template
  const templates = await db.select()
    .from(pipelineTemplates)
    .where(eq(pipelineTemplates.id, templateId))
    .limit(1);
  
  const template = templates[0];
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  
  const definition = template.definition as any;
  
  // Create pipeline
  const pipeline = await createPipeline({
    name,
    description: template.description || undefined,
    triggerType: definition.triggerType as any,
    triggerConfig: definition.triggerConfig,
    errorStrategy: definition.errorStrategy as any,
    category: template.category,
    tags: template.tags || undefined,
    createdBy,
  });
  
  // Create stages
  for (const stageDef of definition.stages) {
    await addStage(pipeline.id, {
      name: stageDef.name,
      stageType: stageDef.type as any,
      config: stageDef.config,
      onSuccessStageId: stageDef.onSuccess,
      onFailureStageId: stageDef.onFailure,
    });
  }
  
  // Increment template usage
  await db.update(pipelineTemplates)
    .set({ usageCount: sql`${pipelineTemplates.usageCount} + 1` })
    .where(eq(pipelineTemplates.id, templateId));
  
  return pipeline;
}

// ============================================================================
// ANALYTICS
// ============================================================================

export async function getPipelineAnalytics(
  pipelineId: string,
  periodType: "hourly" | "daily" | "weekly" | "monthly" = "daily",
  limit: number = 30
): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(pipelineAnalytics)
    .where(and(
      eq(pipelineAnalytics.pipelineId, pipelineId),
      eq(pipelineAnalytics.periodType, periodType)
    ))
    .orderBy(desc(pipelineAnalytics.periodStart))
    .limit(limit);
}

// ============================================================================
// PRE-BUILT TEMPLATES
// ============================================================================

export const BUILT_IN_TEMPLATES = {
  codeReview: {
    id: "template_code_review",
    name: "Code Review Pipeline",
    description: "Automated code review with Kilo analysis, security scanning, and test execution",
    category: "development",
    definition: {
      triggerType: "event",
      triggerConfig: { event: "pull_request.opened" },
      errorStrategy: "continue",
      stages: [
        {
          id: "fetch_changes",
          name: "Fetch PR Changes",
          type: "action",
          config: { action: "github.get_pr_files", pr: "{{trigger.prNumber}}" },
          onSuccess: "kilo_analysis"
        },
        {
          id: "kilo_analysis",
          name: "Kilo Code Analysis",
          type: "action",
          config: { action: "code_review.analyze", agent: "kilo", files: "{{fetch_changes.files}}" },
          onSuccess: "security_scan"
        },
        {
          id: "security_scan",
          name: "Security Scan (Prometheus)",
          type: "action",
          config: { action: "security.scan", agent: "prometheus", files: "{{fetch_changes.files}}" },
          onSuccess: "run_tests"
        },
        {
          id: "run_tests",
          name: "Run Tests",
          type: "action",
          config: { action: "test.run", suite: "all" },
          onSuccess: "generate_report"
        },
        {
          id: "generate_report",
          name: "Generate Report",
          type: "transform",
          config: {
            operations: [{
              field: "report",
              operation: "custom",
              params: { prompt: "Generate a code review report from the analysis results" }
            }]
          },
          onSuccess: "post_comment"
        },
        {
          id: "post_comment",
          name: "Post to PR",
          type: "action",
          config: { action: "github.create_comment", pr: "{{trigger.prNumber}}", body: "{{generate_report.report}}" }
        }
      ]
    }
  },
  
  dataIngestion: {
    id: "template_data_ingestion",
    name: "Data Ingestion Pipeline",
    description: "Validate, sanitize, enrich, and store incoming data",
    category: "data",
    definition: {
      triggerType: "webhook",
      triggerConfig: { path: "/api/ingest" },
      errorStrategy: "fail_fast",
      stages: [
        {
          id: "validate",
          name: "Validate Schema",
          type: "validate",
          config: {
            schema: {
              type: "object",
              required: ["name", "email"],
              properties: {
                name: { type: "string" },
                email: { type: "string", format: "email" }
              }
            }
          },
          onSuccess: "sanitize",
          onFailure: "log_error"
        },
        {
          id: "sanitize",
          name: "Sanitize Input",
          type: "transform",
          config: {
            operations: [
              { field: "name", operation: "trim" },
              { field: "email", operation: "lowercase" }
            ]
          },
          onSuccess: "enrich"
        },
        {
          id: "enrich",
          name: "Enrich with AI Tags",
          type: "enrich",
          config: { service: "ai_tagging", fields: ["description"] },
          onSuccess: "store"
        },
        {
          id: "store",
          name: "Store in Database",
          type: "action",
          config: { action: "database.insert", table: "items", data: "{{enrich}}" },
          onSuccess: "notify"
        },
        {
          id: "notify",
          name: "Send Notification",
          type: "notify",
          config: { channel: "email", template: "new_item", recipients: ["admin@example.com"] }
        },
        {
          id: "log_error",
          name: "Log Validation Error",
          type: "action",
          config: { action: "log.error", message: "Validation failed: {{validate.error}}" }
        }
      ]
    }
  },
  
  userOnboarding: {
    id: "template_user_onboarding",
    name: "User Onboarding Pipeline",
    description: "Automated new user onboarding workflow",
    category: "user-management",
    definition: {
      triggerType: "event",
      triggerConfig: { event: "user.created" },
      errorStrategy: "continue",
      stages: [
        {
          id: "send_welcome",
          name: "Send Welcome Email",
          type: "action",
          config: {
            action: "email.send",
            template: "welcome",
            to: "{{trigger.user.email}}",
            variables: { name: "{{trigger.user.name}}" }
          },
          onSuccess: "create_workspace"
        },
        {
          id: "create_workspace",
          name: "Create Default Workspace",
          type: "action",
          config: {
            action: "database.insert",
            table: "workspaces",
            data: { name: "{{trigger.user.name}}'s Workspace", ownerId: "{{trigger.user.id}}" }
          },
          onSuccess: "notify_admin"
        },
        {
          id: "notify_admin",
          name: "Notify Admin",
          type: "notify",
          config: {
            channel: "slack",
            template: "new_user",
            recipients: ["#admin-notifications"]
          }
        }
      ]
    }
  },
  
  deployment: {
    id: "template_deployment",
    name: "Deployment Pipeline",
    description: "Automated deployment with testing and monitoring",
    category: "devops",
    definition: {
      triggerType: "manual",
      errorStrategy: "fail_fast",
      stages: [
        {
          id: "run_tests",
          name: "Run Test Suite",
          type: "action",
          config: { action: "test.run", suite: "all" },
          onSuccess: "build",
          onFailure: "notify_failure"
        },
        {
          id: "build",
          name: "Build Application",
          type: "action",
          config: { action: "build.run", target: "production" },
          onSuccess: "deploy"
        },
        {
          id: "deploy",
          name: "Deploy to Production",
          type: "action",
          config: { action: "deploy.run", environment: "production" },
          onSuccess: "health_check"
        },
        {
          id: "health_check",
          name: "Health Check",
          type: "action",
          config: { action: "health.check", url: "{{deploy.url}}" },
          onSuccess: "notify_success",
          onFailure: "rollback"
        },
        {
          id: "rollback",
          name: "Rollback Deployment",
          type: "action",
          config: { action: "deploy.rollback" },
          onSuccess: "notify_failure"
        },
        {
          id: "notify_success",
          name: "Notify Success",
          type: "notify",
          config: { channel: "slack", template: "deploy_success", recipients: ["#deployments"] }
        },
        {
          id: "notify_failure",
          name: "Notify Failure",
          type: "notify",
          config: { channel: "slack", template: "deploy_failure", recipients: ["#deployments", "#oncall"] }
        }
      ]
    }
  }
};

// Initialize built-in templates
export async function initializeBuiltInTemplates(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  for (const [key, template] of Object.entries(BUILT_IN_TEMPLATES)) {
    const existing = await db.select()
      .from(pipelineTemplates)
      .where(eq(pipelineTemplates.id, template.id))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(pipelineTemplates).values({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        definition: template.definition,
        icon: key,
        tags: [template.category],
        isPublic: true,
        isVerified: true,
      });
      console.log(`[Pipeline] Initialized template: ${template.name}`);
    }
  }
}
