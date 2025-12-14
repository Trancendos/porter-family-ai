/**
 * Knowledge Base Service
 * 
 * Automatically generates and manages KB articles from error resolutions:
 * - Creates article for each new error code
 * - Includes: description, cause, resolution steps, prevention
 * - Adds code examples and screenshots
 * - Links related articles
 * - Tracks views and helpfulness ratings
 * - Updates articles based on new learnings
 */

import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { getErrorCode } from "./errorCodeService";
import { logger } from "./errorLoggingService";

export interface KnowledgeBaseArticle {
  id: number;
  errorCode: string;
  title: string;
  slug: string;
  
  // Content
  summary: string;
  description: string;
  cause: string;
  symptoms: string[];
  resolution: string;
  resolutionSteps: Array<{
    step: number;
    instruction: string;
    codeExample?: string;
    screenshot?: string;
  }>;
  prevention: string;
  
  // Metadata
  category: string;
  tags: string[];
  relatedArticles: number[];
  
  // Analytics
  views: number;
  helpfulVotes: number;
  notHelpfulVotes: number;
  
  // Versioning
  version: number;
  lastUpdated: Date;
  createdAt: Date;
}

/**
 * Create knowledge base article from error resolution
 */
export async function createKnowledgeBaseArticle(
  errorCode: string,
  research: any,
  fixApplied: string
): Promise<number | null> {
  logger.info(`[KB] Creating article for ${errorCode}`);
  
  const errorDetails = await getErrorCode(errorCode);
  if (!errorDetails) return null;
  
  // Generate article content with AI
  const articleContent = await generateArticleContent(errorDetails, research, fixApplied);
  if (!articleContent) return null;
  
  const db = await getDb();
  if (!db) return null;
  
  const { knowledgeBaseArticles } = await import("../../drizzle/platform-schema");
  
  // Create article
  const result = await db.insert(knowledgeBaseArticles).values({
    errorCode,
    title: articleContent.title,
    slug: generateSlug(articleContent.title),
    summary: articleContent.summary,
    description: articleContent.description,
    cause: articleContent.cause,
    symptoms: JSON.stringify(articleContent.symptoms),
    resolution: articleContent.resolution,
    resolutionSteps: JSON.stringify(articleContent.resolutionSteps),
    prevention: articleContent.prevention,
    category: errorDetails.category,
    tags: JSON.stringify(articleContent.tags),
    relatedArticles: JSON.stringify([]),
    views: 0,
    helpfulVotes: 0,
    notHelpfulVotes: 0,
    version: 1,
  });
  
  const articleId = Number(result.insertId);
  
  // Update error code with KB article ID
  const { updateErrorCodeResolution } = await import("./errorCodeService");
  await updateErrorCodeResolution(errorCode, {
    kbArticleId: articleId,
  });
  
  // Find and link related articles
  await linkRelatedArticles(articleId, errorDetails.category, articleContent.tags);
  
  logger.info(`[KB] Article created: ${articleId} for ${errorCode}`);
  
  return articleId;
}

/**
 * Generate article content with AI
 */
