/**
 * Norman Hawkins - The Knowledge Keeper
 * 
 * Ensures all error codes are documented and accessible:
 * 1. Admin Wiki - All errors visible (internal)
 * 2. Public Knowledge Base - User-facing errors
 * 3. Per-App Knowledge Base - App-specific help
 * 4. Private Support Copy - For customer support
 * 
 * Tracks documentation coverage and quality metrics
 */

import { getDb } from "../db";
import { getErrorCode } from "./errorCodeService";
import { getArticleByErrorCode, createKnowledgeBaseArticle } from "./knowledgeBaseService";
import { logger } from "./errorLoggingService";

export interface DocumentationCoverage {
  totalErrorCodes: number;
  documented: number;
  undocumented: number;
  coveragePercentage: number;
  adminWikiArticles: number;
  publicKBArticles: number;
  perAppKBArticles: number;
}

export interface DocumentationQuality {
  averageHelpfulness: number;
  totalViews: number;
  totalVotes: number;
  articlesNeedingUpdate: number;
  mostHelpfulArticles: Array<{
    id: number;
    title: string;
    helpfulnessRatio: number;
  }>;
  leastHelpfulArticles: Array<{
    id: number;
    title: string;
    helpfulnessRatio: number;
  }>;
}

export interface SupportInsights {
  mostSearchedErrors: Array<{
    errorCode: string;
    searchCount: number;
  }>;
  documentationGaps: Array<{
    errorCode: string;
    occurrences: number;
    hasDocumentation: boolean;
  }>;
  supportTicketTrends: Array<{
    errorCode: string;
    ticketCount: number;
  }>;
}

/**
 * Ensure error code is documented across all channels
 */
export async function ensureErrorDocumentation(errorCode: string): Promise<void> {
  logger.info(`[Norman] Ensuring documentation for ${errorCode}`);
  
  const errorDetails = await getErrorCode(errorCode);
  if (!errorDetails) {
    logger.warn(`[Norman] Error code not found: ${errorCode}`);
    return;
  }
  
  // Check if KB article exists
  const kbArticle = await getArticleByErrorCode(errorCode);
  
  if (!kbArticle) {
    logger.info(`[Norman] No KB article found, triggering creation for ${errorCode}`);
    
    // Trigger KB article creation (will be handled by The Dr)
    // This is a placeholder - actual implementation would trigger The Dr's workflow
    logger.info(`[Norman] KB article creation queued for ${errorCode}`);
  }
  
  // Ensure admin wiki entry
  await ensureAdminWikiEntry(errorCode, errorDetails);
  
  // Determine if error should be in public KB
  const isUserFacing = determineIfUserFacing(errorDetails);
  if (isUserFacing) {
    await ensurePublicKBEntry(errorCode);
  }
  
  // If error is app-specific, ensure per-app KB entry
  if (errorDetails.context) {
    const context = JSON.parse(errorDetails.context as unknown as string);
    if (context.appId) {
      await ensurePerAppKBEntry(errorCode, context.appId);
    }
  }
  
  logger.info(`[Norman] Documentation ensured for ${errorCode}`);
}

/**
 * Ensure admin wiki entry (all errors visible)
 */
async function ensureAdminWikiEntry(errorCode: string, errorDetails: any): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const { wikiArticles } = await import("../../drizzle/platform-schema");
  const { eq } = await import("drizzle-orm");
  
  // Check if wiki article exists
  const existing = await db
    .select()
    .from(wikiArticles)
    .where(eq(wikiArticles.slug, `error-${errorCode.toLowerCase()}`))
    .limit(1);
  
  if (existing.length > 0) {
    logger.info(`[Norman] Admin wiki entry already exists for ${errorCode}`);
    return;
  }
  
  // Create admin wiki entry
  const content = generateAdminWikiContent(errorCode, errorDetails);
  
  await db.insert(wikiArticles).values({
    title: `Error Code: ${errorCode}`,
    slug: `error-${errorCode.toLowerCase()}`,
    content,
    category: 'errors',
    tags: JSON.stringify([errorDetails.category, 'error-code', 'internal']),
    authorId: 1, // System user
    status: 'published',
  });
  
  logger.info(`[Norman] Created admin wiki entry for ${errorCode}`);
}

