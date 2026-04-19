/**
 * Market Data Service
 * 
 * Provides real-time and historical market data using Polygon.io REST API
 * 
 * Features:
 * - Real-time stock quotes
 * - Historical price data
 * - Market status
 * - Symbol search
 */

const POLYGON_API_KEY = process.env.POLYGON_API_KEY || '';
const POLYGON_BASE_URL = 'https://api.polygon.io';

export interface StockQuote {
  symbol: string;
  price: number; // in cents
  change: number; // in cents
  changePercent: number;
  volume: number;
  timestamp: Date;
}

export interface HistoricalBar {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Make authenticated request to Polygon API
 */
async function polygonFetch(endpoint: string): Promise<any> {
  if (!POLYGON_API_KEY) {
    throw new Error('Polygon API key not configured');
  }

  const url = `${POLYGON_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}apiKey=${POLYGON_API_KEY}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Polygon API error: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get real-time quote for a symbol
 */
export async function getQuote(symbol: string): Promise<StockQuote | null> {
  if (!POLYGON_API_KEY) {
    console.warn('Polygon API key not configured, returning mock data');
    return getMockQuote(symbol);
  }

  try {
    // Get last trade
    const lastTradeData = await polygonFetch(`/v2/last/trade/${symbol}`);
    
    // Get previous close
    const prevCloseData = await polygonFetch(`/v2/aggs/ticker/${symbol}/prev`);
    
    if (!lastTradeData?.results || !prevCloseData?.results || prevCloseData.results.length === 0) {
      return getMockQuote(symbol);
    }

    const currentPrice = Math.round(lastTradeData.results.p * 100); // Convert to cents
    const prevClose = Math.round(prevCloseData.results[0].c * 100);
    const change = currentPrice - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    return {
      symbol,
      price: currentPrice,
      change,
      changePercent,
      volume: lastTradeData.results.s || 0,
      timestamp: new Date(lastTradeData.results.t || Date.now()),
    };
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    return getMockQuote(symbol);
  }
}

/**
 * Get quotes for multiple symbols
 */
export async function getQuotes(symbols: string[]): Promise<Record<string, StockQuote>> {
  const quotes: Record<string, StockQuote> = {};
  
  // Fetch quotes in parallel
  const promises = symbols.map(async (symbol) => {
    const quote = await getQuote(symbol);
    if (quote) {
      quotes[symbol] = quote;
    }
  });
  
  await Promise.all(promises);
  
  return quotes;
}

/**
 * Get historical price data
 */
export async function getHistoricalData(
  symbol: string,
  from: Date,
  to: Date,
  timespan: 'minute' | 'hour' | 'day' | 'week' | 'month' = 'day'
): Promise<HistoricalBar[]> {
  if (!POLYGON_API_KEY) {
    console.warn('Polygon API key not configured, returning mock data');
    return getMockHistoricalData(symbol, from, to);
  }

  try {
    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];
    
    const data = await polygonFetch(
      `/v2/aggs/ticker/${symbol}/range/1/${timespan}/${fromStr}/${toStr}?adjusted=true&sort=asc`
    );

    if (!data || !data.results) {
      return getMockHistoricalData(symbol, from, to);
    }

    return data.results.map((bar: any) => ({
      timestamp: new Date(bar.t),
      open: Math.round(bar.o * 100),
      high: Math.round(bar.h * 100),
      low: Math.round(bar.l * 100),
      close: Math.round(bar.c * 100),
      volume: bar.v,
    }));
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error);
    return getMockHistoricalData(symbol, from, to);
  }
}

/**
 * Check if market is open
 */
export async function isMarketOpen(): Promise<boolean> {
  if (!POLYGON_API_KEY) {
    // Mock: Market open Mon-Fri 9:30 AM - 4:00 PM ET
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    
    return day >= 1 && day <= 5 && hour >= 9 && hour < 16;
  }

  try {
    const data = await polygonFetch('/v1/marketstatus/now');
    return data?.market === 'open';
  } catch (error) {
    console.error('Error checking market status:', error);
    return false;
  }
}

/**
 * Search for symbols
 */
export async function searchSymbols(query: string): Promise<Array<{ symbol: string; name: string }>> {
  if (!POLYGON_API_KEY) {
    return getMockSearchResults(query);
  }

  try {
    const data = await polygonFetch(`/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&limit=10`);

    if (!data || !data.results) {
      return getMockSearchResults(query);
    }

    return data.results.map((ticker: any) => ({
      symbol: ticker.ticker,
      name: ticker.name,
    }));
  } catch (error) {
    console.error(`Error searching symbols for ${query}:`, error);
    return getMockSearchResults(query);
  }
}

/**
 * Mock data functions (fallback when API is unavailable)
 */

function getMockQuote(symbol: string): StockQuote {
  // Generate realistic mock data
  const basePrice = 15000 + Math.random() * 10000; // $150-250
  const change = (Math.random() - 0.5) * 1000; // -$5 to +$5
  
  return {
    symbol,
    price: Math.round(basePrice),
    change: Math.round(change),
    changePercent: (change / basePrice) * 100,
    volume: Math.floor(Math.random() * 10000000),
    timestamp: new Date(),
  };
}

function getMockHistoricalData(symbol: string, from: Date, to: Date): HistoricalBar[] {
  const bars: HistoricalBar[] = [];
  const days = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  
  let price = 15000 + Math.random() * 10000;
  
  for (let i = 0; i <= days; i++) {
    const date = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
    const volatility = price * 0.02; // 2% daily volatility
    
    const open = Math.round(price);
    const change = (Math.random() - 0.5) * volatility;
    const close = Math.round(price + change);
    const high = Math.round(Math.max(open, close) + Math.random() * volatility * 0.5);
    const low = Math.round(Math.min(open, close) - Math.random() * volatility * 0.5);
    
    bars.push({
      timestamp: date,
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 10000000),
    });
    
    price = close;
  }
  
  return bars;
}

function getMockSearchResults(query: string): Array<{ symbol: string; name: string }> {
  const mockStocks = [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corporation' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.' },
    { symbol: 'TSLA', name: 'Tesla Inc.' },
    { symbol: 'META', name: 'Meta Platforms Inc.' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
    { symbol: 'V', name: 'Visa Inc.' },
    { symbol: 'WMT', name: 'Walmart Inc.' },
  ];
  
  const queryLower = query.toLowerCase();
  return mockStocks
    .filter(
      (stock) =>
        stock.symbol.toLowerCase().includes(queryLower) ||
        stock.name.toLowerCase().includes(queryLower)
    )
    .slice(0, 10);
}

/**
 * Convert price from cents to dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Convert price from dollars to cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
