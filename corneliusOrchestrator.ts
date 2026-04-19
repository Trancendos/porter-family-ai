import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { agentRegistry, agentTasks, type InsertAgentTask } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Cornelius Orchestrator Service
 * 
 * The central nervous system of the Trancendos Agentic Framework.
 * Analyzes user requests, routes tasks to appropriate agents, and synthesizes results.
 */

// Intent keywords for routing
const INTENT_KEYWORDS = {
  code_generation: ['implement', 'build', 'create app', 'develop', 'program', 'function', 'class', 'api', 'write code', 'generate code'],
  security_audit: ['security', 'vulnerability', 'owasp', 'threat', 'penetration test', 'audit security', 'sql injection', 'xss', 'csrf', 'check for vulnerabilities', 'security scan'],
  dependency_validation: ['dependency', 'package', 'npm', 'library', 'malicious', 'license'],
  compliance: ['compliance', 'gdpr', 'soc 2', 'iso 27001', 'regulation', 'governance'],
  legal: ['contract', 'legal', 'terms', 'agreement', 'liability'],
  patent: ['patent', 'ip', 'intellectual property', 'prior art', 'trademark'],
  deployment: ['deploy', 'kubernetes', 'docker', 'ci/cd', 'infrastructure'],
  financial: ['cost', 'budget', 'expense', 'revenue', 'profit'],
  trading: ['trade', 'market', 'stock', 'investment', 'portfolio'],
  knowledge: ['documentation', 'explain', 'what is', 'how to', 'search', 'find'],
};

// Agent routing map
const AGENT_ROUTING = {
  code_generation: 'The Dr',
  security_audit: 'The Guardian',
  dependency_validation: 'CARL',
  compliance: 'The Senator',
  legal: 'Justitia',
  patent: 'Patent Clerk',
  deployment: 'Prometheus',
  financial: 'Doris',
  trading: 'Mercury',
  knowledge: 'CARL',
  code_review: 'The Auditor',
  framework_compliance: 'The Auditor',
};

interface IntentAnalysisResult {
  intent: string;
  confidence: number;
  suggestedAgent: string;
  reasoning: string;
}

interface TaskDelegationResult {
  taskId: number;
  agentName: string;
  status: string;
}

interface OrchestrationResult {
  success: boolean;
  intent: string;
  delegatedTo: string[];
  tasks: TaskDelegationResult[];
  synthesizedResponse?: string;
  error?: string;
}

/**
 * Analyze user intent using keyword detection + LLM classification
 */
export async function analyzeIntent(userPrompt: string): Promise<IntentAnalysisResult> {
  const lowerPrompt = userPrompt.toLowerCase();
  
  // Keyword-based detection (fast path)
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword)) {
        const suggestedAgent = AGENT_ROUTING[intent as keyof typeof AGENT_ROUTING] || 'Cornelius';
        return {
          intent,
          confidence: 0.8,
          suggestedAgent,
          reasoning: `Keyword match: "${keyword}" → ${intent}`
        };
      }
    }
  }
  
  // LLM-based classification (fallback for complex/ambiguous requests)
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are Cornelius, the Chief Orchestration Officer. Analyze the user's request and classify it into one of these intents:
- code_generation: Writing code, implementing features
- security_audit: Security testing, vulnerability scanning
- dependency_validation: Package validation, dependency checks
- compliance: Regulatory compliance, governance
- legal: Legal analysis, contracts
- patent: Patent analysis, IP compliance
- deployment: Deployment, DevOps, infrastructure
- financial: Budget, costs, expenses
- trading: Market trading, investments
- knowledge: Documentation, explanations, search
- code_review: Code quality review
- framework_compliance: Framework adherence validation