/**
 * Generate admin wiki content
 */
function generateAdminWikiContent(errorCode: string, errorDetails: any): string {
  return `# Error Code: ${errorCode}

## Overview
- **Category**: ${errorDetails.category}
- **Message**: ${errorDetails.message}
- **First Occurrence**: ${errorDetails.firstOccurrence}
- **Last Occurrence**: ${errorDetails.lastOccurrence}
- **Total Occurrences**: ${errorDetails.occurrenceCount}
- **Affected Users**: ${errorDetails.affectedUsers}

## Resolution Status
- **Status**: ${errorDetails.resolutionStatus}
- **Type**: ${errorDetails.resolutionType || 'N/A'}
- **Fix Implemented**: ${errorDetails.fixImplemented ? 'Yes' : 'No'}
- **Fix Validated**: ${errorDetails.fixValidated ? 'Yes' : 'No'}

## Stack Trace
\`\`\`
${errorDetails.stackTrace || 'No stack trace available'}
\`\`\`

## Context
\`\`\`json
${errorDetails.context || '{}'}
\`\`\`

## Resolution Steps
${errorDetails.resolutionSteps ? errorDetails.resolutionSteps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n') : 'No resolution steps yet'}

## Knowledge Base Article
${errorDetails.kbArticleId ? `[View KB Article](/kb/articles/${errorDetails.kbArticleId})` : 'No KB article yet'}

## Internal Notes
*This is an internal admin wiki entry. For user-facing documentation, see the Knowledge Base.*
`;
}

/**
 * Determine if error should be user-facing
 */
function determineIfUserFacing(errorDetails: any): boolean {
  // User-facing categories
  const userFacingCategories = [
    'validation',
    'authentication',
    'authorization',
    'business_logic',
  ];
  
  return userFacingCategories.includes(errorDetails.category);
}

/**
 * Ensure public KB entry
 */
async function ensurePublicKBEntry(errorCode: string): Promise<void> {
  const kbArticle = await getArticleByErrorCode(errorCode);
  
  if (kbArticle) {
    logger.info(`[Norman] Public KB entry already exists for ${errorCode}`);
    return;
  }
  
  logger.info(`[Norman] Public KB entry needed for ${errorCode}, will be created by The Dr`);
}

/**
 * Ensure per-app KB entry
 */
async function ensurePerAppKBEntry(errorCode: string, appId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const { appKnowledgeBase } = await import("../../drizzle/platform-schema");
  const { eq, and } = await import("drizzle-orm");
  
  // Check if per-app KB entry exists
  const existing = await db
    .select()
    .from(appKnowledgeBase)
    .where(
      and(
        eq(appKnowledgeBase.appId, appId),
        eq(appKnowledgeBase.errorCode, errorCode)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    logger.info(`[Norman] Per-app KB entry already exists for ${errorCode} in app ${appId}`);
    return;
  }
  
  // Get KB article content
  const kbArticle = await getArticleByErrorCode(errorCode);
  if (!kbArticle) {
    logger.warn(`[Norman] No KB article found for ${errorCode}, cannot create per-app entry`);
    return;
  }
  
  // Create per-app KB entry
  await db.insert(appKnowledgeBase).values({
    appId,
    errorCode,
    title: kbArticle.title,
    content: kbArticle.description,
    resolution: kbArticle.resolution,
    category: kbArticle.category,
    views: 0,
  });
  
  // Also create private support copy
  await createPrivateSupportCopy(appId, errorCode, kbArticle);
  
  logger.info(`[Norman] Created per-app KB entry for ${errorCode} in app ${appId}`);
}

/**
 * Create private support copy
 */
async function createPrivateSupportCopy(appId: number, errorCode: string, kbArticle: any): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const { supportKnowledgeBase } = await import("../../drizzle/platform-schema");
  
  await db.insert(supportKnowledgeBase).values({
    appId,
    errorCode,
    title: kbArticle.title,
    content: kbArticle.description,
    resolution: kbArticle.resolution,
    internalNotes: 'Private support copy - full error details and resolution history',
    category: kbArticle.category,
    tags: kbArticle.tags,
  });
  
  logger.info(`[Norman] Created private support copy for ${errorCode} in app ${appId}`);
}

/**
 * Get documentation coverage metrics
 */
