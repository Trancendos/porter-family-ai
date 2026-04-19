import EventEmitter from "events";

export interface AgentMessage {
  from: string; // Agent name
  to: string; // Agent name or "broadcast"
  type: "task" | "result" | "question" | "notification" | "error";
  payload: any;
  timestamp: Date;
  messageId: string;
}

/**
 * Message Bus for inter-agent communication
 * Enables the 24-agent mesh to coordinate and collaborate
 */
class MessageBus extends EventEmitter {
  private messageHistory: AgentMessage[] = [];
  private maxHistorySize = 1000; // Keep last 1000 messages

  /**
   * Send message from one agent to another
   */
  send(message: Omit<AgentMessage, "timestamp" | "messageId">) {
    const fullMessage: AgentMessage = {
      ...message,
      timestamp: new Date(),
      messageId: `${message.from}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Add to history
    this.messageHistory.push(fullMessage);
    
    // Trim history if needed
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
    }

    // Emit events
    this.emit("message", fullMessage);

    if (message.to === "broadcast") {
      this.emit("broadcast", fullMessage);
    } else {
      this.emit(`message:${message.to}`, fullMessage);
    }

    console.log(`[MessageBus] ${message.from} → ${message.to}: ${message.type}`);

    return fullMessage;
  }

  /**
   * Subscribe to messages for a specific agent
   */
  subscribe(agentName: string, handler: (message: AgentMessage) => void) {
    this.on(`message:${agentName}`, handler);
    console.log(`[MessageBus] ${agentName} subscribed to messages`);
  }

  /**
   * Unsubscribe from messages
   */
  unsubscribe(agentName: string, handler: (message: AgentMessage) => void) {
    this.off(`message:${agentName}`, handler);
    console.log(`[MessageBus] ${agentName} unsubscribed from messages`);
  }

  /**
   * Subscribe to all broadcast messages
   */
  subscribeBroadcast(handler: (message: AgentMessage) => void) {
    this.on("broadcast", handler);
    console.log(`[MessageBus] Subscribed to broadcast messages`);
  }

  /**
   * Get message history
   */
  getHistory(agentName?: string, limit = 100): AgentMessage[] {
    let messages = this.messageHistory;

    if (agentName) {
      messages = messages.filter((m) => m.from === agentName || m.to === agentName || m.to === "broadcast");
    }

    return messages.slice(-limit);
  }

  /**
   * Get conversation between two agents
   */
  getConversation(agent1: string, agent2: string, limit = 50): AgentMessage[] {
    return this.messageHistory
      .filter((m) => 
        (m.from === agent1 && m.to === agent2) || 
        (m.from === agent2 && m.to === agent1)
      )
      .slice(-limit);
  }

  /**
   * Clear message history
   */
  clearHistory() {
    this.messageHistory = [];
    console.log("[MessageBus] Message history cleared");
  }

  /**
   * Get statistics
   */
  getStats() {
    const agentStats: Record<string, { sent: number; received: number }> = {};

    this.messageHistory.forEach((msg) => {
      // Sender stats
      if (!agentStats[msg.from]) {
        agentStats[msg.from] = { sent: 0, received: 0 };
      }
      agentStats[msg.from].sent++;

      // Receiver stats
      if (msg.to !== "broadcast") {
        if (!agentStats[msg.to]) {
          agentStats[msg.to] = { sent: 0, received: 0 };
        }
        agentStats[msg.to].received++;
      }
    });

    return {
      totalMessages: this.messageHistory.length,
      agentStats,
      messageTypes: this.messageHistory.reduce((acc, msg) => {
        acc[msg.type] = (acc[msg.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

// Export singleton instance
export const messageBus = new MessageBus();

/**
 * Helper function to send a task to an agent
 */
export function sendTask(from: string, to: string, task: any) {
  return messageBus.send({
    from,
    to,
    type: "task",
    payload: task,
  });
}

/**
 * Helper function to send a result back
 */
export function sendResult(from: string, to: string, result: any) {
  return messageBus.send({
    from,
    to,
    type: "result",
    payload: result,
  });
}

/**
 * Helper function to broadcast a notification
 */
export function broadcastNotification(from: string, notification: any) {
  return messageBus.send({
    from,
    to: "broadcast",
    type: "notification",
    payload: notification,
  });
}

/**
 * Helper function to ask a question
 */
export function askQuestion(from: string, to: string, question: any) {
  return messageBus.send({
    from,
    to,
    type: "question",
    payload: question,
  });
}

/**
 * Helper function to report an error
 */
export function reportError(from: string, error: any) {
  return messageBus.send({
    from,
    to: "broadcast",
    type: "error",
    payload: error,
  });
}
