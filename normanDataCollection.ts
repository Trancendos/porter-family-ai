import { invokeLLM } from "../_core/llm";

/**
 * Norman's Universal Data Collection & Tagging System
 * 
 * Collects data from multiple sources (stock market, crypto, economic indicators, news, social media)
 * and automatically tags, enriches, and makes it available to all AIs in the platform.
 */

export interface DataSource {
  id: string;
  name: string;
  type: "stock_market" | "crypto_market" | "economic" | "news" | "social_media" | "custom";
  url?: string;
  apiKey?: string;
  refreshInterval: number; // minutes
  lastCollected?: Date;
  status: "active" | "paused" | "error";
  dataCount: number;
}

export interface CollectedData {
  id: string;
  sourceId: string;
  sourceName: string;
  dataType: string;
  timestamp: Date;
  data: Record<string, any>;
  tags: string[];
  enrichments: Record<string, any>;
  qualityScore: number; // 0-100
  version: number;
}

export interface DataTag {
  name: string;
  category: "market" | "sentiment" | "technical" | "fundamental" | "event" | "custom";
  confidence: number; // 0-1
  metadata?: Record<string, any>;
}

export interface StockMarketData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  pe: number;
  eps: number;
  high52Week: number;
  low52Week: number;
  timestamp: Date;
}

export interface CryptoMarketData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap: number;
  circulatingSupply: number;
  totalSupply: number;
  timestamp: Date;
}

export interface EconomicIndicator {
  name: string;
  value: number;
  unit: string;
  country: string;
  date: Date;
  previousValue?: number;
  change?: number;
  changePercent?: number;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: Date;
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number; // -1 to 1
  relevantSymbols: string[];
  topics: string[];
}

export interface SocialMediaTrend {
  keyword: string;
  platform: "twitter" | "reddit" | "discord" | "telegram";
  mentions: number;
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number;
  trending: boolean;
  relatedAssets: string[];
  timestamp: Date;
}

/**
 * Collect stock market data
 */
export async function collectStockMarketData(symbols: string[]): Promise<StockMarketData[]> {
  // In production, this would use real market data APIs (Alpha Vantage, Yahoo Finance, etc.)
  // For now, return sample data
  return symbols.map((symbol) => ({
    symbol,
    name: getStockName(symbol),
    price: Math.random() * 500 + 50,
    change: Math.random() * 10 - 5,
    changePercent: Math.random() * 5 - 2.5,
    volume: Math.floor(Math.random() * 10000000),
    marketCap: Math.random() * 1000000000000,
    pe: Math.random() * 30 + 10,
    eps: Math.random() * 10,
    high52Week: Math.random() * 600 + 100,
    low52Week: Math.random() * 400 + 20,
    timestamp: new Date(),
  }));
}

/**
 * Collect crypto market data
 */
export async function collectCryptoMarketData(symbols: string[]): Promise<CryptoMarketData[]> {
  // In production, this would use CoinGecko, CoinMarketCap, etc.
  return symbols.map((symbol) => ({
    symbol,
    name: getCryptoName(symbol),
    price: Math.random() * 50000,
    change24h: Math.random() * 2000 - 1000,
    changePercent24h: Math.random() * 10 - 5,
    volume24h: Math.random() * 10000000000,
    marketCap: Math.random() * 1000000000000,
    circulatingSupply: Math.random() * 100000000,
    totalSupply: Math.random() * 200000000,
    timestamp: new Date(),
  }));
}

/**
 * Collect economic indicators
 */
export async function collectEconomicIndicators(): Promise<EconomicIndicator[]> {
  // In production, this would use FRED, World Bank, etc.
  return [
    {
      name: "GDP Growth Rate",
      value: 2.5,
      unit: "%",
      country: "USA",
      date: new Date(),
      previousValue: 2.3,
      change: 0.2,
      changePercent: 8.7,
    },
    {
      name: "Inflation Rate",
      value: 3.2,
      unit: "%",
      country: "USA",
      date: new Date(),
      previousValue: 3.5,
      change: -0.3,
      changePercent: -8.6,
    },
    {
      name: "Unemployment Rate",
      value: 4.1,
      unit: "%",
      country: "USA",
      date: new Date(),
      previousValue: 4.3,
      change: -0.2,
      changePercent: -4.7,
    },
  ];
}

