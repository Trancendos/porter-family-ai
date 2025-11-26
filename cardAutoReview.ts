import { invokeLLM } from "../_core/llm";
import { generateSmartTags } from "./smartTagging";

/**
 * Card Auto-Review and Analysis Service
 * 
 * Automatically reviews and analyzes Kanban cards on creation/update:
 * - Complexity analysis
 * - Risk assessment
 * - Recommendations
 * - Multi-tag smart tagging with confidence scores
 * - Compliance checks
 */

export interface CardAnalysis {
  complexity: {
    score: number; // 1-10
    level: "low" | "medium" | "high" | "very_high";
    factors: string[];
  };
  risks: Array<{
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    mitigation: string;
  }>;
  recommendations: Array<{
    category: string;
    priority: "low" | "medium" | "high";
    suggestion: string;
    reasoning: string;
  }>;
  tags: Array<{
    tag: string;
    confidence: number; // 0-1
    reasoning: string;
    color?: string;
  }>;
  estimatedEffort: {
    storyPoints: number;
    hours: number;
    confidence: number;
  };
  dependencies: string[];
  complianceIssues: Array<{
    framework: string;
    issue: string;
    severity: "info" | "warning" | "error";
  }>;
}

/**
 * Analyze a Kanban card and generate comprehensive insights
 */
export async function analyzeCard(card: {
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  boardId: number;
}): Promise<CardAnalysis> {
  const prompt = `Analyze this Kanban card and provide comprehensive insights:

Title: ${card.title}
Description: ${card.description || "N/A"}
Type: ${card.type || "N/A"}
Priority: ${card.priority || "N/A"}

Provide a detailed analysis in the following JSON format:
{
  "complexity": {
    "score": <1-10>,
    "level": "<low|medium|high|very_high>",
    "factors": ["<factor1>", "<factor2>", ...]
  },
  "risks": [
    {
      "type": "<risk_type>",
      "severity": "<low|medium|high|critical>",
      "description": "<description>",
      "mitigation": "<mitigation_strategy>"
    }
  ],
  "recommendations": [
    {
      "category": "<category>",
      "priority": "<low|medium|high>",
      "suggestion": "<suggestion>",
      "reasoning": "<reasoning>"
    }
  ],
  "estimatedEffort": {
    "storyPoints": <1-13>,
    "hours": <estimated_hours>,
    "confidence": <0-1>
  },
  "dependencies": ["<dependency1>", "<dependency2>", ...],
  "complianceIssues": [
    {
      "framework": "<GDPR|OWASP|Ethical_AI>",
      "issue": "<issue_description>",
      "severity": "<info|warning|error>"
    }
  ]
}

Focus on:
1. Technical complexity and implementation challenges
2. Security and privacy risks
3. Performance and scalability concerns
4. Best practices and code quality
5. GDPR, security, and ethical AI compliance
6. Dependencies on other systems or components
7. Effort estimation based on complexity

Be specific and actionable in your recommendations.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert software architect and project manager. Analyze cards thoroughly and provide detailed, actionable insights." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "card_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              complexity: {
                type: "object",
                properties: {
                  score: { type: "number" },
                  level: { type: "string", enum: ["low", "medium", "high", "very_high"] },
                  factors: { type: "array", items: { type: "string" } },
                },
                required: ["score", "level", "factors"],
                additionalProperties: false,
              },
              risks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                    description: { type: "string" },
                    mitigation: { type: "string" },
                  },
                  required: ["type", "severity", "description", "mitigation"],
                  additionalProperties: false,
                },
              },
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    category: { type: "string" },
                    priority: { type: "string", enum: ["low", "medium", "high"] },
                    suggestion: { type: "string" },
                    reasoning: { type: "string" },
                  },
                  required: ["category", "priority", "suggestion", "reasoning"],
                  additionalProperties: false,
                },
              },
              estimatedEffort: {
                type: "object",
                properties: {
                  storyPoints: { type: "number" },
                  hours: { type: "number" },
                  confidence: { type: "number" },
                },
                required: ["storyPoints", "hours", "confidence"],
                additionalProperties: false,
              },
              dependencies: { type: "array", items: { type: "string" } },
              complianceIssues: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    framework: { type: "string" },
                    issue: { type: "string" },
                    severity: { type: "string", enum: ["info", "warning", "error"] },
                  },
                  required: ["framework", "issue", "severity"],
                  additionalProperties: false,
                },
              },
            },
            required: ["complexity", "risks", "recommendations", "estimatedEffort", "dependencies", "complianceIssues"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content || typeof content !== 'string') throw new Error("No analysis generated");

    const analysis = JSON.parse(content) as Omit<CardAnalysis, "tags">;

    // Generate smart tags
    const tagSuggestions = await generateSmartTags(
      card.boardId,
      card.title,
      card.description
    );

    const tags = tagSuggestions.map(t => ({
      tag: t.tagName,
      confidence: t.confidence,
      reasoning: t.reasoning,
      color: undefined, // Color will be assigned by frontend
    }));

    return {
      ...analysis,
      tags,
    };
  } catch (error) {
    console.error("[CardAutoReview] Analysis failed:", error);
    
    // Return basic analysis as fallback
    return {
      complexity: {
        score: 5,
        level: "medium",
        factors: ["Unable to perform detailed analysis"],
      },
      risks: [],
      recommendations: [],
      tags: [],
      estimatedEffort: {
        storyPoints: 3,
        hours: 8,
        confidence: 0.3,
      },
      dependencies: [],
      complianceIssues: [],
    };
  }
}

/**
 * Generate a summary of the analysis for display
 */
export function formatAnalysisSummary(analysis: CardAnalysis): string {
  const parts: string[] = [];

  parts.push(`**Complexity:** ${analysis.complexity.level.toUpperCase()} (${analysis.complexity.score}/10)`);
  parts.push(`**Estimated Effort:** ${analysis.estimatedEffort.storyPoints} points (~${analysis.estimatedEffort.hours}h)`);

  if (analysis.risks.length > 0) {
    const criticalRisks = analysis.risks.filter(r => r.severity === "critical" || r.severity === "high");
    if (criticalRisks.length > 0) {
      parts.push(`**⚠️ ${criticalRisks.length} High-Priority Risk(s)**`);
    }
  }

  if (analysis.complianceIssues.length > 0) {
    const errors = analysis.complianceIssues.filter(i => i.severity === "error");
    if (errors.length > 0) {
      parts.push(`**🚨 ${errors.length} Compliance Issue(s)**`);
    }
  }

  if (analysis.recommendations.length > 0) {
    const highPriority = analysis.recommendations.filter(r => r.priority === "high");
    if (highPriority.length > 0) {
      parts.push(`**💡 ${highPriority.length} High-Priority Recommendation(s)**`);
    }
  }

  return parts.join(" | ");
}
