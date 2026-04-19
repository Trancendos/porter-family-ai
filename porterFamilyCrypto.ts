import { invokeLLM } from "../_core/llm";

/**
 * Porter Family Crypto & Investment Service
 * 
 * Manages crypto investments, trading strategies, and passive income generation
 * for the Porter Family.
 */

export interface CryptoAsset {
  symbol: string;
  name: string;
  currentPrice: number;
  holdings: number;
  totalValue: number;
  profitLoss: number;
  profitLossPercent: number;
  averageBuyPrice: number;
}

export interface InvestmentStrategy {
  id: string;
  name: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  expectedReturn: number; // Annual percentage
  timeHorizon: string;
  assets: string[];
  allocation: Record<string, number>; // Asset symbol -> percentage
  status: "active" | "paused" | "completed";
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  };
}

export interface TradingSignal {
  id: string;
  asset: string;
  action: "buy" | "sell" | "hold";
  confidence: number; // 0-1
  reasoning: string;
  technicalIndicators: {
    rsi: number;
    macd: { value: number; signal: number; histogram: number };
    bollingerBands: { upper: number; middle: number; lower: number };
    movingAverages: { ma20: number; ma50: number; ma200: number };
  };
  priceTarget: number;
  stopLoss: number;
  timestamp: Date;
}

export interface PassiveIncomeOpportunity {
  id: string;
  type: "staking" | "lending" | "yield_farming" | "dividend" | "rental";
  asset: string;
  platform: string;
  apy: number;
  minimumInvestment: number;
  riskLevel: "low" | "medium" | "high";
  description: string;
  pros: string[];
  cons: string[];
  estimatedMonthlyIncome: number;
}

export interface PortfolioAnalysis {
  totalValue: number;
  totalInvested: number;
  totalProfit: number;
  totalProfitPercent: number;
  diversificationScore: number; // 0-100
  riskScore: number; // 0-100
  recommendations: string[];
  rebalancingNeeded: boolean;
  rebalancingPlan?: {
    asset: string;
    action: "buy" | "sell";
    amount: number;
    reasoning: string;
  }[];
}

/**
 * Get current crypto portfolio
 */
export async function getCryptoPortfolio(): Promise<CryptoAsset[]> {
  // In production, this would fetch from real exchange APIs
  // For now, return sample data
  return [
    {
      symbol: "BTC",
      name: "Bitcoin",
      currentPrice: 45000,
      holdings: 0.5,
      totalValue: 22500,
      profitLoss: 2500,
      profitLossPercent: 12.5,
      averageBuyPrice: 40000,
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      currentPrice: 3000,
      holdings: 5,
      totalValue: 15000,
      profitLoss: 1000,
      profitLossPercent: 7.14,
      averageBuyPrice: 2800,
    },
    {
      symbol: "SOL",
      name: "Solana",
      currentPrice: 100,
      holdings: 50,
      totalValue: 5000,
      profitLoss: -500,
      profitLossPercent: -9.09,
      averageBuyPrice: 110,
    },
  ];
}

/**
 * Analyze portfolio and provide recommendations
 */
