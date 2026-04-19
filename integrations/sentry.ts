/**
 * Sentry Integration Service
 * Priority: CRITICAL
 * 
 * Error monitoring, performance tracking, and auto-healing triggers
 * Uses Sentry MCP server for data access
 */

import { execSync } from 'child_process';

export interface SentryProject {
  id: string;
  name: string;
  slug: string;
  platform: string;
  status: string;
}

export interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  level: 'error' | 'warning' | 'info' | 'fatal';
  status: 'unresolved' | 'resolved' | 'ignored';
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
}

export interface SentryEvent {
  id: string;
  message: string;
  platform: string;
  timestamp: string;
  tags: Record<string, string>;
  contexts: any;
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace: any;
    }>;
  };
}

/**
 * List all Sentry projects
 */
export async function listSentryProjects(): Promise<SentryProject[]> {
  try {
    const result = execSync(
      `trancendos-mcp-cli tool call list_projects --server sentry --input '{}'`,
      { encoding: 'utf-8' }
    );
    const data = JSON.parse(result);
    return data.projects || [];
  } catch (error) {
    console.error('Sentry listProjects error:', error);
    return [];
  }
}

/**
 * Get issues for a project
 */
export async function getSentryIssues(projectSlug: string, status: 'unresolved' | 'resolved' | 'all' = 'unresolved'): Promise<SentryIssue[]> {
  try {
    const result = execSync(
      `trancendos-mcp-cli tool call list_issues --server sentry --input '{"project_slug":"${projectSlug}","status":"${status}"}'`,
      { encoding: 'utf-8' }
    );
    const data = JSON.parse(result);
    return data.issues || [];
  } catch (error) {
    console.error('Sentry getIssues error:', error);
    return [];
  }
}

/**
 * Get events for an issue
 */
export async function getSentryEvents(issueId: string): Promise<SentryEvent[]> {
  try {
    const result = execSync(
      `trancendos-mcp-cli tool call get_issue_events --server sentry --input '{"issue_id":"${issueId}"}'`,
      { encoding: 'utf-8' }
    );
    const data = JSON.parse(result);
    return data.events || [];
  } catch (error) {
    console.error('Sentry getEvents error:', error);
    return [];
  }
}

/**
 * Resolve an issue
 */
export async function resolveSentryIssue(issueId: string): Promise<boolean> {
  try {
    execSync(
      `trancendos-mcp-cli tool call resolve_issue --server sentry --input '{"issue_id":"${issueId}"}'`,
      { encoding: 'utf-8' }
    );
    return true;
  } catch (error) {
    console.error('Sentry resolveIssue error:', error);
    return false;
  }
}

/**
 * Get error statistics for auto-healing triggers
 */
export async function getSentryErrorStats(projectSlug: string): Promise<{
  totalErrors: number;
  criticalErrors: number;
  unresolvedErrors: number;
  errorRate: number;
}> {
  const issues = await getSentryIssues(projectSlug, 'unresolved');
  
  const criticalErrors = issues.filter(i => i.level === 'fatal' || i.level === 'error').length;
  const totalErrors = issues.reduce((sum, i) => sum + i.count, 0);
  const unresolvedErrors = issues.length;
  
  return {
    totalErrors,
    criticalErrors,
    unresolvedErrors,
    errorRate: totalErrors / (Date.now() / 1000 / 3600), // Errors per hour (rough estimate)
  };
}

/**
 * Check if error requires auto-healing
 */
export async function checkAutoHealingTrigger(projectSlug: string): Promise<{
  shouldTrigger: boolean;
  reason: string;
  issues: SentryIssue[];
}> {
  const stats = await getSentryErrorStats(projectSlug);
  
  // Trigger auto-healing if:
  // 1. More than 10 critical errors
  // 2. Error rate > 100 per hour
  // 3. More than 50 unresolved errors
  
  if (stats.criticalErrors > 10) {
    const issues = await getSentryIssues(projectSlug, 'unresolved');
    return {
      shouldTrigger: true,
      reason: `Critical errors threshold exceeded: ${stats.criticalErrors} critical errors`,
      issues: issues.filter(i => i.level === 'fatal' || i.level === 'error'),
    };
  }
  
  if (stats.errorRate > 100) {
    const issues = await getSentryIssues(projectSlug, 'unresolved');
    return {
      shouldTrigger: true,
      reason: `Error rate too high: ${stats.errorRate.toFixed(2)} errors/hour`,
      issues,
    };
  }
  
  if (stats.unresolvedErrors > 50) {
    const issues = await getSentryIssues(projectSlug, 'unresolved');
    return {
      shouldTrigger: true,
      reason: `Too many unresolved errors: ${stats.unresolvedErrors}`,
      issues,
    };
  }
  
  return {
    shouldTrigger: false,
    reason: 'All metrics within acceptable range',
    issues: [],
  };
}
