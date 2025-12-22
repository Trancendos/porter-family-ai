/**
 * Performance Profiler
 * 
 * Track execution times, identify bottlenecks, and provide optimization recommendations
 */

export interface PerformanceMetric {
  id: string;
  operation: string;
  category: "database" | "api" | "computation" | "rendering" | "network";
  startTime: number;
  endTime: number;
  duration: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface Bottleneck {
  operation: string;
  averageDuration: number;
  occurrences: number;
  severity: "low" | "medium" | "high" | "critical";
  recommendation: string;
}

export interface PerformanceReport {
  totalOperations: number;
  averageDuration: number;
  slowestOperations: PerformanceMetric[];
  bottlenecks: Bottleneck[];
  recommendations: string[];
}

// In-memory storage for metrics (should be moved to database in production)
const metrics: PerformanceMetric[] = [];

/**
 * Start profiling an operation
 */
export function startProfiling(
  operation: string,
  category: PerformanceMetric["category"],
  metadata?: Record<string, any>
): string {
  const id = `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const metric: PerformanceMetric = {
    id,
    operation,
    category,
    startTime: performance.now(),
    endTime: 0,
    duration: 0,
    metadata,
    timestamp: new Date(),
  };

  metrics.push(metric);

  return id;
}

/**
 * End profiling an operation
 */
export function endProfiling(id: string): PerformanceMetric | null {
  const metric = metrics.find((m) => m.id === id);

  if (!metric) {
    console.warn(`[Performance Profiler] Metric ${id} not found`);
    return null;
  }

  metric.endTime = performance.now();
  metric.duration = metric.endTime - metric.startTime;

  console.log(`[Performance Profiler] ${metric.operation}: ${metric.duration.toFixed(2)}ms`);

  return metric;
}

/**
 * Profile a function execution
 */
export async function profileFunction<T>(
  operation: string,
  category: PerformanceMetric["category"],
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const id = startProfiling(operation, category, metadata);

  try {
    const result = await fn();
    endProfiling(id);
    return result;
  } catch (error) {
    endProfiling(id);
    throw error;
  }
}

/**
 * Get all metrics
 */
export function getAllMetrics(): PerformanceMetric[] {
  return [...metrics];
}

/**
 * Get metrics by category
 */
export function getMetricsByCategory(
  category: PerformanceMetric["category"]
): PerformanceMetric[] {
  return metrics.filter((m) => m.category === category);
}

/**
 * Get metrics by operation
 */
export function getMetricsByOperation(operation: string): PerformanceMetric[] {
  return metrics.filter((m) => m.operation === operation);
}

/**
 * Identify bottlenecks
 */
export function identifyBottlenecks(thresholdMs: number = 1000): Bottleneck[] {
  const operationGroups = new Map<string, PerformanceMetric[]>();

  // Group metrics by operation
  for (const metric of metrics) {
    if (!operationGroups.has(metric.operation)) {
      operationGroups.set(metric.operation, []);
    }
    operationGroups.get(metric.operation)!.push(metric);
  }

  const bottlenecks: Bottleneck[] = [];

  // Analyze each operation group
  for (const [operation, operationMetrics] of operationGroups.entries()) {
    const avgDuration =
      operationMetrics.reduce((sum, m) => sum + m.duration, 0) / operationMetrics.length;

    if (avgDuration > thresholdMs) {
      let severity: Bottleneck["severity"];
      if (avgDuration > 5000) severity = "critical";
      else if (avgDuration > 3000) severity = "high";
      else if (avgDuration > 1500) severity = "medium";
      else severity = "low";

      const recommendation = generateRecommendation(operation, avgDuration, operationMetrics[0].category);

      bottlenecks.push({
        operation,
        averageDuration: avgDuration,
        occurrences: operationMetrics.length,
        severity,
        recommendation,
      });
    }
  }

  return bottlenecks.sort((a, b) => b.averageDuration - a.averageDuration);
}

/**
 * Generate optimization recommendation
 */
function generateRecommendation(
  operation: string,
  avgDuration: number,
  category: PerformanceMetric["category"]
): string {
  const recommendations: Record<PerformanceMetric["category"], string> = {
    database: "Consider adding database indexes, optimizing queries, or implementing caching",
    api: "Implement request batching, caching, or consider using a CDN",
    computation: "Optimize algorithms, use memoization, or consider moving to background jobs",
    rendering: "Implement virtual scrolling, lazy loading, or reduce component re-renders",
    network: "Reduce payload size, enable compression, or use HTTP/2",
  };

  return recommendations[category] || "Review and optimize this operation";
}

/**
 * Generate performance report
 */
export function generatePerformanceReport(): PerformanceReport {
  const totalOperations = metrics.length;

  const averageDuration =
    metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length
      : 0;

  const slowestOperations = [...metrics]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  const bottlenecks = identifyBottlenecks();

  const recommendations: string[] = [
    ...bottlenecks.map((b) => `${b.operation}: ${b.recommendation}`),
  ];

  // Add general recommendations
  if (averageDuration > 500) {
    recommendations.push("Overall performance is slow. Consider implementing caching strategies.");
  }

  const dbMetrics = getMetricsByCategory("database");
  if (dbMetrics.length > 0) {
    const avgDbDuration = dbMetrics.reduce((sum, m) => sum + m.duration, 0) / dbMetrics.length;
    if (avgDbDuration > 200) {
      recommendations.push("Database queries are slow. Review indexes and query optimization.");
    }
  }

  return {
    totalOperations,
    averageDuration,
    slowestOperations,
    bottlenecks,
    recommendations,
  };
}

/**
 * Clear metrics (for testing or periodic cleanup)
 */
export function clearMetrics(): void {
  metrics.length = 0;
  console.log("[Performance Profiler] Metrics cleared");
}

/**
 * Get metrics summary by time range
 */
export function getMetricsSummary(
  timeRange: "1h" | "24h" | "7d" = "24h"
): {
  totalOperations: number;
  averageDuration: number;
  p50: number;
  p95: number;
  p99: number;
} {
  const now = Date.now();
  const rangeMs = timeRange === "1h" ? 3600000 : timeRange === "24h" ? 86400000 : 604800000;

  const recentMetrics = metrics.filter(
    (m) => now - m.timestamp.getTime() < rangeMs
  );

  if (recentMetrics.length === 0) {
    return {
      totalOperations: 0,
      averageDuration: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    };
  }

  const sorted = [...recentMetrics].sort((a, b) => a.duration - b.duration);

  const p50Index = Math.floor(sorted.length * 0.5);
  const p95Index = Math.floor(sorted.length * 0.95);
  const p99Index = Math.floor(sorted.length * 0.99);

  return {
    totalOperations: recentMetrics.length,
    averageDuration:
      recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length,
    p50: sorted[p50Index]?.duration || 0,
    p95: sorted[p95Index]?.duration || 0,
    p99: sorted[p99Index]?.duration || 0,
  };
}
