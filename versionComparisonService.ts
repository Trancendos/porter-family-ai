import * as Diff from 'diff';
import { getDb } from '../db';
import { normanDocumentVersions, type NormanDocumentVersion } from '../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Diff change types
 */
export interface DiffChange {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
  lineNumber?: number;
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  oldVersion: NormanDocumentVersion;
  newVersion: NormanDocumentVersion;
  changes: DiffChange[];
  stats: {
    additions: number;
    deletions: number;
    unchanged: number;
    totalLines: number;
  };
  summary: string;
}

/**
 * Version history timeline item
 */
export interface VersionTimelineItem {
  version: NormanDocumentVersion;
  changesSummary: string;
  linesChanged: number;
  isRollback: boolean;
}

/**
 * Version Comparison Service
 * Handles document version comparison, diff generation, and rollback functionality
 */
class VersionComparisonService {
  /**
   * Generate diff between two text contents
   */
  generateDiff(oldText: string, newText: string): DiffChange[] {
    const changes: DiffChange[] = [];
    const diff = Diff.diffLines(oldText, newText);

    let lineNumber = 1;
    for (const part of diff) {
      const type = part.added ? 'added' : part.removed ? 'removed' : 'unchanged';
      changes.push({
        type,
        value: part.value,
        lineNumber,
      });

      if (!part.removed) {
        lineNumber += part.value.split('\n').length - 1;
      }
    }

    return changes;
  }

  /**
   * Generate word-level diff for inline comparison
   */
  generateWordDiff(oldText: string, newText: string): DiffChange[] {
    const changes: DiffChange[] = [];
    const diff = Diff.diffWords(oldText, newText);

    for (const part of diff) {
      const type = part.added ? 'added' : part.removed ? 'removed' : 'unchanged';
      changes.push({
        type,
        value: part.value,
      });
    }

    return changes;
  }

  /**
   * Calculate diff statistics
   */
  calculateStats(changes: DiffChange[]): VersionComparison['stats'] {
    const stats = {
      additions: 0,
      deletions: 0,
      unchanged: 0,
      totalLines: 0,
    };

    for (const change of changes) {
      const lines = change.value.split('\n').length - 1;
      
      if (change.type === 'added') {
        stats.additions += lines;
      } else if (change.type === 'removed') {
        stats.deletions += lines;
      } else {
        stats.unchanged += lines;
      }
    }

    stats.totalLines = stats.additions + stats.deletions + stats.unchanged;
    return stats;
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    documentId: number,
    oldVersionNumber: number,
    newVersionNumber: number
  ): Promise<VersionComparison | null> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Fetch both versions
    const [oldVersion] = await db
      .select()
      .from(normanDocumentVersions)
      .where(
        and(
          eq(normanDocumentVersions.documentId, documentId),
          eq(normanDocumentVersions.versionNumber, oldVersionNumber)
        )
      )
      .limit(1);

    const [newVersion] = await db
      .select()
      .from(normanDocumentVersions)
      .where(
        and(
          eq(normanDocumentVersions.documentId, documentId),
          eq(normanDocumentVersions.versionNumber, newVersionNumber)
        )
      )
      .limit(1);

    if (!oldVersion || !newVersion) {
      return null;
    }

    // Generate diff
    const changes = this.generateDiff(oldVersion.content, newVersion.content);
    const stats = this.calculateStats(changes);

    // Generate summary
    const summary = this.generateSummary(stats, oldVersion, newVersion);

    return {
      oldVersion,
      newVersion,
      changes,
      stats,
      summary,
    };
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(
    stats: VersionComparison['stats'],
    oldVersion: NormanDocumentVersion,
    newVersion: NormanDocumentVersion
  ): string {
    const parts: string[] = [];

    if (stats.additions > 0) {
      parts.push(`+${stats.additions} lines added`);
    }
    if (stats.deletions > 0) {
      parts.push(`-${stats.deletions} lines removed`);
    }

    if (parts.length === 0) {
      return 'No changes detected';
    }

    let summary = parts.join(', ');
    
    if (newVersion.changeDescription) {
      summary += ` - ${newVersion.changeDescription}`;
    }

    return summary;
  }

  /**
   * Get version history timeline for a document
   */
  async getVersionTimeline(documentId: number): Promise<VersionTimelineItem[]> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const versions = await db
      .select()
      .from(normanDocumentVersions)
      .where(eq(normanDocumentVersions.documentId, documentId))
      .orderBy(desc(normanDocumentVersions.versionNumber));

