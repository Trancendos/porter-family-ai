/**
 * GOVERNANCE BOARD SERVICE
 * 
 * Merge approval system with:
 * - Automated testing pipeline
 * - Impact analysis engine
 * - Security scanning
 * - Auto-approve/reject rules
 * - Voting workflow with quorum
 * - Audit trail
 */

import { eq, desc, and, sql, gte, lte, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  mergeProposals,
  governanceVotes,
  governanceBoardMembers,
  reviewAssignments,
  governanceRules,
  proposalComments,
  governanceAuditLog,
  governanceMetrics,
  MergeProposal,
  GovernanceVote,
  GovernanceBoardMember,
  GovernanceRule,
  InsertMergeProposal,
  InsertGovernanceVote,
} from "../../drizzle/governance-schema";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";

// ============================================================================
// TYPES
// ============================================================================

export interface TestResults {
  unitTests: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    coverage: number;
  };
  integrationTests?: {
    total: number;
    passed: number;
    failed: number;
  };
  performanceTests?: {
    baseline: Record<string, number>;
    current: Record<string, number>;
    regressions: string[];
  };
  lintErrors: number;
  typeErrors: number;
}

export interface ImpactAnalysis {
  affectedModules: string[];
  affectedServices: string[];
  breakingChanges: Array<{
    type: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
  }>;
  dependencyChanges: {
    added: Array<{ name: string; version: string }>;
    removed: Array<{ name: string; version: string }>;
    updated: Array<{ name: string; from: string; to: string }>;
  };
  estimatedRisk: "low" | "medium" | "high" | "critical";
  riskFactors: string[];
  aiAnalysis?: string;
}

export interface SecurityScanResult {
  vulnerabilities: Array<{
    id: string;
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    file?: string;
    line?: number;
    recommendation?: string;
  }>;
  complianceIssues: Array<{
    rule: string;
    severity: string;
    description: string;
  }>;
  secretLeaks: Array<{
    type: string;
    file: string;
    line: number;
  }>;
  overallSeverity: "none" | "low" | "medium" | "high" | "critical";
  scanDuration: number;
}

export interface ChangedFile {
  path: string;
  type: "added" | "modified" | "deleted" | "renamed";
  linesAdded: number;
  linesRemoved: number;
  diff?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// PROPOSAL CRUD
// ============================================================================

export async function createProposal(data: {
  title: string;
  description?: string;
  submittedBy: number;
  submitterName?: string;
  sourceBranch?: string;
  targetBranch?: string;
  commitHash?: string;
  repository?: string;
  changedFiles?: ChangedFile[];
  priority?: "low" | "medium" | "high" | "critical";
  labels?: string[];
}): Promise<MergeProposal> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const id = generateId();
  
  // Calculate summary stats
  const filesChanged = data.changedFiles?.length || 0;
  const linesAdded = data.changedFiles?.reduce((sum, f) => sum + f.linesAdded, 0) || 0;
  const linesRemoved = data.changedFiles?.reduce((sum, f) => sum + f.linesRemoved, 0) || 0;
  
  await db.insert(mergeProposals).values({
    id,
    title: data.title,
    description: data.description,
    submittedBy: data.submittedBy,
    submitterName: data.submitterName,
    sourceBranch: data.sourceBranch,
    targetBranch: data.targetBranch,
    commitHash: data.commitHash,
    repository: data.repository,
    changedFiles: data.changedFiles,
    filesChanged,
    linesAdded,
    linesRemoved,
    priority: data.priority || "medium",
    labels: data.labels,
    status: "draft",
  });
  
  // Log creation
  await logAction(id, data.submittedBy, data.submitterName || "Unknown", "proposal_created", {
    title: data.title,
    filesChanged,
    linesAdded,
    linesRemoved,
  });
  
  const result = await db.select().from(mergeProposals).where(eq(mergeProposals.id, id)).limit(1);
  return result[0];
}

export async function getProposal(id: string): Promise<MergeProposal | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(mergeProposals).where(eq(mergeProposals.id, id)).limit(1);
  return result[0] || null;
}

