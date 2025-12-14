/**
 * Cornelius Orchestration System V2
 * DPID-ADM-AI-001
 * 
 * Enhanced orchestrator with Definition of Ready (DoR) and Definition of Done (DoD) compliance.
 * Manages development lifecycle with quality gates and governance oversight.
 */

import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { backlogItems, agentRegistry, agentTasks } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// Import existing orchestration functions
import { analyzeIntent, delegateTask, getAgentStatus, getTaskStatus, getAgentTasks } from "./corneliusOrchestrator";

export interface WorkItem {
  id: string;
  type: 'epic' | 'story' | 'task' | 'bug' | 'issue';
  title: string;
  description: string;
  phase: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'backlog' | 'ready' | 'in_progress' | 'review' | 'done';
  estimatedHours?: number;
  dependencies?: string[];
  tags?: string[];
  assignedTo?: string;
}

export interface QualityGate {
  name: string;
  criteria: string[];
  status: 'pending' | 'passed' | 'failed';
  checkedBy: string;
  timestamp: Date;
}

// Definition of Ready (DoR) Criteria
const DEFINITION_OF_READY = [
  "Clear and concise title",
  "Detailed description with acceptance criteria",
  "Dependencies identified and documented",
  "Estimated effort provided",
  "Priority assigned",
  "Assigned to appropriate AI agent",
  "No blocking dependencies in backlog status",
];

// Definition of Done (DoD) Criteria
const DEFINITION_OF_DONE = [
  "Code implemented and tested",
  "Unit tests written and passing",
  "Integration tests passing",
  "Code review completed",
  "Documentation updated",
  "No critical bugs or security issues",
  "Performance benchmarks met",
  "Acceptance criteria validated",
];

/**
 * Check if work item meets Definition of Ready
 */
export async function checkDefinitionOfReady(item: WorkItem): Promise<QualityGate> {
  const criteria: string[] = [];
  const failures: string[] = [];
  
  if (!item.title || item.title.length < 5) {
    failures.push("Title is too short or missing");
  } else {
    criteria.push("✓ Clear and concise title");
  }
  
  if (!item.description || item.description.length < 20) {
    failures.push("Description is insufficient");
  } else {
    criteria.push("✓ Detailed description provided");
  }
  
  if (item.dependencies && item.dependencies.length > 0) {
    criteria.push("✓ Dependencies identified");
  } else {
    criteria.push("✓ No dependencies");
  }
  
  if (!item.estimatedHours) {
    failures.push("Estimated effort not provided");
  } else {
    criteria.push("✓ Estimated effort provided");
  }
  
  if (!item.priority) {
    failures.push("Priority not assigned");
  } else {
    criteria.push("✓ Priority assigned");
  }
  
  if (!item.assignedTo) {
    failures.push("Not assigned to an AI agent");
  } else {
    criteria.push("✓ Assigned to AI agent");
  }
  
  const status = failures.length === 0 ? 'passed' : 'failed';
  
  return {
    name: "Definition of Ready",
    criteria: failures.length === 0 ? criteria : [...criteria, ...failures.map(f => `✗ ${f}`)],
    status,
    checkedBy: "Cornelius MacIntyre",
    timestamp: new Date(),
  };
}

/**
 * Check if work item meets Definition of Done
 */
