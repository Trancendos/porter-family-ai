/**
 * Sample Data Generation Service
 * 
 * Generates realistic test data for all entities:
 * - Platform apps (root and user apps)
 * - User workspaces
 * - Deployments
 * - Error logs
 * - Audit logs
 * - App tags
 */

import { getDb } from "../db";
import { generatePID, generateDPID } from "./productIdService";

/**
 * Generate sample platform apps
 */
export async function generateSampleApps(count: number = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { platformApps } = await import("../../drizzle/platform-schema");
  const { users } = await import("../../drizzle/schema");
  
  // Get admin user (owner)
  const adminUsers = await db.select().from(users).where(sql`role = 'admin'`).limit(1);
  const adminId = adminUsers[0]?.id || 1;
  
  // Root apps (admin-owned)
  const rootApps = [
    {
      name: "Infinity OAuth Hub",
      slug: "infinity",
      type: "root" as const,
      dpid: generateDPID(),
      ownerId: adminId,
      description: "Centralized authentication and user management system",
      icon: "🔐",
      deploymentUrl: "https://trancendos.com/infinity",
      containerName: "infinity-app",
      port: 3001,
      status: "active" as const,
    },
    {
      name: "Luminous MastermindAI",
      slug: "Luminous-MastermindAI",
      type: "root" as const,
      dpid: generateDPID(),
      ownerId: adminId,
      description: "AI orchestration platform with 7 specialized AI assistants",
      icon: "🤖",
      deploymentUrl: "https://trancendos.com/Luminous-MastermindAI",
      containerName: "luminous-app",
      port: 3000,
      status: "active" as const,
    },
    {
      name: "Tristuran",
      slug: "tristuran",
      type: "root" as const,
      dpid: generateDPID(),
      ownerId: adminId,
      description: "Project management and collaboration platform",
      icon: "📊",
      deploymentUrl: "https://trancendos.com/tristuran",
      containerName: "tristuran-app",
      port: 3002,
      status: "active" as const,
    },
    {
      name: "NanoLeaf",
      slug: "NanoLeaf",
      type: "root" as const,
      dpid: generateDPID(),
      ownerId: adminId,
      description: "Lightweight note-taking and knowledge management",
      icon: "🍃",
      deploymentUrl: "https://trancendos.com/NanoLeaf",
      containerName: "nanoleaf-app",
      port: 3003,
      status: "active" as const,
    },
  ];
  
  // User apps (sample)
  const userAppTemplates = [
    { name: "Task Manager", description: "Personal task management app", icon: "✅" },
    { name: "Budget Tracker", description: "Financial tracking and budgeting", icon: "💰" },
    { name: "Recipe Book", description: "Digital cookbook and meal planner", icon: "🍳" },
    { name: "Workout Logger", description: "Fitness tracking and workout planning", icon: "💪" },
    { name: "Reading List", description: "Book tracking and reading goals", icon: "📚" },
    { name: "Travel Planner", description: "Trip planning and itinerary management", icon: "✈️" },
    { name: "Habit Tracker", description: "Daily habit tracking and streaks", icon: "🎯" },
    { name: "Pet Care", description: "Pet health and care management", icon: "🐾" },
  ];
  
  const userApps = userAppTemplates.slice(0, count - rootApps.length).map((template, i) => ({
    name: template.name,
    slug: `${template.name.toLowerCase().replace(/\s+/g, '-')}-${i + 1}`,
    type: "user" as const,
    pid: generatePID(),
    ownerId: adminId, // In real scenario, would be different users
    description: template.description,
    icon: template.icon,
    deploymentUrl: `https://trancendos.com/arcadia/user1/${template.name.toLowerCase().replace(/\s+/g, '-')}`,
    containerName: `arcadia-user1-${template.name.toLowerCase().replace(/\s+/g, '-')}`,
    port: 4000 + i,
    status: "active" as const,
    maxMemoryMB: 512,
    maxCpuCores: "1.0",
    maxStorageGB: 5,
    monthlyPrice: 0, // Free tier
  }));
  
  const allApps = [...rootApps, ...userApps];
  
  // Insert apps
  for (const app of allApps) {
    await db.insert(platformApps).values(app);
  }
  
  console.log(`✅ Generated ${allApps.length} sample apps (${rootApps.length} root, ${userApps.length} user)`);
  return allApps;
}

/**
 * Generate sample error logs
 */
export async function generateSampleErrorLogs(count: number = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { errorLogs, platformApps } = await import("../../drizzle/platform-schema");
  
  // Get some apps
  const apps = await db.select().from(platformApps).limit(5);
  
  const errorTemplates = [
    { level: "error" as const, category: "database" as const, message: "Connection timeout to database" },
    { level: "warn" as const, category: "performance" as const, message: "API response time exceeded 2s threshold" },
    { level: "error" as const, category: "authentication" as const, message: "Invalid JWT token signature" },
    { level: "critical" as const, category: "security" as const, message: "Potential SQL injection attempt detected" },
    { level: "error" as const, category: "external_api" as const, message: "Third-party API returned 500 error" },
    { level: "warn" as const, category: "validation" as const, message: "Missing required field in request body" },
    { level: "info" as const, category: "system" as const, message: "Scheduled backup completed successfully" },
    { level: "error" as const, category: "authorization" as const, message: "User attempted to access forbidden resource" },
    { level: "debug" as const, category: "business_logic" as const, message: "Processing payment workflow step 3" },
    { level: "critical" as const, category: "system" as const, message: "Out of memory error - container restarted" },
  ];
  
  const logs = [];
  for (let i = 0; i < count; i++) {
    const template = errorTemplates[i % errorTemplates.length];
    const app = apps[i % apps.length];
    
    logs.push({
      level: template.level,
      category: template.category,
      message: template.message,
      errorName: template.level === "error" || template.level === "critical" ? "Error" : null,
      errorMessage: template.level === "error" || template.level === "critical" ? template.message : null,
      stackTrace: template.level === "error" || template.level === "critical" 
        ? `Error: ${template.message}\n    at handler (/app/server.js:123:45)\n    at processRequest (/app/middleware.js:67:89)`
        : null,
      appId: app?.id,
      productId: app?.pid || app?.dpid,
      requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      resolved: Math.random() > 0.7 ? 1 : 0,
    });
  }
  
  // Insert logs
  for (const log of logs) {
    await db.insert(errorLogs).values(log);
  }
  
  console.log(`✅ Generated ${count} sample error logs`);
  return logs;
}

