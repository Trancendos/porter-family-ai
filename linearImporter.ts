import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface LinearIssue {
  id: string;
  identifier: string; // e.g., "TRA-35"
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  status: string;
  assignee?: string;
  labels: string[];
  url: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  estimate?: number;
}

export interface LinearImportResult {
  issues: LinearIssue[];
  totalCount: number;
  importedAt: string;
  errors: string[];
}

/**
 * Import all accessible Linear issues using MCP
 */
export async function importLinearIssues(limit: number = 100): Promise<LinearImportResult> {
  const result: LinearImportResult = {
    issues: [],
    totalCount: 0,
    importedAt: new Date().toISOString(),
    errors: [],
  };

  try {
    const { stdout } = await execAsync(
      `trancendos-mcp-cli tool call list_issues --server linear --input '{"limit": ${limit}}'`
    );

    const linearResult = JSON.parse(stdout);

    if (linearResult.issues && Array.isArray(linearResult.issues)) {
      for (const issue of linearResult.issues) {
        result.issues.push({
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description || '',
          priority: mapLinearPriority(issue.priority),
          status: issue.state?.name || 'Backlog',
          assignee: issue.assignee?.name,
          labels: issue.labels?.map((l: any) => l.name) || [],
          url: issue.url,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
          dueDate: issue.dueDate,
          estimate: issue.estimate,
        });
      }
    }

    result.totalCount = result.issues.length;
    return result;
  } catch (error) {
    result.errors.push(`Fatal error importing Linear issues: ${error}`);
    return result;
  }
}

/**
 * Map Linear priority to our system
 */
function mapLinearPriority(priority: number | undefined): 'urgent' | 'high' | 'medium' | 'low' | 'none' {
  if (!priority) return 'none';
  if (priority === 0) return 'none';
  if (priority === 1) return 'urgent';
  if (priority === 2) return 'high';
  if (priority === 3) return 'medium';
  return 'low';
}

/**
 * Convert Linear issue to Kanban card format
 */
export function convertLinearToKanbanCard(issue: LinearIssue): {
  title: string;
  description: string;
  type: 'Story' | 'Task' | 'Bug' | 'Epic';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  storyPoints?: number;
  externalId: string;
  externalUrl: string;
} {
  // Determine card type from labels and title
  let type: 'Story' | 'Task' | 'Bug' | 'Epic' = 'Task';
  const titleLower = issue.title.toLowerCase();
  const labelsLower = issue.labels.map(l => l.toLowerCase());

  if (titleLower.includes('master:') || titleLower.includes('epic') || labelsLower.includes('epic')) {
    type = 'Epic';
  } else if (titleLower.includes('bug') || titleLower.includes('fix') || labelsLower.includes('bug')) {
    type = 'Bug';
  } else if (titleLower.includes('story') || labelsLower.includes('story') || issue.description.length > 200) {
    type = 'Story';
  }

  // Map priority
  let priority: 'Low' | 'Medium' | 'High' | 'Critical' = 'Medium';
  if (issue.priority === 'urgent') priority = 'Critical';
  else if (issue.priority === 'high') priority = 'High';
  else if (issue.priority === 'low') priority = 'Low';

  return {
    title: issue.title,
    description: issue.description,
    type,
    priority,
    storyPoints: issue.estimate,
    externalId: issue.identifier,
    externalUrl: issue.url,
  };
}

/**
 * Sync Linear issue status to Kanban card
 */
export function mapLinearStatusToKanbanColumn(status: string): string {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('backlog') || statusLower.includes('todo')) {
    return 'Backlog';
  } else if (statusLower.includes('ready') || statusLower.includes('planned')) {
    return 'Ready';
  } else if (statusLower.includes('progress') || statusLower.includes('started')) {
    return 'In Progress';
  } else if (statusLower.includes('review') || statusLower.includes('testing')) {
    return 'Review';
  } else if (statusLower.includes('done') || statusLower.includes('completed') || statusLower.includes('closed')) {
    return 'Done';
  }
  
  return 'Backlog'; // Default
}

/**
 * Extract epic relationships from Linear issues
 */
export function groupLinearIssuesByEpic(issues: LinearIssue[]): Map<string, LinearIssue[]> {
  const epics = new Map<string, LinearIssue[]>();
  
  // First pass: identify epics
  const epicIssues = issues.filter(issue => 
    issue.title.toLowerCase().includes('master:') || 
    issue.title.toLowerCase().includes('epic')
  );

  // Second pass: group related issues
  for (const epic of epicIssues) {
    const relatedIssues: LinearIssue[] = [epic];
    
    // Find issues that reference this epic
    const epicIdentifier = epic.identifier;
    for (const issue of issues) {
      if (issue.id !== epic.id && issue.description.includes(epicIdentifier)) {
        relatedIssues.push(issue);
      }
    }

    epics.set(epic.identifier, relatedIssues);
  }

  // Orphaned issues (not part of any epic)
  const orphanedIssues = issues.filter(issue => {
    const isEpic = epicIssues.some(e => e.id === issue.id);
    const isPartOfEpic = Array.from(epics.values()).some(group => 
      group.some(i => i.id === issue.id)
    );
    return !isEpic && !isPartOfEpic;
  });

  if (orphanedIssues.length > 0) {
    epics.set('ORPHANED', orphanedIssues);
  }

  return epics;
}

/**
 * Create bi-directional sync mapping
 */
export interface SyncMapping {
  linearId: string;
  linearIdentifier: string;
  kanbanCardId: number;
  lastSyncedAt: string;
  syncDirection: 'linear-to-kanban' | 'kanban-to-linear' | 'bidirectional';
}

export function createSyncMapping(
  linearIssue: LinearIssue,
  kanbanCardId: number
): SyncMapping {
  return {
    linearId: linearIssue.id,
    linearIdentifier: linearIssue.identifier,
    kanbanCardId,
    lastSyncedAt: new Date().toISOString(),
    syncDirection: 'bidirectional',
  };
}
