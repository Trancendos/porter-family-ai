/**
 * Reinforcement Learning System
 * 
 * Implements continuous learning and improvement through:
 * - Reward-based feedback loops
 * - Policy optimization
 * - Experience replay
 * - Multi-armed bandit algorithms
 * - A/B testing framework
 * - Performance tracking and adaptation
 */

export interface Action {
  id: string;
  type: string;
  parameters: any;
  timestamp: Date;
}

export interface Reward {
  actionId: string;
  value: number; // -1 to 1
  feedback: string;
  timestamp: Date;
  metadata?: any;
}

export interface Policy {
  id: string;
  name: string;
  actions: Map<string, number>; // action -> probability
  performance: number;
  updateCount: number;
  lastUpdated: Date;
}

export interface Experience {
  state: any;
  action: Action;
  reward: number;
  nextState: any;
  timestamp: Date;
}

/**
 * Reward function for code quality
 */
export function calculateCodeQualityReward(metrics: {
  passedTests: number;
  totalTests: number;
  codeComplexity: number;
  maintainabilityIndex: number;
  securityIssues: number;
  performanceScore: number;
}): number {
  let reward = 0;

  // Test coverage (0 to 0.3)
  const testCoverage = metrics.totalTests > 0 ? metrics.passedTests / metrics.totalTests : 0;
  reward += testCoverage * 0.3;

  // Code complexity (0 to 0.2, lower is better)
  const complexityScore = Math.max(0, 1 - (metrics.codeComplexity / 20));
  reward += complexityScore * 0.2;

  // Maintainability (0 to 0.2)
  reward += (metrics.maintainabilityIndex / 100) * 0.2;

  // Security (0 to 0.2, no issues = full score)
  const securityScore = Math.max(0, 1 - (metrics.securityIssues / 5));
  reward += securityScore * 0.2;

  // Performance (0 to 0.1)
  reward += (metrics.performanceScore / 100) * 0.1;

  return reward;
}

/**
 * Reward function for user satisfaction
 */
export function calculateUserSatisfactionReward(metrics: {
  taskCompletionRate: number;
  averageResponseTime: number;
  errorRate: number;
  userRating: number;
}): number {
  let reward = 0;

  // Task completion (0 to 0.4)
  reward += metrics.taskCompletionRate * 0.4;

  // Response time (0 to 0.2, faster is better)
  const responseScore = Math.max(0, 1 - (metrics.averageResponseTime / 5000)); // 5s baseline
  reward += responseScore * 0.2;

  // Error rate (0 to 0.2, lower is better)
  const errorScore = Math.max(0, 1 - metrics.errorRate);
  reward += errorScore * 0.2;

  // User rating (0 to 0.2)
  reward += (metrics.userRating / 5) * 0.2;

  return reward;
}

/**
 * Reward function for knowledge quality
 */
export function calculateKnowledgeQualityReward(metrics: {
  accuracy: number;
  relevance: number;
  completeness: number;
  usageCount: number;
  userFeedback: number;
}): number {
  let reward = 0;

  reward += metrics.accuracy * 0.3;
  reward += metrics.relevance * 0.25;
  reward += metrics.completeness * 0.2;
  reward += Math.min(metrics.usageCount / 100, 1) * 0.15; // Usage popularity
  reward += (metrics.userFeedback + 1) / 2 * 0.1; // Normalize -1 to 1 → 0 to 1

  return reward;
}

/**
 * Experience Replay Buffer
 */
export class ExperienceReplayBuffer {
  private buffer: Experience[] = [];
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  add(experience: Experience): void {
    this.buffer.push(experience);
    
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift(); // Remove oldest
    }
  }

  sample(batchSize: number): Experience[] {
    const sampled: Experience[] = [];
    
    for (let i = 0; i < batchSize && i < this.buffer.length; i++) {
      const randomIndex = Math.floor(Math.random() * this.buffer.length);
      sampled.push(this.buffer[randomIndex]);
    }

    return sampled;
  }

  size(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
  }
}

/**
 * Epsilon-Greedy Policy
 * Balances exploration vs exploitation
 */
