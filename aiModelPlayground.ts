/**
 * AI Model Playground Service
 * Interactive testing interface for HuggingFace models
 */

import { generateText } from './huggingface';

export interface PlaygroundTest {
  id: string;
  modelId: string;
  modelName: string;
  prompt: string;
  parameters: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
  };
  result?: string;
  executionTime?: number;
  tokenCount?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
}

export interface ModelComparison {
  id: string;
  prompt: string;
  models: string[];
  results: Array<{
    modelId: string;
    modelName: string;
    result: string;
    executionTime: number;
    tokenCount: number;
  }>;
  createdAt: Date;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'code' | 'text' | 'creative' | 'analysis' | 'translation';
  template: string;
  variables: string[];
  recommendedModels: string[];
}

class AIModelPlaygroundService {
  private testHistory: PlaygroundTest[] = [];
  private comparisonHistory: ModelComparison[] = [];

  /**
   * Pre-built prompt templates
   */
  private promptTemplates: PromptTemplate[] = [
    {
      id: 'code-function',
      name: 'Generate Function',
      description: 'Generate a function based on description',
      category: 'code',
      template: 'Write a {{language}} function that {{description}}. Include comments and error handling.',
      variables: ['language', 'description'],
      recommendedModels: ['codegen', 'starcoder', 'gpt2'],
    },
    {
      id: 'code-review',
      name: 'Code Review',
      description: 'Review code for improvements',
      category: 'code',
      template: 'Review this {{language}} code and suggest improvements:\n\n{{code}}',
      variables: ['language', 'code'],
      recommendedModels: ['codegen', 'starcoder'],
    },
    {
      id: 'text-summarize',
      name: 'Summarize Text',
      description: 'Summarize long text into key points',
      category: 'text',
      template: 'Summarize the following text in {{length}} sentences:\n\n{{text}}',
      variables: ['length', 'text'],
      recommendedModels: ['bloom', 'gpt2'],
    },
    {
      id: 'creative-story',
      name: 'Write Story',
      description: 'Generate creative story',
      category: 'creative',
      template: 'Write a {{genre}} story about {{topic}}. Make it {{tone}} and approximately {{length}} words.',
      variables: ['genre', 'topic', 'tone', 'length'],
      recommendedModels: ['bloom', 'gpt2', 'opt'],
    },
    {
      id: 'analysis-sentiment',
      name: 'Sentiment Analysis',
      description: 'Analyze sentiment of text',
      category: 'analysis',
      template: 'Analyze the sentiment of this text and explain why:\n\n{{text}}',
      variables: ['text'],
      recommendedModels: ['bloom', 'gpt2'],
    },
    {
      id: 'translation',
      name: 'Translate Text',
      description: 'Translate between languages',
      category: 'translation',
      template: 'Translate this text from {{sourceLanguage}} to {{targetLanguage}}:\n\n{{text}}',
      variables: ['sourceLanguage', 'targetLanguage', 'text'],
      recommendedModels: ['bloom'],
    },
  ];

  /**
   * Run a single model test
   */
  async runTest(
    modelId: string,
    prompt: string,
    parameters: PlaygroundTest['parameters'] = {}
  ): Promise<PlaygroundTest> {
    const testId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const test: PlaygroundTest = {
      id: testId,
      modelId,
      modelName: this.getModelName(modelId),
      prompt,
      parameters,
      status: 'pending',
      createdAt: new Date(),
    };

    this.testHistory.unshift(test);
    if (this.testHistory.length > 100) {
      this.testHistory.pop();
    }

    try {
      test.status = 'running';
      const startTime = Date.now();

      const response = await generateText(prompt, modelId, {
        maxLength: parameters.maxTokens || 100,
        temperature: parameters.temperature || 0.7,
      });
      const result = response.text || '';

      test.executionTime = Date.now() - startTime;
      test.result = result;
      test.tokenCount = this.estimateTokens(result);
      test.status = 'completed';
    } catch (error) {
      test.status = 'failed';
      test.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return test;
  }

  /**
   * Compare multiple models with same prompt
   */
  async compareModels(
    prompt: string,
    modelIds: string[],
    parameters: PlaygroundTest['parameters'] = {}
  ): Promise<ModelComparison> {
    const comparisonId = `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const comparison: ModelComparison = {
      id: comparisonId,
      prompt,
      models: modelIds,
      results: [],
      createdAt: new Date(),
    };

    // Run tests in parallel
    const tests = await Promise.allSettled(
      modelIds.map((modelId) => this.runTest(modelId, prompt, parameters))
    );

    // Collect results
    tests.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.status === 'completed') {
        comparison.results.push({
          modelId: modelIds[index],
          modelName: result.value.modelName,
          result: result.value.result || '',
          executionTime: result.value.executionTime || 0,
          tokenCount: result.value.tokenCount || 0,
        });
      }
    });

    this.comparisonHistory.unshift(comparison);
    if (this.comparisonHistory.length > 50) {
      this.comparisonHistory.pop();
    }

    return comparison;
  }

  /**
   * Get prompt templates
   */
  getPromptTemplates(category?: string): PromptTemplate[] {
    if (category) {
      return this.promptTemplates.filter((t) => t.category === category);
    }
    return this.promptTemplates;
  }

  /**
   * Apply template with variables
   */
  applyTemplate(templateId: string, variables: Record<string, string>): string {
    const template = this.promptTemplates.find((t) => t.id === templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    let prompt = template.template;
    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return prompt;
  }

  /**
   * Get test history
   */
  getTestHistory(limit: number = 20): PlaygroundTest[] {
    return this.testHistory.slice(0, limit);
  }

  /**
   * Get comparison history
   */
  getComparisonHistory(limit: number = 10): ModelComparison[] {
    return this.comparisonHistory.slice(0, limit);
  }

  /**
   * Export test results
   */
  exportResults(testIds: string[]): string {
    const tests = this.testHistory.filter((t) => testIds.includes(t.id));
    return JSON.stringify(tests, null, 2);
  }

  /**
   * Helper: Get model display name
   */
  private getModelName(modelId: string): string {
    const names: Record<string, string> = {
      'gpt2': 'GPT-2',
      'bloom': 'BLOOM',
      'opt': 'OPT',
      'codegen': 'CodeGen',
      'starcoder': 'StarCoder',
    };
    return names[modelId] || modelId;
  }

  /**
   * Helper: Estimate token count
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

// Singleton instance
export const aiModelPlaygroundService = new AIModelPlaygroundService();
