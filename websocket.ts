import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

/**
 * WebSocket Service
 * 
 * Provides real-time updates for:
 * - Mercury Trading (price updates, position changes)
 * - Agent Marketplace (sales notifications)
 * - Agent Dashboard (task progress, status changes)
 */

let io: SocketIOServer | null = null;

export function initializeWebSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.VITE_FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
    },
    path: '/api/socket.io',
  });

  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Join user-specific room
    socket.on('join', (userId: number) => {
      socket.join(`user:${userId}`);
      console.log(`[WebSocket] User ${userId} joined room`);
    });

    // Join trading account room
    socket.on('join-trading', (accountId: number) => {
      socket.join(`trading:${accountId}`);
      console.log(`[WebSocket] Joined trading account ${accountId}`);
    });

    // Join agent dashboard room
    socket.on('join-agents', () => {
      socket.join('agents');
      console.log(`[WebSocket] Joined agents room`);
    });

    // Join marketplace seller room
    socket.on('join-seller', (userId: number) => {
      socket.join(`seller:${userId}`);
      console.log(`[WebSocket] Joined seller room for user ${userId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

/**
 * Emit price update to trading account subscribers
 */
export function emitPriceUpdate(accountId: number, data: {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}) {
  if (!io) return;
  io.to(`trading:${accountId}`).emit('price-update', data);
}

/**
 * Emit position update to trading account subscribers
 */
export function emitPositionUpdate(accountId: number, data: {
  positionId: number;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
}) {
  if (!io) return;
  io.to(`trading:${accountId}`).emit('position-update', data);
}

/**
 * Emit portfolio update to trading account subscribers
 */
export function emitPortfolioUpdate(accountId: number, data: {
  balance: number;
  equity: number;
  unrealizedPnL: number;
  realizedPnL: number;
}) {
  if (!io) return;
  io.to(`trading:${accountId}`).emit('portfolio-update', data);
}

/**
 * Emit agent task update to agent dashboard subscribers
 */
export function emitAgentTaskUpdate(data: {
  agentId: number;
  taskId: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: number;
  result?: string;
}) {
  if (!io) return;
  io.to('agents').emit('agent-task-update', data);
}

/**
 * Emit agent status update to agent dashboard subscribers
 */
export function emitAgentStatusUpdate(data: {
  agentId: number;
  status: 'idle' | 'busy' | 'offline';
  healthScore?: number;
}) {
  if (!io) return;
  io.to('agents').emit('agent-status-update', data);
}

/**
 * Emit marketplace sale notification to seller
 */
export function emitMarketplaceSale(userId: number, data: {
  agentId: number;
  agentName: string;
  price: number;
  buyerName?: string;
  timestamp: Date;
}) {
  if (!io) return;
  io.to(`seller:${userId}`).emit('marketplace-sale', data);
}

/**
 * Emit marketplace review notification to seller
 */
export function emitMarketplaceReview(userId: number, data: {
  agentId: number;
  agentName: string;
  rating: number;
  comment?: string;
  timestamp: Date;
}) {
  if (!io) return;
  io.to(`seller:${userId}`).emit('marketplace-review', data);
}

/**
 * Broadcast message to all connected clients
 */
export function broadcastMessage(event: string, data: any) {
  if (!io) return;
  io.emit(event, data);
}

/**
 * Send message to specific user
 */
export function sendToUser(userId: number, event: string, data: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}