export async function listProposals(filters?: {
  status?: string;
  submittedBy?: number;
  priority?: string;
  limit?: number;
}): Promise<MergeProposal[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(mergeProposals);
  
  const conditions = [];
  if (filters?.status) {
    conditions.push(eq(mergeProposals.status, filters.status as any));
  }
  if (filters?.submittedBy) {
    conditions.push(eq(mergeProposals.submittedBy, filters.submittedBy));
  }
  if (filters?.priority) {
    conditions.push(eq(mergeProposals.priority, filters.priority as any));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  return await query
    .orderBy(desc(mergeProposals.createdAt))
    .limit(filters?.limit || 50);
}

export async function updateProposal(id: string, data: Partial<MergeProposal>): Promise<MergeProposal | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(mergeProposals).set(data).where(eq(mergeProposals.id, id));
  return await getProposal(id);
}

// ============================================================================
// SUBMISSION & REVIEW WORKFLOW
// ============================================================================

export async function submitProposal(proposalId: string): Promise<MergeProposal> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error("Proposal not found");
  
  if (proposal.status !== "draft") {
    throw new Error("Only draft proposals can be submitted");
  }
  
  // Update status to pending tests
  await db.update(mergeProposals)
    .set({ status: "pending_tests" })
    .where(eq(mergeProposals.id, proposalId));
  
  // Log submission
  await logAction(proposalId, proposal.submittedBy, proposal.submitterName || "Unknown", "proposal_submitted", {});
  
  // Start automated testing
  await runAutomatedTests(proposalId);
  
  return (await getProposal(proposalId))!;
}

export async function runAutomatedTests(proposalId: string): Promise<TestResults> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error("Proposal not found");
  
  // Update status
  await db.update(mergeProposals)
    .set({ status: "testing" })
    .where(eq(mergeProposals.id, proposalId));
  
  await logAction(proposalId, 0, "System", "tests_started", {});
  
  // Simulate test execution (in production, this would run actual tests)
  const testResults: TestResults = {
    unitTests: {
      total: 150,
      passed: 148,
      failed: 2,
      skipped: 0,
      coverage: 85.5,
    },
    integrationTests: {
      total: 25,
      passed: 25,
      failed: 0,
    },
    performanceTests: {
      baseline: { responseTime: 100, throughput: 1000 },
      current: { responseTime: 105, throughput: 980 },
      regressions: [],
    },
    lintErrors: 0,
    typeErrors: 0,
  };
  
  // Update proposal with test results
  await db.update(mergeProposals)
    .set({ testResults })
    .where(eq(mergeProposals.id, proposalId));
  
  await logAction(proposalId, 0, "System", "tests_completed", {
    passed: testResults.unitTests.passed,
    failed: testResults.unitTests.failed,
    coverage: testResults.unitTests.coverage,
  });
  
  // Run security scan
  await runSecurityScan(proposalId);
  
  // Run impact analysis
  await runImpactAnalysis(proposalId);
  
  // Evaluate rules
  await evaluateRules(proposalId);
  
  return testResults;
}

export async function runSecurityScan(proposalId: string): Promise<SecurityScanResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error("Proposal not found");
  
  await logAction(proposalId, 0, "System", "security_scan_started", {});
  
  // Simulate security scan (in production, use actual security tools)
  const securityScan: SecurityScanResult = {
    vulnerabilities: [],
    complianceIssues: [],
    secretLeaks: [],
    overallSeverity: "none",
    scanDuration: 5000,
  };
  
  // Check for common issues in changed files
  const changedFiles = proposal.changedFiles as ChangedFile[] || [];
  
  for (const file of changedFiles) {
    // Check for potential secret leaks
    if (file.diff?.includes('API_KEY') || file.diff?.includes('SECRET')) {
      securityScan.secretLeaks.push({
        type: "potential_secret",
        file: file.path,
        line: 1,
      });
      securityScan.overallSeverity = "high";
    }
    
    // Check for SQL injection patterns
    if (file.diff?.includes('${') && file.path.endsWith('.sql')) {
      securityScan.vulnerabilities.push({
        id: `vuln_${Date.now()}`,
        severity: "high",
        title: "Potential SQL Injection",
        description: "String interpolation detected in SQL file",
        file: file.path,
        recommendation: "Use parameterized queries instead",
      });
      securityScan.overallSeverity = "high";
    }
  }
  
  // Update proposal with security scan
  await db.update(mergeProposals)
    .set({ securityScan })
    .where(eq(mergeProposals.id, proposalId));
  
  await logAction(proposalId, 0, "System", "security_scan_completed", {
    vulnerabilities: securityScan.vulnerabilities.length,
    secretLeaks: securityScan.secretLeaks.length,
    overallSeverity: securityScan.overallSeverity,
  });
  
  return securityScan;
}

