/**
 * The Workshop AI Agent (DPID-ADM-AI-019)
 * 
 * Master craftsman AI specializing in Git operations, code quality,
 * deployment automation, and CI/CD orchestration.
 * 
 * Personality: Meticulous, detail-oriented, efficiency-focused, craftsman-like
 */

import { invokeLLM } from "../_core/llm";

export interface WorkshopAIContext {
  operation: string;
  repository?: {
    name: string;
    language?: string;
    framework?: string;
  };
  code?: string;
  diff?: string;
  branch?: string;
  commit?: string;
  error?: string;
}

export interface WorkshopAIResponse {
  success: boolean;
  message: string;
  recommendations?: string[];
  autoFixAvailable?: boolean;
  autoFixCode?: string;
  confidence?: number;
  reasoning?: string;
}

const WORKSHOP_SYSTEM_PROMPT = `You are The Workshop AI, a master craftsman specializing in software development operations. Your expertise includes:

**Core Competencies:**
- Git operations and version control best practices
- Code quality analysis and improvement suggestions
- Security vulnerability detection and remediation
- Performance optimization recommendations
- Deployment strategy and orchestration
- CI/CD pipeline design and troubleshooting
- Merge conflict resolution
- Code review and best practices enforcement

**Personality Traits:**
- Meticulous and detail-oriented
- Efficiency-focused and pragmatic
- Clear and concise communication
- Craftsman-like pride in quality
- Patient teacher when explaining concepts
- Proactive in suggesting improvements

**Response Guidelines:**
1. Always provide actionable recommendations
2. Explain the "why" behind suggestions
3. Prioritize security and reliability
4. Consider performance implications
5. Follow industry best practices
6. Be specific with examples and code snippets
7. Indicate confidence level in recommendations
8. Offer automated fixes when possible

**Output Format:**
Respond in JSON format with:
- success: boolean
- message: string (main response)
- recommendations: string[] (actionable items)
- autoFixAvailable: boolean
- autoFixCode: string (if applicable)
- confidence: number (0-100)
- reasoning: string (explanation)`;

/**
 * Analyze code quality and provide recommendations
 */
export async function analyzeCodeQuality(context: WorkshopAIContext): Promise<WorkshopAIResponse> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: WORKSHOP_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Analyze the following code for quality, security, and performance issues:

Repository: ${context.repository?.name || "Unknown"}
Language: ${context.repository?.language || "Unknown"}
Framework: ${context.repository?.framework || "Unknown"}

Code:
\`\`\`
${context.code || "No code provided"}
\`\`\`

Provide a comprehensive analysis with specific recommendations.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "code_quality_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            recommendations: {
              type: "array",
              items: { type: "string" },
            },
            autoFixAvailable: { type: "boolean" },
            autoFixCode: { type: "string" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
          },
          required: ["success", "message", "recommendations", "autoFixAvailable", "confidence", "reasoning"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  return JSON.parse(contentStr || "{}");
}

/**
 * Review code changes (diff) for a pull request
 */
export async function reviewCodeChanges(context: WorkshopAIContext): Promise<WorkshopAIResponse> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: WORKSHOP_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Review the following code changes for a pull request:

Repository: ${context.repository?.name || "Unknown"}
Branch: ${context.branch || "Unknown"}

Diff:
\`\`\`diff
${context.diff || "No diff provided"}
\`\`\`

Provide a thorough code review with focus on:
1. Code quality and maintainability
2. Security vulnerabilities
3. Performance implications
4. Best practices adherence
5. Potential bugs or edge cases`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "code_review",
        strict: true,
        schema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            recommendations: {
              type: "array",
              items: { type: "string" },
            },
            autoFixAvailable: { type: "boolean" },
            autoFixCode: { type: "string" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
          },
          required: ["success", "message", "recommendations", "autoFixAvailable", "confidence", "reasoning"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  return JSON.parse(contentStr || "{}");
}

/**
 * Suggest deployment strategy based on repository characteristics
 */
export async function suggestDeploymentStrategy(context: WorkshopAIContext): Promise<WorkshopAIResponse> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: WORKSHOP_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Suggest an optimal deployment strategy for this repository:

Repository: ${context.repository?.name || "Unknown"}
Language: ${context.repository?.language || "Unknown"}
Framework: ${context.repository?.framework || "Unknown"}

Consider:
1. Best hosting platform (Vercel, Netlify, Render, Railway, Cloudflare, etc.)
2. Build and deployment configuration
3. Environment variables needed
4. CI/CD pipeline setup
5. Rollback strategy
6. Monitoring and logging

Provide specific, actionable recommendations.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "deployment_strategy",
        strict: true,
        schema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            recommendations: {
              type: "array",
              items: { type: "string" },
            },
            autoFixAvailable: { type: "boolean" },
            autoFixCode: { type: "string" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
          },
          required: ["success", "message", "recommendations", "autoFixAvailable", "confidence", "reasoning"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  return JSON.parse(contentStr || "{}");
}

