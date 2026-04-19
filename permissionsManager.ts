/**
 * Cornelius Permissions Manager
 * 
 * Manages permissions and task approvals for the orchestration framework.
 * Cornelius controls who can do what across all agents and modules.
 */

import { getDb } from "../db";
import { mysqlTable, int, varchar, text, timestamp, boolean, json } from "drizzle-orm/mysql-core";
import { eq, and, desc, inArray } from "drizzle-orm";

// Define permissions tables inline (will be added to schema later)
export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 64 }).notNull(), // 'agent', 'module', 'system', 'workflow'
  resource: varchar("resource", { length: 255 }), // Agent ID, module ID, etc.
  action: varchar("action", { length: 64 }).notNull(), // 'read', 'write', 'execute', 'admin'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rolePermissions = mysqlTable("role_permissions", {
  id: int("id").autoincrement().primaryKey(),
  role: varchar("role", { length: 64 }).notNull(), // 'admin', 'user', 'agent', 'bot'
  permissionId: int("permission_id").notNull(),
  granted: boolean("granted").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userPermissions = mysqlTable("user_permissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  permissionId: int("permission_id").notNull(),
  granted: boolean("granted").default(true).notNull(),
  grantedBy: int("granted_by"),
  expiresAt: timestamp("expires_at"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const taskApprovals = mysqlTable("task_approvals", {
  id: int("id").autoincrement().primaryKey(),
  taskId: varchar("task_id", { length: 255 }).notNull(),
  taskType: varchar("task_type", { length: 64 }).notNull(), // 'agent_spawn', 'workflow_execute', 'module_access', etc.
  requestedBy: int("requested_by").notNull(),
  approvers: json("approvers").$type<number[]>().notNull(), // Array of user IDs who can approve
  status: varchar("status", { length: 32 }).default("pending").notNull(), // 'pending', 'approved', 'rejected', 'cancelled'
  approvedBy: int("approved_by"),
  rejectedBy: int("rejected_by"),
  approvalReason: text("approval_reason"),
  rejectionReason: text("rejection_reason"),
  metadata: json("metadata"), // Task-specific data
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
});

/**
 * Permission types
 */
export interface Permission {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  category: string;
  resource: string | null;
  action: string;
  createdAt: Date;
}

/**
 * Check if user has permission
 */
export async function hasPermission(
  userId: number,
  permissionName: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Get permission ID
  const perms = await db
    .select()
    .from(permissions)
    .where(eq(permissions.name, permissionName))
    .limit(1);

  if (perms.length === 0) return false;

  const permission = perms[0];

  // Check user-specific permission
  const userPerms = await db
    .select()
    .from(userPermissions)
    .where(
      and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.permissionId, permission.id),
        eq(userPermissions.granted, true)
      )
    )
    .limit(1);

  if (userPerms.length > 0) {
    const userPerm = userPerms[0];
    // Check if expired
    if (userPerm.expiresAt && userPerm.expiresAt < new Date()) {
      return false;
    }
    return true;
  }

  // Check role-based permission (get user role from users table)
  // For now, assume admin role has all permissions
  // TODO: Implement proper role checking

  return false;
}

/**
 * Grant permission to user
 */
export async function grantPermission(
  userId: number,
  permissionName: string,
  grantedBy: number,
  expiresAt?: Date,
  reason?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get permission ID
  const perms = await db
    .select()
    .from(permissions)
    .where(eq(permissions.name, permissionName))
    .limit(1);

  if (perms.length === 0) {
    throw new Error(`Permission "${permissionName}" not found`);
  }

  const permission = perms[0];

  // Check if permission already exists
  const existing = await db
    .select()
    .from(userPermissions)
    .where(
      and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.permissionId, permission.id)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing permission
    await db
      .update(userPermissions)
      .set({
        granted: true,
        grantedBy,
        expiresAt,
        reason,
        updatedAt: new Date(),
      })
      .where(eq(userPermissions.id, existing[0].id));
  } else {
    // Create new permission
    await db.insert(userPermissions).values({
      userId,
      permissionId: permission.id,
      granted: true,
      grantedBy,
      expiresAt,
      reason,
    });
  }
}

/**
 * Revoke permission from user
 */
export async function revokePermission(userId: number, permissionName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get permission ID
  const perms = await db
    .select()
    .from(permissions)
    .where(eq(permissions.name, permissionName))
    .limit(1);

  if (perms.length === 0) return;

  const permission = perms[0];

  await db
    .update(userPermissions)
    .set({ granted: false, updatedAt: new Date() })
    .where(
      and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.permissionId, permission.id)
      )
    );
}

