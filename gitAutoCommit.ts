/**
 * Git Auto-Commit Service
 * Automatically commits artifacts to Git when gates complete
 */

import axios from "axios";
import { logger } from "../lib/logger";
import { getDb } from "../db";
import { gitRepositories, gitCommits } from "../../drizzle/schema";
import { pipelineProjects } from "../../drizzle/schema-gates";
import { eq, and } from "drizzle-orm";

const GITEA_URL = process.env.GITEA_URL || "http://localhost:3001";
const GITEA_ADMIN_TOKEN = process.env.GITEA_ADMIN_TOKEN;

export class GitAutoCommitService {
  /**
   * Commit gate artifacts to Git repository
   */
  static async commitGateArtifacts(
    projectId: number,
    gateNumber: number,
    gateExecutionId: number,
    artifacts: Array<{ fileName: string; content: string | Buffer; type: string }>
  ): Promise<void> {
    if (!GITEA_ADMIN_TOKEN) {
      logger.warn('Gitea not configured, skipping auto-commit', { projectId, gateNumber });
      return;
    }

    try {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Get project
      const projects = await db.select()
        .from(pipelineProjects)
        .where(eq(pipelineProjects.id, projectId))
        .limit(1);

      if (projects.length === 0) {
        logger.warn('Project not found', { projectId });
        return;
      }

      const project = projects[0];

      // Get linked repository
      const repos = await db.select()
        .from(gitRepositories)
        .where(
          and(
            eq(gitRepositories.ownerId, project.userId),
            eq(gitRepositories.autoCommitEnabled, 1)
          )
        )
        .limit(1);

      if (repos.length === 0) {
        logger.info('No auto-commit repository found for project', { projectId });
        return;
      }

      const repo = repos[0];

      // Create branch name for this execution
      const branchName = `gate-${gateNumber}-execution-${gateExecutionId}`;

      // Get default branch
      const defaultBranch = 'main';

      // Create new branch from default branch
      try {
        await axios.post(
          `${GITEA_URL}/api/v1/repos/${repo.ownerId}/${repo.name}/branches`,
          {
            new_branch_name: branchName,
            old_branch_name: defaultBranch,
          },
          {
            headers: { Authorization: `token ${GITEA_ADMIN_TOKEN}` },
          }
        );
        logger.info('Created branch for gate execution', { branchName, projectId, gateNumber });
      } catch (error: any) {
        if (error.response?.status === 409) {
          logger.info('Branch already exists', { branchName });
        } else {
          throw error;
        }
      }

      // Prepare commit files
      const files: Record<string, string> = {};
      let filesAdded = 0;
      let filesModified = 0;

      for (const artifact of artifacts) {
        const filePath = `gate-${gateNumber}/${artifact.fileName}`;
        const content = Buffer.isBuffer(artifact.content)
          ? artifact.content.toString('base64')
          : Buffer.from(artifact.content).toString('base64');

        files[filePath] = content;
        filesAdded++;
      }

      // Add gate summary file
      const summaryContent = `# Gate ${gateNumber} Execution\n\n` +
        `**Project**: ${project.title}\n` +
        `**Execution ID**: ${gateExecutionId}\n` +
        `**Date**: ${new Date().toISOString()}\n\n` +
        `## Artifacts\n\n` +
        artifacts.map(a => `- ${a.fileName} (${a.type})`).join('\n');

      files[`gate-${gateNumber}/README.md`] = Buffer.from(summaryContent).toString('base64');
      filesAdded++;

      // Create commit
      const commitMessage = `Gate ${gateNumber} completed for ${project.title}\n\n` +
        `Execution ID: ${gateExecutionId}\n` +
        `Artifacts: ${artifacts.length}`;

      await axios.post(
        `${GITEA_URL}/api/v1/repos/${repo.ownerId}/${repo.name}/contents`,
        {
          branch: branchName,
          message: commitMessage,
          files: Object.entries(files).map(([path, content]) => ({
            path,
            content,
            encoding: 'base64',
          })),
        },
        {
          headers: { Authorization: `token ${GITEA_ADMIN_TOKEN}` },
        }
      );

      // Get commit hash
      const branchInfo = await axios.get(
        `${GITEA_URL}/api/v1/repos/${repo.ownerId}/${repo.name}/branches/${branchName}`,
        {
          headers: { Authorization: `token ${GITEA_ADMIN_TOKEN}` },
        }
      );

      const commitHash = branchInfo.data.commit.id;

      // Store commit record
      await db.insert(gitCommits).values({
        repositoryId: repo.id,
        projectId,
        gateExecutionId,
        commitHash,
        commitMessage,
        authorName: 'Luminous AI',
        authorEmail: 'ai@luminous.ai',
        branch: branchName,
        filesAdded,
        filesModified,
        filesDeleted: 0,
        commitedAt: new Date(),
      });

      logger.info('Gate artifacts committed to Git', {
        projectId,
        gateNumber,
        gateExecutionId,
        commitHash,
        branch: branchName,
        filesAdded,
      });
    } catch (error: any) {
      logger.error('Failed to commit gate artifacts', error, { projectId, gateNumber, gateExecutionId });
      // Don't throw - auto-commit failure shouldn't block gate execution
    }
  }

  /**
   * Merge gate branch into main after approval
   */
  static async mergeGateBranch(
    projectId: number,
    gateNumber: number,
    gateExecutionId: number
  ): Promise<void> {
    if (!GITEA_ADMIN_TOKEN) {
      return;
    }

    try {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Get project
      const projects = await db.select()
        .from(pipelineProjects)
        .where(eq(pipelineProjects.id, projectId))
        .limit(1);

      if (projects.length === 0) return;

      const project = projects[0];

      // Get linked repository
      const repos = await db.select()
        .from(gitRepositories)
        .where(
          and(
            eq(gitRepositories.ownerId, project.userId),
            eq(gitRepositories.autoCommitEnabled, 1)
          )
        )
        .limit(1);

      if (repos.length === 0) return;

      const repo = repos[0];

      const branchName = `gate-${gateNumber}-execution-${gateExecutionId}`;

      // Create pull request
      const pr = await axios.post(
        `${GITEA_URL}/api/v1/repos/${repo.ownerId}/${repo.name}/pulls`,
        {
          title: `Gate ${gateNumber}: ${project.title}`,
          head: branchName,
          base: 'main',
          body: `Automated merge for Gate ${gateNumber} completion\n\nExecution ID: ${gateExecutionId}`,
        },
        {
          headers: { Authorization: `token ${GITEA_ADMIN_TOKEN}` },
        }
      );

      // Auto-merge the pull request
      await axios.post(
        `${GITEA_URL}/api/v1/repos/${repo.ownerId}/${repo.name}/pulls/${pr.data.number}/merge`,
        {
          Do: 'merge',
          MergeMessageField: `Merged Gate ${gateNumber} for ${project.title}`,
        },
        {
          headers: { Authorization: `token ${GITEA_ADMIN_TOKEN}` },
        }
      );

      logger.info('Gate branch merged to main', {
        projectId,
        gateNumber,
        gateExecutionId,
        prNumber: pr.data.number,
      });
    } catch (error: any) {
      logger.error('Failed to merge gate branch', error, { projectId, gateNumber, gateExecutionId });
    }
  }
}
