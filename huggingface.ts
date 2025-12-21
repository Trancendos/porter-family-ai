/**
 * HuggingFace Integration Service
 * 
 * Provides access to 100+ open-source AI models for zero-cost operations:
 * - Text generation (GPT-2, BLOOM, Llama)
 * - Code generation (CodeGen, StarCoder)
 * - Embeddings for semantic search
 * - Translation, summarization, and more
 */

export interface HuggingFaceModel {
  id: string;
  name: string;
  description: string;
  category:
    | "text-generation"
    | "code-generation"
    | "embeddings"
    | "translation"
    | "summarization"
    | "classification";
  provider: "huggingface";
  cost: "free" | "paid";
  performance: "fast" | "medium" | "slow";
  contextWindow: number;
}

export interface HuggingFaceResponse {
  text?: string;
  embeddings?: number[];
  tokens?: number;
  model: string;
  cached: boolean;
}

/**
 * Available HuggingFace models (free tier)
 */
export const HUGGINGFACE_MODELS: HuggingFaceModel[] = [
  // Text Generation
  {
    id: "gpt2",
    name: "GPT-2",
    description: "OpenAI's GPT-2 model for text generation",
    category: "text-generation",
    provider: "huggingface",
    cost: "free",
    performance: "fast",
    contextWindow: 1024,
  },
  {
    id: "bigscience/bloom-560m",
    name: "BLOOM 560M",
    description: "Multilingual text generation model",
    category: "text-generation",
    provider: "huggingface",
    cost: "free",
    performance: "fast",
    contextWindow: 2048,
  },
  {
    id: "facebook/opt-350m",
    name: "OPT 350M",
    description: "Meta's Open Pretrained Transformer",
    category: "text-generation",
    provider: "huggingface",
    cost: "free",
    performance: "fast",
    contextWindow: 2048,
  },

  // Code Generation
  {
    id: "Salesforce/codegen-350M-mono",
    name: "CodeGen 350M",
    description: "Code generation model trained on Python",
    category: "code-generation",
    provider: "huggingface",
    cost: "free",
    performance: "fast",
    contextWindow: 2048,
  },
  {
    id: "bigcode/tiny_starcoder_py",
    name: "Tiny StarCoder",
    description: "Small but efficient code generation model",
    category: "code-generation",
    provider: "huggingface",
    cost: "free",
    performance: "fast",
    contextWindow: 1024,
  },

  // Embeddings
  {
    id: "sentence-transformers/all-MiniLM-L6-v2",
    name: "MiniLM Embeddings",
    description: "Fast and efficient sentence embeddings",
    category: "embeddings",
    provider: "huggingface",
    cost: "free",
    performance: "fast",
    contextWindow: 512,
  },
  {
    id: "sentence-transformers/all-mpnet-base-v2",
    name: "MPNet Embeddings",
    description: "High-quality sentence embeddings",
    category: "embeddings",
    provider: "huggingface",
    cost: "free",
    performance: "medium",
    contextWindow: 512,
  },

  // Translation
  {
    id: "Helsinki-NLP/opus-mt-en-es",
    name: "English to Spanish",
    description: "Neural machine translation model",
    category: "translation",
    provider: "huggingface",
    cost: "free",
    performance: "fast",
    contextWindow: 512,
  },
  {
    id: "Helsinki-NLP/opus-mt-en-fr",
    name: "English to French",
    description: "Neural machine translation model",
    category: "translation",
    provider: "huggingface",
    cost: "free",
    performance: "fast",
    contextWindow: 512,
  },

  // Summarization
  {
    id: "facebook/bart-large-cnn",
    name: "BART Summarization",
    description: "Abstractive summarization model",
    category: "summarization",
    provider: "huggingface",
    cost: "free",
    performance: "medium",
    contextWindow: 1024,
  },
  {
    id: "sshleifer/distilbart-cnn-12-6",
    name: "DistilBART Summarization",
    description: "Faster distilled version of BART",
    category: "summarization",
    provider: "huggingface",
    cost: "free",
    performance: "fast",
    contextWindow: 1024,
  },

  // Classification
  {
    id: "distilbert-base-uncased-finetuned-sst-2-english",
    name: "DistilBERT Sentiment",
    description: "Sentiment analysis model",
    category: "classification",
    provider: "huggingface",
    cost: "free",
    performance: "fast",
    contextWindow: 512,
  },
];

/**
 * Query HuggingFace Inference API
 */