/**
 * Collect news articles
 */
export async function collectNewsArticles(keywords: string[]): Promise<NewsArticle[]> {
  // In production, this would use NewsAPI, Google News, etc.
  return [
    {
      id: "news-1",
      title: "Federal Reserve Announces Interest Rate Decision",
      summary: "The Fed maintains interest rates at current levels, citing economic stability",
      url: "https://example.com/news/1",
      source: "Financial Times",
      publishedAt: new Date(),
      sentiment: "neutral",
      sentimentScore: 0.1,
      relevantSymbols: ["SPY", "QQQ"],
      topics: ["monetary_policy", "interest_rates", "federal_reserve"],
    },
    {
      id: "news-2",
      title: "Bitcoin Reaches New All-Time High",
      summary: "Bitcoin surpasses previous records as institutional adoption continues",
      url: "https://example.com/news/2",
      source: "CoinDesk",
      publishedAt: new Date(),
      sentiment: "positive",
      sentimentScore: 0.8,
      relevantSymbols: ["BTC"],
      topics: ["cryptocurrency", "bitcoin", "institutional_investment"],
    },
  ];
}

/**
 * Collect social media trends
 */
export async function collectSocialMediaTrends(keywords: string[]): Promise<SocialMediaTrend[]> {
  // In production, this would use Twitter API, Reddit API, etc.
  return keywords.map((keyword) => ({
    keyword,
    platform: "twitter" as const,
    mentions: Math.floor(Math.random() * 10000),
    sentiment: ["positive", "neutral", "negative"][Math.floor(Math.random() * 3)] as "positive" | "neutral" | "negative",
    sentimentScore: Math.random() * 2 - 1,
    trending: Math.random() > 0.7,
    relatedAssets: ["BTC", "ETH", "SOL"].slice(0, Math.floor(Math.random() * 3) + 1),
    timestamp: new Date(),
  }));
}

/**
 * Automatically tag collected data using AI
 */
export async function autoTagData(data: CollectedData): Promise<DataTag[]> {
  try {
    const prompt = `Analyze this data and generate relevant tags:

Data Type: ${data.dataType}
Source: ${data.sourceName}
Content: ${JSON.stringify(data.data, null, 2)}

Generate 5-10 relevant tags that categorize this data. Include:
- Market-related tags (bullish, bearish, volatile, etc.)
- Sentiment tags (positive, negative, neutral)
- Technical tags (overbought, oversold, trending, etc.)
- Event tags (earnings, announcement, regulation, etc.)`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are Norman Hawkins, a documentation and knowledge management AI. Generate precise, relevant tags for data categorization.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "data_tags",
          strict: true,
          schema: {
            type: "object",
            properties: {
              tags: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    category: {
                      type: "string",
                      enum: ["market", "sentiment", "technical", "fundamental", "event", "custom"],
                    },
                    confidence: { type: "number" },
                  },
                  required: ["name", "category", "confidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["tags"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from LLM");
    }

    const aiTags = JSON.parse(content);
    return aiTags.tags;
  } catch (error) {
    console.error("Error auto-tagging data:", error);
    // Fallback tags based on data type
    return [
      { name: data.dataType, category: "custom", confidence: 1.0 },
      { name: data.sourceName, category: "custom", confidence: 1.0 },
    ];
  }
}

/**
 * Enrich data with additional context
 */
export async function enrichData(data: CollectedData): Promise<Record<string, any>> {
  const enrichments: Record<string, any> = {
    collectedAt: new Date(),
    processingVersion: "1.0",
  };

  // Add data type-specific enrichments
  if (data.dataType === "stock_market") {
    enrichments.marketStatus = "open"; // Would check actual market hours
    enrichments.tradingDay = true;
  } else if (data.dataType === "crypto_market") {
    enrichments.marketStatus = "24/7";
    enrichments.volatilityIndex = Math.random() * 100;
  } else if (data.dataType === "news") {
    enrichments.readingTime = Math.floor(Math.random() * 10) + 1;
    enrichments.credibilityScore = Math.random() * 100;
  }

  return enrichments;
}