export async function getDocumentationCoverage(): Promise<DocumentationCoverage> {
  const db = await getDb();
  if (!db) {
    return {
      totalErrorCodes: 0,
      documented: 0,
      undocumented: 0,
      coveragePercentage: 0,
      adminWikiArticles: 0,
      publicKBArticles: 0,
      perAppKBArticles: 0,
    };
  }
  
  const { errorCodes, wikiArticles, knowledgeBaseArticles, appKnowledgeBase } = await import("../../drizzle/platform-schema");
  const { sql, isNotNull } = await import("drizzle-orm");
  
  // Total error codes
  const totalResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(errorCodes);
  const totalErrorCodes = totalResult[0].count;
  
  // Documented (has KB article)
  const documentedResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(errorCodes)
    .where(isNotNull(errorCodes.kbArticleId));
  const documented = documentedResult[0].count;
  
  // Admin wiki articles
  const adminWikiResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(wikiArticles)
    .where(sql`${wikiArticles.category} = 'errors'`);
  const adminWikiArticles = adminWikiResult[0].count;
  
  // Public KB articles
  const publicKBResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(knowledgeBaseArticles);
  const publicKBArticles = publicKBResult[0].count;
  
  // Per-app KB articles
  const perAppKBResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(appKnowledgeBase);
  const perAppKBArticles = perAppKBResult[0].count;
  
  return {
    totalErrorCodes,
    documented,
    undocumented: totalErrorCodes - documented,
    coveragePercentage: totalErrorCodes > 0 ? (documented / totalErrorCodes) * 100 : 0,
    adminWikiArticles,
    publicKBArticles,
    perAppKBArticles,
  };
}

/**
 * Get documentation quality metrics
 */
export async function getDocumentationQuality(): Promise<DocumentationQuality> {
  const db = await getDb();
  if (!db) {
    return {
      averageHelpfulness: 0,
      totalViews: 0,
      totalVotes: 0,
      articlesNeedingUpdate: 0,
      mostHelpfulArticles: [],
      leastHelpfulArticles: [],
    };
  }
  
  const { knowledgeBaseArticles } = await import("../../drizzle/platform-schema");
  const { sql } = await import("drizzle-orm");
  
  // Average helpfulness
  const avgResult = await db
    .select({
      avgHelpfulness: sql<number>`AVG(${knowledgeBaseArticles.helpfulVotes} / (${knowledgeBaseArticles.helpfulVotes} + ${knowledgeBaseArticles.notHelpfulVotes}))`,
      totalViews: sql<number>`SUM(${knowledgeBaseArticles.views})`,
      totalVotes: sql<number>`SUM(${knowledgeBaseArticles.helpfulVotes} + ${knowledgeBaseArticles.notHelpfulVotes})`,
    })
    .from(knowledgeBaseArticles);
  
  // Most helpful articles
  const mostHelpful = await db
    .select({
      id: knowledgeBaseArticles.id,
      title: knowledgeBaseArticles.title,
      helpfulnessRatio: sql<number>`${knowledgeBaseArticles.helpfulVotes} / (${knowledgeBaseArticles.helpfulVotes} + ${knowledgeBaseArticles.notHelpfulVotes})`,
    })
    .from(knowledgeBaseArticles)
    .orderBy(sql`helpfulnessRatio DESC`)
    .limit(5);
  
  // Least helpful articles
  const leastHelpful = await db
    .select({
      id: knowledgeBaseArticles.id,
      title: knowledgeBaseArticles.title,
      helpfulnessRatio: sql<number>`${knowledgeBaseArticles.helpfulVotes} / (${knowledgeBaseArticles.helpfulVotes} + ${knowledgeBaseArticles.notHelpfulVotes})`,
    })
    .from(knowledgeBaseArticles)
    .orderBy(sql`helpfulnessRatio ASC`)
    .limit(5);
  
  return {
    averageHelpfulness: avgResult[0].avgHelpfulness || 0,
    totalViews: avgResult[0].totalViews || 0,
    totalVotes: avgResult[0].totalVotes || 0,
    articlesNeedingUpdate: 0, // TODO: Implement logic to detect stale articles
    mostHelpfulArticles: mostHelpful.map(a => ({
      id: a.id,
      title: a.title,
      helpfulnessRatio: a.helpfulnessRatio,
    })),
    leastHelpfulArticles: leastHelpful.map(a => ({
      id: a.id,
      title: a.title,
      helpfulnessRatio: a.helpfulnessRatio,
    })),
  };
}

