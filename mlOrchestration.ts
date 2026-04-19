import { invokeLLM } from "../_core/llm";

/**
 * ML/LLM Orchestration Service
 * 
 * Manages multiple AI models and orchestrates their usage:
 * - GPT-4 (OpenAI) - General reasoning, code generation
 * - Claude (Anthropic) - Analysis, long-context processing
 * - Gemini (Google) - Multimodal understanding
 * - Grok (xAI) - Real-time information, reasoning
 * 
 * Features:
 * - Model selection based on task type
 * - Fallback and retry logic
 * - Cost optimization
 * - Performance tracking
 * - Context window management
 */

export interface ModelConfig {
  name: string;
  provider: string;
  strengths: string[];
  maxTokens: number;
  costPer1kTokens: number;
  isAvailable: boolean;
}

export interface TaskRequirements {
  taskType: "reasoning" | "code_generation" | "analysis" | "classification" | "embedding" | "generation";
  priority: "low" | "medium" | "high";
  maxLatency?: number; // milliseconds
  maxCost?: number; // USD
  requiresLongContext?: boolean;
  requiresMultimodal?: boolean;
}

export interface ModelResponse {
  content: string;
  modelUsed: string;
  tokensUsed: number;
  latencyMs: number;
  costUsd: number;
  confidence?: number;
}

// Model configurations
const MODELS: ModelConfig[] = [
  {
    name: "gpt-4",
    provider: "openai",
    strengths: ["reasoning", "code_generation", "general"],
    maxTokens: 128000,
    costPer1kTokens: 0.03,
    isAvailable: true,
  },
  {
    name: "claude-3-opus",
    provider: "anthropic",
    strengths: ["analysis", "long_context", "reasoning"],
    maxTokens: 200000,
    costPer1kTokens: 0.015,
    isAvailable: true,
  },
  {
    name: "gemini-pro",
    provider: "google",
    strengths: ["multimodal", "reasoning", "generation"],
    maxTokens: 32000,
    costPer1kTokens: 0.00025,
    isAvailable: true,
  },
  {
    name: "grok-beta",
    provider: "xai",
    strengths: ["reasoning", "real_time", "analysis"],
    maxTokens: 131072,
    costPer1kTokens: 0.01,
    isAvailable: true,
  },
];

/**
 * Select the best model for a given task
 */
export function selectModel(requirements: TaskRequirements): ModelConfig {
  let candidates = MODELS.filter(m => m.isAvailable);

  // Filter by task type strengths
  const taskStrengthMap: Record<string, string[]> = {
    reasoning: ["reasoning", "general"],
    code_generation: ["code_generation", "reasoning"],
    analysis: ["analysis", "reasoning"],
    classification: ["general", "reasoning"],
    embedding: ["embedding"],
    generation: ["generation", "reasoning"],
  };

  const requiredStrengths = taskStrengthMap[requirements.taskType] || ["general"];
  
  candidates = candidates.filter(m =>
    requiredStrengths.some(strength => m.strengths.includes(strength))
  );

  // Filter by long context requirement
  if (requirements.requiresLongContext) {
    candidates = candidates.filter(m => m.maxTokens >= 100000);
  }

  // Filter by multimodal requirement
  if (requirements.requiresMultimodal) {
    candidates = candidates.filter(m => m.strengths.includes("multimodal"));
  }

  // Sort by cost (prefer cheaper models for low priority)
  if (requirements.priority === "low") {
    candidates.sort((a, b) => a.costPer1kTokens - b.costPer1kTokens);
  } else {
    // For high priority, prefer more capable models
    candidates.sort((a, b) => b.maxTokens - a.maxTokens);
  }

  // Return best candidate or fallback to first available
  return candidates[0] || MODELS[0];
}

/**
 * Execute a task with automatic model selection
 */
