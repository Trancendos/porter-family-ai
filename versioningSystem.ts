/**
 * Versioning System for All Entities
 * 
 * Track history, enable rollback, and provide diff comparison for all platform entities
 */

export interface Version {
  id: string;
  entityType: string;
  entityId: string;
  version: number;
  data: any;
  changes: Change[];
  createdBy: string;
  createdAt: Date;
  message?: string;
}

export interface Change {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: "added" | "modified" | "removed";
}

export interface DiffResult {
  additions: Change[];
  modifications: Change[];
  deletions: Change[];
  summary: string;
}

/**
 * Create a new version of an entity
 */
export async function createVersion(
  entityType: string,
  entityId: string,
  data: any,
  userId: string,
  message?: string
): Promise<Version> {
  // TODO: Get previous version from database
  const previousVersion: Version | null = null;

  const version: Version = {
    id: `version-${Date.now()}`,
    entityType,
    entityId,
    version: previousVersion ? previousVersion.version + 1 : 1,
    data,
    changes: previousVersion ? calculateChanges(previousVersion.data, data) : [],
    createdBy: userId,
    createdAt: new Date(),
    message,
  };

  // TODO: Store in database

  console.log(`[Versioning] Created version ${version.version} for ${entityType}:${entityId}`);

  return version;
}

/**
 * Get version history for an entity
 */
export async function getVersionHistory(
  entityType: string,
  entityId: string
): Promise<Version[]> {
  // TODO: Retrieve from database

  return [
    {
      id: "version-1",
      entityType,
      entityId,
      version: 1,
      data: { title: "Initial version" },
      changes: [],
      createdBy: "user-1",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 7 days ago
      message: "Initial creation",
    },
    {
      id: "version-2",
      entityType,
      entityId,
      version: 2,
      data: { title: "Updated version", description: "Added description" },
      changes: [
        {
          field: "title",
          oldValue: "Initial version",
          newValue: "Updated version",
          changeType: "modified",
        },
        {
          field: "description",
          oldValue: null,
          newValue: "Added description",
          changeType: "added",
        },
      ],
      createdBy: "user-1",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
      message: "Updated title and added description",
    },
  ];
}

/**
 * Rollback to a specific version
 */
export async function rollbackToVersion(
  entityType: string,
  entityId: string,
  targetVersion: number,
  userId: string
): Promise<Version> {
  // TODO: Get target version from database
  const targetVersionData = await getVersion(entityType, entityId, targetVersion);

  if (!targetVersionData) {
    throw new Error(`Version ${targetVersion} not found`);
  }

  // Create new version with the old data
  const newVersion = await createVersion(
    entityType,
    entityId,
    targetVersionData.data,
    userId,
    `Rolled back to version ${targetVersion}`
  );

  console.log(`[Versioning] Rolled back ${entityType}:${entityId} to version ${targetVersion}`);

  return newVersion;
}

/**
 * Get a specific version
 */
export async function getVersion(
  entityType: string,
  entityId: string,
  version: number
): Promise<Version | null> {
  // TODO: Retrieve from database

  return null;
}

/**
 * Compare two versions
 */
export async function compareVersions(
  entityType: string,
  entityId: string,
  version1: number,
  version2: number
): Promise<DiffResult> {
  const v1 = await getVersion(entityType, entityId, version1);
  const v2 = await getVersion(entityType, entityId, version2);

  if (!v1 || !v2) {
    throw new Error("One or both versions not found");
  }

  const changes = calculateChanges(v1.data, v2.data);

  const additions = changes.filter((c) => c.changeType === "added");
  const modifications = changes.filter((c) => c.changeType === "modified");
  const deletions = changes.filter((c) => c.changeType === "removed");

  const summary = `${additions.length} additions, ${modifications.length} modifications, ${deletions.length} deletions`;

  return {
    additions,
    modifications,
    deletions,
    summary,
  };
}

/**
 * Calculate changes between two data objects
 */
function calculateChanges(oldData: any, newData: any): Change[] {
  const changes: Change[] = [];

  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);

  for (const key of allKeys) {
    const oldValue = oldData?.[key];
    const newValue = newData?.[key];

    if (oldValue === undefined && newValue !== undefined) {
      // Added
      changes.push({
        field: key,
        oldValue: null,
        newValue,
        changeType: "added",
      });
    } else if (oldValue !== undefined && newValue === undefined) {
      // Removed
      changes.push({
        field: key,
        oldValue,
        newValue: null,
        changeType: "removed",
      });
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      // Modified
      changes.push({
        field: key,
        oldValue,
        newValue,
        changeType: "modified",
      });
    }
  }

  return changes;
}

/**
 * Get latest version number
 */
export async function getLatestVersionNumber(
  entityType: string,
  entityId: string
): Promise<number> {
  const history = await getVersionHistory(entityType, entityId);
  return history.length > 0 ? Math.max(...history.map((v) => v.version)) : 0;
}

/**
 * Auto-version on entity update
 */
export async function autoVersion(
  entityType: string,
  entityId: string,
  newData: any,
  userId: string,
  autoMessage?: boolean
): Promise<Version> {
  const previousVersion = await getVersion(entityType, entityId, await getLatestVersionNumber(entityType, entityId));

  let message: string | undefined;
  if (autoMessage && previousVersion) {
    const changes = calculateChanges(previousVersion.data, newData);
    message = `Auto-versioned: ${changes.length} changes`;
  }

  return await createVersion(entityType, entityId, newData, userId, message);
}