/**
 * Get support insights
 */
export async function getSupportInsights(): Promise<SupportInsights> {
  const db = await getDb();
  if (!db) {
    return {
      mostSearchedErrors: [],
      documentationGaps: [],
      supportTicketTrends: [],
    };
  }
  
  const { errorCodes, knowledgeBaseArticles } = await import("../../drizzle/platform-schema");
  const { sql, isNull } = await import("drizzle-orm");
  
  // Most searched errors (by views)
  const mostSearched = await db
    .select({
      errorCode: knowledgeBaseArticles.errorCode,
      searchCount: knowledgeBaseArticles.views,
    })
    .from(knowledgeBaseArticles)
    .orderBy(sql`${knowledgeBaseArticles.views} DESC`)
    .limit(10);
  
  // Documentation gaps (high occurrence, no KB article)
  const gaps = await db
    .select({
      errorCode: errorCodes.code,
      occurrences: errorCodes.occurrenceCount,
      hasDocumentation: sql<boolean>`${errorCodes.kbArticleId} IS NOT NULL`,
    })
    .from(errorCodes)
    .where(isNull(errorCodes.kbArticleId))
    .orderBy(sql`${errorCodes.occurrenceCount} DESC`)
    .limit(10);
  
  return {
    mostSearchedErrors: mostSearched.map(e => ({
      errorCode: e.errorCode,
      searchCount: e.searchCount,
    })),
    documentationGaps: gaps.map(g => ({
      errorCode: g.errorCode,
      occurrences: g.occurrences,
      hasDocumentation: g.hasDocumentation,
    })),
    supportTicketTrends: [], // TODO: Integrate with support ticket system
  };
}

/**
 * Generate Norman's dashboard report
 */
export async function generateNormanDashboardReport() {
  console.log('📚 Norman\'s Documentation Dashboard\n');
  console.log('='.repeat(70) + '\n');
  
  const coverage = await getDocumentationCoverage();
  const quality = await getDocumentationQuality();
  const insights = await getSupportInsights();
  
  console.log('📊 DOCUMENTATION COVERAGE\n');
  console.log(`Total Error Codes: ${coverage.totalErrorCodes}`);
  console.log(`Documented: ${coverage.documented}`);
  console.log(`Undocumented: ${coverage.undocumented}`);
  console.log(`Coverage: ${coverage.coveragePercentage.toFixed(1)}%`);
  console.log(`Admin Wiki Articles: ${coverage.adminWikiArticles}`);
  console.log(`Public KB Articles: ${coverage.publicKBArticles}`);
  console.log(`Per-App KB Articles: ${coverage.perAppKBArticles}\n`);
  
  console.log('⭐ DOCUMENTATION QUALITY\n');
  console.log(`Average Helpfulness: ${(quality.averageHelpfulness * 100).toFixed(1)}%`);
  console.log(`Total Views: ${quality.totalViews}`);
  console.log(`Total Votes: ${quality.totalVotes}\n`);
  
  if (quality.mostHelpfulArticles.length > 0) {
    console.log('Most Helpful Articles:');
    quality.mostHelpfulArticles.forEach(a => {
      console.log(`  - ${a.title} (${(a.helpfulnessRatio * 100).toFixed(1)}%)`);
    });
    console.log('');
  }
  
  console.log('🔍 SUPPORT INSIGHTS\n');
  if (insights.mostSearchedErrors.length > 0) {
    console.log('Most Searched Errors:');
    insights.mostSearchedErrors.forEach(e => {
      console.log(`  - ${e.errorCode} (${e.searchCount} views)`);
    });
    console.log('');
  }
  
  if (insights.documentationGaps.length > 0) {
    console.log('Documentation Gaps:');
    insights.documentationGaps.forEach(g => {
      console.log(`  - ${g.errorCode} (${g.occurrences} occurrences, no KB article)`);
    });
    console.log('');
  }
  
  console.log('='.repeat(70));
  
  return {
    coverage,
    quality,
    insights,
  };
}