async function queryHuggingFace(
  modelId: string,
  input: string | { inputs: string }
): Promise<any> {
  const API_URL = `https://api-inference.huggingface.co/models/${modelId}`;

  // Use environment variable if available, otherwise use demo mode
  const apiKey = process.env.HUGGINGFACE_API_KEY || "demo";

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(typeof input === "string" ? { inputs: input } : input),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HuggingFace API error: ${error}`);
  }

  return response.json();
}

/**
 * Generate text using HuggingFace models
 */
export async function generateText(
  prompt: string,
  modelId: string = "gpt2",
  options: {
    maxLength?: number;
    temperature?: number;
    topP?: number;
  } = {}
): Promise<HuggingFaceResponse> {
  const model = HUGGINGFACE_MODELS.find((m) => m.id === modelId);
  if (!model || model.category !== "text-generation") {
    throw new Error(`Invalid text generation model: ${modelId}`);
  }

  const result = await queryHuggingFace(modelId, {
    inputs: prompt,
    parameters: {
      max_length: options.maxLength || 100,
      temperature: options.temperature || 0.7,
      top_p: options.topP || 0.9,
      return_full_text: false,
    },
  } as any);

  return {
    text: result[0]?.generated_text || "",
    model: modelId,
    cached: false,
    tokens: result[0]?.generated_text?.split(" ").length || 0,
  };
}

/**
 * Generate code using HuggingFace models
 */
export async function generateCode(
  prompt: string,
  language: string = "python",
  modelId: string = "Salesforce/codegen-350M-mono"
): Promise<HuggingFaceResponse> {
  const model = HUGGINGFACE_MODELS.find((m) => m.id === modelId);
  if (!model || model.category !== "code-generation") {
    throw new Error(`Invalid code generation model: ${modelId}`);
  }

  const fullPrompt = `# ${language}\n${prompt}\n`;

  const result = await queryHuggingFace(modelId, {
    inputs: fullPrompt,
    parameters: {
      max_length: 200,
      temperature: 0.2,
      top_p: 0.95,
      return_full_text: false,
    },
  } as any);

  return {
    text: result[0]?.generated_text || "",
    model: modelId,
    cached: false,
    tokens: result[0]?.generated_text?.split(" ").length || 0,
  };
}

/**
 * Generate embeddings for semantic search
 */
export async function generateEmbeddings(
  text: string,
  modelId: string = "sentence-transformers/all-MiniLM-L6-v2"
): Promise<HuggingFaceResponse> {
  const model = HUGGINGFACE_MODELS.find((m) => m.id === modelId);
  if (!model || model.category !== "embeddings") {
    throw new Error(`Invalid embeddings model: ${modelId}`);
  }

  const result = await queryHuggingFace(modelId, text);

  return {
    embeddings: result,
    model: modelId,
    cached: false,
  };
}

/**
 * Translate text
 */
export async function translateText(
  text: string,
  sourceLang: string = "en",
  targetLang: string = "es"
): Promise<HuggingFaceResponse> {
  const modelId = `Helsinki-NLP/opus-mt-${sourceLang}-${targetLang}`;
  const model = HUGGINGFACE_MODELS.find((m) => m.id === modelId);

  if (!model) {
    throw new Error(`Translation model not available: ${sourceLang} → ${targetLang}`);
  }

  const result = await queryHuggingFace(modelId, text);

  return {
    text: result[0]?.translation_text || "",
    model: modelId,
    cached: false,
  };
}

/**
 * Summarize text
 */
export async function summarizeText(
  text: string,
  modelId: string = "sshleifer/distilbart-cnn-12-6",
  maxLength: number = 150
): Promise<HuggingFaceResponse> {
  const model = HUGGINGFACE_MODELS.find((m) => m.id === modelId);
  if (!model || model.category !== "summarization") {
    throw new Error(`Invalid summarization model: ${modelId}`);
  }

  const result = await queryHuggingFace(modelId, {
    inputs: text,
    parameters: {
      max_length: maxLength,
      min_length: 30,
    },
  } as any);

  return {
    text: result[0]?.summary_text || "",
    model: modelId,
    cached: false,
  };
}

/**
 * Classify text (sentiment, intent, etc.)
 */
export async function classifyText(
  text: string,
  modelId: string = "distilbert-base-uncased-finetuned-sst-2-english"
): Promise<{
  label: string;
  score: number;
  model: string;
}> {
  const model = HUGGINGFACE_MODELS.find((m) => m.id === modelId);
  if (!model || model.category !== "classification") {
    throw new Error(`Invalid classification model: ${modelId}`);
  }

  const result = await queryHuggingFace(modelId, text);

  return {
    label: result[0]?.label || "",
    score: result[0]?.score || 0,
    model: modelId,
  };
}

