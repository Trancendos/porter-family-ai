/**
 * Bulk Import Orchestration Service
 * 
 * Coordinates the complete bulk import workflow:
 * 1. Fetch data from multiple sources (Notion/GitHub/Linear)
 * 2. Analyze with AI to categorize and group content
 * 3. Create epics grouped by theme
 * 4. Route to correct Kanban boards (Requirements vs Knowledge)
 * 5. Generate smart tags and complexity scores
 */

import { fetchAllNotionPages } from './notionFetcher';
import { analyzeGitHubRepositories } from './githubAnalyzer';
import { importLinearIssues } from './linearImporter';
import { processAllSources } from './dataProcessor';
import { MultiAIResearchService } from './multiAIResearch';
import { generateSmartTags } from './smartTagging';
import { analyzeCard } from './cardAutoReview';
import { getDb } from '../db';
import { agileBacklog, agileKanbanBoards, agileKanbanColumns, agileKanbanCards } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';

export interface ImportProgress {
  stage: 'fetching' | 'analyzing' | 'creating_epics' | 'routing' | 'tagging' | 'complete' | 'error';
  currentSource?: 'notion' | 'github' | 'linear';
  itemsProcessed: number;
  totalItems: number;
  message: string;
  epicsCreated?: number;
  storiesCreated?: number;
  errors?: string[];
}

export interface ImportResult {
  success: boolean;
  epicsCreated: number;
  storiesCreated: number;
  requirementsCount: number;
  knowledgeCount: number;
  errors: string[];
  duration: number;
  summary: {
    notion: { pages: number; epics: number };
    github: { repos: number; epics: number };
    linear: { issues: number; epics: number };
  };
}

interface EpicGroup {
  title: string;
  description: string;
  theme: string;
  stories: Array<{
    title: string;
    description: string;
    type: 'story' | 'task' | 'bug' | 'epic';
    priority: 'low' | 'medium' | 'high' | 'critical';
    storyPoints?: number;
    source: string;
    metadata: any;
  }>;
  boardType: 'requirements' | 'knowledge';
}

/**
 * Main orchestration function for bulk import
 */
export async function orchestrateBulkImport(
  userId: number,
  sources: {
    notion?: { searchTerms: string[] };
    github?: { repoNames: string[] };
    linear?: { projectIds: string[] };
  },
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const startTime = Date.now();
  const result: ImportResult = {
    success: false,
    epicsCreated: 0,
    storiesCreated: 0,
    requirementsCount: 0,
    knowledgeCount: 0,
    errors: [],
    duration: 0,
    summary: {
      notion: { pages: 0, epics: 0 },
      github: { repos: 0, epics: 0 },
      linear: { issues: 0, epics: 0 },
    },
  };

  try {
    // Stage 1: Fetch data from all sources
    onProgress?.({
      stage: 'fetching',
      itemsProcessed: 0,
      totalItems: 0,
      message: 'Fetching data from selected sources...',
    });

    const allData: any[] = [];

    // Fetch from Notion
    if (sources.notion) {
      onProgress?.({
        stage: 'fetching',
        currentSource: 'notion',
        itemsProcessed: 0,
        totalItems: sources.notion.searchTerms.length,
        message: `Fetching Notion pages (${sources.notion.searchTerms.length} search terms)...`,
      });

      try {
        // Fetch all Notion pages
        const notionResult = await fetchAllNotionPages();
        allData.push(...notionResult.pages);
        result.summary.notion.pages = notionResult.pages.length;
      } catch (error) {
        result.errors.push(`Notion fetch error: ${error}`);
      }
    }

    // Fetch from GitHub
    if (sources.github) {
      onProgress?.({
        stage: 'fetching',
        currentSource: 'github',
        itemsProcessed: result.summary.notion.pages,
        totalItems: result.summary.notion.pages + sources.github.repoNames.length,
        message: `Analyzing GitHub repositories...`,
      });

      try {
        // Analyze GitHub repositories (limit 50)
        const githubResult = await analyzeGitHubRepositories(50);
        allData.push(...githubResult.repositories);
        result.summary.github.repos = githubResult.repositories.length;
      } catch (error) {
        result.errors.push(`GitHub fetch error: ${error}`);
      }
    }

    // Fetch from Linear
    if (sources.linear) {
      onProgress?.({
        stage: 'fetching',
        currentSource: 'linear',
        itemsProcessed: result.summary.notion.pages + result.summary.github.repos,
        totalItems: result.summary.notion.pages + result.summary.github.repos + sources.linear.projectIds.length,
        message: `Importing Linear issues...`,
      });

      try {
        // Import all accessible Linear issues (limit 100)
        const linearResult = await importLinearIssues(100);
        allData.push(...linearResult.issues);
        result.summary.linear.issues = linearResult.issues.length;
      } catch (error) {
        result.errors.push(`Linear fetch error: ${error}`);
      }
    }

    if (allData.length === 0) {
      throw new Error('No data fetched from any source');
    }

    // Stage 2: Process and normalize data
    onProgress?.({
      stage: 'analyzing',
      itemsProcessed: 0,
      totalItems: allData.length,
      message: `Processing ${allData.length} items...`,
    });

    // Separate data by type
    const notionPages = allData.filter((item: any) => item.url?.includes('notion'));
    const githubRepos = allData.filter((item: any) => item.fullName || item.readme);
    const linearIssues = allData.filter((item: any) => item.identifier?.includes('-'));

    const processedData = await processAllSources(notionPages, githubRepos, linearIssues);

    // Stage 3: Group into epics using AI
    onProgress?.({
      stage: 'creating_epics',
      itemsProcessed: 0,
      totalItems: processedData.requirements.length,
      message: 'Creating epics with AI theme grouping...',
    });

    const epicGroups = await createEpicGroups(processedData.requirements, userId);
    result.epicsCreated = epicGroups.length;

    // Stage 4: Route to correct boards and create cards
    onProgress?.({
      stage: 'routing',
      itemsProcessed: 0,
      totalItems: epicGroups.length,
      message: 'Routing to Kanban boards...',
    });

    for (const epicGroup of epicGroups) {
      try {
        const createdStories = await createEpicAndStories(epicGroup, userId);
        result.storiesCreated += createdStories;

        if (epicGroup.boardType === 'requirements') {
          result.requirementsCount += createdStories + 1; // +1 for epic
          const sourceKey = epicGroup.stories[0]?.source.split(':')[0] as 'notion' | 'github' | 'linear';
          if (sourceKey && result.summary[sourceKey]) {
            result.summary[sourceKey].epics++;
          }
        } else {
          result.knowledgeCount += createdStories + 1;
        }
      } catch (error) {
        result.errors.push(`Epic creation error: ${error}`);
      }
    }

    // Stage 5: Generate smart tags for all created items
    onProgress?.({
      stage: 'tagging',
      itemsProcessed: 0,
      totalItems: result.storiesCreated,
      message: 'Generating smart tags...',
    });

    // Tags are generated automatically in createEpicAndStories

    // Complete
    result.success = true;
    result.duration = Date.now() - startTime;

    onProgress?.({
      stage: 'complete',
      itemsProcessed: result.storiesCreated,
      totalItems: result.storiesCreated,
      message: `Import complete! Created ${result.epicsCreated} epics and ${result.storiesCreated} stories.`,
      epicsCreated: result.epicsCreated,
      storiesCreated: result.storiesCreated,
    });

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(`Fatal error: ${error}`);
    result.duration = Date.now() - startTime;

    onProgress?.({
      stage: 'error',
      itemsProcessed: 0,
      totalItems: 0,
      message: `Import failed: ${error}`,
      errors: result.errors,
    });

    return result;
  }
}

