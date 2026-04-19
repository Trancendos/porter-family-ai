/**
 * Vercel Integration Service
 * Priority: HIGH
 * 
 * Deployment tracking, build status monitoring, preview URLs
 * Uses Vercel MCP server for data access
 */

import { execSync } from 'child_process';

export interface VercelProject {
  id: string;
  name: string;
  framework: string;
  createdAt: number;
  updatedAt: number;
  latestDeployments: VercelDeployment[];
}

export interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  type: 'LAMBDAS';
  created: number;
  ready: number;
  buildingAt: number;
  creator: {
    uid: string;
    username: string;
  };
  target: 'production' | 'staging' | 'preview';
}

export interface VercelDeploymentLog {
  timestamp: number;
  text: string;
  type: 'stdout' | 'stderr' | 'command';
}

/**
 * List all Vercel projects
 */
export async function listVercelProjects(): Promise<VercelProject[]> {
  try {
    const result = execSync(
      `trancendos-mcp-cli tool call list_projects --server vercel --input '{}'`,
      { encoding: 'utf-8' }
    );
    const data = JSON.parse(result);
    return data.projects || [];
  } catch (error) {
    console.error('Vercel listProjects error:', error);
    return [];
  }
}

/**
 * Get deployments for a project
 */
export async function getVercelDeployments(projectId: string, limit: number = 10): Promise<VercelDeployment[]> {
  try {
    const result = execSync(
      `trancendos-mcp-cli tool call list_deployments --server vercel --input '{"project_id":"${projectId}","limit":${limit}}'`,
      { encoding: 'utf-8' }
    );
    const data = JSON.parse(result);
    return data.deployments || [];
  } catch (error) {
    console.error('Vercel getDeployments error:', error);
    return [];
  }
}

/**
 * Get deployment logs
 */
export async function getVercelDeploymentLogs(deploymentId: string): Promise<VercelDeploymentLog[]> {
  try {
    const result = execSync(
      `trancendos-mcp-cli tool call get_deployment_logs --server vercel --input '{"deployment_id":"${deploymentId}"}'`,
      { encoding: 'utf-8' }
    );
    const data = JSON.parse(result);
    return data.logs || [];
  } catch (error) {
    console.error('Vercel getDeploymentLogs error:', error);
    return [];
  }
}

/**
 * Get deployment status summary
 */
export async function getVercelDeploymentStats(projectId: string): Promise<{
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  buildingDeployments: number;
  successRate: number;
  averageBuildTime: number;
}> {
  const deployments = await getVercelDeployments(projectId, 50);
  
  const successful = deployments.filter(d => d.state === 'READY').length;
  const failed = deployments.filter(d => d.state === 'ERROR').length;
  const building = deployments.filter(d => d.state === 'BUILDING').length;
  
  const buildTimes = deployments
    .filter(d => d.ready && d.buildingAt)
    .map(d => d.ready - d.buildingAt);
  
  const averageBuildTime = buildTimes.length > 0
    ? buildTimes.reduce((sum, time) => sum + time, 0) / buildTimes.length
    : 0;
  
  return {
    totalDeployments: deployments.length,
    successfulDeployments: successful,
    failedDeployments: failed,
    buildingDeployments: building,
    successRate: deployments.length > 0 ? (successful / deployments.length) * 100 : 0,
    averageBuildTime: averageBuildTime / 1000, // Convert to seconds
  };
}

/**
 * Check for failed deployments requiring attention
 */
export async function checkFailedDeployments(projectId: string): Promise<{
  hasFailures: boolean;
  failedDeployments: VercelDeployment[];
  reason: string;
}> {
  const deployments = await getVercelDeployments(projectId, 20);
  const failed = deployments.filter(d => d.state === 'ERROR');
  
  if (failed.length > 0) {
    return {
      hasFailures: true,
      failedDeployments: failed,
      reason: `${failed.length} deployment(s) failed in recent history`,
    };
  }
  
  return {
    hasFailures: false,
    failedDeployments: [],
    reason: 'All recent deployments successful',
  };
}

/**
 * Get production deployment URL
 */
export async function getProductionUrl(projectId: string): Promise<string | null> {
  const deployments = await getVercelDeployments(projectId, 10);
  const production = deployments.find(d => d.target === 'production' && d.state === 'READY');
  return production ? `https://${production.url}` : null;
}
