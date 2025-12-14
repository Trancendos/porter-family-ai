/**
 * Project Intelligence Service
 * 
 * AI-powered features for Project Kickoff Dashboard:
 * - Cornelius: Phase completion prediction
 * - The Dr: Success criteria validation
 * - Norman: Smart command suggestions
 */

import { invokeLLM } from "../_core/llm";

/**
 * Cornelius: Predict phase completion percentage and timeline
 */
export async function predictPhaseCompletion(phaseData: {
  phaseNumber: number;
  title: string;
  startWeek: number;
  endWeek: number;
  completedTasks: number;
  totalTasks: number;
  currentWeek: number;
}) {
  const prompt = `You are Cornelius MacIntyre, the AI Orchestrator. Analyze this project phase and predict completion:

Phase ${phaseData.phaseNumber}: ${phaseData.title}
Timeline: Week ${phaseData.startWeek} to ${phaseData.endWeek} (currently week ${phaseData.currentWeek})
Progress: ${phaseData.completedTasks}/${phaseData.totalTasks} tasks completed

Provide a JSON response with:
{
  "completionPercentage": number (0-100),
  "predictedCompletionWeek": number,
  "confidence": "high" | "medium" | "low",
  "risks": string[],
  "recommendations": string[],
  "reasoning": string
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are Cornelius MacIntyre, an expert AI orchestrator and project manager. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "phase_prediction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              completionPercentage: { type: "number", description: "Predicted completion percentage (0-100)" },
              predictedCompletionWeek: { type: "number", description: "Week number when phase will complete" },
              confidence: { type: "string", enum: ["high", "medium", "low"], description: "Confidence level" },
              risks: { type: "array", items: { type: "string" }, description: "Identified risks" },
              recommendations: { type: "array", items: { type: "string" }, description: "Actionable recommendations" },
              reasoning: { type: "string", description: "Explanation of the prediction" }
            },
            required: ["completionPercentage", "predictedCompletionWeek", "confidence", "risks", "recommendations", "reasoning"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from Cornelius");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("[Cornelius] Phase prediction error:", error);
    return {
      completionPercentage: Math.round((phaseData.completedTasks / phaseData.totalTasks) * 100),
      predictedCompletionWeek: phaseData.endWeek,
      confidence: "low",
      risks: ["Unable to perform AI analysis"],
      recommendations: ["Continue monitoring progress manually"],
      reasoning: "AI analysis unavailable, using basic calculation"
    };
  }
}

/**
 * The Dr: Validate success criteria for a phase/week
 */
export async function validateSuccessCriteria(criteria: {
  phaseNumber: number;
  weekNumber: number;
  successCriteria: string[];
  completedTasks: string[];
  evidence: string[];
}) {
  const prompt = `You are The Dr, an expert in code quality and validation. Review these success criteria:

Phase ${criteria.phaseNumber}, Week ${criteria.weekNumber}

Success Criteria:
${criteria.successCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Completed Tasks:
${criteria.completedTasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Evidence:
${criteria.evidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Provide a JSON response with:
{
  "overallStatus": "pass" | "partial" | "fail",
  "criteriaResults": [
    {
      "criterion": string,
      "status": "pass" | "partial" | "fail",
      "evidence": string,
      "gaps": string[]
    }
  ],
  "recommendations": string[],
  "nextSteps": string[]
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are The Dr, an expert in quality validation and success criteria assessment. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "criteria_validation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              overallStatus: { type: "string", enum: ["pass", "partial", "fail"] },
              criteriaResults: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    criterion: { type: "string" },
                    status: { type: "string", enum: ["pass", "partial", "fail"] },
                    evidence: { type: "string" },
                    gaps: { type: "array", items: { type: "string" } }
                  },
                  required: ["criterion", "status", "evidence", "gaps"],
                  additionalProperties: false
                }
              },
              recommendations: { type: "array", items: { type: "string" } },
              nextSteps: { type: "array", items: { type: "string" } }
            },
            required: ["overallStatus", "criteriaResults", "recommendations", "nextSteps"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from The Dr");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("[The Dr] Criteria validation error:", error);
    return {
      overallStatus: "partial",
      criteriaResults: criteria.successCriteria.map(c => ({
        criterion: c,
        status: "partial",
        evidence: "Manual review required",
        gaps: ["AI validation unavailable"]
      })),
      recommendations: ["Perform manual validation"],
      nextSteps: ["Review evidence and mark criteria as complete"]
    };
  }
}

