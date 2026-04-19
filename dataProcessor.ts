import type { NotionPage } from './notionFetcher';
import type { GitHubRepository } from './githubAnalyzer';
import type { LinearIssue } from './linearImporter';

export interface UnifiedRequirement {
  id: string;
  source: 'notion' | 'github' | 'linear';
  sourceId: string;
  sourceUrl: string;
  title: string;
  description: string;
  type: 'Epic' | 'Story' | 'Task' | 'Bug';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: string;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessingResult {
  requirements: UnifiedRequirement[];
  epics: Map<string, UnifiedRequirement[]>;
  totalProcessed: number;
  processingTime: number;
  errors: string[];
}

/**
 * Process and normalize data from all sources
 */
export async function processAllSources(
  notionPages: NotionPage[],
  githubRepos: GitHubRepository[],
  linearIssues: LinearIssue[]
): Promise<ProcessingResult> {
  const startTime = Date.now();
  const result: ProcessingResult = {
    requirements: [],
    epics: new Map(),
    totalProcessed: 0,
    processingTime: 0,
    errors: [],
  };

  try {
    // Process Notion pages
    for (const page of notionPages) {
      try {
        const req = processNotionPage(page);
        result.requirements.push(req);
        result.totalProcessed++;
      } catch (error) {
        result.errors.push(`Failed to process Notion page ${page.title}: ${error}`);
      }
    }

    // Process GitHub repositories
    for (const repo of githubRepos) {
      try {
        const reqs = processGitHubRepository(repo);
        result.requirements.push(...reqs);
        result.totalProcessed += reqs.length;
      } catch (error) {
        result.errors.push(`Failed to process GitHub repo ${repo.name}: ${error}`);
      }
    }

    // Process Linear issues
    for (const issue of linearIssues) {
      try {
        const req = processLinearIssue(issue);
        result.requirements.push(req);
        result.totalProcessed++;
      } catch (error) {
        result.errors.push(`Failed to process Linear issue ${issue.identifier}: ${error}`);
      }
    }

    // Group into epics
    result.epics = groupRequirementsIntoEpics(result.requirements);

    result.processingTime = Date.now() - startTime;
    return result;
  } catch (error) {
    result.errors.push(`Fatal error processing data: ${error}`);
    result.processingTime = Date.now() - startTime;
    return result;
  }
}

/**
 * Process a Notion page into a unified requirement
 */
function processNotionPage(page: NotionPage): UnifiedRequirement {
  const title = page.title;
  const titleLower = title.toLowerCase();
  
  // Determine type from title
  let type: 'Epic' | 'Story' | 'Task' | 'Bug' = 'Task';
  if (titleLower.includes('framework') || titleLower.includes('platform') || titleLower.includes('system')) {
    type = 'Epic';
  } else if (titleLower.includes('guide') || titleLower.includes('documentation')) {
    type = 'Story';
  }

  // Determine priority
  let priority: 'Critical' | 'High' | 'Medium' | 'Low' = 'Medium';
  if (titleLower.includes('compliance') || titleLower.includes('security')) {
    priority = 'High';
  } else if (titleLower.includes('deployment') || titleLower.includes('production')) {
    priority = 'High';
  }

  // Extract tags from content
  const tags: string[] = [];
  const content = page.content.toLowerCase();
  if (content.includes('framework')) tags.push('framework');
  if (content.includes('deployment')) tags.push('deployment');
  if (content.includes('compliance')) tags.push('compliance');
  if (content.includes('api')) tags.push('api');
  if (content.includes('integration')) tags.push('integration');

  return {
    id: `notion-${page.id}`,
    source: 'notion',
    sourceId: page.id,
    sourceUrl: page.url,
    title: page.title,
    description: page.content.substring(0, 500), // First 500 chars
    type,
    priority,
    status: 'Backlog',
    tags,
    metadata: {
      pageType: page.type,
      highlight: page.highlight,
      properties: page.properties,
    },
    createdAt: page.timestamp,
    updatedAt: page.timestamp,
  };
}

/**
 * Process a GitHub repository into unified requirements
 */
function processGitHubRepository(repo: GitHubRepository): UnifiedRequirement[] {
  const requirements: UnifiedRequirement[] = [];

  // Create epic for the repository itself
  requirements.push({
    id: `github-repo-${repo.name}`,
    source: 'github',
    sourceId: repo.name,
    sourceUrl: repo.url,
    title: `Repository: ${repo.name}`,
    description: repo.description || repo.readme.substring(0, 500),
    type: 'Epic',
    priority: repo.stars > 5 ? 'High' : 'Medium',
    status: 'Backlog',
    tags: [...repo.topics, repo.language],
    metadata: {
      stars: repo.stars,
      language: repo.language,
      lastUpdated: repo.lastUpdated,
    },
    createdAt: repo.lastUpdated,
    updatedAt: repo.lastUpdated,
  });

  // Process issues
  for (const issue of repo.issues) {
    const type: 'Bug' | 'Story' | 'Task' = 
      issue.labels.includes('bug') ? 'Bug' :
      issue.labels.includes('enhancement') ? 'Story' : 'Task';

    requirements.push({
      id: `github-issue-${repo.name}-${issue.number}`,
      source: 'github',
      sourceId: `${repo.name}#${issue.number}`,
      sourceUrl: issue.url,
      title: `[${repo.name}] ${issue.title}`,
      description: issue.body,
      type,
      priority: issue.state === 'open' ? 'Medium' : 'Low',
      status: issue.state === 'open' ? 'Backlog' : 'Done',
      tags: issue.labels,
      metadata: {
        repository: repo.name,
        issueNumber: issue.number,
      },
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    });
  }

  return requirements;
}

/**
 * Process a Linear issue into a unified requirement
 */
function processLinearIssue(issue: LinearIssue): UnifiedRequirement {
  const titleLower = issue.title.toLowerCase();
  
  // Determine type
  let type: 'Epic' | 'Story' | 'Task' | 'Bug' = 'Task';
  if (titleLower.includes('master:') || titleLower.includes('epic')) {
    type = 'Epic';
  } else if (titleLower.includes('bug') || titleLower.includes('fix')) {
    type = 'Bug';
  } else if (issue.description.length > 200) {
    type = 'Story';
  }

  // Map priority
  let priority: 'Critical' | 'High' | 'Medium' | 'Low' = 'Medium';
  if (issue.priority === 'urgent') priority = 'Critical';
  else if (issue.priority === 'high') priority = 'High';
  else if (issue.priority === 'low') priority = 'Low';

  return {
    id: `linear-${issue.id}`,
    source: 'linear',
    sourceId: issue.identifier,
    sourceUrl: issue.url,
    title: issue.title,
    description: issue.description,
    type,
    priority,
    status: issue.status,
    tags: issue.labels,
    metadata: {
      identifier: issue.identifier,
      assignee: issue.assignee,
      estimate: issue.estimate,
      dueDate: issue.dueDate,
    },
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

/**
 * Group requirements into epics based on content similarity
 */
function groupRequirementsIntoEpics(requirements: UnifiedRequirement[]): Map<string, UnifiedRequirement[]> {
  const epics = new Map<string, UnifiedRequirement[]>();

  // First, identify explicit epics
  const epicRequirements = requirements.filter(r => r.type === 'Epic');

  for (const epic of epicRequirements) {
    const relatedRequirements: UnifiedRequirement[] = [epic];

    // Find requirements that share tags or keywords with this epic
    const epicKeywords = extractKeywords(epic.title + ' ' + epic.description);

    for (const req of requirements) {
      if (req.id !== epic.id && req.type !== 'Epic') {
        const reqKeywords = extractKeywords(req.title + ' ' + req.description);
        const overlap = epicKeywords.filter(k => reqKeywords.includes(k));

        // If significant keyword overlap, group with this epic
        if (overlap.length >= 2) {
          relatedRequirements.push(req);
        }
      }
    }

    epics.set(epic.id, relatedRequirements);
  }

  // Orphaned requirements (not part of any epic)
  const groupedIds = new Set(
    Array.from(epics.values()).flat().map(r => r.id)
  );
  const orphaned = requirements.filter(r => !groupedIds.has(r.id) && r.type !== 'Epic');

  if (orphaned.length > 0) {
    epics.set('ORPHANED', orphaned);
  }

  return epics;
}

/**
 * Extract keywords from text for grouping
 */
function extractKeywords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3); // Only words longer than 3 chars

  // Remove common words
  const stopWords = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should']);
  return words.filter(w => !stopWords.has(w));
}

/**
 * Calculate similarity score between two requirements
 */
export function calculateSimilarity(req1: UnifiedRequirement, req2: UnifiedRequirement): number {
  let score = 0;

  // Tag overlap
  const tagOverlap = req1.tags.filter(t => req2.tags.includes(t));
  score += tagOverlap.length * 10;

  // Keyword overlap
  const keywords1 = extractKeywords(req1.title + ' ' + req1.description);
  const keywords2 = extractKeywords(req2.title + ' ' + req2.description);
  const keywordOverlap = keywords1.filter(k => keywords2.includes(k));
  score += keywordOverlap.length * 5;

  // Same source bonus
  if (req1.source === req2.source) {
    score += 5;
  }

  // Same type bonus
  if (req1.type === req2.type) {
    score += 3;
  }

  return score;
}