export async function analyzePortfolio(portfolio: CryptoAsset[]): Promise<PortfolioAnalysis> {
  const totalValue = portfolio.reduce((sum, asset) => sum + asset.totalValue, 0);
  const totalInvested = portfolio.reduce((sum, asset) => sum + asset.holdings * asset.averageBuyPrice, 0);
  const totalProfit = totalValue - totalInvested;
  const totalProfitPercent = (totalProfit / totalInvested) * 100;

  // Calculate diversification score (higher is better)
  const assetCount = portfolio.length;
  const largestAssetPercent = Math.max(...portfolio.map(a => (a.totalValue / totalValue) * 100));
  const diversificationScore = Math.min(100, (assetCount * 20) - (largestAssetPercent - 20));

  // Calculate risk score (based on volatility and concentration)
  const riskScore = largestAssetPercent > 50 ? 80 : largestAssetPercent > 30 ? 60 : 40;

  try {
    const prompt = `Analyze this crypto portfolio and provide investment recommendations:

Portfolio:
${portfolio.map(a => `- ${a.name} (${a.symbol}): $${a.totalValue.toFixed(2)} (${((a.totalValue / totalValue) * 100).toFixed(1)}%)`).join('\n')}

Total Value: $${totalValue.toFixed(2)}
Total Profit/Loss: $${totalProfit.toFixed(2)} (${totalProfitPercent.toFixed(2)}%)
Diversification Score: ${diversificationScore}/100
Risk Score: ${riskScore}/100

Provide:
1. 3-5 specific recommendations for improving the portfolio
2. Whether rebalancing is needed
3. If rebalancing is needed, provide a detailed rebalancing plan`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a professional crypto investment advisor for the Porter Family. Provide detailed, actionable investment advice.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "portfolio_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              recommendations: {
                type: "array",
                items: { type: "string" },
                description: "3-5 specific recommendations",
              },
              rebalancingNeeded: { type: "boolean" },
              rebalancingPlan: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    asset: { type: "string" },
                    action: { type: "string", enum: ["buy", "sell"] },
                    amount: { type: "number" },
                    reasoning: { type: "string" },
                  },
                  required: ["asset", "action", "amount", "reasoning"],
                  additionalProperties: false,
                },
              },
            },
            required: ["recommendations", "rebalancingNeeded"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content || typeof content !== 'string') {
      throw new Error("No response from LLM");
    }

    const aiAnalysis = JSON.parse(content);

    return {
      totalValue,
      totalInvested,
      totalProfit,
      totalProfitPercent,
      diversificationScore,
      riskScore,
      recommendations: aiAnalysis.recommendations,
      rebalancingNeeded: aiAnalysis.rebalancingNeeded,
      rebalancingPlan: aiAnalysis.rebalancingPlan,
    };
  } catch (error) {
    console.error("Error analyzing portfolio:", error);
    // Fallback recommendations
    return {
      totalValue,
      totalInvested,
      totalProfit,
      totalProfitPercent,
      diversificationScore,
      riskScore,
      recommendations: [
        "Consider diversifying into more assets to reduce risk",
        "Monitor Bitcoin dominance and adjust allocation accordingly",
        "Set stop-loss orders to protect against downside risk",
      ],
      rebalancingNeeded: diversificationScore < 60,
    };
  }
}

/**
 * Generate trading signals using technical analysis
 */
export async function generateTradingSignals(assets: string[]): Promise<TradingSignal[]> {
  // In production, this would use real market data and technical indicators
  // For now, return sample signals
  return [
    {
      id: "signal-1",
      asset: "BTC",
      action: "buy",
      confidence: 0.75,
      reasoning: "RSI oversold, MACD bullish crossover, price bouncing off 200-day MA support",
      technicalIndicators: {
        rsi: 35,
        macd: { value: 120, signal: 100, histogram: 20 },
        bollingerBands: { upper: 48000, middle: 45000, lower: 42000 },
        movingAverages: { ma20: 44000, ma50: 43000, ma200: 42000 },
      },
      priceTarget: 48000,
      stopLoss: 43000,
      timestamp: new Date(),
    },
    {
      id: "signal-2",
      asset: "ETH",
      action: "hold",
      confidence: 0.6,
      reasoning: "Neutral technical indicators, waiting for clearer trend direction",
      technicalIndicators: {
        rsi: 50,
        macd: { value: 10, signal: 12, histogram: -2 },
        bollingerBands: { upper: 3200, middle: 3000, lower: 2800 },
        movingAverages: { ma20: 3000, ma50: 2950, ma200: 2900 },
      },
      priceTarget: 3200,
      stopLoss: 2800,
      timestamp: new Date(),
    },
  ];
}

/**
 * Identify passive income opportunities
 */
