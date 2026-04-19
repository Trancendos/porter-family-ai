/**
 * Agent Mesh Communication Protocol
 * 
 * Enables direct agent-to-agent communication via Redis Pub/Sub.
 * Reduces orchestration overhead and enables faster multi-agent workflows.
 */

import Redis from 'ioredis';
import { getDb } from '../db';
import { agentConversations, type InsertAgentConversation } from '../../drizzle/schema';

// Redis client for publishing
let redisPublisher: Redis | null = null;

// Redis clients for subscribing (one per agent)
const redisSubscribers: Map<string, Redis> = new Map();

// Message handlers (one per agent)
const messageHandlers: Map<string, Set<MessageHandler>> = new Map();

/**
 * Message types for agent communication
 */
export type AgentMessageType = 
  | 'request'           // Request help from another agent
  | 'response'          // Response to a request
  | 'event'             // Event notification (task_started, task_completed, etc.)
  | 'broadcast'         // Broadcast to all agents
  | 'vote'              // Vote on a decision
  | 'consensus';        // Consensus result

/**
 * Agent message structure
 */
export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: AgentMessageType;
  subject: string;
  content: any;
  timestamp: Date;
  correlationId?: string;  // For request/response matching
  metadata?: Record<string, any>;
}

/**
 * Message handler function
 */
export type MessageHandler = (message: AgentMessage) => void | Promise<void>;

/**
 * Initialize Redis connection
 */
function getRedisPublisher(): Redis {
  if (!redisPublisher) {
    // Use local Redis or fallback to in-memory (for development)
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisPublisher = new Redis(redisUrl, {
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('[Agent Mesh] Redis connection failed, falling back to in-memory mode');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000);
      },
      lazyConnect: true,
    });
    
    redisPublisher.on('error', (err) => {
      console.warn('[Agent Mesh] Redis error:', err.message);
    });
  }
  return redisPublisher;
}

/**
 * Get or create Redis subscriber for an agent
 */
function getRedisSubscriber(agentName: string): Redis {
  if (!redisSubscribers.has(agentName)) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const subscriber = new Redis(redisUrl, {
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 100, 3000);
      },
      lazyConnect: true,
    });
    
    subscriber.on('error', (err) => {
      console.warn(`[Agent Mesh] Redis subscriber error for ${agentName}:`, err.message);
    });
    
    redisSubscribers.set(agentName, subscriber);
  }
  return redisSubscribers.get(agentName)!;
}

/**
 * Send a message from one agent to another
 */
