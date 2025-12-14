/**
 * Learning System
 * 
 * Analyzes test results, error patterns, and system behavior to:
 * - Identify recurring issues
 * - Suggest automated fixes
 * - Predict potential problems
 * - Generate improvement recommendations
 * - Build knowledge base from failures
 */

import { getDb } from "../db";
import { invokeLLM } from "../_core/llm";

export interface LearningInsight {
  id: string;
  category: 'error_pattern' | 'test_failure' | 'performance' | 'security' | 'user_behavior';
  title: string;
  description: string;
  frequency: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedFix: string;
  automatable: boolean;
  relatedIssues: string[];
  learnedAt: Date;
}

export interface PredictiveAlert {
  id: string;
  type: 'potential_failure' | 'performance_degradation' | 'security_risk' | 'capacity_issue';
  prediction: string;
  confidence: number; // 0-1
  timeframe: string; // "within 24 hours", "next week", etc.
  preventiveActions: string[];
  basedOn: string[]; // Data sources used for prediction
  createdAt: Date;
}

/**
 * Analyze test reports to find patterns and insights
 */
export async function analyzeTestReports(timeRangeHours: number = 168): Promise<LearningInsight[]> {
  const db = await getDb();
  if (!db) return [];
  
  const { testReports } = await import("../../drizzle/platform-schema");
  const { gte, sql } = await import("drizzle-orm");
  
  const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
  
  // Get recent test reports
  const reports = await db
    .select()
    .from(testReports)
    .where(gte(testReports.createdAt, cutoffTime))
    .orderBy(sql`${testReports.createdAt} DESC`);
  
  if (reports.length === 0) return [];
  
  // Extract all failed tests
  const allFailures: any[] = [];
  reports.forEach(report => {
    const results = JSON.parse(report.results);
    const failures = results.filter((r: any) => r.status === 'fail');
    allFailures.push(...failures);
  });
  
  // Group failures by test name
  const failureGroups: Record<string, any[]> = {};
  allFailures.forEach(failure => {
    if (!failureGroups[failure.testName]) {
      failureGroups[failure.testName] = [];
    }
    failureGroups[failure.testName].push(failure);
  });
  
  // Generate insights for recurring failures
  const insights: LearningInsight[] = [];
  
  for (const [testName, failures] of Object.entries(failureGroups)) {
    if (failures.length >= 2) { // Recurring issue
      const insight: LearningInsight = {
        id: `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: 'test_failure',
        title: `Recurring test failure: ${testName}`,
        description: `This test has failed ${failures.length} times in the past ${timeRangeHours} hours`,
        frequency: failures.length,
        severity: failures[0].severity || 'medium',
        suggestedFix: failures[0].recommendation || 'Review test implementation and fix root cause',
        automatable: false,
        relatedIssues: failures.map((f: any) => f.error).filter(Boolean),
        learnedAt: new Date(),
      };
      
      insights.push(insight);
    }
  }
  
  // Use AI to analyze patterns
  if (allFailures.length > 0) {
    const aiInsights = await analyzeFailuresWithAI(allFailures);
    insights.push(...aiInsights);
  }
  
  return insights;
}

/**
 * Use AI to analyze failure patterns
 */
async function analyzeFailuresWithAI(failures: any[]): Promise<LearningInsight[]> {
  const failureSummary = failures.slice(0, 20).map(f => ({
    test: f.testName,
    error: f.error,
    severity: f.severity,
  }));
  
  const prompt = `Analyze these test failures and identify patterns:

${JSON.stringify(failureSummary, null, 2)}

Provide insights in JSON format:
{
  "insights": [
    {
      "category": "error_pattern" | "test_failure" | "performance" | "security",
      "title": string,
      "description": string,
      "severity": "low" | "medium" | "high" | "critical",
      "suggestedFix": string,
      "automatable": boolean
    }
  ]
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert in software testing and failure analysis. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "failure_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              insights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    category: { type: "string", enum: ["error_pattern", "test_failure", "performance", "security", "user_behavior"] },
                    title: { type: "string" },
                    description: { type: "string" },
                    severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                    suggestedFix: { type: "string" },
                    automatable: { type: "boolean" }
                  },
                  required: ["category", "title", "description", "severity", "suggestedFix", "automatable"],
                  additionalProperties: false
                }
              }
            },
            required: ["insights"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const result = JSON.parse(content);
    
    return result.insights.map((insight: any) => ({
      id: `ai-insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...insight,
      frequency: 1,
      relatedIssues: [],
      learnedAt: new Date(),
    }));
  } catch (error) {
    console.error('[LearningSystem] AI analysis failed:', error);
    return [];
  }
}

/**
 * Analyze error logs to find patterns
 */
export async function analyzeErrorPatterns(timeRangeHours: number = 24): Promise<LearningInsight[]> {
  const db = await getDb();
  if (!db) return [];
  
  const { errorLogs } = await import("../../drizzle/platform-schema");
  const { gte, sql } = await import("drizzle-orm");
  
  const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
  
  // Get recent errors
  const errors = await db
    .select()
    .from(errorLogs)
    .where(gte(errorLogs.createdAt, cutoffTime))
    .orderBy(sql`${errorLogs.createdAt} DESC`)
    .limit(500);
  
  if (errors.length === 0) return [];
  
  // Group errors by message
  const errorGroups: Record<string, any[]> = {};
  errors.forEach(error => {
    if (!errorGroups[error.message]) {
      errorGroups[error.message] = [];
    }
    errorGroups[error.message].push(error);
  });
  
  const insights: LearningInsight[] = [];
  
  // Find recurring errors
  for (const [message, errorGroup] of Object.entries(errorGroups)) {
    if (errorGroup.length >= 5) { // Recurring error
      const insight: LearningInsight = {
        id: `error-insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: 'error_pattern',
        title: `Recurring error: ${message.substring(0, 100)}`,
        description: `This error has occurred ${errorGroup.length} times in the past ${timeRangeHours} hours`,
        frequency: errorGroup.length,
        severity: errorGroup[0].level === 'critical' ? 'critical' : 
                  errorGroup[0].level === 'error' ? 'high' : 'medium',
        suggestedFix: 'Investigate root cause and implement permanent fix',
        automatable: false,
        relatedIssues: [errorGroup[0].category],
        learnedAt: new Date(),
      };
      
      insights.push(insight);
    }
  }
  
  return insights;
}

/**
 * Generate predictive alerts based on historical data
 */
export async function generatePredictiveAlerts(): Promise<PredictiveAlert[]> {
  const db = await getDb();
  if (!db) return [];
  
  const alerts: PredictiveAlert[] = [];
  
  // Analyze error rate trends
  const { errorLogs } = await import("../../drizzle/platform-schema");
  const { gte, sql } = await import("drizzle-orm");
  
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const last48Hours = new Date(Date.now() - 48 * 60 * 60 * 1000);
  
  const errors24h = await db.select().from(errorLogs).where(gte(errorLogs.createdAt, last24Hours));
  const errors48h = await db.select().from(errorLogs).where(gte(errorLogs.createdAt, last48Hours));
  
  const errorRate24h = errors24h.length;
  const errorRate48h = errors48h.length / 2; // Average per 24h
  
  // If error rate is increasing significantly
  if (errorRate24h > errorRate48h * 1.5) {
    alerts.push({
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'potential_failure',
      prediction: 'Error rate is increasing significantly - potential system instability',
      confidence: 0.75,
      timeframe: 'within 24 hours',
      preventiveActions: [
        'Review recent deployments',
        'Check system resources (CPU, memory)',
        'Investigate top error messages',
        'Consider scaling infrastructure',
      ],
      basedOn: ['Error log trends', 'Historical patterns'],
      createdAt: new Date(),
    });
  }
  
  // Check for critical errors
  const criticalErrors = errors24h.filter(e => e.level === 'critical');
  if (criticalErrors.length > 0) {
    alerts.push({
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'security_risk',
      prediction: `${criticalErrors.length} critical errors detected - immediate attention required`,
      confidence: 1.0,
      timeframe: 'immediate',
      preventiveActions: [
        'Review critical error logs',
        'Implement emergency fixes',
        'Notify on-call team',
        'Prepare rollback plan',
      ],
      basedOn: ['Critical error logs'],
      createdAt: new Date(),
    });
  }
  
  return alerts;
}

/**
 * Build knowledge base from failures
 */
export async function buildKnowledgeBase(): Promise<void> {
  const insights = await analyzeTestReports(168); // Last week
  const errorPatterns = await analyzeErrorPatterns(168);
  
  const allInsights = [...insights, ...errorPatterns];
  
  if (allInsights.length === 0) {
    console.log('No new insights to add to knowledge base');
    return;
  }
  
  // Store insights in database
  const db = await getDb();
  if (!db) return;
  
  const { learningInsights } = await import("../../drizzle/platform-schema");
  
  for (const insight of allInsights) {
    await db.insert(learningInsights).values({
      insightId: insight.id,
      category: insight.category,
      title: insight.title,
      description: insight.description,
      frequency: insight.frequency,
      severity: insight.severity,
      suggestedFix: insight.suggestedFix,
      automatable: insight.automatable ? 1 : 0,
      relatedIssues: JSON.stringify(insight.relatedIssues),
    });
  }
  
  console.log(`✅ Added ${allInsights.length} insights to knowledge base`);
}

/**
 * Get recommendations for improvement
 */
export async function getImprovementRecommendations(): Promise<string[]> {
  const insights = await analyzeTestReports(168);
  const errorPatterns = await analyzeErrorPatterns(168);
  const alerts = await generatePredictiveAlerts();
  
  const recommendations: string[] = [];
  
  // From insights
  insights.forEach(insight => {
    if (insight.severity === 'critical' || insight.severity === 'high') {
      recommendations.push(`🔴 ${insight.title}: ${insight.suggestedFix}`);
    }
  });
  
  // From error patterns
  errorPatterns.forEach(pattern => {
    if (pattern.frequency >= 10) {
      recommendations.push(`⚠️  Fix recurring error (${pattern.frequency}x): ${pattern.title}`);
    }
  });
  
  // From predictive alerts
  alerts.forEach(alert => {
    if (alert.confidence >= 0.7) {
      recommendations.push(`🔮 ${alert.prediction} - ${alert.preventiveActions[0]}`);
    }
  });
  
  return recommendations;
}

/**
 * Generate comprehensive learning report
 */
export async function generateLearningReport() {
  console.log('🧠 Generating Learning Report...\n');
  
  const insights = await analyzeTestReports(168);
  const errorPatterns = await analyzeErrorPatterns(168);
  const alerts = await generatePredictiveAlerts();
  const recommendations = await getImprovementRecommendations();
  
  console.log('📊 LEARNING INSIGHTS\n');
  console.log(`Total Insights: ${insights.length + errorPatterns.length}`);
  console.log(`Predictive Alerts: ${alerts.length}`);
  console.log(`Recommendations: ${recommendations.length}\n`);
  
  if (insights.length > 0) {
    console.log('🔍 Test Failure Patterns:');
    insights.forEach(i => console.log(`  - ${i.title} (${i.frequency}x)`));
    console.log('');
  }
  
  if (errorPatterns.length > 0) {
    console.log('❌ Error Patterns:');
    errorPatterns.forEach(p => console.log(`  - ${p.title} (${p.frequency}x)`));
    console.log('');
  }
  
  if (alerts.length > 0) {
    console.log('🔮 Predictive Alerts:');
    alerts.forEach(a => console.log(`  - ${a.prediction} (${(a.confidence * 100).toFixed(0)}% confidence)`));
    console.log('');
  }
  
  if (recommendations.length > 0) {
    console.log('💡 Recommendations:');
    recommendations.forEach(r => console.log(`  ${r}`));
    console.log('');
  }
  
  return {
    insights,
    errorPatterns,
    alerts,
    recommendations,
  };
}