/**
 * Norman: Suggest relevant commands based on context
 */
export async function suggestCommands(context: {
  phaseNumber: number;
  weekNumber: number;
  tasks: string[];
  techStack: string[];
  recentCommands: string[];
}) {
  const prompt = `You are Norman Hawkins, the Knowledge Keeper. Suggest helpful commands for this context:

Phase ${context.phaseNumber}, Week ${context.weekNumber}

Current Tasks:
${context.tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Tech Stack: ${context.techStack.join(', ')}

Recent Commands:
${context.recentCommands.slice(0, 3).map((c, i) => `${i + 1}. ${c}`).join('\n')}

Provide a JSON response with:
{
  "suggestions": [
    {
      "title": string,
      "commands": string[],
      "description": string,
      "category": "setup" | "development" | "testing" | "deployment" | "maintenance",
      "relevanceScore": number (0-100)
    }
  ],
  "reasoning": string
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are Norman Hawkins, an expert in development workflows and command-line tools. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "command_suggestions",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    commands: { type: "array", items: { type: "string" } },
                    description: { type: "string" },
                    category: { type: "string", enum: ["setup", "development", "testing", "deployment", "maintenance"] },
                    relevanceScore: { type: "number" }
                  },
                  required: ["title", "commands", "description", "category", "relevanceScore"],
                  additionalProperties: false
                }
              },
              reasoning: { type: "string" }
            },
            required: ["suggestions", "reasoning"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from Norman");
    }

    const result = JSON.parse(content);
    // Sort by relevance score
    result.suggestions.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
    return result;
  } catch (error) {
    console.error("[Norman] Command suggestion error:", error);
    return {
      suggestions: [
        {
          title: "Basic Development Commands",
          commands: ["pnpm install", "pnpm dev", "pnpm build"],
          description: "Standard development workflow commands",
          category: "development",
          relevanceScore: 50
        }
      ],
      reasoning: "AI suggestions unavailable, showing default commands"
    };
  }
}

/**
 * Analyze project health across all phases
 */
export async function analyzeProjectHealth(projectData: {
  name: string;
  phases: Array<{
    phaseNumber: number;
    title: string;
    completedTasks: number;
    totalTasks: number;
    status: string;
  }>;
  overallProgress: number;
  daysRemaining: number;
}) {
  const prompt = `You are Cornelius MacIntyre, analyzing overall project health:

Project: ${projectData.name}
Overall Progress: ${projectData.overallProgress}%
Days Remaining: ${projectData.daysRemaining}

Phases:
${projectData.phases.map(p => `Phase ${p.phaseNumber}: ${p.title} - ${p.completedTasks}/${p.totalTasks} tasks (${p.status})`).join('\n')}

Provide a JSON response with:
{
  "healthScore": number (0-100),
  "status": "on_track" | "at_risk" | "critical",
  "strengths": string[],
  "concerns": string[],
  "actionItems": string[],
  "summary": string
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are Cornelius MacIntyre, providing strategic project health analysis. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "project_health",
          strict: true,
          schema: {
            type: "object",
            properties: {
              healthScore: { type: "number" },
              status: { type: "string", enum: ["on_track", "at_risk", "critical"] },
              strengths: { type: "array", items: { type: "string" } },
              concerns: { type: "array", items: { type: "string" } },
              actionItems: { type: "array", items: { type: "string" } },
              summary: { type: "string" }
            },
            required: ["healthScore", "status", "strengths", "concerns", "actionItems", "summary"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from Cornelius");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("[Cornelius] Project health analysis error:", error);
    return {
      healthScore: projectData.overallProgress,
      status: projectData.overallProgress >= 75 ? "on_track" : projectData.overallProgress >= 50 ? "at_risk" : "critical",
      strengths: ["Project is progressing"],
      concerns: ["AI analysis unavailable"],
      actionItems: ["Continue monitoring progress"],
      summary: "Basic health check based on completion percentage"
    };
  }
}