async function generateArticleContent(
  errorDetails: any,
  research: any,
  fixApplied: string
): Promise<{
  title: string;
  summary: string;
  description: string;
  cause: string;
  symptoms: string[];
  resolution: string;
  resolutionSteps: Array<{
    step: number;
    instruction: string;
    codeExample?: string;
  }>;
  prevention: string;
  tags: string[];
} | null> {
  const prompt = `Create a comprehensive knowledge base article for this error:

Error Code: ${errorDetails.code}
Category: ${errorDetails.category}
Message: ${errorDetails.message}
Occurrences: ${errorDetails.occurrenceCount}
Recommended Fix: ${research.recommendedFix}
Fix Applied: ${fixApplied}

Generate a detailed KB article in JSON format:
{
  "title": string (clear, descriptive title),
  "summary": string (1-2 sentence overview),
  "description": string (detailed explanation of the error),
  "cause": string (what causes this error),
  "symptoms": string[] (how to identify this error),
  "resolution": string (overview of the solution),
  "resolutionSteps": [
    {
      "step": number,
      "instruction": string,
      "codeExample": string (optional, if applicable)
    }
  ],
  "prevention": string (how to prevent this error in the future),
  "tags": string[] (relevant tags for search)
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a technical writer creating clear, comprehensive knowledge base articles. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    return JSON.parse(contentStr);
  } catch (error) {
    logger.error('[KB] Failed to generate article content', error as Error);
    return null;
  }
}

/**
 * Generate URL-friendly slug
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Link related articles
 */
async function linkRelatedArticles(
  articleId: number,
  category: string,
  tags: string[]
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const { knowledgeBaseArticles } = await import("../../drizzle/platform-schema");
  const { eq, sql } = await import("drizzle-orm");
  
  // Find articles in same category
  const relatedByCategory = await db
    .select()
    .from(knowledgeBaseArticles)
    .where(eq(knowledgeBaseArticles.category, category))
    .limit(5);
  
  const relatedIds = relatedByCategory
    .filter(a => a.id !== articleId)
    .map(a => a.id);
  
  if (relatedIds.length > 0) {
    await db
      .update(knowledgeBaseArticles)
      .set({
        relatedArticles: JSON.stringify(relatedIds),
      })
      .where(eq(knowledgeBaseArticles.id, articleId));
  }
}

/**
 * Get KB article by error code
 */
export async function getArticleByErrorCode(errorCode: string): Promise<KnowledgeBaseArticle | null> {
  const db = await getDb();
  if (!db) return null;
  
  const { knowledgeBaseArticles } = await import("../../drizzle/platform-schema");
  const { eq } = await import("drizzle-orm");
  
  const results = await db
    .select()
    .from(knowledgeBaseArticles)
    .where(eq(knowledgeBaseArticles.errorCode, errorCode))
    .limit(1);
  
  if (results.length === 0) return null;
  
  const article = results[0];
  
  // Increment view count
  await db
    .update(knowledgeBaseArticles)
    .set({ views: article.views + 1 })
    .where(eq(knowledgeBaseArticles.id, article.id));
  
  return {
    id: article.id,
    errorCode: article.errorCode,
    title: article.title,
    slug: article.slug,
    summary: article.summary,
    description: article.description,
    cause: article.cause,
    symptoms: JSON.parse(article.symptoms),
    resolution: article.resolution,
    resolutionSteps: JSON.parse(article.resolutionSteps),
    prevention: article.prevention,
    category: article.category,
    tags: JSON.parse(article.tags),
    relatedArticles: JSON.parse(article.relatedArticles),
    views: article.views + 1,
    helpfulVotes: article.helpfulVotes,
    notHelpfulVotes: article.notHelpfulVotes,
    version: article.version,
    lastUpdated: article.updatedAt,
    createdAt: article.createdAt,
  };
}

/**
 * Search KB articles
 */
export async function searchArticles(query: string, limit: number = 10): Promise<KnowledgeBaseArticle[]> {
  const db = await getDb();
  if (!db) return [];
  
  const { knowledgeBaseArticles } = await import("../../drizzle/platform-schema");
  const { like, or, sql } = await import("drizzle-orm");
  
  const results = await db
    .select()
    .from(knowledgeBaseArticles)
    .where(
      or(
        like(knowledgeBaseArticles.title, `%${query}%`),
        like(knowledgeBaseArticles.summary, `%${query}%`),
        like(knowledgeBaseArticles.description, `%${query}%`)
      )
    )
    .orderBy(sql`${knowledgeBaseArticles.views} DESC`)
    .limit(limit);
  
  return results.map(article => ({
    id: article.id,
    errorCode: article.errorCode,
    title: article.title,
    slug: article.slug,
    summary: article.summary,
    description: article.description,
    cause: article.cause,
    symptoms: JSON.parse(article.symptoms),
    resolution: article.resolution,
    resolutionSteps: JSON.parse(article.resolutionSteps),
    prevention: article.prevention,
    category: article.category,
    tags: JSON.parse(article.tags),
    relatedArticles: JSON.parse(article.relatedArticles),
    views: article.views,
    helpfulVotes: article.helpfulVotes,
    notHelpfulVotes: article.notHelpfulVotes,
    version: article.version,
    lastUpdated: article.updatedAt,
    createdAt: article.createdAt,
  }));
}

/**
 * Vote on article helpfulness
 */
export async function voteOnArticle(articleId: number, helpful: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const { knowledgeBaseArticles } = await import("../../drizzle/platform-schema");
  const { eq, sql } = await import("drizzle-orm");
  
  if (helpful) {
    await db
      .update(knowledgeBaseArticles)
      .set({
        helpfulVotes: sql`${knowledgeBaseArticles.helpfulVotes} + 1`,
      })
      .where(eq(knowledgeBaseArticles.id, articleId));
  } else {
    await db
      .update(knowledgeBaseArticles)
      .set({
        notHelpfulVotes: sql`${knowledgeBaseArticles.notHelpfulVotes} + 1`,
      })
      .where(eq(knowledgeBaseArticles.id, articleId));
  }
}

/**
 * Update article based on new learnings
 */
export async function updateArticleFromLearning(
  errorCode: string,
  newLearnings: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const article = await getArticleByErrorCode(errorCode);
  if (!article) return;
  
  logger.info(`[KB] Updating article ${article.id} with new learnings`);
  
  // Use AI to incorporate new learnings
  const prompt = `Update this knowledge base article with new learnings:

Current Article:
Title: ${article.title}
Description: ${article.description}
Resolution: ${article.resolution}

New Learnings:
${newLearnings}

Provide updated content in JSON format:
{
  "description": string (updated description),
  "resolution": string (updated resolution),
  "additionalSteps": string[] (any new steps to add)
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a technical writer updating knowledge base articles. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return;

    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const updates = JSON.parse(contentStr);
    
    const { knowledgeBaseArticles } = await import("../../drizzle/platform-schema");
    const { eq, sql } = await import("drizzle-orm");
    
    await db
      .update(knowledgeBaseArticles)
      .set({
        description: updates.description,
        resolution: updates.resolution,
        version: sql`${knowledgeBaseArticles.version} + 1`,
      })
      .where(eq(knowledgeBaseArticles.id, article.id));
    
    logger.info(`[KB] Article ${article.id} updated to version ${article.version + 1}`);
  } catch (error) {
    logger.error('[KB] Failed to update article', error as Error);
  }
}

/**
 * Get most viewed articles
 */
export async function getMostViewedArticles(limit: number = 10): Promise<KnowledgeBaseArticle[]> {
  const db = await getDb();
  if (!db) return [];
  
  const { knowledgeBaseArticles } = await import("../../drizzle/platform-schema");
  const { sql } = await import("drizzle-orm");
  
  const results = await db
    .select()
    .from(knowledgeBaseArticles)
    .orderBy(sql`${knowledgeBaseArticles.views} DESC`)
    .limit(limit);
  
  return results.map(article => ({
    id: article.id,
    errorCode: article.errorCode,
    title: article.title,
    slug: article.slug,
    summary: article.summary,
    description: article.description,
    cause: article.cause,
    symptoms: JSON.parse(article.symptoms),
    resolution: article.resolution,
    resolutionSteps: JSON.parse(article.resolutionSteps),
    prevention: article.prevention,
    category: article.category,
    tags: JSON.parse(article.tags),
    relatedArticles: JSON.parse(article.relatedArticles),
    views: article.views,
    helpfulVotes: article.helpfulVotes,
    notHelpfulVotes: article.notHelpfulVotes,
    version: article.version,
    lastUpdated: article.updatedAt,
    createdAt: article.createdAt,
  }));
}