export class EpsilonGreedyPolicy {
  private epsilon: number;
  private minEpsilon: number;
  private decayRate: number;
  private actionValues: Map<string, number>;
  private actionCounts: Map<string, number>;

  constructor(
    initialEpsilon: number = 0.3,
    minEpsilon: number = 0.05,
    decayRate: number = 0.995
  ) {
    this.epsilon = initialEpsilon;
    this.minEpsilon = minEpsilon;
    this.decayRate = decayRate;
    this.actionValues = new Map();
    this.actionCounts = new Map();
  }

  selectAction(availableActions: string[]): string {
    // Exploration: random action
    if (Math.random() < this.epsilon) {
      return availableActions[Math.floor(Math.random() * availableActions.length)];
    }

    // Exploitation: best known action
    let bestAction = availableActions[0];
    let bestValue = this.actionValues.get(bestAction) || 0;

    for (const action of availableActions) {
      const value = this.actionValues.get(action) || 0;
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }

    return bestAction;
  }

  updateActionValue(action: string, reward: number): void {
    const currentValue = this.actionValues.get(action) || 0;
    const count = (this.actionCounts.get(action) || 0) + 1;
    
    // Incremental average
    const newValue = currentValue + (reward - currentValue) / count;
    
    this.actionValues.set(action, newValue);
    this.actionCounts.set(action, count);

    // Decay epsilon
    this.epsilon = Math.max(this.minEpsilon, this.epsilon * this.decayRate);
  }

  getActionValue(action: string): number {
    return this.actionValues.get(action) || 0;
  }

  getEpsilon(): number {
    return this.epsilon;
  }
}

/**
 * Multi-Armed Bandit
 * For A/B testing and variant selection
 */
export class MultiArmedBandit {
  private arms: Map<string, { pulls: number; totalReward: number; avgReward: number }>;

  constructor() {
    this.arms = new Map();
  }

  addArm(armId: string): void {
    if (!this.arms.has(armId)) {
      this.arms.set(armId, { pulls: 0, totalReward: 0, avgReward: 0 });
    }
  }

  selectArm(): string | null {
    const armIds = Array.from(this.arms.keys());
    if (armIds.length === 0) return null;

    // UCB1 algorithm (Upper Confidence Bound)
    const totalPulls = Array.from(this.arms.values()).reduce((sum, arm) => sum + arm.pulls, 0);
    
    let bestArm = armIds[0];
    let bestScore = -Infinity;

    for (const armId of armIds) {
      const arm = this.arms.get(armId)!;
      
      if (arm.pulls === 0) {
        return armId; // Try untested arms first
      }

      // UCB1 score
      const exploitationTerm = arm.avgReward;
      const explorationTerm = Math.sqrt((2 * Math.log(totalPulls)) / arm.pulls);
      const score = exploitationTerm + explorationTerm;

      if (score > bestScore) {
        bestScore = score;
        bestArm = armId;
      }
    }

    return bestArm;
  }

  updateArm(armId: string, reward: number): void {
    const arm = this.arms.get(armId);
    if (!arm) return;

    arm.pulls++;
    arm.totalReward += reward;
    arm.avgReward = arm.totalReward / arm.pulls;
  }

  getArmStats(armId: string) {
    return this.arms.get(armId);
  }

  getAllStats() {
    return Array.from(this.arms.entries()).map(([id, stats]) => ({
      armId: id,
      ...stats,
    }));
  }
}

/**
 * Q-Learning Agent
 * For learning optimal policies
 */
export class QLearningAgent {
  private qTable: Map<string, Map<string, number>>;
  private learningRate: number;
  private discountFactor: number;
  private epsilon: number;

  constructor(
    learningRate: number = 0.1,
    discountFactor: number = 0.95,
    epsilon: number = 0.1
  ) {
    this.qTable = new Map();
    this.learningRate = learningRate;
    this.discountFactor = discountFactor;
    this.epsilon = epsilon;
  }

  getQValue(state: string, action: string): number {
    if (!this.qTable.has(state)) {
      this.qTable.set(state, new Map());
    }
    return this.qTable.get(state)!.get(action) || 0;
  }