export async function checkDefinitionOfDone(item: WorkItem): Promise<QualityGate> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are Cornelius MacIntyre, verifying Definition of Done compliance.",
      },
      {
        role: "user",
        content: `Verify if this work item meets the Definition of Done:

**Work Item:**
- ID: ${item.id}
- Title: ${item.title}
- Status: ${item.status}

**Definition of Done Criteria:**
${DEFINITION_OF_DONE.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Check each criterion and provide pass/fail assessment.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "dod_check",
        strict: true,
        schema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["passed", "failed"] },
            criteria: {
              type: "array",
              items: { type: "string" },
            },
            reasoning: { type: "string" },
          },
          required: ["status", "criteria", "reasoning"],
          additionalProperties: false,
        },
      },
    },
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  
  return {
    name: "Definition of Done",
    criteria: result.criteria,
    status: result.status,
    checkedBy: "Cornelius MacIntyre",
    timestamp: new Date(),
  };
}

/**
 * Get next work items ready for development
 */
export async function getNextWorkItems(limit = 10): Promise<WorkItem[]> {
  const db = await getDb();
  
  if (!db) {
    throw new Error("Database not available");
  }

  const items = await db
    .select()
    .from(backlogItems)
    .where(eq(backlogItems.status, "ready"))
    .limit(limit);

  return items.map(item => ({
    id: item.id,
    type: item.type as any,
    title: item.title,
    description: item.description || "",
    phase: item.phase || "Unknown",
    priority: item.priority as any,
    status: item.status as any,
    estimatedHours: item.estimatedHours || undefined,
    dependencies: (item.dependencies as string[]) || [],
    tags: (item.tags as string[]) || [],
    assignedTo: item.assignedTo || undefined,
  }));
}

/**
 * Start orchestrated development with DoR/DoD compliance
 */
export async function startOrchestration(): Promise<{
  readyChecks: QualityGate[];
  summary: string;
}> {
  console.log("[Cornelius] Starting orchestrated development with DoR/DoD compliance...");
  
  const workItems = await getNextWorkItems(15);
  
  console.log(`[Cornelius] Found ${workItems.length} work items ready for development`);
  
  const readyChecks: QualityGate[] = [];
  const readyItems: WorkItem[] = [];
  
  for (const item of workItems) {
    const check = await checkDefinitionOfReady(item);
    readyChecks.push(check);
    
    if (check.status === 'passed') {
      readyItems.push(item);
    } else {
      console.log(`[Cornelius] Item ${item.id} failed DoR check:`, check.criteria);
    }
  }
  
  console.log(`[Cornelius] ${readyItems.length} items passed DoR check`);
  
  const summary = `
Cornelius Orchestration Summary
================================

Total Work Items Reviewed: ${workItems.length}
Items Passing DoR: ${readyItems.length}
Items Failing DoR: ${workItems.length - readyItems.length}

Next Steps:
1. Address DoR failures for ${workItems.length - readyItems.length} items
2. Begin development on ${readyItems.length} ready items
3. Monitor progress and enforce DoD compliance

Cornelius MacIntyre - Master Orchestrator
${new Date().toISOString()}
  `.trim();
  
  return {
    readyChecks,
    summary,
  };
}

/**
 * Generate progress report
 */
export async function generateProgressReport(): Promise<string> {
  const db = await getDb();
  
  if (!db) {
    throw new Error("Database not available");
  }

  const allItems = await db.select().from(backlogItems);
  
  const byStatus = {
    backlog: allItems.filter(i => i.status === 'backlog').length,
    ready: allItems.filter(i => i.status === 'ready').length,
    in_progress: allItems.filter(i => i.status === 'in_progress').length,
    review: allItems.filter(i => i.status === 'review').length,
    done: allItems.filter(i => i.status === 'done').length,
  };
  
  const byPriority = {
    critical: allItems.filter(i => i.priority === 'critical').length,
    high: allItems.filter(i => i.priority === 'high').length,
    medium: allItems.filter(i => i.priority === 'medium').length,
    low: allItems.filter(i => i.priority === 'low').length,
  };
  
  const totalEstimatedHours = allItems.reduce((sum, i) => sum + (i.estimatedHours || 0), 0);
  const completedHours = allItems
    .filter(i => i.status === 'done')
    .reduce((sum, i) => sum + (i.estimatedHours || 0), 0);
  
  const completionPercentage = totalEstimatedHours > 0 
    ? ((completedHours / totalEstimatedHours) * 100).toFixed(1)
    : '0.0';
  
  return `
Cornelius Progress Report
=========================

Total Work Items: ${allItems.length}

Status Breakdown:
- Backlog: ${byStatus.backlog}
- Ready: ${byStatus.ready}
- In Progress: ${byStatus.in_progress}
- In Review: ${byStatus.review}
- Done: ${byStatus.done}

Priority Breakdown:
- Critical: ${byPriority.critical}
- High: ${byPriority.high}
- Medium: ${byPriority.medium}
- Low: ${byPriority.low}

Effort Tracking:
- Total Estimated Hours: ${totalEstimatedHours}
- Completed Hours: ${completedHours}
- Completion: ${completionPercentage}%

Generated: ${new Date().toISOString()}
By: Cornelius MacIntyre (DPID-ADM-AI-001)
  `.trim();
}

// Re-export existing functions
export { analyzeIntent, delegateTask, getAgentStatus, getTaskStatus, getAgentTasks };
