/**
 * AI Intercommunication Service
 * 
 * Manages cross-hybrid communication between:
 * - AI-to-AI: Direct communication between AI agents
 * - Platform-to-AI: Platform commands and data to AI agents
 * - AI-to-Platform: AI responses and outputs to platform
 * 
 * Features:
 * - Multi-directional message routing
 * - Data stream processing
 * - Message queue management
 * - Health monitoring
 * - Error recovery
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { 
  sendAiToAiNotification, 
  sendPlatformToAiNotification, 
  sendAiToPlatformNotification,
  logAiCommunication 
} from "./unifiedNotifications";

// Communication Types
export type CommunicationType = 'ai_to_ai' | 'platform_to_ai' | 'ai_to_platform';
export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';
export type MessageStatus = 'queued' | 'processing' | 'delivered' | 'acknowledged' | 'failed';

// Message Structure
export interface IntercommMessage {
  id: string;
  type: CommunicationType;
  sourceId: string;
  sourceType: 'ai' | 'platform';
  targetId: string;
  targetType: 'ai' | 'platform' | 'user';
  payload: unknown;
  priority: MessagePriority;
  status: MessageStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  processedAt?: Date;
  acknowledgedAt?: Date;
  error?: string;
}

// Channel Configuration
export interface ChannelConfig {
  id: string;
  name: string;
  type: CommunicationType;
  enabled: boolean;
  rateLimit: number; // messages per minute
  bufferSize: number;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
    backoffMultiplier: number;
  };
}

// Default channel configurations
const DEFAULT_CHANNELS: ChannelConfig[] = [
  {
    id: 'ai_to_ai_default',
    name: 'AI-to-AI Default Channel',
    type: 'ai_to_ai',
    enabled: true,
    rateLimit: 100,
    bufferSize: 1000,
    retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
  },
  {
    id: 'platform_to_ai_default',
    name: 'Platform-to-AI Default Channel',
    type: 'platform_to_ai',
    enabled: true,
    rateLimit: 200,
    bufferSize: 2000,
    retryPolicy: { maxRetries: 5, backoffMs: 500, backoffMultiplier: 1.5 },
  },
  {
    id: 'ai_to_platform_default',
    name: 'AI-to-Platform Default Channel',
    type: 'ai_to_platform',
    enabled: true,
    rateLimit: 150,
    bufferSize: 1500,
    retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
  },
];

// In-memory message queues
const messageQueues: Map<CommunicationType, IntercommMessage[]> = new Map([
  ['ai_to_ai', []],
  ['platform_to_ai', []],
  ['ai_to_platform', []],
]);

// Channel health status
const channelHealth: Map<string, {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  messagesProcessed: number;
  messagesFailed: number;
  avgLatencyMs: number;
}> = new Map();

// Registered AI agents
const registeredAgents: Map<string, {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  status: 'online' | 'offline' | 'busy';
  lastHeartbeat: Date;
}> = new Map();

// ============================================
// Agent Registration
// ============================================

/**
 * Register an AI agent for intercommunication
 */
export function registerAgent(
  id: string,
  name: string,
  type: string,
  capabilities: string[]
): boolean {
  registeredAgents.set(id, {
    id,
    name,
    type,
    capabilities,
    status: 'online',
    lastHeartbeat: new Date(),
  });
  
  console.log(`[AI Intercomm] Agent registered: ${name} (${id})`);
  return true;
}

/**
 * Unregister an AI agent
 */
export function unregisterAgent(id: string): boolean {
  const result = registeredAgents.delete(id);
  if (result) {
    console.log(`[AI Intercomm] Agent unregistered: ${id}`);
  }
  return result;
}

/**
 * Update agent heartbeat
 */
export function updateAgentHeartbeat(id: string): boolean {
  const agent = registeredAgents.get(id);
  if (agent) {
    agent.lastHeartbeat = new Date();
    agent.status = 'online';
    return true;
  }
  return false;
}

/**
 * Get all registered agents
 */
export function getRegisteredAgents(): typeof registeredAgents extends Map<string, infer V> ? V[] : never {
  return Array.from(registeredAgents.values());
}

// ============================================
// Message Routing
// ============================================

/**
 * Send a message through the intercommunication system
 */