export async function runImpactAnalysis(proposalId: string): Promise<ImpactAnalysis> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error("Proposal not found");
  
  const changedFiles = proposal.changedFiles as ChangedFile[] || [];
  
  // Analyze affected modules
  const affectedModules = new Set<string>();
  const affectedServices = new Set<string>();
  
  for (const file of changedFiles) {
    // Extract module from path
    const parts = file.path.split('/');
    if (parts.length > 1) {
      affectedModules.add(parts[0]);
      if (parts[0] === 'server' && parts.length > 2) {
        affectedServices.add(parts[2].replace('.ts', ''));
      }
    }
  }
  
  // Calculate risk
  let estimatedRisk: "low" | "medium" | "high" | "critical" = "low";
  const riskFactors: string[] = [];
  
  if (proposal.linesAdded && proposal.linesAdded > 500) {
    estimatedRisk = "medium";
    riskFactors.push("Large change (>500 lines added)");
  }
  
  if (changedFiles.some(f => f.path.includes('schema'))) {
    estimatedRisk = "high";
    riskFactors.push("Database schema changes");
  }
  
  if
 (changedFiles.some(f => f.path.includes('auth') || f.path.includes('security'))) {
    estimatedRisk = "high";
    riskFactors.push("Security-related changes");
  }
  
  const securityScan = proposal.securityScan as SecurityScanResult | null;
  if (securityScan?.overallSeverity === "critical") {
    estimatedRisk = "critical";
    riskFactors.push("Critical security vulnerabilities found");
  }
  
  // Use AI for deeper analysis
  let aiAnalysis: string | undefined;
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a code review expert. Analyze the changes and provide a brief risk assessment."
        },
        {
          role: "user",
          content: `Analyze these code changes:
          
Files changed: ${changedFiles.map(f => `${f.path} (${f.type})`).join(', ')}
Lines added: ${proposal.linesAdded}
Lines removed: ${proposal.linesRemoved}
Affected modules: ${Array.from(affectedModules).join(', ')}

Provide a brief risk assessment in 2-3 sentences.`
        }
      ]
    });
    const content = response.choices[0].message.content;
    aiAnalysis = typeof content === 'string' ? content : JSON.stringify(content);
  } catch (error) {
    console.error("[Governance] AI analysis failed:", error);
  }
  
  const impactAnalysis: ImpactAnalysis = {
    affectedModules: Array.from(affectedModules),
    affectedServices: Array.from(affectedServices),
    breakingChanges: [],
    dependencyChanges: {
      added: [],
      removed: [],
      updated: [],
    },
    estimatedRisk,
    riskFactors,
    aiAnalysis,
  };
  
  // Update proposal
  await db.update(mergeProposals)
    .set({ impactAnalysis })
    .where(eq(mergeProposals.id, proposalId));
  
  return impactAnalysis;
}

// ============================================================================
// RULES ENGINE
// ============================================================================