Respond in JSON format:
{
  "intent": "code_generation",
  "confidence": 0.95,
  "suggestedAgent": "The Dr",
  "reasoning": "User wants to build a feature"
}`
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'intent_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              intent: { type: 'string' },
              confidence: { type: 'number' },
              suggestedAgent: { type: 'string' },
              reasoning: { type: 'string' }
            },
            required: ['intent', 'confidence', 'suggestedAgent', 'reasoning'],
            additionalProperties: false
          }
        }
      }
    });
    
    const content = response.choices[0].message.content;
    const contentStr = typeof content === 'string' ? content : '';
    const result = JSON.parse(contentStr || '{}');
    return result as IntentAnalysisResult;
  } catch (error) {
    console.error('[Cornelius] LLM intent analysis failed:', error);
    // Default to knowledge query
    return {
      intent: 'knowledge',
      confidence: 0.5,
      suggestedAgent: 'CARL',
      reasoning: 'Fallback to knowledge query due to classification error'
    };
  }
}

/**
 * Delegate task to appropriate agent
 */
export async function delegateTask(
  agentName: string,
  taskType: string,
  taskDescription: string,
  taskInput: any,
  priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): Promise<TaskDelegationResult> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  // Get agent ID
  const [agent] = await db
    .select()
    .from(agentRegistry)
    .where(eq(agentRegistry.agentName, agentName))
    .limit(1);
  
  if (!agent) {
    throw new Error(`Agent ${agentName} not found`);
  }
  
  // Create task
  const newTask: InsertAgentTask = {
    agentId: agent.id,
    taskType,
    taskDescription,
    taskInput: JSON.stringify(taskInput),
    status: 'pending',
    priority,
    assignedBy: 'Cornelius',
    metadata: JSON.stringify({
      assignedAt: new Date().toISOString(),
      expectedDuration: 'unknown'
    })
  };
  
  const [result] = await db.insert(agentTasks).values(newTask);
  
  return {
    taskId: result.insertId,
    agentName,
    status: 'pending'
  };
}

/**
 * Main orchestration function
 * Analyzes intent, routes to agents, and synthesizes results
 */
export async function orchestrate(userPrompt: string): Promise<OrchestrationResult> {
  try {
    // Step 1: Analyze intent
    const intentAnalysis = await analyzeIntent(userPrompt);
    
    // Step 2: Route to appropriate agent(s)
    const tasks: TaskDelegationResult[] = [];
    
    // For now, delegate to single agent (future: multi-agent collaboration)
    const task = await delegateTask(
      intentAnalysis.suggestedAgent,
      intentAnalysis.intent,
      userPrompt,
      { originalPrompt: userPrompt, intentAnalysis },
      'medium'
    );
    
    tasks.push(task);
    
    // Step 3: Synthesize response (for now, just acknowledge delegation)
    const synthesizedResponse = `I've analyzed your request and delegated it to **${intentAnalysis.suggestedAgent}** (${intentAnalysis.intent}).

**Reasoning**: ${intentAnalysis.reasoning}
**Confidence**: ${(intentAnalysis.confidence * 100).toFixed(0)}%
**Task ID**: #${task.taskId}

The agent will process your request shortly.`;
    
    return {
      success: true,
      intent: intentAnalysis.intent,
      delegatedTo: [intentAnalysis.suggestedAgent],
      tasks,
      synthesizedResponse
    };
  } catch (error) {
    console.error('[Cornelius] Orchestration failed:', error);
    return {
      success: false,
      intent: 'unknown',
      delegatedTo: [],
      tasks: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get agent status
 */
export async function getAgentStatus(agentName?: string) {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  if (agentName) {
    const [agent] = await db
      .select()
      .from(agentRegistry)
      .where(eq(agentRegistry.agentName, agentName))
      .limit(1);
    return agent;
  }
  
  // Get all agents
  const agents = await db.select().from(agentRegistry);
  return agents;
}

/**
 * Get task status
 */
export async function getTaskStatus(taskId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  const [task] = await db
    .select()
    .from(agentTasks)
    .where(eq(agentTasks.id, taskId))
    .limit(1);
  
  return task;
}

/**
 * Get all tasks for an agent
 */
export async function getAgentTasks(agentName: string, limit: number = 100) {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  // Get agent ID
  const [agent] = await db
    .select()
    .from(agentRegistry)
    .where(eq(agentRegistry.agentName, agentName))
    .limit(1);
  
  if (!agent) {
    throw new Error(`Agent ${agentName} not found`);
  }
  
  // Get tasks
  const tasks = await db
    .select()
    .from(agentTasks)
    .where(eq(agentTasks.agentId, agent.id))
    .limit(limit);
  
  return tasks;
}