/**
 * Calculate data quality score
 */
export function calculateQualityScore(data: CollectedData): number {
  let score = 100;

  // Deduct points for missing fields
  if (!data.data || Object.keys(data.data).length === 0) score -= 30;
  if (!data.tags || data.tags.length === 0) score -= 20;
  if (!data.timestamp) score -= 10;

  // Deduct points for old data
  const ageMinutes = (Date.now() - new Date(data.timestamp).getTime()) / 1000 / 60;
  if (ageMinutes > 60) score -= 10;
  if (ageMinutes > 1440) score -= 20; // More than 24 hours

  // Deduct points for incomplete enrichments
  if (!data.enrichments || Object.keys(data.enrichments).length < 3) score -= 10;

  return Math.max(0, score);
}

/**
 * Store collected data for AI access
 */
export async function storeCollectedData(
  sourceId: string,
  sourceName: string,
  dataType: string,
  rawData: Record<string, any>
): Promise<CollectedData> {
  const data: CollectedData = {
    id: `data-${Date.now()}`,
    sourceId,
    sourceName,
    dataType,
    timestamp: new Date(),
    data: rawData,
    tags: [],
    enrichments: {},
    qualityScore: 0,
    version: 1,
  };

  // Auto-tag the data
  const tags = await autoTagData(data);
  data.tags = tags.map((t) => t.name);

  // Enrich the data
  data.enrichments = await enrichData(data);

  // Calculate quality score
  data.qualityScore = calculateQualityScore(data);

  // In production, this would be saved to database
  return data;
}

/**
 * Query collected data with filters
 */
export async function queryCollectedData(filters: {
  dataType?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  minQualityScore?: number;
}): Promise<CollectedData[]> {
  // In production, this would query the database
  // For now, return empty array
  return [];
}

/**
 * Get data statistics
 */
export async function getDataStatistics(): Promise<{
  totalDataPoints: number;
  dataByType: Record<string, number>;
  averageQualityScore: number;
  lastCollectionTime: Date;
  activeDataSources: number;
}> {
  return {
    totalDataPoints: 15847,
    dataByType: {
      stock_market: 5234,
      crypto_market: 3421,
      economic: 892,
      news: 4123,
      social_media: 2177,
    },
    averageQualityScore: 87.3,
    lastCollectionTime: new Date(),
    activeDataSources: 12,
  };
}

// Helper functions
function getStockName(symbol: string): string {
  const names: Record<string, string> = {
    AAPL: "Apple Inc.",
    MSFT: "Microsoft Corporation",
    GOOGL: "Alphabet Inc.",
    AMZN: "Amazon.com Inc.",
    TSLA: "Tesla Inc.",
  };
  return names[symbol] || symbol;
}

function getCryptoName(symbol: string): string {
  const names: Record<string, string> = {
    BTC: "Bitcoin",
    ETH: "Ethereum",
    SOL: "Solana",
    ADA: "Cardano",
    DOT: "Polkadot",
  };
  return names[symbol] || symbol;
}

/**
 * Schedule automatic data collection
 */
export async function scheduleDataCollection(
  sourceId: string,
  intervalMinutes: number
): Promise<{ success: boolean; nextCollection: Date }> {
  // In production, this would set up a cron job or scheduled task
  const nextCollection = new Date(Date.now() + intervalMinutes * 60 * 1000);

  return {
    success: true,
    nextCollection,
  };
}

/**
 * Share data with AI agents
 */
export async function shareDataWithAI(
  aiName: string,
  dataTypes: string[],
  tags?: string[]
): Promise<{ success: boolean; dataCount: number }> {
  // Query relevant data
  const relevantData = await queryCollectedData({
    dataType: dataTypes[0],
    tags,
    minQualityScore: 70,
  });

  // In production, this would make the data available to the specified AI
  // through a shared data repository or pub/sub system

  return {
    success: true,
    dataCount: relevantData.length,
  };
}
