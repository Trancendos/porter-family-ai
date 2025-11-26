import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitHubRepository {
  name: string;
  fullName: string;
  description: string;
  url: string;
  readme: string;
  issues: GitHubIssue[];
  pullRequests: GitHubPullRequest[];
  topics: string[];
  language: string;
  stars: number;
  lastUpdated: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubAnalysisResult {
  repositories: GitHubRepository[];
  totalCount: number;
  analyzedAt: string;
  errors: string[];
}

/**
 * Analyze GitHub repositories for the authenticated user
 */
export async function analyzeGitHubRepositories(limit: number = 50): Promise<GitHubAnalysisResult> {
  const result: GitHubAnalysisResult = {
    repositories: [],
    totalCount: 0,
    analyzedAt: new Date().toISOString(),
    errors: [],
  };

  try {
    // Get list of repositories
    const { stdout } = await execAsync(
      `gh repo list --limit ${limit} --json name,description,url,primaryLanguage,stargazerCount,updatedAt,repositoryTopics`
    );

    const repos = JSON.parse(stdout);

    for (const repo of repos) {
      try {
        const repoData: GitHubRepository = {
          name: repo.name,
          fullName: `Trancendos/${repo.name}`,
          description: repo.description || '',
          url: repo.url,
          readme: '',
          issues: [],
          pullRequests: [],
          topics: repo.repositoryTopics?.map((t: any) => t.topic?.name || t.name) || [],
          language: repo.primaryLanguage?.name || 'Unknown',
          stars: repo.stargazerCount || 0,
          lastUpdated: repo.updatedAt,
        };

        // Fetch README
        try {
          const { stdout: readmeStdout } = await execAsync(
            `gh api repos/Trancendos/${repo.name}/readme --jq .content | base64 -d`
          );
          repoData.readme = readmeStdout;
        } catch (readmeError) {
          result.errors.push(`No README for ${repo.name}`);
        }

        // Fetch open issues
        try {
          const { stdout: issuesStdout } = await execAsync(
            `gh issue list --repo Trancendos/${repo.name} --limit 10 --json number,title,body,state,labels,url,createdAt,updatedAt`
          );
          const issues = JSON.parse(issuesStdout);
          repoData.issues = issues.map((issue: any) => ({
            number: issue.number,
            title: issue.title,
            body: issue.body || '',
            state: issue.state,
            labels: issue.labels?.map((l: any) => l.name) || [],
            url: issue.url,
            createdAt: issue.createdAt,
            updatedAt: issue.updatedAt,
          }));
        } catch (issuesError) {
          // No issues is not an error
        }

        // Fetch recent PRs
        try {
          const { stdout: prsStdout } = await execAsync(
            `gh pr list --repo Trancendos/${repo.name} --limit 10 --json number,title,body,state,url,createdAt,updatedAt`
          );
          const prs = JSON.parse(prsStdout);
          repoData.pullRequests = prs.map((pr: any) => ({
            number: pr.number,
            title: pr.title,
            body: pr.body || '',
            state: pr.state,
            url: pr.url,
            createdAt: pr.createdAt,
            updatedAt: pr.updatedAt,
          }));
        } catch (prsError) {
          // No PRs is not an error
        }

        result.repositories.push(repoData);
      } catch (repoError) {
        result.errors.push(`Failed to analyze ${repo.name}: ${repoError}`);
      }
    }

    result.totalCount = result.repositories.length;
    return result;
  } catch (error) {
    result.errors.push(`Fatal error analyzing GitHub repositories: ${error}`);
    return result;
  }
}

/**
 * Extract requirements and user stories from GitHub content
 */
export function extractGitHubRequirements(repos: GitHubRepository[]): {
  features: string[];
  bugs: string[];
  enhancements: string[];
  documentation: string[];
} {
  const requirements = {
    features: [] as string[],
    bugs: [] as string[],
    enhancements: [] as string[],
    documentation: [] as string[],
  };

  for (const repo of repos) {
    // Extract from issues
    for (const issue of repo.issues) {
      const labels = issue.labels.map(l => l.toLowerCase());
      
      if (labels.includes('bug') || issue.title.toLowerCase().includes('bug') || 
          issue.title.toLowerCase().includes('fix')) {
        requirements.bugs.push(`[${repo.name}] ${issue.title}`);
      } else if (labels.includes('enhancement') || labels.includes('feature')) {
        requirements.features.push(`[${repo.name}] ${issue.title}`);
      } else if (labels.includes('documentation') || labels.includes('docs')) {
        requirements.documentation.push(`[${repo.name}] ${issue.title}`);
      } else {
        requirements.enhancements.push(`[${repo.name}] ${issue.title}`);
      }
    }

    // Extract from README
    if (repo.readme) {
      const readmeLower = repo.readme.toLowerCase();
      if (readmeLower.includes('feature') || readmeLower.includes('roadmap')) {
        requirements.features.push(`[${repo.name}] README features`);
      }
    }
  }

  return requirements;
}

/**
 * Analyze repository for integration opportunities
 */
export function analyzeIntegrationPotential(repo: GitHubRepository): {
  score: number;
  reasons: string[];
  suggestedIntegrations: string[];
} {
  const analysis = {
    score: 0,
    reasons: [] as string[],
    suggestedIntegrations: [] as string[],
  };

  const content = `${repo.description} ${repo.readme}`.toLowerCase();

  // Check for AI/ML keywords
  if (content.includes('ai') || content.includes('ml') || content.includes('llm')) {
    analysis.score += 20;
    analysis.reasons.push('Contains AI/ML functionality');
    analysis.suggestedIntegrations.push('AI Orchestration Layer');
  }

  // Check for API keywords
  if (content.includes('api') || content.includes('rest') || content.includes('graphql')) {
    analysis.score += 15;
    analysis.reasons.push('Provides API functionality');
    analysis.suggestedIntegrations.push('API Integration Hub');
  }

  // Check for database keywords
  if (content.includes('database') || content.includes('postgres') || content.includes('vector')) {
    analysis.score += 15;
    analysis.reasons.push('Database functionality');
    analysis.suggestedIntegrations.push('Vector Database');
  }

  // Check for automation keywords
  if (content.includes('automation') || content.includes('workflow') || content.includes('pipeline')) {
    analysis.score += 15;
    analysis.reasons.push('Workflow automation');
    analysis.suggestedIntegrations.push('Workflow Builder');
  }

  // Check for template keywords
  if (content.includes('template') || content.includes('generator') || content.includes('scaffold')) {
    analysis.score += 10;
    analysis.reasons.push('Template/generator functionality');
    analysis.suggestedIntegrations.push('Template Generation Platform');
  }

  // Recent activity bonus
  const daysSinceUpdate = (Date.now() - new Date(repo.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 30) {
    analysis.score += 10;
    analysis.reasons.push('Recently updated');
  }

  // Stars bonus
  if (repo.stars > 5) {
    analysis.score += 5;
    analysis.reasons.push('Community interest');
  }

  return analysis;
}
