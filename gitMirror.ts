/**
 * Git Mirroring Service
 * Handles bidirectional synchronization between Gitea and external platforms
 * (GitHub, GitLab, BitBucket)
 */

import { Octokit } from "@octokit/rest";
import { Gitlab } from "@gitbeaker/node";
import axios from "axios";
import { logger } from "../lib/logger";
import { getDb } from "../db";
import { gitRepositories, gitSyncLog } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export class GitMirrorService {
  private github: Octokit | null = null;
  private gitlab: InstanceType<typeof Gitlab> | null = null;

  constructor() {
    // Initialize GitHub client if token is available
    if (process.env.GITHUB_TOKEN) {
      this.github = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });
    }

    // Initialize GitLab client if token is available
    if (process.env.GITLAB_TOKEN) {
      this.gitlab = new Gitlab({
        token: process.env.GITLAB_TOKEN,
      });
    }
  }

  /**
   * Mirror repository to GitHub
   */
  async mirrorToGitHub(repositoryId: number): Promise<void> {
    if (!this.github) {
      throw new Error('GitHub token not configured');
    }

    const repo = await this.getRepository(repositoryId);
    if (!repo) throw new Error('Repository not found');

    const syncLog = await this.createSyncLog(repositoryId, 'gitea', 'github', 'mirror');

    try {
      // Check if GitHub repo exists
      let githubRepo;
      const githubUsername = process.env.GITHUB_USERNAME || 'luminous-ai';

      try {
        githubRepo = await this.github.repos.get({
          owner: githubUsername,
          repo: repo.name,
        });
        logger.info('GitHub repository already exists', { repositoryId, githubUrl: githubRepo.data.html_url });
      } catch (error: any) {
        if (error.status === 404) {
          // Create GitHub repository
          githubRepo = await this.github.repos.createForAuthenticatedUser({
            name: repo.name,
            description: repo.description || '',
            private: repo.isPrivate === 1,
          });
          logger.info('GitHub repository created', { repositoryId, githubUrl: githubRepo.data.html_url });
        } else {
          throw error;
        }
      }

      // Set up push mirror in Gitea
      const giteaUrl = process.env.GITEA_URL || 'http://localhost:3001';
      const giteaToken = process.env.GITEA_ADMIN_TOKEN;

      if (!giteaToken) {
        throw new Error('Gitea admin token not configured');
      }

      await axios.post(
        `${giteaUrl}/api/v1/repos/${repo.ownerId}/${repo.name}/push_mirrors`,
        {
          remote_address: githubRepo.data.clone_url,
          remote_username: githubUsername,
          remote_password: process.env.GITHUB_TOKEN,
          sync_on_commit: true,
          interval: '8h0m0s',
        },
        {
          headers: { Authorization: `token ${giteaToken}` },
        }
      ).catch((error) => {
        // Mirror might already exist
        if (error.response?.status !== 409) {
          throw error;
        }
      });

      // Update repository record
      const db = await getDb();
      if (db) {
        await db.update(gitRepositories)
          .set({
            githubRepoId: githubRepo.data.id.toString(),
            githubUrl: githubRepo.data.html_url,
            githubSyncEnabled: 1,
            githubLastSync: new Date(),
          })
          .where(eq(gitRepositories.id, repositoryId));
      }

      await this.completeSyncLog(syncLog.id, 'success');
      logger.info('Repository mirrored to GitHub', { repositoryId, githubUrl: githubRepo.data.html_url });
    } catch (error: any) {
      await this.completeSyncLog(syncLog.id, 'failed', error.message);
      logger.error('Failed to mirror to GitHub', error, { repositoryId });
      throw error;
    }
  }

  /**
   * Mirror repository to GitLab
   */
  async mirrorToGitLab(repositoryId: number): Promise<void> {
    if (!this.gitlab) {
      throw new Error('GitLab token not configured');
    }

    const repo = await this.getRepository(repositoryId);
    if (!repo) throw new Error('Repository not found');

    const syncLog = await this.createSyncLog(repositoryId, 'gitea', 'gitlab', 'mirror');

    try {
      // Check if GitLab project exists
      let gitlabProject;
      const gitlabUsername = process.env.GITLAB_USERNAME || 'luminous-ai';

      try {
        const projects = await this.gitlab.Projects.all({
          search: repo.name,
          owned: true,
        });

        gitlabProject = projects.find((p: any) => p.name === repo.name);

        if (!gitlabProject) {
          throw new Error('Project not found');
        }

        logger.info('GitLab project already exists', { repositoryId, gitlabUrl: gitlabProject.web_url });
      } catch (error) {
        // Create GitLab project
        gitlabProject = await this.gitlab.Projects.create({
          name: repo.name,
          description: repo.description || '',
          visibility: repo.isPrivate === 1 ? 'private' : 'public',
        });
        logger.info('GitLab project created', { repositoryId, gitlabUrl: gitlabProject.web_url });
      }

      // Set up push mirror in Gitea
      const giteaUrl = process.env.GITEA_URL || 'http://localhost:3001';
      const giteaToken = process.env.GITEA_ADMIN_TOKEN;

      if (!giteaToken) {
        throw new Error('Gitea admin token not configured');
      }

      await axios.post(
        `${giteaUrl}/api/v1/repos/${repo.ownerId}/${repo.name}/push_mirrors`,
        {
          remote_address: gitlabProject.http_url_to_repo,
          remote_username: gitlabUsername,
          remote_password: process.env.GITLAB_TOKEN,
          sync_on_commit: true,
          interval: '8h0m0s',
        },
        {
          headers: { Authorization: `token ${giteaToken}` },
        }
      ).catch((error) => {
        if (error.response?.status !== 409) {
          throw error;
        }
      });

      // Update repository record
      const db = await getDb();
      if (db) {
        await db.update(gitRepositories)
          .set({
            gitlabRepoId: gitlabProject.id.toString(),
            gitlabUrl: gitlabProject.web_url,
            gitlabSyncEnabled: 1,
            gitlabLastSync: new Date(),
          })
          .where(eq(gitRepositories.id, repositoryId));
      }

      await this.completeSyncLog(syncLog.id, 'success');
      logger.info('Repository mirrored to GitLab', { repositoryId, gitlabUrl: gitlabProject.web_url });
    } catch (error: any) {
      await this.completeSyncLog(syncLog.id, 'failed', error.message);
      logger.error('Failed to mirror to GitLab', error, { repositoryId });
      throw error;
    }
  }

  /**
   * Mirror repository to BitBucket
   */
  async mirrorToBitBucket(repositoryId: number): Promise<void> {
    const repo = await this.getRepository(repositoryId);
    if (!repo) throw new Error('Repository not found');

    const syncLog = await this.createSyncLog(repositoryId, 'gitea', 'bitbucket', 'mirror');

    try {
      const bitbucketUsername = process.env.BITBUCKET_USERNAME;
      const bitbucketPassword = process.env.BITBUCKET_APP_PASSWORD;

      if (!bitbucketUsername || !bitbucketPassword) {
        throw new Error('BitBucket credentials not configured');
      }

      // Check if BitBucket repository exists
      let bitbucketRepo;

      try {
        const response = await axios.get(
          `https://api.bitbucket.org/2.0/repositories/${bitbucketUsername}/${repo.name}`,
          {
            auth: {
              username: bitbucketUsername,
              password: bitbucketPassword,
            },
          }
        );
        bitbucketRepo = response.data;
        logger.info('BitBucket repository already exists', { repositoryId, bitbucketUrl: bitbucketRepo.links.html.href });
      } catch (error: any) {
        if (error.response?.status === 404) {
          // Create BitBucket repository
          const response = await axios.post(
            `https://api.bitbucket.org/2.0/repositories/${bitbucketUsername}/${repo.name}`,
            {
              scm: 'git',
              is_private: repo.isPrivate === 1,
              description: repo.description || '',
            },
            {
              auth: {
                username: bitbucketUsername,
                password: bitbucketPassword,
              },
            }
          );
          bitbucketRepo = response.data;
          logger.info('BitBucket repository created', { repositoryId, bitbucketUrl: bitbucketRepo.links.html.href });
        } else {
          throw error;
        }
      }

      // Set up push mirror in Gitea
      const giteaUrl = process.env.GITEA_URL || 'http://localhost:3001';
      const giteaToken = process.env.GITEA_ADMIN_TOKEN;

      if (!giteaToken) {
        throw new Error('Gitea admin token not configured');
      }

      await axios.post(
        `${giteaUrl}/api/v1/repos/${repo.ownerId}/${repo.name}/push_mirrors`,
        {
          remote_address: bitbucketRepo.links.clone.find((l: any) => l.name === 'https').href,
          remote_username: bitbucketUsername,
          remote_password: bitbucketPassword,
          sync_on_commit: true,
          interval: '8h0m0s',
        },
        {
          headers: { Authorization: `token ${giteaToken}` },
        }
      ).catch((error) => {
        if (error.response?.status !== 409) {
          throw error;
        }
      });

      // Update repository record
      const db = await getDb();
      if (db) {
        await db.update(gitRepositories)
          .set({
            bitbucketRepoId: bitbucketRepo.uuid,
            bitbucketUrl: bitbucketRepo.links.html.href,
            bitbucketSyncEnabled: 1,
            bitbucketLastSync: new Date(),
          })
          .where(eq(gitRepositories.id, repositoryId));
      }

      await this.completeSyncLog(syncLog.id, 'success');
      logger.info('Repository mirrored to BitBucket', { repositoryId, bitbucketUrl: bitbucketRepo.links.html.href });
    } catch (error: any) {
      await this.completeSyncLog(syncLog.id, 'failed', error.message);
      logger.error('Failed to mirror to BitBucket', error, { repositoryId });
      throw error;
    }
  }

  /**
   * Sync commits from GitHub to Gitea
   */
  async syncFromGitHub(repositoryId: number): Promise<void> {
    if (!this.github) {
      throw new Error('GitHub token not configured');
    }

    const repo = await this.getRepository(repositoryId);
    if (!repo || !repo.githubRepoId) return;

    const syncLog = await this.createSyncLog(repositoryId, 'github', 'gitea', 'pull');

    try {
      const githubUsername = process.env.GITHUB_USERNAME || 'luminous-ai';

      // Get latest commits from GitHub
      const commits = await this.github.repos.listCommits({
        owner: githubUsername,
        repo: repo.name,
        since: repo.githubLastSync?.toISOString(),
      });

      // Trigger pull in Gitea
      const giteaUrl = process.env.GITEA_URL || 'http://localhost:3001';
      const giteaToken = process.env.GITEA_ADMIN_TOKEN;

      if (!giteaToken) {
        throw new Error('Gitea admin token not configured');
      }

      await axios.post(
        `${giteaUrl}/api/v1/repos/${repo.ownerId}/${repo.name}/mirror-sync`,
        {},
        {
          headers: { Authorization: `token ${giteaToken}` },
        }
      );

      // Update last sync time
      const db = await getDb();
      if (db) {
        await db.update(gitRepositories)
          .set({ githubLastSync: new Date() })
          .where(eq(gitRepositories.id, repositoryId));
      }

      await this.completeSyncLog(syncLog.id, 'success', { commitsSync: commits.data.length });
      logger.info('Synced commits from GitHub', { repositoryId, commits: commits.data.length });
    } catch (error: any) {
      await this.completeSyncLog(syncLog.id, 'failed', error.message);
      logger.error('Failed to sync from GitHub', error, { repositoryId });
      throw error;
    }
  }

  /**
   * Trigger manual sync for all enabled platforms
   */
  async triggerSync(repositoryId: number): Promise<void> {
    const repo = await this.getRepository(repositoryId);
    if (!repo) throw new Error('Repository not found');

    const promises: Promise<void>[] = [];

    if (repo.githubSyncEnabled && this.github) {
      promises.push(this.mirrorToGitHub(repositoryId));
    }

    if (repo.gitlabSyncEnabled && this.gitlab) {
      promises.push(this.mirrorToGitLab(repositoryId));
    }

    if (repo.bitbucketSyncEnabled) {
      promises.push(this.mirrorToBitBucket(repositoryId));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Get repository from database
   */
  private async getRepository(repositoryId: number): Promise<any> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const result = await db.select()
      .from(gitRepositories)
      .where(eq(gitRepositories.id, repositoryId))
      .limit(1);

    return result[0];
  }

  /**
   * Create sync log entry
   */
  private async createSyncLog(
    repositoryId: number,
    source: string,
    target: string,
    type: string
  ): Promise<{ id: number }> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const result: any = await db.insert(gitSyncLog).values({
      // @ts-ignore - Type issue with enum values
      repositoryId,
      sourcePlatform: source,
      targetPlatform: target,
      syncType: type,
      status: 'in_progress',
      triggeredBy: 'auto' as const,
      startedAt: new Date(),
    });

    return { id: result.insertId };
  }

  /**
   * Complete sync log entry
   */
  private async completeSyncLog(id: number, status: string, metadata?: any): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await db.update(gitSyncLog)
      .set({
        status: status as 'success' | 'failed',
        error: metadata?.error || null,
        completedAt: new Date(),
      })
      .where(eq(gitSyncLog.id, id));
  }
}

// Export singleton instance
export const gitMirrorService = new GitMirrorService();