export async function identifyPassiveIncomeOpportunities(): Promise<PassiveIncomeOpportunity[]> {
  return [
    {
      id: "opp-1",
      type: "staking",
      asset: "ETH",
      platform: "Lido",
      apy: 4.5,
      minimumInvestment: 0.01,
      riskLevel: "low",
      description: "Stake ETH through Lido to earn staking rewards while maintaining liquidity",
      pros: [
        "Liquid staking - receive stETH that can be traded",
        "No minimum ETH requirement",
        "Decentralized and secure",
      ],
      cons: ["Smart contract risk", "Slightly lower APY than direct staking"],
      estimatedMonthlyIncome: 56.25, // Based on 15 ETH at 4.5% APY
    },
    {
      id: "opp-2",
      type: "lending",
      asset: "USDC",
      platform: "Aave",
      apy: 3.2,
      minimumInvestment: 100,
      riskLevel: "low",
      description: "Lend stablecoins on Aave to earn interest with minimal risk",
      pros: ["Stable returns", "Low volatility", "Easy to withdraw"],
      cons: ["Lower APY than other options", "Smart contract risk"],
      estimatedMonthlyIncome: 26.67, // Based on $10k at 3.2% APY
    },
    {
      id: "opp-3",
      type: "yield_farming",
      asset: "SOL-USDC LP",
      platform: "Raydium",
      apy: 15.8,
      minimumInvestment: 500,
      riskLevel: "medium",
      description: "Provide liquidity to SOL-USDC pool and earn trading fees + rewards",
      pros: ["High APY", "Earn trading fees", "Dual token exposure"],
      cons: ["Impermanent loss risk", "Higher complexity", "Smart contract risk"],
      estimatedMonthlyIncome: 65.83, // Based on $5k at 15.8% APY
    },
  ];
}

/**
 * Create investment strategy
 */
export async function createInvestmentStrategy(
  name: string,
  riskLevel: "low" | "medium" | "high",
  timeHorizon: string,
  initialCapital: number
): Promise<InvestmentStrategy> {
  try {
    const prompt = `Create a crypto investment strategy with the following parameters:

Name: ${name}
Risk Level: ${riskLevel}
Time Horizon: ${timeHorizon}
Initial Capital: $${initialCapital}

Provide:
1. Detailed description of the strategy
2. Asset allocation (which cryptocurrencies and what percentage)
3. Expected annual return
4. Key principles and rules to follow`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a professional crypto investment strategist for the Porter Family. Create detailed, actionable investment strategies.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "investment_strategy",
          strict: true,
          schema: {
            type: "object",
            properties: {
              description: { type: "string" },
              assets: { type: "array", items: { type: "string" } },
              allocation: {
                type: "object",
                additionalProperties: { type: "number" },
              },
              expectedReturn: { type: "number" },
            },
            required: ["description", "assets", "allocation", "expectedReturn"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content || typeof content !== 'string') {
      throw new Error("No response from LLM");
    }

    const aiStrategy = JSON.parse(content);

    return {
      id: `strategy-${Date.now()}`,
      name,
      description: aiStrategy.description,
      riskLevel,
      expectedReturn: aiStrategy.expectedReturn,
      timeHorizon,
      assets: aiStrategy.assets,
      allocation: aiStrategy.allocation,
      status: "active",
      performance: {
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
      },
    };
  } catch (error) {
    console.error("Error creating investment strategy:", error);
    // Fallback strategy based on risk level
    const strategies = {
      low: {
        description: "Conservative strategy focused on established cryptocurrencies with staking rewards",
        assets: ["BTC", "ETH", "USDC"],
        allocation: { BTC: 40, ETH: 40, USDC: 20 },
        expectedReturn: 8,
      },
      medium: {
        description: "Balanced strategy mixing blue-chip and mid-cap cryptocurrencies",
        assets: ["BTC", "ETH", "SOL", "MATIC"],
        allocation: { BTC: 35, ETH: 35, SOL: 20, MATIC: 10 },
        expectedReturn: 15,
      },
      high: {
        description: "Aggressive strategy targeting high-growth opportunities",
        assets: ["ETH", "SOL", "AVAX", "DOT", "ATOM"],
        allocation: { ETH: 30, SOL: 25, AVAX: 20, DOT: 15, ATOM: 10 },
        expectedReturn: 30,
      },
    };

    const strategyTemplate = strategies[riskLevel];

    return {
      id: `strategy-${Date.now()}`,
      name,
      description: strategyTemplate.description,
      riskLevel,
      expectedReturn: strategyTemplate.expectedReturn,
      timeHorizon,
      assets: strategyTemplate.assets,
      allocation: strategyTemplate.allocation,
      status: "active",
      performance: {
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
      },
    };
  }
}
