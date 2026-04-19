/**
 * Doris Fontaine - Royal Bank of Arcadia
 * 
 * Financial management, revenue tracking, investment portfolio, and budget optimization.
 * Doris is the Financial Management Goddess.
 */

import { getDb } from "../db";
import { mysqlTable, int, varchar, text, timestamp, decimal, json } from "drizzle-orm/mysql-core";
import { eq, and, desc, sum, gte, lte } from "drizzle-orm";

// Financial database schema (will be added to main schema)
export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  accountNumber: varchar("account_number", { length: 64 }).notNull().unique(),
  accountName: varchar("account_name", { length: 255 }).notNull(),
  accountType: varchar("account_type", { length: 32 }).notNull(), // 'checking', 'savings', 'investment', 'revenue', 'expense'
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  userId: int("user_id").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: varchar("transaction_id", { length: 64 }).notNull().unique(),
  accountId: int("account_id").notNull(),
  type: varchar("type", { length: 32 }).notNull(), // 'debit', 'credit', 'transfer'
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  category: varchar("category", { length: 64 }), // 'revenue', 'expense', 'investment', 'withdrawal'
  description: text("description"),
  reference: varchar("reference", { length: 255 }), // External reference (invoice, order, etc.)
  metadata: json("metadata"),
  transactionDate: timestamp("transaction_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const portfolios = mysqlTable("portfolios", {
  id: int("id").autoincrement().primaryKey(),
  portfolioName: varchar("portfolio_name", { length: 255 }).notNull(),
  userId: int("user_id").notNull(),
  totalValue: decimal("total_value", { precision: 15, scale: 2 }).default("0.00").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  riskLevel: varchar("risk_level", { length: 32 }).default("medium"), // 'low', 'medium', 'high'
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const investments = mysqlTable("investments", {
  id: int("id").autoincrement().primaryKey(),
  portfolioId: int("portfolio_id").notNull(),
  assetType: varchar("asset_type", { length: 64 }).notNull(), // 'stock', 'crypto', 'bond', 'real_estate', 'other'
  assetName: varchar("asset_name", { length: 255 }).notNull(),
  symbol: varchar("symbol", { length: 32 }),
  quantity: decimal("quantity", { precision: 15, scale: 8 }).notNull(),
  purchasePrice: decimal("purchase_price", { precision: 15, scale: 2 }).notNull(),
  currentPrice: decimal("current_price", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  purchaseDate: timestamp("purchase_date").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const budgets = mysqlTable("budgets", {
  id: int("id").autoincrement().primaryKey(),
  budgetName: varchar("budget_name", { length: 255 }).notNull(),
  userId: int("user_id").notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  spent: decimal("spent", { precision: 15, scale: 2 }).default("0.00").notNull(),
  period: varchar("period", { length: 32 }).notNull(), // 'daily', 'weekly', 'monthly', 'yearly'
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  alertThreshold: int("alert_threshold").default(80), // Alert when spent reaches this percentage
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const financialReports = mysqlTable("financial_reports", {
  id: int("id").autoincrement().primaryKey(),
  reportType: varchar("report_type", { length: 64 }).notNull(), // 'income_statement', 'balance_sheet', 'cash_flow', 'roi_analysis'
  userId: int("user_id").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  data: json("data").notNull(), // Report data
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

/**
 * Create account
 */
export async function createAccount(
  accountName: string,
  accountType: string,
  userId: number,
  currency: string = "USD"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const accountNumber = `ACC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  const [account] = await db.insert(accounts).values({
    accountNumber,
    accountName,
    accountType,
    currency,
    userId,
    balance: "0.00",
  }).$returningId();

  return account;
}

/**
 * Get account balance
 */
export async function getAccountBalance(accountId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Record transaction
 */
export async function recordTransaction(
  accountId: number,
  type: string,
  amount: string,
  category: string,
  description?: string,
  reference?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  // Get account
  const account = await getAccountBalance(accountId);
  if (!account) throw new Error("Account not found");

  // Update account balance
  const amountNum = parseFloat(amount);
  const currentBalance = parseFloat(account.balance.toString());

  let newBalance: number;
  if (type === "credit") {
    newBalance = currentBalance + amountNum;
  } else if (type === "debit") {
    newBalance = currentBalance - amountNum;
  } else {
    throw new Error("Invalid transaction type");
  }

  await db
    .update(accounts)
    .set({ balance: newBalance.toFixed(2) })
    .where(eq(accounts.id, accountId));

  // Record transaction
  await db.insert(transactions).values({
    transactionId,
    accountId,
    type,
    amount,
    currency: account.currency,
    category,
    description,
    reference,
  });

  return transactionId;
}

/**
 * Get transactions for account
 */
export async function getAccountTransactions(
  accountId: number,
  limit: number = 50
) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(transactions)
    .where(eq(transactions.accountId, accountId))
    .orderBy(desc(transactions.transactionDate))
    .limit(limit);
}

/**
 * Create portfolio
 */
export async function createPortfolio(
  portfolioName: string,
  userId: number,
  riskLevel: string = "medium"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [portfolio] = await db.insert(portfolios).values({
    portfolioName,
    userId,
    riskLevel,
    totalValue: "0.00",
  }).$returningId();

  return portfolio;
}

/**
 * Add investment to portfolio
 */
export async function addInvestment(
  portfolioId: number,
  assetType: string,
  assetName: string,
  symbol: string,
  quantity: string,
  purchasePrice: string,
  purchaseDate: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(investments).values({
    portfolioId,
    assetType,
    assetName,
    symbol,
    quantity,
    purchasePrice,
    currentPrice: purchasePrice, // Initially same as purchase price
    purchaseDate,
  });

  // Update portfolio total value
  await updatePortfolioValue(portfolioId);
}

/**
 * Update portfolio value
 */
export async function updatePortfolioValue(portfolioId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const investmentList = await db
    .select()
    .from(investments)
    .where(eq(investments.portfolioId, portfolioId));

  let totalValue = 0;
  for (const investment of investmentList) {
    const value =
      parseFloat(investment.quantity.toString()) *
      parseFloat(investment.currentPrice.toString());
    totalValue += value;
  }

  await db
    .update(portfolios)
    .set({ totalValue: totalValue.toFixed(2) })
    .where(eq(portfolios.id, portfolioId));
}

/**
 * Get portfolio performance
 */
export async function getPortfolioPerformance(portfolioId: number) {
  const db = await getDb();
  if (!db) return null;

  const portfolio = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.id, portfolioId))
    .limit(1);

  if (portfolio.length === 0) return null;

  const investmentList = await db
    .select()
    .from(investments)
    .where(eq(investments.portfolioId, portfolioId));

  let totalInvested = 0;
  let totalCurrent = 0;

  for (const investment of investmentList) {
    const invested =
      parseFloat(investment.quantity.toString()) *
      parseFloat(investment.purchasePrice.toString());
    const current =
      parseFloat(investment.quantity.toString()) *
      parseFloat(investment.currentPrice.toString());

    totalInvested += invested;
    totalCurrent += current;
  }

  const gain = totalCurrent - totalInvested;
  const gainPercentage = totalInvested > 0 ? (gain / totalInvested) * 100 : 0;

  return {
    portfolioId,
    portfolioName: portfolio[0].portfolioName,
    totalInvested: totalInvested.toFixed(2),
    totalCurrent: totalCurrent.toFixed(2),
    gain: gain.toFixed(2),
    gainPercentage: gainPercentage.toFixed(2),
    investments: investmentList.length,
  };
}

/**
 * Create budget
 */
export async function createBudget(
  budgetName: string,
  userId: number,
  category: string,
  amount: string,
  period: string,
  startDate: Date,
  endDate: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(budgets).values({
    budgetName,
    userId,
    category,
    amount,
    period,
    startDate,
    endDate,
  });
}

/**
 * Track budget spending
 */
export async function trackBudgetSpending(budgetId: number, amount: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const budget = await db
    .select()
    .from(budgets)
    .where(eq(budgets.id, budgetId))
    .limit(1);

  if (budget.length === 0) throw new Error("Budget not found");

  const currentSpent = parseFloat(budget[0].spent.toString());
  const newSpent = currentSpent + parseFloat(amount);

  await db
    .update(budgets)
    .set({ spent: newSpent.toFixed(2) })
    .where(eq(budgets.id, budgetId));

  // Check if alert threshold reached
  const budgetAmount = parseFloat(budget[0].amount.toString());
  const spentPercentage = (newSpent / budgetAmount) * 100;

  if (spentPercentage >= (budget[0].alertThreshold || 80)) {
    return {
      alert: true,
      message: `Budget "${budget[0].budgetName}" has reached ${spentPercentage.toFixed(1)}% of allocated amount`,
      spent: newSpent.toFixed(2),
      budget: budgetAmount.toFixed(2),
    };
  }

  return { alert: false };
}

/**
 * Get budget status
 */
export async function getBudgetStatus(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();

  const userBudgets = await db
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, userId),
        lte(budgets.startDate, now),
        gte(budgets.endDate, now)
      )
    );

  return userBudgets.map((budget) => {
    const spent = parseFloat(budget.spent.toString());
    const amount = parseFloat(budget.amount.toString());
    const remaining = amount - spent;
    const percentage = (spent / amount) * 100;

    return {
      id: budget.id,
      name: budget.budgetName,
      category: budget.category,
      amount: amount.toFixed(2),
      spent: spent.toFixed(2),
      remaining: remaining.toFixed(2),
      percentage: percentage.toFixed(1),
      status:
        percentage >= 100
          ? "exceeded"
          : percentage >= 80
          ? "warning"
          : "healthy",
    };
  });
}

/**
 * Generate financial report
 */
export async function generateFinancialReport(
  userId: number,
  reportType: string,
  periodStart: Date,
  periodEnd: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let reportData: any = {};

  if (reportType === "income_statement") {
    // Get all transactions in period
    const txns = await db
      .select()
      .from(transactions)
      .where(
        and(
          gte(transactions.transactionDate, periodStart),
          lte(transactions.transactionDate, periodEnd)
        )
      );

    const revenue = txns
      .filter((t) => t.category === "revenue")
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    const expenses = txns
      .filter((t) => t.category === "expense")
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    reportData = {
      revenue: revenue.toFixed(2),
      expenses: expenses.toFixed(2),
      netIncome: (revenue - expenses).toFixed(2),
    };
  } else if (reportType === "roi_analysis") {
    // Get all portfolios
    const userPortfolios = await db
      .select()
      .from(portfolios)
      .where(eq(portfolios.userId, userId));

    const portfolioPerformance = await Promise.all(
      userPortfolios.map((p) => getPortfolioPerformance(p.id))
    );

    reportData = {
      portfolios: portfolioPerformance,
      totalGain: portfolioPerformance
        .reduce((sum, p) => sum + parseFloat(p?.gain || "0"), 0)
        .toFixed(2),
    };
  }

  // Save report
  await db.insert(financialReports).values({
    reportType,
    userId,
    periodStart,
    periodEnd,
    data: reportData,
  });

  return reportData;
}

/**
 * Get financial dashboard metrics
 */
export async function getFinancialDashboard(userId: number) {
  const db = await getDb();
  if (!db) return null;

  // Get total balance across all accounts
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const totalBalance = userAccounts.reduce(
    (sum, acc) => sum + parseFloat(acc.balance.toString()),
    0
  );

  // Get portfolio performance
  const userPortfolios = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.userId, userId));

  const totalPortfolioValue = userPortfolios.reduce(
    (sum, p) => sum + parseFloat(p.totalValue.toString()),
    0
  );

  // Get budget status
  const budgetStatus = await getBudgetStatus(userId);

  // Get recent transactions
  const recentTransactions = await db
    .select()
    .from(transactions)
    .orderBy(desc(transactions.transactionDate))
    .limit(10);

  return {
    totalBalance: totalBalance.toFixed(2),
    totalPortfolioValue: totalPortfolioValue.toFixed(2),
    totalNetWorth: (totalBalance + totalPortfolioValue).toFixed(2),
    accounts: userAccounts.length,
    portfolios: userPortfolios.length,
    budgets: budgetStatus,
    recentTransactions,
  };
}
