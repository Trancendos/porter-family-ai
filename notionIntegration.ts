/**
 * Notion Integration Service
 * 
 * Integrates with Notion workspace via MCP for:
 * - Error code documentation sync
 * - Knowledge base article creation
 * - Project documentation sync
 * - Wiki integration
 * 
 * DPID: DPID-ADM-CONN-002
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './errorLoggingService';

const execAsync = promisify(exec);

export interface NotionPage {
  id: string;
  title: string;
  url: string;
  type: 'page' | 'database';
  createdAt: Date;
  updatedAt: Date;
}

export interface NotionDatabase {
  id: string;
  title: string;
  url: string;
  properties: Record<string, any>;
}

/**
 * Execute MCP tool via manus-mcp-cli
 */
async function executeMCPTool(
  toolName: string,
  input: Record<string, any>
): Promise<any> {
  const inputJson = JSON.stringify(input);
  const command = `manus-mcp-cli tool call ${toolName} --server notion --input '${inputJson}'`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('Tool execution result saved')) {
      logger.warn(`[Notion MCP] Warning: ${stderr}`);
    }
    
    // Parse the JSON output
    const lines = stdout.split('\n');
    const resultLine = lines.find(line => line.startsWith('{') || line.startsWith('['));
    
    if (resultLine) {
      return JSON.parse(resultLine);
    }
    
    return null;
  } catch (error: any) {
    logger.error(`[Notion MCP] Error executing ${toolName}:`, error);
    throw new Error(`Notion MCP tool ${toolName} failed: ${error.message}`);
  }
}

/**
 * Search Notion workspace
 */
export async function searchNotion(query: string, limit: number = 10): Promise<NotionPage[]> {
  logger.info(`[Notion] Searching for: ${query}`);
  
  const result = await executeMCPTool('notion-search', {
    query,
    limit,
  });
  
  if (!result || !result.results) {
    return [];
  }
  
  return result.results.map((item: any) => ({
    id: item.id,
    title: item.title,
    url: item.url,
    type: item.type,
    createdAt: new Date(item.timestamp),
    updatedAt: new Date(item.timestamp),
  }));
}

/**
 * Fetch Notion page or database
 */
export async function fetchNotionEntity(urlOrId: string): Promise<any> {
  logger.info(`[Notion] Fetching entity: ${urlOrId}`);
  
  return await executeMCPTool('notion-fetch', {
    url: urlOrId,
  });
}

/**
 * Create Notion page
 */
export async function createNotionPage(
  parentId: string,
  title: string,
  content: string,
  properties?: Record<string, any>
): Promise<NotionPage> {
  logger.info(`[Notion] Creating page: ${title}`);
  
  const result = await executeMCPTool('notion-create-pages', {
    parent_id: parentId,
    title,
    content,
    properties: properties || {},
  });
  
  return {
    id: result.id,
    title: result.title,
    url: result.url,
    type: 'page',
    createdAt: new Date(result.created_time),
    updatedAt: new Date(result.last_edited_time),
  };
}

/**
 * Update Notion page
 */
export async function updateNotionPage(
  pageId: string,
  updates: {
    title?: string;
    content?: string;
    properties?: Record<string, any>;
  }
): Promise<void> {
  logger.info(`[Notion] Updating page: ${pageId}`);
  
  await executeMCPTool('notion-update-page', {
    page_id: pageId,
    ...updates,
  });
}

/**
 * Create Notion database
 */
export async function createNotionDatabase(
  parentId: string,
  title: string,
  properties: Record<string, any>
): Promise<NotionDatabase> {
  logger.info(`[Notion] Creating database: ${title}`);
  
  const result = await executeMCPTool('notion-create-database', {
    parent_id: parentId,
    title,
    properties,
  });
  
  return {
    id: result.id,
    title: result.title,
    url: result.url,
    properties: result.properties,
  };
}

/**
 * Query Notion database
 */
export async function queryNotionDatabase(
  databaseId: string,
  filter?: Record<string, any>,
  sorts?: Array<Record<string, any>>
): Promise<any[]> {
  logger.info(`[Notion] Querying database: ${databaseId}`);
  
  const result = await executeMCPTool('notion-query-database', {
    database_id: databaseId,
    filter,
    sorts,
  });
  
  return result.results || [];
}