export async function evaluateRules(proposalId: string): Promise<{
  autoApproved: boolean;
  autoRejected: boolean;
  triggeredRules: string[];
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error("Proposal not found");
  
  // Get active rules
  const rules = await db.select()
    .from(governanceRules)
    .where(eq(governanceRules.isActive, true))
    .orderBy(desc(governanceRules.priority));
  
  let autoApproved = false;
  let autoRejected = false;
  const triggeredRules: string[] = [];
  
  for (const rule of rules) {
    const conditions = rule.conditions as any[] || [];
    let allConditionsMet = true;
    
    for (const condition of conditions) {
      const value = getProposalValue(proposal, condition.field);
      const conditionMet = evaluateCondition(value, condition.operator, condition.value);
      
      if (!conditionMet) {
        allConditionsMet = false;
        break;
      }
    }
    
    if (allConditionsMet) {
      triggeredRules.push(rule.name);
      
      // Update rule stats
      await db.update(governanceRules)
        .set({
          timesTriggered: sql`${governanceRules.timesTriggered} + 1`,
          lastTriggeredAt: new Date(),
        })
        .where(eq(governanceRules.id, rule.id));
      
      await logAction(proposalId, 0, "System", "rule_triggered", { ruleName: rule.name });
      
      // Execute action
      const action = rule.action as any;
      
      if (rule.ruleType === "auto_approve") {
        autoApproved = true;
        await db.update(mergeProposals)
          .set({
            status: "approved",
            decision: "auto_approved",
            decisionReason: `Auto-approved by rule: ${rule.name}`,
            decidedAt: new Date(),
            decidedBy: 0,
          })
          .where(eq(mergeProposals.id, proposalId));
        
        await logAction(proposalId, 0, "System", "auto_approved", { rule: rule.name });
        break;
      }
      
      if (rule.ruleType === "auto_reject") {
        autoRejected = true;
        await db.update(mergeProposals)
          .set({
            status: "rejected",
            decision: "auto_rejected",
            decisionReason: `Auto-rejected by rule: ${rule.name}`,
            decidedAt: new Date(),
            decidedBy: 0,
          })
          .where(eq(mergeProposals.id, proposalId));
        
        await logAction(proposalId, 0, "System", "auto_rejected", { rule: rule.name });
        break;
      }
      
      if (rule.ruleType === "require_review") {
        // Assign reviewers
        await assignReviewers(proposalId);
      }
    }
  }
  
  // If no auto-decision, move to pending review
  if (!autoApproved && !autoRejected) {
    await db.update(mergeProposals)
      .set({ status: "pending_review" })
      .where(eq(mergeProposals.id, proposalId));
    
    // Assign reviewers
    await assignReviewers(proposalId);
    
    // Notify board members
    await notifyBoardMembers(proposalId);
  }
  
  return { autoApproved, autoRejected, triggeredRules };
}

function getProposalValue(proposal: MergeProposal, field: string): any {
  switch (field) {
    case "filesChanged":
      return proposal.filesChanged;
    case "linesAdded":
      return proposal.linesAdded;
    case "linesRemoved":
      return proposal.linesRemoved;
    case "testCoverage":
      return (proposal.testResults as TestResults)?.unitTests?.coverage;
    case "testsFailed":
      return (proposal.testResults as TestResults)?.unitTests?.failed;
    case "securitySeverity":
      return (proposal.securityScan as SecurityScanResult)?.overallSeverity;
    case "estimatedRisk":
      return (proposal.impactAnalysis as ImpactAnalysis)?.estimatedRisk;
    case "priority":
      return proposal.priority;
    default:
      return undefined;
  }
}

function evaluateCondition(value: any, operator: string, targetValue: any): boolean {
  switch (operator) {
    case "equals":
      return value === targetValue;
    case "not_equals":
      return value !== targetValue;
    case "greater_than":
      return Number(value) > Number(targetValue);
    case "less_than":
      return Number(value) < Number(targetValue);
    case "contains":
      return String(value).includes(String(targetValue));
    case "matches":
      return new RegExp(String(targetValue)).test(String(value));
    default:
      return false;
  }
}

// ============================================================================
// REVIEWER ASSIGNMENT
// ============================================================================

export async function assignReviewers(proposalId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const proposal = await getProposal(proposalId);
  if (!proposal) return;
  
  // Get active board members
  const members = await db.select()
    .from(governanceBoardMembers)
    .where(eq(governanceBoardMembers.isActive, true));
  
  if (members.length === 0) {
    console.log("[Governance] No active board members to assign");
    return;
  }
  
  const changedFiles = proposal.changedFiles as ChangedFile[] || [];
  const assignedMembers = new Set<number>();
  
  // Auto-assign based on file patterns
  for (const member of members) {
    const patterns = member.autoAssignPatterns as string[] || [];
    
    for (const pattern of patterns) {
      const regex = new RegExp(pattern);
      if (changedFiles.some(f => regex.test(f.path))) {
        assignedMembers.add(member.id);
        break;
      }
    }
  }
  
  // Ensure minimum reviewers
  const minReviewers = proposal.requiredApprovals || 2;
  
  if (assignedMembers.size < minReviewers) {
    // Add more reviewers based on specialization
    const impactAnalysis = proposal.impactAnalysis as ImpactAnalysis;
    const affectedModules = impactAnalysis?.affectedModules || [];
    
    for (const member of members) {
      if (assignedMembers.size >= minReviewers) break;
      if (assignedMembers.has(member.id)) continue;
      
      const specializations = member.specializations as string[] || [];
      if (specializations.some(s => affectedModules.includes(s))) {
        assignedMembers.add(member.id);
      }
    }
  }
  
  // Still need more? Add by role priority
  if (assignedMembers.size < minReviewers) {
    const rolePriority = ["lead", "architect", "security", "member"];
    
    for (const role of rolePriority) {
      if (assignedMembers.size >= minReviewers) break;
      
      for (const member of members) {
        if (assignedMembers.size >= minReviewers) break;
        if (assignedMembers.has(member.id)) continue;
        if (member.role === role) {
          assignedMembers.add(member.id);
        }
      }
    }
  }
  
  // Create assignments
  for (const memberId of assignedMembers) {
    await db.insert(reviewAssignments).values({
      proposalId,
      memberId,
      assignmentType: "auto",
      status: "pending",
    });
    
    await logAction(proposalId, 0, "System", "review_assigned", { memberId });
  }
}