export async function sendMessage(message: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<void> {
  const fullMessage: AgentMessage = {
    ...message,
    id: generateMessageId(),
    timestamp: new Date(),
  };
  
  // Store in database for audit trail
  await storeMessage(fullMessage);
  
  // Publish to Redis channel
  try {
    const publisher = getRedisPublisher();
    await publisher.connect();
    
    const channel = `agent:${message.to}`;
    await publisher.publish(channel, JSON.stringify(fullMessage));
    
    console.log(`[Agent Mesh] Message sent: ${message.from} → ${message.to} (${message.type})`);
  } catch (error) {
    console.error('[Agent Mesh] Failed to send message:', error);
    // Fallback: call handlers directly (in-memory mode)
    await deliverMessageDirectly(fullMessage);
  }
}

/**
 * Subscribe to messages for an agent
 */
export async function subscribeToAgent(agentName: string, handler: MessageHandler): Promise<void> {
  // Register handler
  if (!messageHandlers.has(agentName)) {
    messageHandlers.set(agentName, new Set());
  }
  messageHandlers.get(agentName)!.add(handler);
  
  // Subscribe to Redis channel
  try {
    const subscriber = getRedisSubscriber(agentName);
    await subscriber.connect();
    
    const channel = `agent:${agentName}`;
    await subscriber.subscribe(channel);
    
    subscriber.on('message', async (ch, messageStr) => {
      if (ch === channel) {
        try {
          const message: AgentMessage = JSON.parse(messageStr);
          await deliverMessage(agentName, message);
        } catch (error) {
          console.error('[Agent Mesh] Failed to parse message:', error);
        }
      }
    });
    
    console.log(`[Agent Mesh] Subscribed: ${agentName}`);
  } catch (error) {
    console.error(`[Agent Mesh] Failed to subscribe ${agentName}:`, error);
  }
}

/**
 * Unsubscribe from messages for an agent
 */
export async function unsubscribeFromAgent(agentName: string, handler?: MessageHandler): Promise<void> {
  if (handler) {
    // Remove specific handler
    messageHandlers.get(agentName)?.delete(handler);
  } else {
    // Remove all handlers
    messageHandlers.delete(agentName);
    
    // Unsubscribe from Redis
    const subscriber = redisSubscribers.get(agentName);
    if (subscriber) {
      await subscriber.unsubscribe(`agent:${agentName}`);
      await subscriber.quit();
      redisSubscribers.delete(agentName);
    }
  }
}

/**
 * Broadcast a message to all agents
 */
export async function broadcastMessage(message: Omit<AgentMessage, 'id' | 'timestamp' | 'to'>): Promise<void> {
  const fullMessage: AgentMessage = {
    ...message,
    id: generateMessageId(),
    to: '*',
    timestamp: new Date(),
  };
  
  // Store in database
  await storeMessage(fullMessage);
  
  // Publish to broadcast channel
  try {
    const publisher = getRedisPublisher();
    await publisher.connect();
    await publisher.publish('agent:broadcast', JSON.stringify(fullMessage));
    
    console.log(`[Agent Mesh] Broadcast: ${message.from} (${message.type})`);
  } catch (error) {
    console.error('[Agent Mesh] Failed to broadcast:', error);
    // Fallback: deliver to all subscribed agents
    for (const agentName of Array.from(messageHandlers.keys())) {
      await deliverMessage(agentName, fullMessage);
    }
  }
}

/**
 * Emit an event (task_started, task_completed, task_failed)
 */
export async function emitEvent(
  from: string,
  eventType: string,
  data: any
): Promise<void> {
  await broadcastMessage({
    from,
    type: 'event',
    subject: eventType,
    content: data,
  });
}

/**
 * Request help from another agent
 */
export async function requestHelp(
  from: string,
  to: string,
  subject: string,
  content: any
): Promise<string> {
  const correlationId = generateMessageId();
  
  await sendMessage({
    from,
    to,
    type: 'request',
    subject,
    content,
    correlationId,
  });
  
  return correlationId;
}

/**
 * Respond to a request
 */
export async function respondToRequest(
  from: string,
  to: string,
  correlationId: string,
  content: any
): Promise<void> {
  await sendMessage({
    from,
    to,
    type: 'response',
    subject: 'Response',
    content,
    correlationId,
  });
}

/**
 * Store message in database for audit trail
 */
async function storeMessage(message: AgentMessage): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    // Store as a conversation log entry
    const conversation: InsertAgentConversation = {
      initiatorAgentId: 1, // Placeholder - would need agent ID lookup
      participantAgentIds: JSON.stringify([message.from, message.to]),
      conversationTopic: message.subject,
      conversationLog: JSON.stringify([message]),
      status: 'active',
    };
    
    await db.insert(agentConversations).values(conversation);
  } catch (error) {
    console.error('[Agent Mesh] Failed to store message:', error);
  }
}

/**
 * Deliver message to handlers
 */
async function deliverMessage(agentName: string, message: AgentMessage): Promise<void> {
  const handlers = messageHandlers.get(agentName);
  if (!handlers || handlers.size === 0) {
    console.warn(`[Agent Mesh] No handlers for agent: ${agentName}`);
    return;
  }
  
  for (const handler of Array.from(handlers)) {
    try {
      await handler(message);
    } catch (error) {
      console.error(`[Agent Mesh] Handler error for ${agentName}:`, error);
    }
  }
}

/**
 * Deliver message directly (fallback for in-memory mode)
 */
async function deliverMessageDirectly(message: AgentMessage): Promise<void> {
  if (message.to === '*') {
    // Broadcast to all
    for (const agentName of Array.from(messageHandlers.keys())) {
      await deliverMessage(agentName, message);
    }
  } else {
    // Deliver to specific agent
    await deliverMessage(message.to, message);
  }
}

/**
 * Generate unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get conversation history between two agents
 */
export async function getConversationHistory(
  agent1: string,
  agent2: string,
  limit: number = 100
): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conversations = await db
    .select()
    .from(agentConversations)
    .limit(limit);
  
  return conversations;
}

/**
 * Cleanup: Close all Redis connections
 */
export async function cleanup(): Promise<void> {
  if (redisPublisher) {
    await redisPublisher.quit();
    redisPublisher = null;
  }
  
  for (const [agentName, subscriber] of Array.from(redisSubscribers.entries())) {
    await subscriber.quit();
  }
  redisSubscribers.clear();
  messageHandlers.clear();
}