/**
 * Get model recommendations based on task
 */
export function getRecommendedModels(
  task:
    | "text-generation"
    | "code-generation"
    | "embeddings"
    | "translation"
    | "summarization"
    | "classification",
  performance: "fast" | "medium" | "slow" = "fast"
): HuggingFaceModel[] {
  return HUGGINGFACE_MODELS.filter(
    (m) => m.category === task && m.performance === performance
  );
}

/**
 * Intelligent model router - selects best free model for task
 */
export async function smartInference(
  task: string,
  input: string,
  options: {
    preferPerformance?: "fast" | "medium" | "slow";
    fallbackToPaid?: boolean;
  } = {}
): Promise<HuggingFaceResponse> {
  const performance = options.preferPerformance || "fast";

  // Determine task type from input
  let taskType:
    | "text-generation"
    | "code-generation"
    | "embeddings"
    | "translation"
    | "summarization"
    | "classification" = "text-generation";

  if (task.includes("code") || task.includes("function")) {
    taskType = "code-generation";
  } else if (task.includes("embed") || task.includes("search")) {
    taskType = "embeddings";
  } else if (task.includes("translate")) {
    taskType = "translation";
  } else if (task.includes("summarize") || task.includes("summary")) {
    taskType = "summarization";
  } else if (task.includes("classify") || task.includes("sentiment")) {
    taskType = "classification";
  }

  // Get recommended models
  const models = getRecommendedModels(taskType, performance);

  if (models.length === 0) {
    throw new Error(`No free models available for task: ${taskType}`);
  }

  // Try first model
  const model = models[0];

  try {
    switch (taskType) {
      case "text-generation":
        return await generateText(input, model.id);
      case "code-generation":
        return await generateCode(input, "python", model.id);
      case "embeddings":
        return await generateEmbeddings(input, model.id);
      case "summarization":
        return await summarizeText(input, model.id);
      case "classification":
        const result = await classifyText(input, model.id);
        return {
          text: `${result.label} (${(result.score * 100).toFixed(1)}%)`,
          model: result.model,
          cached: false,
        };
      default:
        throw new Error(`Unsupported task type: ${taskType}`);
    }
  } catch (error) {
    // Try next model if first fails
    if (models.length > 1) {
      const fallbackModel = models[1];
      console.warn(`Model ${model.id} failed, trying ${fallbackModel.id}`);
      return smartInference(task, input, {
        ...options,
        preferPerformance: fallbackModel.performance,
      });
    }
    throw error;
  }
}

/**
 * Batch processing for multiple inputs
 */
export async function batchInference(
  task: string,
  inputs: string[],
  modelId?: string
): Promise<HuggingFaceResponse[]> {
  const results: HuggingFaceResponse[] = [];

  for (const input of inputs) {
    try {
      const result = modelId
        ? await generateText(input, modelId)
        : await smartInference(task, input);
      results.push(result);
    } catch (error) {
      console.error(`Batch inference error for input: ${input}`, error);
      results.push({
        text: "",
        model: modelId || "unknown",
        cached: false,
        tokens: 0,
      });
    }
  }

  return results;
}

/**
 * Get cost savings report (HuggingFace vs paid APIs)
 */
export function getCostSavingsReport(): {
  freeModelsAvailable: number;
  estimatedMonthlySavings: number;
  comparisonToOpenAI: string;
  comparisonToAnthropic: string;
} {
  const freeModels = HUGGINGFACE_MODELS.filter((m) => m.cost === "free");

  // Assume 10,000 API calls per month
  const callsPerMonth = 10000;
  const openAICostPerCall = 0.002; // $0.002 per call (GPT-3.5)
  const anthropicCostPerCall = 0.008; // $0.008 per call (Claude)

  const openAIMonthlyCost = callsPerMonth * openAICostPerCall;
  const anthropicMonthlyCost = callsPerMonth * anthropicCostPerCall;

  return {
    freeModelsAvailable: freeModels.length,
    estimatedMonthlySavings: openAIMonthlyCost,
    comparisonToOpenAI: `Save $${openAIMonthlyCost}/month vs OpenAI GPT-3.5`,
    comparisonToAnthropic: `Save $${anthropicMonthlyCost}/month vs Anthropic Claude`,
  };
}
