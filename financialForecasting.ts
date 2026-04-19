/**
 * Financial Forecasting Service
 * 
 * Predictive analytics for revenue, expenses, and cash flow.
 * Uses historical data and trend analysis to forecast financial performance.
 */

import { getDb } from "../db";
import { transactions, accounts, budgets } from "./dorisFinancial";
import { eq, gte, lte, desc, and, sql } from "drizzle-orm";

export interface ForecastResult {
  period: string;
  predictedRevenue: number;
  predictedExpenses: number;
  predictedProfit: number;
  confidence: number; // 0-100
  trend: "increasing" | "decreasing" | "stable";
}

export interface CashFlowForecast {
  date: string;
  inflow: number;
  outflow: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
}

/**
 * Forecast revenue for next N periods based on historical data
 */
export async function forecastRevenue(
  userId: number,
  periods: number = 12, // months
  accountId?: number
): Promise<ForecastResult[]> {
  const db = await getDb();
  if (!db) return [];

  // Get historical revenue data (last 12 months)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 12);

  const historicalData = await db
    .select({
      month: sql<string>`DATE_FORMAT(transaction_date, '%Y-%m')`,
      total: sql<number>`SUM(CASE WHEN type = 'credit' AND category = 'revenue' THEN amount ELSE 0 END)`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.transactionDate, startDate),
        lte(transactions.transactionDate, endDate),
        accountId ? eq(transactions.accountId, accountId) : undefined
      )
    )
    .groupBy(sql`DATE_FORMAT(transaction_date, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(transaction_date, '%Y-%m')`);

  // Calculate trend using linear regression
  const values = historicalData.map(d => d.total);
  const trend = calculateTrend(values);

  // Generate forecasts
  const forecasts: ForecastResult[] = [];
  const lastValue = values[values.length - 1] || 0;
  
  for (let i = 1; i <= periods; i++) {
    const predictedValue = lastValue + (trend.slope * i);
    const confidence = Math.max(50, 100 - (i * 5)); // Confidence decreases over time

    const currentDate = new Date();
    currentDate.setMonth(currentDate.getMonth() + i);
    const period = currentDate.toISOString().slice(0, 7); // YYYY-MM

    forecasts.push({
      period,
      predictedRevenue: Math.max(0, predictedValue),
      predictedExpenses: 0, // Will be calculated separately
      predictedProfit: 0,
      confidence,
      trend: trend.direction,
    });
  }

  return forecasts;
}

/**
 * Forecast expenses for next N periods
 */
export async function forecastExpenses(
  userId: number,
  periods: number = 12,
  accountId?: number
): Promise<ForecastResult[]> {
  const db = await getDb();
  if (!db) return [];

  // Get historical expense data
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 12);

  const historicalData = await db
    .select({
      month: sql<string>`DATE_FORMAT(transaction_date, '%Y-%m')`,
      total: sql<number>`SUM(CASE WHEN type = 'debit' AND category = 'expense' THEN amount ELSE 0 END)`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.transactionDate, startDate),
        lte(transactions.transactionDate, endDate),
        accountId ? eq(transactions.accountId, accountId) : undefined
      )
    )
    .groupBy(sql`DATE_FORMAT(transaction_date, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(transaction_date, '%Y-%m')`);

  const values = historicalData.map(d => d.total);
  const trend = calculateTrend(values);

  const forecasts: ForecastResult[] = [];
  const lastValue = values[values.length - 1] || 0;
  
  for (let i = 1; i <= periods; i++) {
    const predictedValue = lastValue + (trend.slope * i);
    const confidence = Math.max(50, 100 - (i * 5));

    const currentDate = new Date();
    currentDate.setMonth(currentDate.getMonth() + i);
    const period = currentDate.toISOString().slice(0, 7);

    forecasts.push({
      period,
      predictedRevenue: 0,
      predictedExpenses: Math.max(0, predictedValue),
      predictedProfit: 0,
      confidence,
      trend: trend.direction,
    });
  }

  return forecasts;
}

/**
 * Generate comprehensive financial forecast
 */
export async function generateFinancialForecast(
  userId: number,
  periods: number = 12
): Promise<ForecastResult[]> {
  const revenueForecast = await forecastRevenue(userId, periods);
  const expenseForecast = await forecastExpenses(userId, periods);

  // Combine forecasts
  const combined: ForecastResult[] = [];
  for (let i = 0; i < periods; i++) {
    const revenue = revenueForecast[i] || { predictedRevenue: 0, confidence: 50, trend: "stable" as const };
    const expense = expenseForecast[i] || { predictedExpenses: 0, confidence: 50, trend: "stable" as const };

    combined.push({
      period: revenue.period || expense.period,
      predictedRevenue: revenue.predictedRevenue,
      predictedExpenses: expense.predictedExpenses,
      predictedProfit: revenue.predictedRevenue - expense.predictedExpenses,
      confidence: Math.min(revenue.confidence, expense.confidence),
      trend: revenue.predictedRevenue > expense.predictedExpenses ? "increasing" : "decreasing",
    });
  }

  return combined;
}

