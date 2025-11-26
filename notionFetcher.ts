import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface NotionPage {
  id: string;
  title: string;
  url: string;
  type: 'page' | 'database';
  content: string;
  highlight?: string;
  timestamp: string;
  properties?: Record<string, any>;
}

export interface NotionFetchResult {
  pages: NotionPage[];
  totalCount: number;
  fetchedAt: string;
  errors: string[];
}

/**
 * Fetch all accessible Notion pages using MCP
 */
export async function fetchAllNotionPages(): Promise<NotionFetchResult> {
  const result: NotionFetchResult = {
    pages: [],
    totalCount: 0,
    fetchedAt: new Date().toISOString(),
    errors: [],
  };

  try {
    // Search for common terms to get broad coverage
    const searchTerms = [
      'project', 'framework', 'deployment', 'compliance', 
      'documentation', 'guide', 'process', 'workflow',
      'trancendos', 'platform', 'system', 'integration'
    ];

    const seenIds = new Set<string>();

    for (const term of searchTerms) {
      try {
        const { stdout } = await execAsync(
          `manus-mcp-cli tool call notion-search --server notion --input '{"query": "${term}", "limit": 50}'`
        );

        const searchResult = JSON.parse(stdout);
        
        if (searchResult.results && Array.isArray(searchResult.results)) {
          for (const page of searchResult.results) {
            if (!seenIds.has(page.id)) {
              seenIds.add(page.id);
              
              // Fetch full page content
              try {
                const { stdout: contentStdout } = await execAsync(
                  `manus-mcp-cli tool call notion-fetch --server notion --input '{"url": "${page.url}"}'`
                );
                
                const pageContent = JSON.parse(contentStdout);
                
                result.pages.push({
                  id: page.id,
                  title: page.title || 'Untitled',
                  url: page.url,
                  type: page.type || 'page',
                  content: pageContent.content || pageContent.markdown || '',
                  highlight: page.highlight,
                  timestamp: page.timestamp || new Date().toISOString(),
                  properties: pageContent.properties,
                });
              } catch (fetchError) {
                result.errors.push(`Failed to fetch content for ${page.title}: ${fetchError}`);
                // Still add the page with limited info
                result.pages.push({
                  id: page.id,
                  title: page.title || 'Untitled',
                  url: page.url,
                  type: page.type || 'page',
                  content: page.highlight || '',
                  highlight: page.highlight,
                  timestamp: page.timestamp || new Date().toISOString(),
                });
              }
            }
          }
        }
      } catch (searchError) {
        result.errors.push(`Search failed for term "${term}": ${searchError}`);
      }
    }

    result.totalCount = result.pages.length;
    return result;
  } catch (error) {
    result.errors.push(`Fatal error fetching Notion pages: ${error}`);
    return result;
  }
}

/**
 * Fetch a specific Notion page by URL or ID
 */
export async function fetchNotionPage(urlOrId: string): Promise<NotionPage | null> {
  try {
    const { stdout } = await execAsync(
      `manus-mcp-cli tool call notion-fetch --server notion --input '{"url": "${urlOrId}"}'`
    );
    
    const pageData = JSON.parse(stdout);
    
    return {
      id: pageData.id || urlOrId,
      title: pageData.title || 'Untitled',
      url: pageData.url || urlOrId,
      type: pageData.type || 'page',
      content: pageData.content || pageData.markdown || '',
      timestamp: new Date().toISOString(),
      properties: pageData.properties,
    };
  } catch (error) {
    console.error(`Failed to fetch Notion page ${urlOrId}:`, error);
    return null;
  }
}

/**
 * Extract key information from Notion pages for AI processing
 */
export function extractNotionKnowledge(pages: NotionPage[]): {
  frameworks: string[];
  requirements: string[];
  processes: string[];
  integrations: string[];
} {
  const knowledge = {
    frameworks: [] as string[],
    requirements: [] as string[],
    processes: [] as string[],
    integrations: [] as string[],
  };

  for (const page of pages) {
    const content = page.content.toLowerCase();
    const title = page.title.toLowerCase();

    // Detect frameworks
    if (title.includes('framework') || content.includes('framework')) {
      knowledge.frameworks.push(page.title);
    }

    // Detect requirements
    if (title.includes('requirement') || content.includes('requirement') || 
        title.includes('compliance') || content.includes('compliance')) {
      knowledge.requirements.push(page.title);
    }

    // Detect processes
    if (title.includes('process') || title.includes('workflow') || 
        title.includes('guide') || title.includes('deployment')) {
      knowledge.processes.push(page.title);
    }

    // Detect integrations
    if (title.includes('integration') || content.includes('integration') ||
        title.includes('api') || content.includes('sync')) {
      knowledge.integrations.push(page.title);
    }
  }

  return knowledge;
}