/**
 * Get user permissions
 */
export async function getUserPermissions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const userPerms = await db
    .select()
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId));

  const permissionIds = userPerms.map((up) => up.permissionId);

  if (permissionIds.length === 0) return [];

  const perms = await db
    .select()
    .from(permissions)
    .where(inArray(permissions.id, permissionIds));

  return perms;
}

/**
 * Request task approval
 */
export async function requestTaskApproval(
  taskId: string,
  taskType: string,
  requestedBy: number,
  approvers: number[],
  metadata?: any
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(taskApprovals).values({
    taskId,
    taskType,
    requestedBy,
    approvers,
    metadata,
    status: "pending",
  });
}

/**
 * Approve task
 */
export async function approveTask(
  taskId: string,
  approvedBy: number,
  reason?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(taskApprovals)
    .set({
      status: "approved",
      approvedBy,
      approvalReason: reason,
      respondedAt: new Date(),
    })
    .where(eq(taskApprovals.taskId, taskId));
}

/**
 * Reject task
 */
export async function rejectTask(
  taskId: string,
  rejectedBy: number,
  reason: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(taskApprovals)
    .set({
      status: "rejected",
      rejectedBy,
      rejectionReason: reason,
      respondedAt: new Date(),
    })
    .where(eq(taskApprovals.taskId, taskId));
}

/**
 * Get pending approvals for user
 */
export async function getPendingApprovals(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const approvals = await db
    .select()
    .from(taskApprovals)
    .where(eq(taskApprovals.status, "pending"))
    .orderBy(desc(taskApprovals.requestedAt));

  // Filter approvals where user is an approver
  return approvals.filter((approval) => {
    const approvers = approval.approvers as number[];
    return approvers.includes(userId);
  });
}

/**
 * Get all task approvals
 */
export async function getAllTaskApprovals(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(taskApprovals)
    .orderBy(desc(taskApprovals.requestedAt))
    .limit(limit);
}

/**
 * Initialize default permissions
 */
export async function initializeDefaultPermissions() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const defaultPermissions = [
    // Agent permissions
    {
      name: "agent.cornelius.execute",
      displayName: "Execute Cornelius Tasks",
      description: "Allows executing tasks through Cornelius orchestrator",
      category: "agent",
      resource: "cornelius",
      action: "execute",
    },
    {
      name: "agent.doris.read",
      displayName: "View Doris Financial Data",
      description: "Allows viewing financial data managed by Doris",
      category: "agent",
      resource: "doris",
      action: "read",
    },
    {
      name: "agent.doris.write",
      displayName: "Modify Doris Financial Data",
      description: "Allows modifying financial data managed by Doris",
      category: "agent",
      resource: "doris",
      action: "write",
    },
    {
      name: "agent.the_dr.execute",
      displayName: "Execute The Dr Code Validation",
      description: "Allows running code validation and self-healing",
      category: "agent",
      resource: "the_dr",
      action: "execute",
    },
    {
      name: "agent.the_guardian.admin",
      displayName: "Administer The Guardian",
      description: "Full control over security and gatekeeper bots",
      category: "agent",
      resource: "the_guardian",
      action: "admin",
    },
    // Module permissions
    {
      name: "module.infinity.admin",
      displayName: "Administer Infinity OAuth Hub",
      description: "Full control over authentication and sessions",
      category: "module",
      resource: "infinity",
      action: "admin",
    },
    {
      name: "module.hive.access",
      displayName: "Access The HIVE",
      description: "Allows accessing The HIVE module dashboard",
      category: "module",
      resource: "hive",
      action: "read",
    },
    // System permissions
    {
      name: "system.admin",
      displayName: "System Administrator",
      description: "Full system access and control",
      category: "system",
      resource: null,
      action: "admin",
    },
    {
      name: "system.user",
      displayName: "System User",
      description: "Basic system access",
      category: "system",
      resource: null,
      action: "read",
    },
  ];

  for (const perm of defaultPermissions) {
    try {
      // Check if permission already exists
      const existing = await db
        .select()
        .from(permissions)
        .where(eq(permissions.name, perm.name))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(permissions).values(perm);
      }
    } catch (error) {
      console.error(`Failed to create permission ${perm.name}:`, error);
    }
  }
}