/**
 * Resolve merge conflicts with AI assistance
 */
export async function resolveMergeConflict(context: WorkshopAIContext): Promise<WorkshopAIResponse> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: WORKSHOP_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Help resolve this merge conflict:

Repository: ${context.repository?.name || "Unknown"}
Branch: ${context.branch || "Unknown"}

Conflict:
\`\`\`
${context.diff || "No conflict provided"}
\`\`\`

Analyze both sides of the conflict and suggest the best resolution.
If possible, provide the resolved code.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "merge_conflict_resolution",
        strict: true,
        schema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            recommendations: {
              type: "array",
              items: { type: "string" },
            },
            autoFixAvailable: { type: "boolean" },
            autoFixCode: { type: "string" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
          },
          required: ["success", "message", "recommendations", "autoFixAvailable", "confidence", "reasoning"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  return JSON.parse(contentStr || "{}");
}

/**
 * Troubleshoot CI/CD pipeline failures
 */
export async function troubleshootPipelineFailure(context: WorkshopAIContext): Promise<WorkshopAIResponse> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: WORKSHOP_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Troubleshoot this CI/CD pipeline failure:

Repository: ${context.repository?.name || "Unknown"}
Operation: ${context.operation}

Error:
\`\`\`
${context.error || "No error provided"}
\`\`\`

Analyze the error and provide:
1. Root cause analysis
2. Step-by-step fix instructions
3. Prevention strategies
4. Related best practices`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "pipeline_troubleshooting",
        strict: true,
        schema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            recommendations: {
              type: "array",
              items: { type: "string" },
            },
            autoFixAvailable: { type: "boolean" },
            autoFixCode: { type: "string" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
          },
          required: ["success", "message", "recommendations", "autoFixAvailable", "confidence", "reasoning"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  return JSON.parse(contentStr || "{}");
}

/**
 * Generate release notes from commits
 */
export async function generateReleaseNotes(context: WorkshopAIContext): Promise<WorkshopAIResponse> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: WORKSHOP_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Generate release notes for this version:

Repository: ${context.repository?.name || "Unknown"}
Commit: ${context.commit || "Unknown"}

Diff:
\`\`\`
${context.diff || "No diff provided"}
\`\`\`

Create comprehensive release notes including:
1. New features
2. Bug fixes
3. Breaking changes
4. Performance improvements
5. Security updates

Format in markdown.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "release_notes",
        strict: true,
        schema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            recommendations: {
              type: "array",
              items: { type: "string" },
            },
            autoFixAvailable: { type: "boolean" },
            autoFixCode: { type: "string" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
          },
          required: ["success", "message", "recommendations", "autoFixAvailable", "confidence", "reasoning"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  return JSON.parse(contentStr || "{}");
}

/**
 * Suggest branch strategy for repository
 */
export async function suggestBranchStrategy(context: WorkshopAIContext): Promise<WorkshopAIResponse> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: WORKSHOP_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Suggest an optimal branch strategy for this repository:

Repository: ${context.repository?.name || "Unknown"}
Language: ${context.repository?.language || "Unknown"}
Framework: ${context.repository?.framework || "Unknown"}

Consider team size, release frequency, and project complexity.
Suggest one of: GitFlow, GitHub Flow, Trunk-Based Development, or custom strategy.

Provide:
1. Recommended strategy and why
2. Branch naming conventions
3. Protection rules
4. Merge strategies
5. Release process`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "branch_strategy",
        strict: true,
        schema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            recommendations: {
              type: "array",
              items: { type: "string" },
            },
            autoFixAvailable: { type: "boolean" },
            autoFixCode: { type: "string" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
          },
          required: ["success", "message", "recommendations", "autoFixAvailable", "confidence", "reasoning"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  return JSON.parse(contentStr || "{}");
}

/**
 * General Workshop AI consultation
 */
export async function consultWorkshopAI(context: WorkshopAIContext): Promise<WorkshopAIResponse> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: WORKSHOP_SYSTEM_PROMPT },
      {
        role: "user",
        content: `${context.operation}

Repository: ${context.repository?.name || "Unknown"}
${context.code ? `\nCode:\n\`\`\`\n${context.code}\n\`\`\`` : ""}
${context.diff ? `\nDiff:\n\`\`\`\n${context.diff}\n\`\`\`` : ""}
${context.error ? `\nError:\n\`\`\`\n${context.error}\n\`\`\`` : ""}

Provide expert guidance and recommendations.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "workshop_consultation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            recommendations: {
              type: "array",
              items: { type: "string" },
            },
            autoFixAvailable: { type: "boolean" },
            autoFixCode: { type: "string" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
          },
          required: ["success", "message", "recommendations", "autoFixAvailable", "confidence", "reasoning"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  return JSON.parse(contentStr || "{}");
}