// ============================================================================
// VOTING
// ============================================================================

export async function castVote(
  proposalId: string,
  voterId: number,
  voterName: string,
  vote: "approve" | "reject" | "abstain" | "request_changes",
  reasoning?: string,
  comments?: Array<{ file: string; line: number; comment: string; severity: string }>
): Promise<GovernanceVote> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error("Proposal not found");
  
  if (!["pending_review", "in_review"].includes(proposal.status)) {
    throw new Error("Proposal is not open for voting");
  }
  
  // Check if voter is a board member
  const member = await db.select()
    .from(governanceBoardMembers)
    .where(eq(governanceBoardMembers.userId, voterId))
    .limit(1);
  
  if (member.length === 0) {
    throw new Error("Only board members can vote");
  }
  
  // Check for existing vote
  const existingVote = await db.select()
    .from(governanceVotes)
    .where(and(
      eq(governanceVotes.proposalId, proposalId),
      eq(governanceVotes.voterId, voterId)
    ))
    .limit(1);
  
  let voteRecord: GovernanceVote;
  
  if (existingVote.length > 0) {
    // Update existing vote
    await db.update(governanceVotes)
      .set({
        vote,
        reasoning,
        comments,
        updatedAt: new Date(),
      })
      .where(eq(governanceVotes.id, existingVote[0].id));
    
    await logAction(proposalId, voterId, voterName, "vote_changed", { vote, previousVote: existingVote[0].vote });
    
    const updated = await db.select()
      .from(governanceVotes)
      .where(eq(governanceVotes.id, existingVote[0].id))
      .limit(1);
    voteRecord = updated[0];
  } else {
    // Create new vote
    await db.insert(governanceVotes).values({
      proposalId,
      voterId,
      voterName,
      voterRole: member[0].role,
      vote,
      reasoning,
      comments,
    });
    
    await logAction(proposalId, voterId, voterName, "vote_cast", { vote });
    
    const newVote = await db.select()
      .from(governanceVotes)
      .where(and(
        eq(governanceVotes.proposalId, proposalId),
        eq(governanceVotes.voterId, voterId)
      ))
      .orderBy(desc(governanceVotes.votedAt))
      .limit(1);
    voteRecord = newVote[0];
  }
  
  // Update member stats
  await db.update(governanceBoardMembers)
    .set({
      totalVotes: sql`${governanceBoardMembers.totalVotes} + 1`,
      lastActiveAt: new Date(),
    })
    .where(eq(governanceBoardMembers.userId, voterId));
  
  // Update proposal status to in_review
  if (proposal.status === "pending_review") {
    await db.update(mergeProposals)
      .set({ status: "in_review" })
      .where(eq(mergeProposals.id, proposalId));
  }
  
  // Check if quorum reached
  await checkQuorum(proposalId);
  
  return voteRecord;
}

