/**
 * Cost Optimization AI Service
 * 
 * Automated cost analysis and optimization recommendations using AI.
 * Doris uses this to identify savings opportunities and reduce expenses.
 */

import { getDb } from "../db";
import { transactions, accounts, budgets } from "./dorisFinancial";
import { eq, gte, lte, desc, and, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

export interface CostOptimization {
  id: string;
  category: string;
  currentCost: number;
  potentialSavings: number;
  savingsPercentage: number;
  priority: "low" | "medium" | "high" | "critical";
  recommendation: string;
  actionItems: string[];
  implementationDifficulty: "easy" | "medium" | "hard";
  estimatedTimeToImplement: string;
  confidence: number; // 0-100
}

export interface CostAnalysis {
  totalMonthlySpend: number;
  totalPotentialSavings: number;
  optimizations: CostOptimization[];
  overallScore: number; // 0-100 (100 = fully optimized)
}

/**
 * Analyze costs and generate AI-powered optimization recommendations
 */
export async function analyzeCostsWithAI(userId: number): Promise<CostAnalysis> {
  const db = await getDb();
  if (!db) {
    return {
      totalMonthlySpend: 0,
      totalPotentialSavings: 0,
      optimizations: [],
      overallScore: 100,
    };
  }

  // Get last 3 months of expenses
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3);

  const expenses = await db
    .select({
      category: transactions.category,
      total: sql<number>`SUM(amount)`,
      count: sql<number>`COUNT(*)`,
      avgAmount: sql<number>`AVG(amount)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, "debit"),
        gte(transactions.transactionDate, startDate),
        lte(transactions.transactionDate, endDate)
      )
    )
    .groupBy(transactions.category);

  const totalSpend = expenses.reduce((sum, e) => sum + e.total, 0);
  const monthlySpend = totalSpend / 3;

  // Use AI to analyze each category
  const optimizations: CostOptimization[] = [];

  for (const expense of expenses) {
    if (!expense.category || expense.total < 100) continue; // Skip small expenses

    const monthlyAvg = expense.total / 3;

    // Use LLM to generate optimization recommendations
    try {
      const prompt = `You are a financial optimization AI assistant. Analyze this expense category and provide cost-saving recommendations.

Category: ${expense.category}
Monthly Average Spend: $${monthlyAvg.toFixed(2)}
Number of Transactions: ${expense.count}
Average Transaction Amount: $${expense.avgAmount.toFixed(2)}

Provide a JSON response with:
1. potentialSavingsPercentage (realistic percentage, 5-30%)
2. priority (low/medium/high/critical)
3. recommendation (one concise sentence)
4. actionItems (array of 2-3 specific actionable steps)
5. implementationDifficulty (easy/medium/hard)
6. estimatedTimeToImplement (e.g., "1 week", "2 days", "1 month")
7. confidence (0-100, how confident you are in the savings estimate)

Be realistic and practical. Focus on actionable advice.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a financial optimization expert. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "cost_optimization",
            strict: true,
            schema: {
              type: "object",
              properties: {
                potentialSavingsPercentage: { type: "number" },
                priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                recommendation: { type: "string" },
                actionItems: { type: "array", items: { type: "string" } },
                implementationDifficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                estimatedTimeToImplement: { type: "string" },
                confidence: { type: "number" },
              },
              required: [
                "potentialSavingsPercentage",
                "priority",
                "recommendation",
                "actionItems",
                "implementationDifficulty",
                "estimatedTimeToImplement",
                "confidence",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const aiResult = JSON.parse(response.choices[0].message.content || "{}");

      const potentialSavings = monthlyAvg * (aiResult.potentialSavingsPercentage / 100);

      optimizations.push({
        id: `OPT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        category: expense.category,
        currentCost: monthlyAvg,
        potentialSavings,
        savingsPercentage: aiResult.potentialSavingsPercentage,
        priority: aiResult.priority,
        recommendation: aiResult.recommendation,
        actionItems: aiResult.actionItems,
        implementationDifficulty: aiResult.implementationDifficulty,
        estimatedTimeToImplement: aiResult.estimatedTimeToImplement,
        confidence: aiResult.confidence,
      });
    } catch (error) {
      console.error(`Error analyzing category ${expense.category}:`, error);
      
      // Fallback: Rule-based optimization
      const fallbackOptimization = generateFallbackOptimization(expense.category, monthlyAvg);
      if (fallbackOptimization) {
        optimizations.push(fallbackOptimization);
      }
    }
  }

  // Sort by potential savings (highest first)
  optimizations.sort((a, b) => b.potentialSavings - a.potentialSavings);

  const totalPotentialSavings = optimizations.reduce((sum, opt) => sum + opt.potentialSavings, 0);
  const savingsPercentage = (totalPotentialSavings / monthlySpend) * 100;
  const overallScore = Math.max(0, 100 - savingsPercentage);

  return {
    totalMonthlySpend: monthlySpend,
    totalPotentialSavings,
    optimizations,
    overallScore: Math.round(overallScore),
  };
}

/**
 * Fallback rule-based optimization (when AI fails)
 */
function generateFallbackOptimization(category: string, monthlySpend: number): CostOptimization | null {
  const rules: Record<string, {
    savingsPercentage: number;
    priority: "low" | "medium" | "high" | "critical";
    recommendation: string;
    actionItems: string[];
    difficulty: "easy" | "medium" | "hard";
    timeToImplement: string;
  }> = {
    "cloud_services": {
      savingsPercentage: 20,
      priority: "high",
      recommendation: "Optimize cloud resource usage and consider reserved instances",
      actionItems: [
        "Audit unused resources and shut them down",
        "Switch to reserved instances for predictable workloads",
        "Implement auto-scaling to match demand",
      ],
      difficulty: "medium",
      timeToImplement: "2 weeks",
    },
    "subscriptions": {
      savingsPercentage: 25,
      priority: "high",
      recommendation: "Review and cancel unused subscriptions",
      actionItems: [
        "List all active subscriptions",
        "Identify unused or redundant services",
        "Negotiate annual plans for frequently used services",
      ],
      difficulty: "easy",
      timeToImplement: "1 week",
    },
    "marketing": {
      savingsPercentage: 15,
      priority: "medium",
      recommendation: "Optimize marketing spend by focusing on high-ROI channels",
      actionItems: [
        "Analyze ROI by marketing channel",
        "Pause underperforming campaigns",
        "Reallocate budget to top performers",
      ],
      difficulty: "medium",
      timeToImplement: "2 weeks",
    },
    "infrastructure": {
      savingsPercentage: 18,
      priority: "high",
      recommendation: "Consolidate infrastructure and eliminate redundancies",
      actionItems: [
        "Audit all infrastructure components",
        "Identify duplicate or overlapping services",
        "Migrate to more cost-effective alternatives",
      ],
      difficulty: "hard",
      timeToImplement: "1 month",
    },
  };

  const categoryLower = category.toLowerCase();
  for (const [key, rule] of Object.entries(rules)) {
    if (categoryLower.includes(key)) {
      const potentialSavings = monthlySpend * (rule.savingsPercentage / 100);

      return {
        id: `OPT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        category,
        currentCost: monthlySpend,
        potentialSavings,
        savingsPercentage: rule.savingsPercentage,
        priority: rule.priority,
        recommendation: rule.recommendation,
        actionItems: rule.actionItems,
        implementationDifficulty: rule.difficulty,
        estimatedTimeToImplement: rule.timeToImplement,
        confidence: 75,
      };
    }
  }

  // Generic optimization for high-spend categories
  if (monthlySpend > 1000) {
    return {
      id: `OPT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      category,
      currentCost: monthlySpend,
      potentialSavings: monthlySpend * 0.10, // 10% generic savings
      savingsPercentage: 10,
      priority: "medium",
      recommendation: `Review ${category} expenses for potential savings opportunities`,
      actionItems: [
        "Analyze spending patterns in this category",
        "Compare with industry benchmarks",
        "Negotiate better rates with vendors",
      ],
      implementationDifficulty: "medium",
      estimatedTimeToImplement: "2 weeks",
      confidence: 60,
    };
  }

  return null;
}

/**
 * Get quick wins (easy optimizations with high impact)
 */
export async function getQuickWins(userId: number): Promise<CostOptimization[]> {
  const analysis = await analyzeCostsWithAI(userId);
  
  return analysis.optimizations.filter(
    opt =>
      opt.implementationDifficulty === "easy" &&
      opt.potentialSavings > 100 &&
      opt.confidence > 70
  );
}

/**
 * Track optimization implementation
 */
export async function trackOptimizationImplementation(
  optimizationId: string,
  status: "implemented" | "in_progress" | "rejected",
  actualSavings?: number
): Promise<void> {
  // TODO: Store in database for tracking
  console.log(`Optimization ${optimizationId} status: ${status}`, {
    actualSavings,
  });
}

/**
 * Calculate ROI for implemented optimizations
 */
export async function calculateOptimizationROI(
  userId: number,
  periodMonths: number = 3
): Promise<{
  totalSavings: number;
  implementationCost: number;
  roi: number;
  paybackPeriod: string;
}> {
  // TODO: Implement based on tracked optimizations
  return {
    totalSavings: 0,
    implementationCost: 0,
    roi: 0,
    paybackPeriod: "N/A",
  };
}
