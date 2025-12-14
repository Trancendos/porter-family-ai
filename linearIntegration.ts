/**
 * Linear Integration Service
 * 
 * Integrates with Linear workspace via MCP for:
 * - Issue creation from errors
 * - Project phase sync
 * - Task automation
 * - Status tracking
 * 
 * DPID: DPID-ADM-CONN-003
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './errorLoggingService';

const execAsync = promisify(exec);

export interface LinearIssue {
  id: string;
  identifier: string; // e.g., "TRA-64"
  title: string;
  description: string;
  status: string;
  priority: {
    value: number;
    name: string; // "Urgent", "High", "Medium", "Low"
  };
  url: string;
  gitBranchName: string;
  createdAt: Date;
  updatedAt: Date;
  assignee?: string;
  assigneeId?: string;
  team: string;
  teamId: string;
  labels: string[];
  projectId?: string;
  project?: string;
}

export interface LinearProject {
  id: string;
  name: string;
  description: string;
  status: string;
  url: string;
  teamId: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string; // e.g., "TRA"
}

/**
 * Execute MCP tool via manus-mcp-cli
 */
async function executeMCPTool(
  toolName: string,
  input: Record<string, any>
): Promise<any> {
  const inputJson = JSON.stringify(input);
  const command = `manus-mcp-cli tool call ${toolName} --server linear --input '${inputJson}'`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('Tool execution result saved')) {
      logger.warn(`[Linear MCP] Warning: ${stderr}`);
    }
    
    // Parse the JSON output
    const lines = stdout.split('\n');
    const resultLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));
    
    if (resultLine) {
      return JSON.parse(resultLine);
    }
    
    return null;
  } catch (error: any) {
    logger.error(`[Linear MCP] Error executing ${toolName}:`, error);
    throw new Error(`Linear MCP tool ${toolName} failed: ${error.message}`);
  }
}

/**
 * Parse Linear issue from API response
 */
function parseLinearIssue(issue: any): LinearIssue {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description || '',
    status: issue.status,
    priority: issue.priority || { value: 3, name: 'Medium' },
    url: issue.url,
    gitBranchName: issue.gitBranchName || '',
    createdAt: new Date(issue.createdAt),
    updatedAt: new Date(issue.updatedAt),
    assignee: issue.assignee,
    assigneeId: issue.assigneeId,
    team: issue.team,
    teamId: issue.teamId,
    labels: issue.labels || [],
    projectId: issue.projectId,
    project: issue.project,
  };
}

/**
 * List Linear issues
 */
export async function listLinearIssues(
  filter?: Record<string, any>,
  first: number = 50
): Promise<LinearIssue[]> {
  logger.info('[Linear] Listing issues');
  
  const result = await executeMCPTool('list_issues', {
    filter,
    first,
  });
  
  if (!result || !Array.isArray(result)) {
    return [];
  }
  
  return result.map(parseLinearIssue);
}

/**
 * Get Linear issue by ID
 */
export async function getLinearIssue(issueId: string): Promise<LinearIssue | null> {
  logger.info(`[Linear] Getting issue: ${issueId}`);
  
  const result = await executeMCPTool('get_issue', {
    issueId,
  });
  
  if (!result) {
    return null;
  }
  
  return parseLinearIssue(result);
}

/**
 * Create Linear issue
 */
export async function createLinearIssue(
  teamId: string,
  title: string,
  description: string,
  priority?: number,
  assigneeId?: string,
  projectId?: string,
  labels?: string[]
): Promise<LinearIssue> {
  logger.info(`[Linear] Creating issue: ${title}`);
  
  const result = await executeMCPTool('create_issue', {
    teamId,
    title,
    description,
    priority,
    assigneeId,
    projectId,
    labelIds: labels,
  });
  
  return parseLinearIssue(result);
}

/**
 * Update Linear issue
 */
export async function updateLinearIssue(
  issueId: string,
  updates: {
    title?: string;
    description?: string;
    status?: string;
    priority?: number;
    assigneeId?: string;
    projectId?: string;
  }
): Promise<LinearIssue> {
  logger.info(`[Linear] Updating issue: ${issueId}`);
  
  const result = await executeMCPTool('update_issue', {
    issueId,
    ...updates,
  });
  
  return parseLinearIssue(result);
}

/**
 * Search Linear issues
 */
export async function searchLinearIssues(
  query: string,
  first: number = 20
): Promise<LinearIssue[]> {
  logger.info(`[Linear] Searching issues: ${query}`);
  
  const result = await executeMCPTool('search_issues', {
    query,
    first,
  });
  
  if (!result || !Array.isArray(result)) {
    return [];
  }
  
  return result.map(parseLinearIssue);
}

/**
 * Create Linear issue from error code
 */
export async function createIssueFromError(
  errorCode: string,
  errorTitle: string,
  errorDescription: string,
  errorCategory: string,
  severity: 'critical' | 'high' | 'medium' | 'low'
): Promise<LinearIssue> {
  logger.info(`[Linear] Creating issue from error: ${errorCode}`);
  
  // Map severity to Linear priority
  const priorityMap: Record<string, number> = {
    critical: 1, // Urgent
    high: 2,     // High
    medium: 3,   // Medium
    low: 4,      // Low
  };
  
  const priority = priorityMap[severity] || 3;
  
  // Get Trancendos team ID (TRA)
  const teams = await listLinearTeams();
  const trancendosTeam = teams.find(t => t.key === 'TRA');
  
  if (!trancendosTeam) {
    throw new Error('Trancendos team (TRA) not found in Linear');
  }
  
  const description = `## Error Code: \`${errorCode}\`

**Category**: ${errorCategory}
**Severity**: ${severity.toUpperCase()}

### Description

${errorDescription}

### Resolution Steps

1. Review error logs and stack trace
2. Identify root cause
3. Implement fix
4. Test thoroughly
5. Deploy to production
6. Update Knowledge Base article

### Related Resources

- Error Code: \`${errorCode}\`
- Knowledge Base: [View Article](#)
- Guardian Dashboard: [View Security Report](#)

---

*This issue was automatically created by The Guardian security system.*
`;
  
  return await createLinearIssue(
    trancendosTeam.id,
    `[${errorCode}] ${errorTitle}`,
    description,
    priority
  );
}