export async function checkQuorum(proposalId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const proposal = await getProposal(proposalId);
  if (!proposal) return false;
  
  // Get all votes
  const votes = await db.select()
    .from(governanceVotes)
    .where(eq(governanceVotes.proposalId, proposalId));
  
  // Get vote weights
  const voterIds = votes.map(v => v.voterId);
  const members = await db.select()
    .from(governanceBoardMembers)
    .where(inArray(governanceBoardMembers.userId, voterIds));
  
  const memberWeights = new Map(members.map(m => [m.userId, m.voteWeight]));
  
  // Calculate weighted votes
  let approvalWeight = 0;
  let rejectionWeight = 0;
  let totalWeight = 0;
  
  for (const vote of votes) {
    const weight = memberWeights.get(vote.voterId) || 1;
    totalWeight += weight;
    
    if (vote.vote === "approve") {
      approvalWeight += weight;
    } else if (vote.vote === "reject") {
      rejectionWeight += weight;
    }
  }
  
  const requiredApprovals = proposal.requiredApprovals || 2;
  
  // Check for approval
  if (approvalWeight >= requiredApprovals) {
    await db.update(mergeProposals)
      .set({
        status: "approved",
        decision: "approved",
        decisionReason: `Approved with ${approvalWeight} weighted votes`,
        decidedAt: new Date(),
      })
      .where(eq(mergeProposals.id, proposalId));
    
    await logAction(proposalId, 0, "System", "approved", {
      approvalWeight,
      rejectionWeight,
      totalVotes: votes.length,
    });
    
    // Notify submitter
    await notifyOwner({
      title: "Merge Proposal Approved",
      content: `Your proposal "${proposal.title}" has been approved!`,
    });
    
    return true;
  }
  
  // Check for rejection (2 rejections)
  if (rejectionWeight >= 2) {
    await db.update(mergeProposals)
      .set({
        status: "rejected",
        decision: "rejected",
        decisionReason: `Rejected with ${rejectionWeight} weighted votes`,
        decidedAt: new Date(),
      })
      .where(eq(mergeProposals.id, proposalId));
    
    await logAction(proposalId, 0, "System", "rejected", {
      approvalWeight,
      rejectionWeight,
      totalVotes: votes.length,
    });
    
    // Notify submitter
    await notifyOwner({
      title: "Merge Proposal Rejected",
      content: `Your proposal "${proposal.title}" has been rejected.`,
    });
    
    return true;
  }
  
  return false;
}

// ============================================================================
// MERGE
// ============================================================================

export async function mergeProposal(
  proposalId: string,
  mergedBy: number,
  mergeCommitHash?: string
): Promise<MergeProposal> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error("Proposal not found");
  
  if (proposal.status !== "approved") {
    throw new Error("Only approved proposals can be merged");
  }
  
  await db.update(mergeProposals)
    .set({
      status: "merged",
      mergedAt: new Date(),
      mergedBy,
      mergeCommitHash,
    })
    .where(eq(mergeProposals.id, proposalId));
  
  await logAction(proposalId, mergedBy, "User", "merged", { mergeCommitHash });
  
  return (await getProposal(proposalId))!;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

async function notifyBoardMembers(proposalId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const proposal = await getProposal(proposalId);
  if (!proposal) return;
  
  // Get assigned reviewers
  const assignments = await db.select()
    .from(reviewAssignments)
    .where(eq(reviewAssignments.proposalId, proposalId));
  
  // Notify each reviewer
  for (const assignment of assignments) {
    // In production, send email/notification to each reviewer
    console.log(`[Governance] Notifying reviewer ${assignment.memberId} about proposal ${proposalId}`);
  }
  
  // Also notify owner
  await notifyOwner({
    title: "New Merge Proposal for Review",
    content: `A new proposal "${proposal.title}" requires review.\n\nFiles changed: ${proposal.filesChanged}\nLines: +${proposal.linesAdded} / -${proposal.linesRemoved}`,
  });
}

// ============================================================================
// AUDIT LOG
// ============================================================================

async function logAction(
  proposalId: string,
  actorId: number,
  actorName: string,
  action: string,
  details: Record<string, any>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(governanceAuditLog).values({
    proposalId,
    actorId,
    actorName,
    actorType: actorId === 0 ? "system" : "user",
    action: action as any,
    details,
  });
}

export async function getAuditLog(proposalId: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(governanceAuditLog)
    .where(eq(governanceAuditLog.proposalId, proposalId))
    .orderBy(desc(governanceAuditLog.createdAt));
}

// ============================================================================
// BOARD MEMBERS
// ============================================================================