  selectAction(state: string, availableActions: string[]): string {
    // Epsilon-greedy selection
    if (Math.random() < this.epsilon) {
      return availableActions[Math.floor(Math.random() * availableActions.length)];
    }

    // Select best action
    let bestAction = availableActions[0];
    let bestValue = this.getQValue(state, bestAction);

    for (const action of availableActions) {
      const value = this.getQValue(state, action);
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }

    return bestAction;
  }

  update(state: string, action: string, reward: number, nextState: string, nextActions: string[]): void {
    const currentQ = this.getQValue(state, action);

    // Find max Q value for next state
    let maxNextQ = 0;
    for (const nextAction of nextActions) {
      const nextQ = this.getQValue(nextState, nextAction);
      maxNextQ = Math.max(maxNextQ, nextQ);
    }

    // Q-learning update rule
    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);

    if (!this.qTable.has(state)) {
      this.qTable.set(state, new Map());
    }
    this.qTable.get(state)!.set(action, newQ);
  }

  getPolicy(state: string, availableActions: string[]): Map<string, number> {
    const policy = new Map<string, number>();
    
    for (const action of availableActions) {
      policy.set(action, this.getQValue(state, action));
    }

    return policy;
  }
}

/**
 * Performance Tracker
 */
export class PerformanceTracker {
  private metrics: Map<string, number[]>;

  constructor() {
    this.metrics = new Map();
  }

  record(metricName: string, value: number): void {
    if (!this.metrics.has(metricName)) {
      this.metrics.set(metricName, []);
    }
    this.metrics.get(metricName)!.push(value);
  }

  getAverage(metricName: string): number {
    const values = this.metrics.get(metricName) || [];
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  getTrend(metricName: string, windowSize: number = 10): "improving" | "declining" | "stable" {
    const values = this.metrics.get(metricName) || [];
    if (values.length < windowSize * 2) return "stable";

    const recentValues = values.slice(-windowSize);
    const previousValues = values.slice(-windowSize * 2, -windowSize);

    const recentAvg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const previousAvg = previousValues.reduce((sum, val) => sum + val, 0) / previousValues.length;

    const change = (recentAvg - previousAvg) / previousAvg;

    if (change > 0.05) return "improving";
    if (change < -0.05) return "declining";
    return "stable";
  }

  getStats(metricName: string) {
    const values = this.metrics.get(metricName) || [];
    if (values.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, trend: "stable" as const };
    }

    return {
      count: values.length,
      avg: this.getAverage(metricName),
      min: Math.min(...values),
      max: Math.max(...values),
      trend: this.getTrend(metricName),
    };
  }
}

/**
 * Adaptive Learning Rate
 */
export class AdaptiveLearningRate {
  private initialRate: number;
  private currentRate: number;
  private performanceHistory: number[];
  private windowSize: number;

  constructor(initialRate: number = 0.1, windowSize: number = 100) {
    this.initialRate = initialRate;
    this.currentRate = initialRate;
    this.performanceHistory = [];
    this.windowSize = windowSize;
  }

  update(performance: number): void {
    this.performanceHistory.push(performance);

    if (this.performanceHistory.length > this.windowSize) {
      this.performanceHistory.shift();
    }

    // Adjust learning rate based on performance trend
    if (this.performanceHistory.length >= this.windowSize) {
      const recentPerf = this.performanceHistory.slice(-10);
      const olderPerf = this.performanceHistory.slice(0, 10);

      const recentAvg = recentPerf.reduce((sum, val) => sum + val, 0) / recentPerf.length;
      const olderAvg = olderPerf.reduce((sum, val) => sum + val, 0) / olderPerf.length;

      if (recentAvg > olderAvg) {
        // Performance improving - maintain or slightly increase rate
        this.currentRate = Math.min(this.initialRate, this.currentRate * 1.01);
      } else {
        // Performance declining - decrease rate
        this.currentRate = Math.max(0.001, this.currentRate * 0.95);
      }
    }
  }

  getRate(): number {
    return this.currentRate;
  }

  reset(): void {
    this.currentRate = this.initialRate;
    this.performanceHistory = [];
  }
}