/**
 * List Linear teams
 */
export async function listLinearTeams(): Promise<LinearTeam[]> {
  logger.info('[Linear] Listing teams');
  
  const result = await executeMCPTool('list_teams', {});
  
  if (!result || !Array.isArray(result)) {
    return [];
  }
  
  return result.map((team: any) => ({
    id: team.id,
    name: team.name,
    key: team.key,
  }));
}

/**
 * List Linear projects
 */
export async function listLinearProjects(teamId?: string): Promise<LinearProject[]> {
  logger.info('[Linear] Listing projects');
  
  const result = await executeMCPTool('list_projects', {
    teamId,
  });
  
  if (!result || !Array.isArray(result)) {
    return [];
  }
  
  return result.map((project: any) => ({
    id: project.id,
    name: project.name,
    description: project.description || '',
    status: project.state,
    url: project.url,
    teamId: project.teamId,
  }));
}

/**
 * Create Linear project
 */
export async function createLinearProject(
  teamId: string,
  name: string,
  description: string
): Promise<LinearProject> {
  logger.info(`[Linear] Creating project: ${name}`);
  
  const result = await executeMCPTool('create_project', {
    teamId,
    name,
    description,
  });
  
  return {
    id: result.id,
    name: result.name,
    description: result.description || '',
    status: result.state,
    url: result.url,
    teamId: result.teamId,
  };
}

/**
 * Create comment on Linear issue
 */
export async function createLinearComment(
  issueId: string,
  body: string
): Promise<void> {
  logger.info(`[Linear] Creating comment on issue: ${issueId}`);
  
  await executeMCPTool('create_comment', {
    issueId,
    body,
  });
}

/**
 * List comments on Linear issue
 */
export async function listLinearComments(issueId: string): Promise<any[]> {
  logger.info(`[Linear] Listing comments for issue: ${issueId}`);
  
  const result = await executeMCPTool('list_comments', {
    issueId,
  });
  
  return result || [];
}

/**
 * Get Linear workspace statistics
 */
export async function getLinearStats(): Promise<{
  totalIssues: number;
  openIssues: number;
  urgentIssues: number;
  teams: number;
  projects: number;
}> {
  logger.info('[Linear] Getting workspace statistics');
  
  const allIssues = await listLinearIssues({}, 1000);
  const teams = await listLinearTeams();
  const projects = await listLinearProjects();
  
  const openIssues = allIssues.filter(i => 
    i.status !== 'Done' && i.status !== 'Canceled'
  );
  
  const urgentIssues = allIssues.filter(i => 
    i.priority.value === 1 && i.status !== 'Done'
  );
  
  return {
    totalIssues: allIssues.length,
    openIssues: openIssues.length,
    urgentIssues: urgentIssues.length,
    teams: teams.length,
    projects: projects.length,
  };
}

/**
 * Sync project phases to Linear cycles
 */
export async function syncProjectPhasesToLinear(
  projectName: string,
  phases: Array<{
    name: string;
    description: string;
    startDate: Date;
    endDate: Date;
  }>
): Promise<void> {
  logger.info(`[Linear] Syncing project phases for: ${projectName}`);
  
  const teams = await listLinearTeams();
  const trancendosTeam = teams.find(t => t.key === 'TRA');
  
  if (!trancendosTeam) {
    throw new Error('Trancendos team (TRA) not found');
  }
  
  // Create project if it doesn't exist
  const projects = await listLinearProjects(trancendosTeam.id);
  let project = projects.find(p => p.name === projectName);
  
  if (!project) {
    project = await createLinearProject(
      trancendosTeam.id,
      projectName,
      `Project phases synced from Luminous-MastermindAI`
    );
  }
  
  // Create issues for each phase
  for (const phase of phases) {
    const description = `## Phase: ${phase.name}

${phase.description}

**Start Date**: ${phase.startDate.toISOString().split('T')[0]}
**End Date**: ${phase.endDate.toISOString().split('T')[0]}

---

*This phase was automatically synced from Luminous-MastermindAI Project Kickoff.*
`;
    
    await createLinearIssue(
      trancendosTeam.id,
      `Phase: ${phase.name}`,
      description,
      2, // High priority
      undefined,
      project.id
    );
  }
  
  logger.info(`[Linear] Synced ${phases.length} phases to project: ${projectName}`);
}

/**
 * Health check for Linear integration
 */
export async function checkLinearHealth(): Promise<{
  connected: boolean;
  teamName?: string;
  error?: string;
}> {
  try {
    const teams = await listLinearTeams();
    const trancendosTeam = teams.find(t => t.key === 'TRA');
    
    return {
      connected: true,
      teamName: trancendosTeam?.name || 'Unknown',
    };
  } catch (error: any) {
    logger.error('[Linear] Health check failed:', error);
    return {
      connected: false,
      error: error.message,
    };
  }
}
