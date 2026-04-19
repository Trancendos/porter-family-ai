import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../db';
import { tradingAccounts, tradingStrategies, tradingPositions, tradingTransactions } from '../../drizzle/schema';

/**
 * Mercury Paper Trading Engine
 * 
 * Provides paper trading functionality with:
 * - Account management ($100K starting balance)
 * - Buy/sell order execution
 * - Portfolio management
 * - P&L calculation
 * - Strategy tracking
 */

export interface TradeOrder {
  accountId: number;
  strategyId?: number;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number; // in cents
}

export interface PortfolioSummary {
  accountId: number;
  balance: number;
  equity: number;
  buyingPower: number;
  positions: {
    symbol: string;
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
  }[];
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
}

/**
 * Create a new paper trading account
 */
export async function createTradingAccount(userId: number, accountName: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [result] = await db.insert(tradingAccounts).values({
    userId,
    accountName,
    accountType: 'paper',
    balance: 10000000, // $100,000
    equity: 10000000,
    buyingPower: 10000000,
    status: 'active',
  });

  return result.insertId;
}

/**
 * Execute a buy order
 */
export async function executeBuyOrder(order: TradeOrder): Promise<{ success: boolean; positionId?: number; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    // Get account
    const accounts = await db
      .select()
      .from(tradingAccounts)
      .where(eq(tradingAccounts.id, order.accountId))
      .limit(1);

    const account = accounts[0];
    if (!account) throw new Error('Account not found');
    if (account.status !== 'active') throw new Error('Account is not active');

    // Calculate order cost
    const orderCost = order.quantity * order.price;
    const fee = Math.round(orderCost * 0.001); // 0.1% fee
    const totalCost = orderCost + fee;

    // Check buying power
    if (account.buyingPower < totalCost) {
      return { success: false, error: 'Insufficient buying power' };
    }

    // Create position
    const [positionResult] = await db.insert(tradingPositions).values({
      accountId: order.accountId,
      strategyId: order.strategyId,
      symbol: order.symbol,
      side: 'long',
      quantity: order.quantity,
      entryPrice: order.price,
      currentPrice: order.price,
      unrealizedPnl: 0,
      status: 'open',
    });

    // Record transaction
    await db.insert(tradingTransactions).values({
      accountId: order.accountId,
      strategyId: order.strategyId,
      positionId: positionResult.insertId,
      symbol: order.symbol,
      transactionType: 'buy',
      quantity: order.quantity,
      price: order.price,
      amount: orderCost,
      fee,
    });

    // Update account balance
    const newBalance = account.balance - totalCost;
    const newBuyingPower = account.buyingPower - totalCost;
    
    await db
      .update(tradingAccounts)
      .set({
        balance: newBalance,
        buyingPower: newBuyingPower,
      })
      .where(eq(tradingAccounts.id, order.accountId));

    return { success: true, positionId: positionResult.insertId };
  } catch (error) {
    console.error('Buy order error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Execute a sell order
 */
export async function executeSellOrder(order: TradeOrder): Promise<{ success: boolean; realizedPnl?: number; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    // Get account
    const accounts = await db
      .select()
      .from(tradingAccounts)
      .where(eq(tradingAccounts.id, order.accountId))
      .limit(1);

    const account = accounts[0];
    if (!account) throw new Error('Account not found');
    if (account.status !== 'active') throw new Error('Account is not active');

    // Find open position
    const positions = await db
      .select()
      .from(tradingPositions)
      .where(
        and(
          eq(tradingPositions.accountId, order.accountId),
          eq(tradingPositions.symbol, order.symbol),
          eq(tradingPositions.status, 'open')
        )
      )
      .limit(1);

    const position = positions[0];
    if (!position) {
      return { success: false, error: 'No open position found for this symbol' };
    }

    if (position.quantity < order.quantity) {
      return { success: false, error: `Insufficient quantity. You have ${position.quantity}, trying to sell ${order.quantity}` };
    }

    // Calculate proceeds and P&L
    const proceeds = order.quantity * order.price;
    const fee = Math.round(proceeds * 0.001); // 0.1% fee
    const netProceeds = proceeds - fee;
    const costBasis = order.quantity * position.entryPrice;
    const realizedPnl = netProceeds - costBasis;

    // Close or reduce position
    if (position.quantity === order.quantity) {
      // Close entire position
      await db
        .update(tradingPositions)
        .set({
          status: 'closed',
          closedAt: new Date(),
        })
        .where(eq(tradingPositions.id, position.id));
    } else {
      // Reduce position
      await db
        .update(tradingPositions)
        .set({
          quantity: position.quantity - order.quantity,
        })
        .where(eq(tradingPositions.id, position.id));
    }

    // Record transaction
    await db.insert(tradingTransactions).values({
      accountId: order.accountId,
      strategyId: order.strategyId,
      positionId: position.id,
      symbol: order.symbol,
      transactionType: 'sell',
      quantity: order.quantity,
      price: order.price,
      amount: proceeds,
      fee,
      realizedPnl,
    });

    // Update account balance
    const newBalance = account.balance + netProceeds;
    const newBuyingPower = account.buyingPower + netProceeds;
    
    await db
      .update(tradingAccounts)
      .set({
        balance: newBalance,
        buyingPower: newBuyingPower,
      })
      .where(eq(tradingAccounts.id, order.accountId));

    // Update strategy stats if applicable
    if (order.strategyId) {
      const strategies = await db
        .select()
        .from(tradingStrategies)
        .where(eq(tradingStrategies.id, order.strategyId))
        .limit(1);

      const strategy = strategies[0];
      if (strategy) {
        const isWinning = realizedPnl > 0;
        await db
          .update(tradingStrategies)
          .set({
            totalTrades: strategy.totalTrades + 1,
            winningTrades: isWinning ? strategy.winningTrades + 1 : strategy.winningTrades,
            losingTrades: !isWinning ? strategy.losingTrades + 1 : strategy.losingTrades,
            totalProfit: isWinning ? strategy.totalProfit + realizedPnl : strategy.totalProfit,
            totalLoss: !isWinning ? strategy.totalLoss + Math.abs(realizedPnl) : strategy.totalLoss,
          })
          .where(eq(tradingStrategies.id, order.strategyId));
      }
    }

    return { success: true, realizedPnl };
  } catch (error) {
    console.error('Sell order error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get portfolio summary
 */
export async function getPortfolioSummary(accountId: number): Promise<PortfolioSummary | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // Get account
    const accounts = await db
      .select()
      .from(tradingAccounts)
      .where(eq(tradingAccounts.id, accountId))
      .limit(1);

    const account = accounts[0];
    if (!account) return null;

    // Get open positions
    const positions = await db
      .select()
      .from(tradingPositions)
      .where(and(eq(tradingPositions.accountId, accountId), eq(tradingPositions.status, 'open')));

    // Calculate total unrealized P&L
    const totalUnrealizedPnl = positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);

    // Get total realized P&L from transactions
    const transactions = await db
      .select()
      .from(tradingTransactions)
      .where(and(eq(tradingTransactions.accountId, accountId), eq(tradingTransactions.transactionType, 'sell')));

    const totalRealizedPnl = transactions.reduce((sum, tx) => sum + (tx.realizedPnl || 0), 0);

    // Format positions
    const formattedPositions = positions.map((pos) => ({
      symbol: pos.symbol,
      quantity: pos.quantity,
      entryPrice: pos.entryPrice,
      currentPrice: pos.currentPrice,
      unrealizedPnl: pos.unrealizedPnl,
      unrealizedPnlPercent: pos.entryPrice > 0 ? (pos.unrealizedPnl / (pos.entryPrice * pos.quantity)) * 100 : 0,
    }));

    return {
      accountId,
      balance: account.balance,
      equity: account.equity,
      buyingPower: account.buyingPower,
      positions: formattedPositions,
      totalUnrealizedPnl,
      totalRealizedPnl,
    };
  } catch (error) {
    console.error('Portfolio summary error:', error);
    return null;
  }
}

/**
 * Update position prices (for real-time market data updates)
 */
export async function updatePositionPrices(accountId: number, prices: Record<string, number>): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    // Get open positions
    const positions = await db
      .select()
      .from(tradingPositions)
      .where(and(eq(tradingPositions.accountId, accountId), eq(tradingPositions.status, 'open')));

    // Update each position
    for (const position of positions) {
      const newPrice = prices[position.symbol];
      if (newPrice !== undefined) {
        const unrealizedPnl = (newPrice - position.entryPrice) * position.quantity;
        
        await db
          .update(tradingPositions)
          .set({
            currentPrice: newPrice,
            unrealizedPnl,
          })
          .where(eq(tradingPositions.id, position.id));
      }
    }

    // Update account equity
    const updatedPositions = await db
      .select()
      .from(tradingPositions)
      .where(and(eq(tradingPositions.accountId, accountId), eq(tradingPositions.status, 'open')));

    const totalUnrealizedPnl = updatedPositions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
    
    const accounts = await db
      .select()
      .from(tradingAccounts)
      .where(eq(tradingAccounts.id, accountId))
      .limit(1);

    const account = accounts[0];
    if (account) {
      const newEquity = account.balance + totalUnrealizedPnl;
      await db
        .update(tradingAccounts)
        .set({ equity: newEquity })
        .where(eq(tradingAccounts.id, accountId));
    }
  } catch (error) {
    console.error('Update position prices error:', error);
  }
}