export async function addBoardMember(data: {
  userId: number;
  name: string;
  email?: string;
  role?: "member" | "lead" | "architect" | "security" | "admin";
  voteWeight?: number;
  specializations?: string[];
  autoAssignPatterns?: string[];
}): Promise<GovernanceBoardMember> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(governanceBoardMembers).values({
    userId: data.userId,
    name: data.name,
    email: data.email,
    role: data.role || "member",
    voteWeight: data.voteWeight || 1,
    specializations: data.specializations,
    autoAssignPatterns: data.autoAssignPatterns,
    isActive: true,
  });
  
  const result = await db.select()
    .from(governanceBoardMembers)
    .where(eq(governanceBoardMembers.userId, data.userId))
    .limit(1);
  
  return result[0];
}

export async function getBoardMembers(): Promise<GovernanceBoardMember[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(governanceBoardMembers)
    .where(eq(governanceBoardMembers.isActive, true))
    .orderBy(governanceBoardMembers.role);
}

export async function getVotes(proposalId: string): Promise<GovernanceVote[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(governanceVotes)
    .where(eq(governanceVotes.proposalId, proposalId))
    .orderBy(desc(governanceVotes.votedAt));
}

// ============================================================================
// RULES MANAGEMENT
// ============================================================================

export async function createRule(data: {
  name: string;
  description?: string;
  ruleType: "auto_approve" | "auto_reject" | "require_review" | "assign_reviewer" | "notify";
  conditions: Array<{
    field: string;
    operator: string;
    value: any;
    logicalOperator?: "AND" | "OR";
  }>;
  action?: { type: string; params?: Record<string, any> };
  priority?: number;
  createdBy: number;
}): Promise<GovernanceRule> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(governanceRules).values({
    name: data.name,
    description: data.description,
    ruleType: data.ruleType,
    conditions: data.conditions,
    action: data.action,
    priority: data.priority || 0,
    isActive: true,
    createdBy: data.createdBy,
  });
  
  const result = await db.select()
    .from(governanceRules)
    .where(eq(governanceRules.name, data.name))
    .orderBy(desc(governanceRules.createdAt))
    .limit(1);
  
  return result[0];
}

export async function getRules(): Promise<GovernanceRule[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(governanceRules)
    .orderBy(desc(governanceRules.priority));
}

// ============================================================================
// BUILT-IN RULES
// ============================================================================

export const BUILT_IN_RULES = [
  {
    name: "Auto-approve small changes",
    description: "Automatically approve changes with less than 50 lines and passing tests",
    ruleType: "auto_approve" as const,
    conditions: [
      { field: "linesAdded", operator: "less_than", value: 50 },
      { field: "testsFailed", operator: "equals", value: 0 },
      { field: "securitySeverity", operator: "equals", value: "none" },
    ],
    priority: 100,
  },
  {
    name: "Auto-reject critical security issues",
    description: "Automatically reject changes with critical security vulnerabilities",
    ruleType: "auto_reject" as const,
    conditions: [
      { field: "securitySeverity", operator: "equals", value: "critical" },
    ],
    priority: 200,
  },
  {
    name: "Auto-reject failing tests",
    description: "Automatically reject changes with failing unit tests",
    ruleType: "auto_reject" as const,
    conditions: [
      { field: "testsFailed", operator: "greater_than", value: 0 },
    ],
    priority: 150,
  },
  {
    name: "Require security review for auth changes",
    description: "Require security team review for authentication-related changes",
    ruleType: "require_review" as const,
    conditions: [
      { field: "affectedModules", operator: "contains", value: "auth" },
    ],
    priority: 50,
  },
];

export async function initializeBuiltInRules(createdBy: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  for (const rule of BUILT_IN_RULES) {
    const existing = await db.select()
      .from(governanceRules)
      .where(eq(governanceRules.name, rule.name))
      .limit(1);
    
    if (existing.length === 0) {
      await createRule({
        ...rule,
        createdBy,
      });
      console.log(`[Governance] Initialized rule: ${rule.name}`);
    }
  }
}

// ============================================================================
// METRICS
// ============================================================================

export async function getGovernanceMetrics(
  periodType: "daily" | "weekly" | "monthly" = "daily",
  limit: number = 30
): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(governanceMetrics)
    .where(eq(governanceMetrics.periodType, periodType))
    .orderBy(desc(governanceMetrics.periodStart))
    .limit(limit);
}