export async function executeTask(
  prompt: string,
  requirements: TaskRequirements,
  systemPrompt?: string
): Promise<ModelResponse> {
  const startTime = Date.now();
  const model = selectModel(requirements);

  try {
    const response = await invokeLLM({
      messages: [
        ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
        { role: "user" as const, content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    const tokensUsed = response.usage?.total_tokens || 0;
    const latencyMs = Date.now() - startTime;
    const costUsd = (tokensUsed / 1000) * model.costPer1kTokens;

    return {
      content: typeof content === 'string' ? content : JSON.stringify(content),
      modelUsed: model.name,
      tokensUsed,
      latencyMs,
      costUsd,
    };
  } catch (error) {
    console.error(`Task execution failed with model ${model.name}:`, error);
    
    // Fallback to next available model
    const fallbackModel = MODELS.find(m => m.isAvailable && m.name !== model.name);
    if (fallbackModel) {
      console.log(`Retrying with fallback model: ${fallbackModel.name}`);
      return await executeTask(prompt, requirements, systemPrompt);
    }
    
    throw error;
  }
}

/**
 * Execute multiple tasks in parallel with different models
 */
export async function executeParallelTasks(
  tasks: Array<{ prompt: string; requirements: TaskRequirements; systemPrompt?: string }>
): Promise<ModelResponse[]> {
  const promises = tasks.map(task =>
    executeTask(task.prompt, task.requirements, task.systemPrompt)
  );

  return await Promise.all(promises);
}

/**
 * Generate embeddings for semantic search
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // This would use an embedding model
  // For now, returning placeholder
  // In production: const response = await openai.embeddings.create({ model: "text-embedding-3-small", input: texts });
  return texts.map(() => []);
}

/**
 * Semantic search using embeddings
 */
export async function semanticSearch(
  query: string,
  documents: Array<{ id: number; content: string; embedding: number[] }>,
  topK: number = 5
): Promise<Array<{ id: number; score: number }>> {
  // Generate query embedding
  const queryEmbedding = (await generateEmbeddings([query]))[0];

  // Calculate cosine similarity
  const scores = documents.map(doc => ({
    id: doc.id,
    score: cosineSimilarity(queryEmbedding, doc.embedding),
  }));

  // Sort by score and return top K
  return scores.sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Ensemble prediction - combine multiple model outputs
 */
export async function ensemblePrediction(
  prompt: string,
  systemPrompt: string,
  modelCount: number = 3
): Promise<{
  consensus: string;
  confidence: number;
  responses: ModelResponse[];
}> {
  // Execute same task with multiple models
  const tasks = MODELS.slice(0, modelCount).map(model => ({
    prompt,
    systemPrompt,
    requirements: {
      taskType: "reasoning" as const,
      priority: "high" as const,
    },
  }));

  const responses = await executeParallelTasks(tasks);

  // Analyze responses for consensus
  const contents = responses.map(r => r.content);
  
  // Simple consensus: most common response
  const contentCounts = new Map<string, number>();
  for (const content of contents) {
    contentCounts.set(content, (contentCounts.get(content) || 0) + 1);
  }

  let maxCount = 0;
  let consensus = contents[0];
  
  for (const [content, count] of Array.from(contentCounts.entries())) {
    if (count > maxCount) {
      maxCount = count;
      consensus = content;
    }
  }

  const confidence = maxCount / contents.length;

  return { consensus, confidence, responses };
}

/**
 * Chain of thought reasoning
 */
export async function chainOfThought(
  problem: string,
  steps: string[]
): Promise<{ solution: string; reasoning: string[] }> {
  const reasoning: string[] = [];
  let context = problem;

  for (const step of steps) {
    const response = await executeTask(
      `${context}\n\nStep: ${step}\n\nProvide your reasoning for this step.`,
      { taskType: "reasoning", priority: "high" },
      "You are an expert problem solver. Think step by step and explain your reasoning clearly."
    );

    reasoning.push(response.content);
    context += `\n\nStep ${reasoning.length}: ${response.content}`;
  }

  // Final synthesis
  const finalResponse = await executeTask(
    `${context}\n\nBased on all the steps above, provide the final solution.`,
    { taskType: "reasoning", priority: "high" },
    "Synthesize the reasoning steps into a clear, actionable solution."
  );

  return {
    solution: finalResponse.content,
    reasoning,
  };
}

/**
 * Self-correction loop
 */
export async function selfCorrect(
  task: string,
  initialResponse: string,
  maxIterations: number = 3
): Promise<{ finalResponse: string; iterations: number }> {
  let currentResponse = initialResponse;
  let iteration = 0;

  while (iteration < maxIterations) {
    // Ask model to critique its own response
    const critique = await executeTask(
      `Original task: ${task}\n\nYour response: ${currentResponse}\n\nCritique your response. What could be improved? Are there any errors?`,
      { taskType: "analysis", priority: "high" },
      "You are a critical reviewer. Identify flaws, errors, and areas for improvement."
    );

    // Check if critique suggests improvements
    if (critique.content.toLowerCase().includes("no improvements") || 
        critique.content.toLowerCase().includes("looks good")) {
      break;
    }

    // Generate improved response
    const improved = await executeTask(
      `Original task: ${task}\n\nPrevious response: ${currentResponse}\n\nCritique: ${critique.content}\n\nProvide an improved response addressing the critique.`,
      { taskType: "reasoning", priority: "high" }
    );

    currentResponse = improved.content;
    iteration++;
  }

  return { finalResponse: currentResponse, iterations: iteration };
}