/**
 * Create Notion database item
 */
export async function createNotionDatabaseItem(
  databaseId: string,
  properties: Record<string, any>
): Promise<any> {
  logger.info(`[Notion] Creating database item in: ${databaseId}`);
  
  return await executeMCPTool('notion-create-database-item', {
    database_id: databaseId,
    properties,
  });
}

/**
 * Sync error code to Notion Knowledge Base
 */
export async function syncErrorCodeToNotion(
  errorCode: string,
  title: string,
  content: string,
  category: string,
  resolution: string
): Promise<NotionPage> {
  logger.info(`[Notion] Syncing error code: ${errorCode}`);
  
  // Search for existing Knowledge Base database
  const searchResults = await searchNotion('Knowledge Base', 5);
  let kbDatabaseId: string | null = null;
  
  for (const result of searchResults) {
    if (result.type === 'database' && result.title.includes('Knowledge Base')) {
      kbDatabaseId = result.id;
      break;
    }
  }
  
  // If no KB database found, create one
  if (!kbDatabaseId) {
    logger.info('[Notion] Creating Knowledge Base database');
    const db = await createNotionDatabase(
      '', // Root level - will need parent page ID
      'Trancendos Knowledge Base',
      {
        'Error Code': { type: 'title' },
        'Category': { type: 'select' },
        'Status': { type: 'select' },
        'Created': { type: 'date' },
      }
    );
    kbDatabaseId = db.id;
  }
  
  // Create KB article
  const fullContent = `# ${title}

**Error Code**: \`${errorCode}\`
**Category**: ${category}

## Description

${content}

## Resolution

${resolution}

## Prevention

Follow best practices to prevent this error from occurring again.
`;
  
  return await createNotionPage(
    kbDatabaseId,
    `[${errorCode}] ${title}`,
    fullContent,
    {
      'Error Code': errorCode,
      'Category': category,
      'Status': 'Published',
    }
  );
}

/**
 * Sync project documentation to Notion
 */
export async function syncProjectDocsToNotion(
  projectName: string,
  documentation: string
): Promise<NotionPage> {
  logger.info(`[Notion] Syncing project docs: ${projectName}`);
  
  // Search for Projects database
  const searchResults = await searchNotion('Projects', 5);
  let projectsDatabaseId: string | null = null;
  
  for (const result of searchResults) {
    if (result.type === 'database' && result.title.includes('Projects')) {
      projectsDatabaseId = result.id;
      break;
    }
  }
  
  // If no Projects database found, create one
  if (!projectsDatabaseId) {
    logger.info('[Notion] Creating Projects database');
    const db = await createNotionDatabase(
      '', // Root level
      'Trancendos Projects',
      {
        'Name': { type: 'title' },
        'Status': { type: 'select' },
        'Created': { type: 'date' },
        'Updated': { type: 'date' },
      }
    );
    projectsDatabaseId = db.id;
  }
  
  return await createNotionPage(
    projectsDatabaseId,
    projectName,
    documentation,
    {
      'Name': projectName,
      'Status': 'Active',
    }
  );
}

/**
 * Get Notion workspace statistics
 */
export async function getNotionStats(): Promise<{
  totalPages: number;
  totalDatabases: number;
  recentUpdates: NotionPage[];
}> {
  logger.info('[Notion] Getting workspace statistics');
  
  // Search for all pages (limit to recent)
  const allPages = await searchNotion('', 100);
  
  const pages = allPages.filter(p => p.type === 'page');
  const databases = allPages.filter(p => p.type === 'database');
  
  // Sort by updated date
  const recentUpdates = allPages
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 10);
  
  return {
    totalPages: pages.length,
    totalDatabases: databases.length,
    recentUpdates,
  };
}

/**
 * Health check for Notion integration
 */
export async function checkNotionHealth(): Promise<{
  connected: boolean;
  workspaceName?: string;
  error?: string;
}> {
  try {
    // Try to search for anything
    const results = await searchNotion('', 1);
    
    return {
      connected: true,
      workspaceName: 'Trancendos Workspace',
    };
  } catch (error: any) {
    logger.error('[Notion] Health check failed:', error);
    return {
      connected: false,
      error: error.message,
    };
  }
}