    const timeline: VersionTimelineItem[] = [];

    for (let i = 0; i < versions.length; i++) {
      const version = versions[i];
      const previousVersion = versions[i + 1];

      let linesChanged = 0;
      let changesSummary = version.changeDescription || 'No description';

      if (previousVersion) {
        const diff = this.generateDiff(previousVersion.content, version.content);
        const stats = this.calculateStats(diff);
        linesChanged = stats.additions + stats.deletions;
        
        if (!version.changeDescription) {
          changesSummary = this.generateSummary(stats, previousVersion, version);
        }
      } else {
        // First version
        linesChanged = version.content.split('\n').length;
        changesSummary = 'Initial version';
      }

      timeline.push({
        version,
        changesSummary,
        linesChanged,
        isRollback: version.changeDescription?.toLowerCase().includes('rollback') || false,
      });
    }

    return timeline;
  }

  /**
   * Create a new version with diff from previous
   */
  async createVersionWithDiff(
    documentId: number,
    title: string,
    content: string,
    contentType: 'markdown' | 'html',
    changeDescription: string,
    editedBy: number,
    metadata?: string
  ): Promise<NormanDocumentVersion> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Get the latest version
    const latestVersions = await db
      .select()
      .from(normanDocumentVersions)
      .where(eq(normanDocumentVersions.documentId, documentId))
      .orderBy(desc(normanDocumentVersions.versionNumber))
      .limit(1);

    const latestVersion = latestVersions[0];
    const newVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    // Generate diff from previous version
    let diffFromPrevious: string | null = null;
    if (latestVersion) {
      const changes = this.generateDiff(latestVersion.content, content);
      diffFromPrevious = JSON.stringify(changes);
    }

    // Insert new version
    const [newVersion] = await db
      .insert(normanDocumentVersions)
      .values({
        documentId,
        versionNumber: newVersionNumber,
        title,
        content,
        contentType,
        changeDescription,
        editedBy,
        diffFromPrevious,
        metadata,
      })
      .$returningId();

    // Fetch and return the created version
    const [createdVersion] = await db
      .select()
      .from(normanDocumentVersions)
      .where(eq(normanDocumentVersions.id, newVersion.id))
      .limit(1);

    return createdVersion;
  }

  /**
   * Rollback document to a specific version
   */
  async rollbackToVersion(
    documentId: number,
    targetVersionNumber: number,
    editedBy: number
  ): Promise<NormanDocumentVersion> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Get the target version
    const [targetVersion] = await db
      .select()
      .from(normanDocumentVersions)
      .where(
        and(
          eq(normanDocumentVersions.documentId, documentId),
          eq(normanDocumentVersions.versionNumber, targetVersionNumber)
        )
      )
      .limit(1);

    if (!targetVersion) {
      throw new Error('Target version not found');
    }

    // Create a new version with the content from the target version
    const newVersion = await this.createVersionWithDiff(
      documentId,
      targetVersion.title,
      targetVersion.content,
      targetVersion.contentType,
      `Rolled back to version ${targetVersionNumber}`,
      editedBy,
      targetVersion.metadata
    );

    return newVersion;
  }

  /**
   * Get diff from previous version (from stored diff)
   */
  async getDiffFromPrevious(versionId: number): Promise<DiffChange[] | null> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const [version] = await db
      .select()
      .from(normanDocumentVersions)
      .where(eq(normanDocumentVersions.id, versionId))
      .limit(1);

    if (!version || !version.diffFromPrevious) {
      return null;
    }

    try {
      return JSON.parse(version.diffFromPrevious) as DiffChange[];
    } catch (error) {
      console.error('[VersionComparison] Failed to parse diff:', error);
      return null;
    }
  }

  /**
   * Get version by ID
   */
  async getVersionById(versionId: number): Promise<NormanDocumentVersion | null> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const [version] = await db
      .select()
      .from(normanDocumentVersions)
      .where(eq(normanDocumentVersions.id, versionId))
      .limit(1);

    return version || null;
  }

  /**
   * Get all versions for a document
   */
  async getDocumentVersions(documentId: number): Promise<NormanDocumentVersion[]> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    return await db
      .select()
      .from(normanDocumentVersions)
      .where(eq(normanDocumentVersions.documentId, documentId))
      .orderBy(desc(normanDocumentVersions.versionNumber));
  }
}

// Singleton instance
export const versionComparisonService = new VersionComparisonService();