/**
 * Generate sample audit logs
 */
export async function generateSampleAuditLogs(count: number = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { auditLogs, platformApps } = await import("../../drizzle/platform-schema");
  const { users } = await import("../../drizzle/schema");
  
  const allUsers = await db.select().from(users).limit(10);
  const apps = await db.select().from(platformApps).limit(5);
  
  const actions = [
    { action: "create", entityType: "app" },
    { action: "update", entityType: "app" },
    { action: "delete", entityType: "app" },
    { action: "deploy", entityType: "deployment" },
    { action: "rollback", entityType: "deployment" },
    { action: "login", entityType: "user" },
    { action: "logout", entityType: "user" },
    { action: "update_settings", entityType: "app" },
    { action: "add_env_var", entityType: "environment" },
    { action: "remove_env_var", entityType: "environment" },
  ];
  
  const logs = [];
  for (let i = 0; i < count; i++) {
    const actionTemplate = actions[i % actions.length];
    const user = allUsers[i % allUsers.length];
    const app = apps[i % apps.length];
    
    logs.push({
      action: actionTemplate.action,
      entityType: actionTemplate.entityType,
      entityId: app?.id,
      userId: user?.id,
      userEmail: user?.email,
      changesBefore: JSON.stringify({ status: "active", version: "1.0.0" }),
      changesAfter: JSON.stringify({ status: "active", version: "1.0.1" }),
      ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      success: Math.random() > 0.1 ? 1 : 0,
    });
  }
  
  // Insert logs
  for (const log of logs) {
    await db.insert(auditLogs).values(log);
  }
  
  console.log(`✅ Generated ${count} sample audit logs`);
  return logs;
}

/**
 * Generate sample app tags
 */
export async function generateSampleAppTags() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { appTags, platformApps } = await import("../../drizzle/platform-schema");
  const { users } = await import("../../drizzle/schema");
  
  const apps = await db.select().from(platformApps).limit(10);
  const adminUsers = await db.select().from(users).where(sql`role = 'admin'`).limit(1);
  const adminId = adminUsers[0]?.id || 1;
  
  const tagTemplates = [
    { tag: "production", category: "status" },
    { tag: "staging", category: "status" },
    { tag: "development", category: "status" },
    { tag: "react", category: "tech" },
    { tag: "nextjs", category: "tech" },
    { tag: "nodejs", category: "tech" },
    { tag: "typescript", category: "tech" },
    { tag: "authentication", category: "feature" },
    { tag: "database", category: "feature" },
    { tag: "api", category: "feature" },
    { tag: "ai-powered", category: "feature" },
    { tag: "high-priority", category: "priority" },
    { tag: "experimental", category: "status" },
  ];
  
  const tags = [];
  for (const app of apps) {
    // Add 2-4 random tags per app
    const numTags = 2 + Math.floor(Math.random() * 3);
    const selectedTags = tagTemplates
      .sort(() => Math.random() - 0.5)
      .slice(0, numTags);
    
    for (const tagTemplate of selectedTags) {
      tags.push({
        appId: app.id,
        tag: tagTemplate.tag,
        category: tagTemplate.category,
        autoGenerated: Math.random() > 0.5 ? 1 : 0,
        confidence: Math.random() > 0.5 ? (0.7 + Math.random() * 0.3).toFixed(2) : null,
        createdBy: adminId,
      });
    }
  }
  
  // Insert tags
  for (const tag of tags) {
    await db.insert(appTags).values(tag);
  }
  
  console.log(`✅ Generated ${tags.length} sample app tags for ${apps.length} apps`);
  return tags;
}

/**
 * Generate all sample data
 */
export async function generateAllSampleData() {
  console.log("🚀 Generating sample data...\n");
  
  try {
    await generateSampleApps(12);
    await generateSampleErrorLogs(50);
    await generateSampleAuditLogs(100);
    await generateSampleAppTags();
    
    console.log("\n✅ All sample data generated successfully!");
  } catch (error) {
    console.error("❌ Error generating sample data:", error);
    throw error;
  }
}

/**
 * Clear all sample data (for testing)
 */
export async function clearAllSampleData() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { platformApps, errorLogs, auditLogs, appTags } = await import("../../drizzle/platform-schema");
  
  console.log("🗑️  Clearing sample data...");
  
  await db.delete(appTags);
  await db.delete(auditLogs);
  await db.delete(errorLogs);
  await db.delete(platformApps);
  
  console.log("✅ All sample data cleared!");
}

// Helper for SQL import
const { sql } = await import("drizzle-orm");