/**
 * Forecast cash flow for next N days
 */
export async function forecastCashFlow(
  userId: number,
  days: number = 90
): Promise<CashFlowForecast[]> {
  const db = await getDb();
  if (!db) return [];

  // Get current cash balance
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));

  let currentBalance = 0;
  for (const account of userAccounts) {
    currentBalance += parseFloat(account.balance.toString());
  }

  // Get historical daily cash flow
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  const historicalData = await db
    .select({
      date: sql<string>`DATE(transaction_date)`,
      inflow: sql<number>`SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END)`,
      outflow: sql<number>`SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END)`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.transactionDate, startDate),
        lte(transactions.transactionDate, endDate)
      )
    )
    .groupBy(sql`DATE(transaction_date)`)
    .orderBy(sql`DATE(transaction_date)`);

  // Calculate average daily inflow/outflow
  const avgInflow = historicalData.reduce((sum, d) => sum + d.inflow, 0) / historicalData.length || 0;
  const avgOutflow = historicalData.reduce((sum, d) => sum + d.outflow, 0) / historicalData.length || 0;

  // Generate forecast
  const forecasts: CashFlowForecast[] = [];
  let cumulativeBalance = currentBalance;

  for (let i = 1; i <= days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);

    // Add some randomness (±20%)
    const inflowVariation = (Math.random() - 0.5) * 0.4;
    const outflowVariation = (Math.random() - 0.5) * 0.4;

    const inflow = avgInflow * (1 + inflowVariation);
    const outflow = avgOutflow * (1 + outflowVariation);
    const netCashFlow = inflow - outflow;
    cumulativeBalance += netCashFlow;

    forecasts.push({
      date: date.toISOString().slice(0, 10),
      inflow,
      outflow,
      netCashFlow,
      cumulativeCashFlow: cumulativeBalance,
    });
  }

  return forecasts;
}

/**
 * Calculate trend using simple linear regression
 */
function calculateTrend(values: number[]): {
  slope: number;
  direction: "increasing" | "decreasing" | "stable";
} {
  if (values.length < 2) {
    return { slope: 0, direction: "stable" };
  }

  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  let direction: "increasing" | "decreasing" | "stable";
  if (slope > 0.05) {
    direction = "increasing";
  } else if (slope < -0.05) {
    direction = "decreasing";
  } else {
    direction = "stable";
  }

  return { slope, direction };
}

/**
 * Get budget health score (0-100)
 */
export async function getBudgetHealthScore(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const userBudgets = await db
    .select()
    .from(budgets)
    .where(eq(budgets.userId, userId));

  if (userBudgets.length === 0) return 100;

  let totalScore = 0;
  for (const budget of userBudgets) {
    const spentPercentage = (parseFloat(budget.spent.toString()) / parseFloat(budget.amount.toString())) * 100;
    
    let score = 100;
    if (spentPercentage > 100) {
      score = 0; // Over budget
    } else if (spentPercentage > 90) {
      score = 30; // Critical
    } else if (spentPercentage > 75) {
      score = 60; // Warning
    } else {
      score = 100; // Healthy
    }

    totalScore += score;
  }

  return Math.round(totalScore / userBudgets.length);
}

/**
 * Identify cost optimization opportunities
 */
export async function identifyCostOptimizations(userId: number): Promise<{
  category: string;
  currentSpend: number;
  potentialSavings: number;
  recommendation: string;
}[]> {
  const db = await getDb();
  if (!db) return [];

  // Get expense categories
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3); // Last 3 months

  const categorySpend = await db
    .select({
      category: transactions.category,
      total: sql<number>`SUM(amount)`,
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

  const opportunities = [];

  for (const cat of categorySpend) {
    if (!cat.category) continue;

    const monthlySpend = cat.total / 3;

    // Identify high-spend categories
    if (monthlySpend > 1000) {
      opportunities.push({
        category: cat.category,
        currentSpend: cat.total,
        potentialSavings: monthlySpend * 0.15, // Assume 15% savings potential
        recommendation: `Review ${cat.category} expenses. High spending detected ($${monthlySpend.toFixed(2)}/month). Consider negotiating rates or finding alternatives.`,
      });
    }
  }

  return opportunities;
}