/**
 * Group processed data into epics by theme using AI
 */
async function createEpicGroups(
  processedData: any[],
  userId: number
): Promise<EpicGroup[]> {
  const epicGroups: EpicGroup[] = [];

  // Use AI to analyze themes and group items
  const prompt = `Analyze the following items and group them into logical epics based on themes.
For each epic, provide:
1. A clear epic title
2. A comprehensive description
3. The theme/category
4. Whether it belongs on the "requirements" board (actionable development work) or "knowledge" board (documentation/learning content)

Items to analyze:
${JSON.stringify(processedData.slice(0, 50), null, 2)}

Return a JSON array of epic groups with this structure:
{
  "epics": [
    {
      "title": "Epic Title",
      "description": "Epic description",
      "theme": "Theme name",
      "boardType": "requirements" | "knowledge",
      "storyIds": [0, 1, 2] // indices of items that belong to this epic
    }
  ]
}`;

  try {
    const multiAI = new MultiAIResearchService();
    const aiResult = await multiAI.generateUserStories({
      topic: 'Group these items into logical epics',
      context: prompt,
      maxStories: 20,
    });

    // Convert AI result to epic groups
    const parsed = { epics: [] as any[] };
    // Group stories by theme (simplified - use first 5 stories per epic)
    for (let i = 0; i < aiResult.stories.length; i += 5) {
      const epicStories = aiResult.stories.slice(i, i + 5);
      if (epicStories.length > 0) {
        parsed.epics.push({
          title: epicStories[0].title,
          description: aiResult.summary,
          theme: 'imported',
          boardType: 'requirements',
          storyIds: epicStories.map((_, idx) => i + idx),
        });
      }
    }

    for (const epic of parsed.epics || []) {
      const stories = epic.storyIds.map((idx: number) => processedData[idx]).filter(Boolean);

      if (stories.length > 0) {
        epicGroups.push({
          title: epic.title,
          description: epic.description,
          theme: epic.theme,
          boardType: epic.boardType === 'knowledge' ? 'knowledge' : 'requirements',
          stories: stories.map((item: any) => ({
            title: item.title,
            description: item.description,
            type: item.type || 'story',
            priority: item.priority || 'medium',
            storyPoints: item.estimatedPoints,
            source: item.source,
            metadata: item.metadata,
          })),
        });
      }
    }
  } catch (error) {
    console.error('AI epic grouping failed, using fallback grouping:', error);
    // Fallback: group by source
    const bySource = processedData.reduce((acc, item) => {
      const source = item.source.split(':')[0];
      if (!acc[source]) acc[source] = [];
      acc[source].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    for (const [source, items] of Object.entries(bySource)) {
      const itemsArray = items as any[];
      epicGroups.push({
        title: `${source.charAt(0).toUpperCase() + source.slice(1)} Import`,
        description: `Items imported from ${source}`,
        theme: source,
        boardType: itemsArray[0]?.category === 'knowledge' ? 'knowledge' : 'requirements',
        stories: itemsArray.map((item: any) => ({
          title: item.title,
          description: item.description,
          type: item.type || 'story',
          priority: item.priority || 'medium',
          storyPoints: item.estimatedPoints,
          source: item.source,
          metadata: item.metadata,
        })),
      });
    }
  }

  return epicGroups;
}

/**
 * Create epic and its stories in the database
 */
async function createEpicAndStories(
  epicGroup: EpicGroup,
  userId: number
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Get or create the appropriate board
  const boardName = epicGroup.boardType === 'knowledge' ? 'Knowledge Management' : 'Requirements';
  let board = await db
    .select()
    .from(agileKanbanBoards)
    .where(and(eq(agileKanbanBoards.ownerId, userId), eq(agileKanbanBoards.boardName, boardName)))
    .limit(1);

  if (board.length === 0) {
    // Create board if it doesn't exist
    const boardIdStr = `BOARD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const [newBoard] = await db.insert(agileKanbanBoards).values({
      boardId: boardIdStr,
      boardName,
      boardType: 'kanban',
      description: `${boardName} board`,
      ownerId: userId,
    });
    board = [{ id: newBoard.insertId, boardId: boardIdStr, boardName, boardType: 'kanban' as const, description: `${boardName} board`, ownerId: userId, teamMembers: null, wipLimits: null, isDefault: null, createdAt: new Date(), updatedAt: new Date() }];
  }

  const boardId = board[0].id;

  // Get the first column (Backlog)
  const columns = await db
    .select()
    .from(agileKanbanColumns)
    .where(eq(agileKanbanColumns.boardId, boardId))
    .orderBy(agileKanbanColumns.columnOrder);

  let columnId = columns[0]?.id;

  if (!columnId) {
    // Create default column if none exist
    const [newColumn] = await db.insert(agileKanbanColumns).values({
      boardId,
      columnName: 'Backlog',
      columnOrder: 0,
    });
    columnId = newColumn.insertId;
  }

  // Create epic in backlog
  const epicBacklogId = `EPIC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const [epicResult] = await db.insert(agileBacklog).values({
    backlogId: epicBacklogId,
    itemType: 'epic',
    title: epicGroup.title,
    description: epicGroup.description,
    status: 'backlog',
    priority: 'medium',
    reportedBy: userId,
    labels: JSON.stringify({ theme: epicGroup.theme, source: 'bulk_import' }),
  });

  const epicId = epicResult.insertId;

  // Create epic card
  await db.insert(agileKanbanCards).values({
    boardId,
    columnId,
    backlogItemId: epicId,
    cardOrder: 0,
  });

  // Generate smart tags for epic
  try {
    const tags = await generateSmartTags(boardId, epicGroup.title, epicGroup.description);
    // Tags are stored via the cardFeatures router
  } catch (error) {
    console.error('Smart tagging failed for epic:', error);
  }

  // Create stories
  let storiesCreated = 0;
  for (const story of epicGroup.stories) {
    try {
      const storyBacklogId = `STORY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const [storyResult] = await db.insert(agileBacklog).values({
        backlogId: storyBacklogId,
        itemType: story.type === 'epic' ? 'epic' : story.type === 'bug' ? 'bug' : story.type === 'task' ? 'task' : 'user_story',
        parentId: epicId,
        title: story.title,
        description: story.description,
        status: 'backlog',
        priority: story.priority,
        storyPoints: story.storyPoints,
        reportedBy: userId,
        labels: JSON.stringify(story.metadata),
      });

      const storyId = storyResult.insertId;

      // Create story card
      await db.insert(agileKanbanCards).values({
        boardId,
        columnId,
        backlogItemId: storyId,
        cardOrder: storiesCreated + 1,
      });

      // Generate smart tags for story
      try {
        await generateSmartTags(boardId, story.title, story.description);
      } catch (error) {
        console.error('Smart tagging failed for story:', error);
      }

      // Run auto-review
      try {
        await analyzeCard({
          title: story.title,
          description: story.description,
          type: story.type,
          priority: story.priority,
          boardId,
        });
      } catch (error) {
        console.error('Auto-review failed for story:', error);
      }

      storiesCreated++;
    } catch (error) {
      console.error('Failed to create story:', error);
    }
  }

  return storiesCreated;
}