export async function sendIntercommMessage(
  type: CommunicationType,
  sourceId: string,
  targetId: string,
  payload: unknown,
  priority: MessagePriority = 'normal'
): Promise<{ success: boolean; messageId: string; error?: string }> {
  const messageId = uuidv4();
  
  const message: IntercommMessage = {
    id: messageId,
    type,
    sourceId,
    sourceType: type === 'platform_to_ai' ? 'platform' : 'ai',
    targetId,
    targetType: type === 'ai_to_platform' ? 'platform' : 'ai',
    payload,
    priority,
    status: 'queued',
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
  };
  
  try {
    // Add to queue
    const queue = messageQueues.get(type);
    if (queue) {
      queue.push(message);
    }
    
    // Process immediately for high priority
    if (priority === 'high' || priority === 'critical') {
      await processMessage(message);
    }
    
    // Log the communication
    await logAiCommunication(
      message.sourceType,
      sourceId,
      message.targetType,
      targetId,
      typeof payload === 'string' ? payload : JSON.stringify(payload),
      { messageId, priority }
    );
    
    return { success: true, messageId };
  } catch (error) {
    console.error(`[AI Intercomm] Failed to send message:`, error);
    return { 
      success: false, 
      messageId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Process a single message
 */
async function processMessage(message: IntercommMessage): Promise<boolean> {
  message.status = 'processing';
  
  try {
    // Route based on type
    switch (message.type) {
      case 'ai_to_ai':
        await routeAiToAi(message);
        break;
      case 'platform_to_ai':
        await routePlatformToAi(message);
        break;
      case 'ai_to_platform':
        await routeAiToPlatform(message);
        break;
    }
    
    message.status = 'delivered';
    message.processedAt = new Date();
    
    // Update channel health
    updateChannelHealth(message.type, true);
    
    return true;
  } catch (error) {
    message.retryCount++;
    message.error = error instanceof Error ? error.message : 'Unknown error';
    
    if (message.retryCount >= message.maxRetries) {
      message.status = 'failed';
      updateChannelHealth(message.type, false);
    } else {
      message.status = 'queued';
    }
    
    return false;
  }
}

/**
 * Route AI-to-AI message
 */
async function routeAiToAi(message: IntercommMessage): Promise<void> {
  const targetAgent = registeredAgents.get(message.targetId);
  
  if (!targetAgent) {
    throw new Error(`Target agent not found: ${message.targetId}`);
  }
  
  if (targetAgent.status === 'offline') {
    throw new Error(`Target agent is offline: ${message.targetId}`);
  }
  
  // Send notification
  await sendAiToAiNotification(
    message.sourceId,
    message.targetId,
    typeof message.payload === 'string' ? message.payload : JSON.stringify(message.payload),
    { messageId: message.id, priority: message.priority }
  );
  
  console.log(`[AI Intercomm] AI→AI: ${message.sourceId} → ${message.targetId}`);
}

/**
 * Route Platform-to-AI message
 */
async function routePlatformToAi(message: IntercommMessage): Promise<void> {
  const targetAgent = registeredAgents.get(message.targetId);
  
  if (!targetAgent) {
    // If agent not registered, still try to send
    console.warn(`[AI Intercomm] Target agent not registered: ${message.targetId}`);
  }
  
  // Send notification
  await sendPlatformToAiNotification(
    message.sourceId,
    message.targetId,
    typeof message.payload === 'string' ? message.payload : JSON.stringify(message.payload),
    { messageId: message.id, priority: message.priority }
  );
  
  console.log(`[AI Intercomm] Platform→AI: ${message.sourceId} → ${message.targetId}`);
}

/**
 * Route AI-to-Platform message
 */
async function routeAiToPlatform(message: IntercommMessage): Promise<void> {
  // Send notification (broadcast to platform)
  await sendAiToPlatformNotification(
    message.sourceId,
    message.targetId,
    typeof message.payload === 'string' ? message.payload : JSON.stringify(message.payload),
    undefined, // No specific user
    { messageId: message.id, priority: message.priority }
  );
  
  console.log(`[AI Intercomm] AI→Platform: ${message.sourceId} → ${message.targetId}`);
}

// ============================================
// Health Monitoring
// ============================================

/**
 * Update channel health metrics
 */
function updateChannelHealth(type: CommunicationType, success: boolean): void {
  const channelId = `${type}_default`;
  const current = channelHealth.get(channelId) ?? {
    status: 'healthy' as const,
    lastCheck: new Date(),
    messagesProcessed: 0,
    messagesFailed: 0,
    avgLatencyMs: 0,
  };
  
  if (success) {
    current.messagesProcessed++;
  } else {
    current.messagesFailed++;
  }
  
  // Calculate health status
  const failureRate = current.messagesFailed / (current.messagesProcessed + current.messagesFailed);
  if (failureRate > 0.5) {
    current.status = 'unhealthy';
  } else if (failureRate > 0.1) {
    current.status = 'degraded';
  } else {
    current.status = 'healthy';
  }
  
  current.lastCheck = new Date();
  channelHealth.set(channelId, current);
}

/**
 * Get channel health status
 */
export function getChannelHealth(): Map<string, {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  messagesProcessed: number;
  messagesFailed: number;
  avgLatencyMs: number;
}> {
  return new Map(channelHealth);
}

/**
 * Get intercommunication statistics
 */
export function getIntercommStats(): {
  totalAgents: number;
  onlineAgents: number;
  channels: {
    type: CommunicationType;
    queueSize: number;
    health: string;
    processed: number;
    failed: number;
  }[];
} {
  const agents = Array.from(registeredAgents.values());
  
  return {
    totalAgents: agents.length,
    onlineAgents: agents.filter(a => a.status === 'online').length,
    channels: (['ai_to_ai', 'platform_to_ai', 'ai_to_platform'] as CommunicationType[]).map(type => {
      const queue = messageQueues.get(type) ?? [];
      const health = channelHealth.get(`${type}_default`);
      
      return {
        type,
        queueSize: queue.length,
        health: health?.status ?? 'unknown',
        processed: health?.messagesProcessed ?? 0,
        failed: health?.messagesFailed ?? 0,
      };
    }),
  };
}

// ============================================
// Data Stream Processing
// ============================================

/**
 * Process multiple data streams concurrently
 */
export async function processDataStreams(
  streams: Array<{
    sourceId: string;
    targetId: string;
    data: unknown[];
    type: CommunicationType;
  }>
): Promise<{
  processed: number;
  failed: number;
  errors: string[];
}> {
  let processed = 0;
  let failed = 0;
  const errors: string[] = [];
  
  // Process streams in parallel
  await Promise.all(streams.map(async (stream) => {
    for (const item of stream.data) {
      try {
        const result = await sendIntercommMessage(
          stream.type,
          stream.sourceId,
          stream.targetId,
          item
        );
        
        if (result.success) {
          processed++;
        } else {
          failed++;
          if (result.error) errors.push(result.error);
        }
      } catch (error) {
        failed++;
        errors.push(error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }));
  
  return { processed, failed, errors };
}

// ============================================
// Queue Processing
// ============================================

/**
 * Process message queues
 */
async function processQueues(): Promise<void> {
  for (const [type, queue] of messageQueues) {
    // Process up to 10 messages per cycle
    const batch = queue.splice(0, 10);
    
    for (const message of batch) {
      if (message.status === 'queued') {
        await processMessage(message);
      }
    }
  }
}

// Start queue processor
setInterval(processQueues, 1000);

// ============================================
// Verification Functions
// ============================================

/**
 * Verify AI-to-AI communication
 */
export async function verifyAiToAiCommunication(): Promise<{
  success: boolean;
  latencyMs: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const testMessage = {
      type: 'verification',
      timestamp: new Date().toISOString(),
      payload: 'AI-to-AI verification test',
    };
    
    const result = await sendIntercommMessage(
      'ai_to_ai',
      'verification_source',
      'verification_target',
      testMessage,
      'high'
    );
    
    const latencyMs = Date.now() - startTime;
    
    return {
      success: result.success,
      latencyMs,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify Platform-to-AI communication
 */
export async function verifyPlatformToAiCommunication(): Promise<{
  success: boolean;
  latencyMs: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const testMessage = {
      type: 'verification',
      timestamp: new Date().toISOString(),
      payload: 'Platform-to-AI verification test',
    };
    
    const result = await sendIntercommMessage(
      'platform_to_ai',
      'luminous_platform',
      'verification_target',
      testMessage,
      'high'
    );
    
    const latencyMs = Date.now() - startTime;
    
    return {
      success: result.success,
      latencyMs,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify AI-to-Platform communication
 */
export async function verifyAiToPlatformCommunication(): Promise<{
  success: boolean;
  latencyMs: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const testMessage = {
      type: 'verification',
      timestamp: new Date().toISOString(),
      payload: 'AI-to-Platform verification test',
    };
    
    const result = await sendIntercommMessage(
      'ai_to_platform',
      'verification_source',
      'luminous_platform',
      testMessage,
      'high'
    );
    
    const latencyMs = Date.now() - startTime;
    
    return {
      success: result.success,
      latencyMs,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run full intercommunication verification
 */
export async function runFullVerification(): Promise<{
  overall: boolean;
  aiToAi: { success: boolean; latencyMs: number; error?: string };
  platformToAi: { success: boolean; latencyMs: number; error?: string };
  aiToPlatform: { success: boolean; latencyMs: number; error?: string };
  stats: ReturnType<typeof getIntercommStats>;
}> {
  const [aiToAi, platformToAi, aiToPlatform] = await Promise.all([
    verifyAiToAiCommunication(),
    verifyPlatformToAiCommunication(),
    verifyAiToPlatformCommunication(),
  ]);
  
  return {
    overall: aiToAi.success && platformToAi.success && aiToPlatform.success,
    aiToAi,
    platformToAi,
    aiToPlatform,
    stats: getIntercommStats(),
  };
}

// Initialize default agents
registerAgent('cornelius', 'Cornelius', 'orchestrator', ['task_management', 'delegation']);
registerAgent('prometheus', 'Prometheus', 'monitor', ['security', 'compliance']);
registerAgent('the_dr', 'The Dr', 'healer', ['error_detection', 'self_healing']);
registerAgent('doris', 'Doris', 'assistant', ['data_processing', 'reporting']);
registerAgent('infinity', 'Infinity', 'analyzer', ['data_analysis', 'insights']);
registerAgent('guardian', 'Guardian', 'security', ['access_control', 'audit']);

console.log('[AI Intercomm] Service initialized with 6 default agents');
