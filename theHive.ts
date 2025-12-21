/**
 * The Hive Intelligence System
 * 
 * A self-evolving intelligence system inspired by:
 * - Skywork's DeepResearchAgent (hierarchical multi-agent orchestration)
 * - Taskade's Living Systems (Intelligence, Memory, Execution pillars)
 * - Kilo Code's multi-mode architecture
 * 
 * The Hive scans connected estates (GitHub, GitLab, Bitbucket, Vercel, Google Drive, etc.)
 * and intelligently harvests documentation, detects modules, identifies integration points,
 * and continuously strengthens the platform through smart merging and enhancement.
 */

import { invokeLLM } from "../_core/llm";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type EstateType = 
  | 'github' 
  | 'gitlab' 
  | 'bitbucket' 
  | 'vercel' 
  | 'google_drive' 
  | 'onedrive' 
  | 'dropbox'
  | 'notion'
  | 'linear';

export type ScanType =
  | 'documentation'
  | 'modules'
  | 'functions'
  | 'workflows'
  | 'pipelines'
  | 'automations'
  | 'templates'
  | 'ais'
  | 'agents'
  | 'bots'
  | 'styles'
  | 'designs';

export type InjectionPointType =
  | 'direct_import'
  | 'api_integration'
  | 'workflow_merge'
  | 'style_adoption'
  | 'pattern_replication'
  | 'data_sync';

export interface EstateConnection {
  id: string;
  type: EstateType;
  name: string;
  url: string;
  credentials: {
    token?: string;
    apiKey?: string;
    oauth?: {
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
    };
  };
  lastScanned?: Date;
  status: 'connected' | 'disconnected' | 'scanning' | 'error';
}

export interface ScannedItem {
  id: string;
  estateId: string;
  estateType: EstateType;
  scanType: ScanType;
  name: string;
  description: string;
  path: string;
  url: string;
  content?: string;
  metadata: Record<string, any>;
  tags: string[];
  language?: string;
  framework?: string;
  dependencies?: string[];
  scannedAt: Date;
  accuracy: number; // 0-1 confidence score
}

export interface InjectionPoint {
  id: string;
  sourceItemId: string;
  targetLocation: string;
  injectionType: InjectionPointType;
  description: string;
  benefits: string[];
  risks: string[];
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  priority: number; // 1-10
  status: 'proposed' | 'approved' | 'rejected' | 'implemented';
  proposedAt: Date;
  proposedBy: 'hive' | 'user';
}

export interface HiveKnowledge {
  id: string;
  category: 'pattern' | 'best_practice' | 'anti_pattern' | 'integration' | 'optimization';
  title: string;
  description: string;
  source: string;
  confidence: number; // 0-1
  usageCount: number;
  successRate: number; // 0-1
  learnedAt: Date;
  lastUsed?: Date;
}

// ============================================================================
// THE HIVE COORDINATOR (Top-Level Planning Agent)
// ============================================================================

export class HiveCoordinator {
  private scanningAgents: Map<string, ScanningAgent> = new Map();
  private analysisAgents: Map<string, AnalysisAgent> = new Map();
  private injectionAgents: Map<string, InjectionAgent> = new Map();
  private knowledgeBase: HiveKnowledge[] = [];

  /**
   * Initialize The Hive with connected estates
   */
  async initialize(estates: EstateConnection[]): Promise<void> {
    console.log(`[Hive] Initializing with ${estates.length} estates`);

    // Create scanning agents for each estate type
    for (const estate of estates) {
      const agent = new ScanningAgent(estate);
      this.scanningAgents.set(estate.id, agent);
    }

    // Create analysis agents for each scan type
    const scanTypes: ScanType[] = [
      'documentation',
      'modules',
      'functions',
      'workflows',
      'pipelines',
      'automations',
      'templates',
      'ais',
      'agents',
      'bots',
      'styles',
      'designs',
    ];

    for (const scanType of scanTypes) {
      const agent = new AnalysisAgent(scanType);
      this.analysisAgents.set(scanType, agent);
    }

    // Create injection agents for each injection type
    const injectionTypes: InjectionPointType[] = [
      'direct_import',
      'api_integration',
      'workflow_merge',
      'style_adoption',
      'pattern_replication',
      'data_sync',
    ];

    for (const injectionType of injectionTypes) {
      const agent = new InjectionAgent(injectionType);
      this.injectionAgents.set(injectionType, agent);
    }

    console.log(`[Hive] Initialized ${this.scanningAgents.size} scanning agents`);
    console.log(`[Hive] Initialized ${this.analysisAgents.size} analysis agents`);
    console.log(`[Hive] Initialized ${this.injectionAgents.size} injection agents`);
  }

  /**
   * Execute a full scan cycle across all estates
   */
  async executeScanCycle(): Promise<{
    scannedItems: ScannedItem[];
    injectionPoints: InjectionPoint[];
    newKnowledge: HiveKnowledge[];
  }> {
    console.log('[Hive] Starting scan cycle');

    // Phase 1: Scan all estates in parallel
    const scanPromises = Array.from(this.scanningAgents.values()).map(agent =>
      agent.scan()
    );
    const scanResults = await Promise.all(scanPromises);
    const scannedItems = scanResults.flat();

    console.log(`[Hive] Scanned ${scannedItems.length} items`);

    // Phase 2: Analyze scanned items in parallel
    const analysisPromises = Array.from(this.analysisAgents.values()).map(agent =>
      agent.analyze(scannedItems)
    );
    await Promise.all(analysisPromises);

    // Phase 3: Identify injection points
    const injectionPromises = Array.from(this.injectionAgents.values()).map(agent =>
      agent.identifyInjectionPoints(scannedItems)
    );
    const injectionResults = await Promise.all(injectionPromises);
    const injectionPoints = injectionResults.flat();

    console.log(`[Hive] Identified ${injectionPoints.length} injection points`);

    // Phase 4: Learn from scan results
    const newKnowledge = await this.learnFromScan(scannedItems, injectionPoints);

    console.log(`[Hive] Learned ${newKnowledge.length} new patterns`);

    return {
      scannedItems,
      injectionPoints,
      newKnowledge,
    };
  }

  /**
   * Learn patterns and best practices from scan results
   */
  private async learnFromScan(
    items: ScannedItem[],
    injectionPoints: InjectionPoint[]
  ): Promise<HiveKnowledge[]> {
    const newKnowledge: HiveKnowledge[] = [];

    // Use AI to identify patterns
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are The Hive's learning system. Analyze scanned items and injection points to identify:
1. Common patterns across projects
2. Best practices worth adopting
3. Anti-patterns to avoid
4. Integration opportunities
5. Optimization strategies

Return a JSON array of knowledge items with: category, title, description, confidence.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            itemCount: items.length,
            injectionPointCount: injectionPoints.length,
            sampleItems: items.slice(0, 10),
            sampleInjectionPoints: injectionPoints.slice(0, 5),
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'hive_knowledge',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              knowledge: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    category: {
                      type: 'string',
                      enum: ['pattern', 'best_practice', 'anti_pattern', 'integration', 'optimization'],
                    },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    confidence: { type: 'number' },
                  },
                  required: ['category', 'title', 'description', 'confidence'],
                  additionalProperties: false,
                },
              },
            },
            required: ['knowledge'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = typeof response.choices[0].message.content === 'string' 
      ? response.choices[0].message.content 
      : '{"knowledge":[]}';
    const parsed = JSON.parse(content || '{"knowledge":[]}');

    for (const item of parsed.knowledge) {
      newKnowledge.push({
        id: `knowledge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: item.category,
        title: item.title,
        description: item.description,
        source: 'hive_scan',
        confidence: item.confidence,
        usageCount: 0,
        successRate: 0,
        learnedAt: new Date(),
      });
    }

    this.knowledgeBase.push(...newKnowledge);

    return newKnowledge;
  }

  /**
   * Get knowledge base
   */
  getKnowledgeBase(): HiveKnowledge[] {
    return this.knowledgeBase;
  }

  /**
   * Update knowledge success rate
   */
  updateKnowledgeSuccess(knowledgeId: string, success: boolean): void {
    const knowledge = this.knowledgeBase.find(k => k.id === knowledgeId);
    if (knowledge) {
      knowledge.usageCount++;
      knowledge.successRate = 
        (knowledge.successRate * (knowledge.usageCount - 1) + (success ? 1 : 0)) / knowledge.usageCount;
      knowledge.lastUsed = new Date();
    }
  }
}

// ============================================================================
// SCANNING AGENT (Estate-Specific Scanners)
// ============================================================================

export class ScanningAgent {
  constructor(private estate: EstateConnection) {}

  /**
   * Scan the estate for items
   */
  async scan(): Promise<ScannedItem[]> {
    console.log(`[ScanningAgent] Scanning ${this.estate.type}: ${this.estate.name}`);

    const items: ScannedItem[] = [];

    try {
      switch (this.estate.type) {
        case 'github':
          items.push(...await this.scanGitHub());
          break;
        case 'gitlab':
          items.push(...await this.scanGitLab());
          break;
        case 'bitbucket':
          items.push(...await this.scanBitbucket());
          break;
        case 'vercel':
          items.push(...await this.scanVercel());
          break;
        case 'google_drive':
          items.push(...await this.scanGoogleDrive());
          break;
        case 'onedrive':
          items.push(...await this.scanOneDrive());
          break;
        case 'dropbox':
          items.push(...await this.scanDropbox());
          break;
        case 'notion':
          items.push(...await this.scanNotion());
          break;
        case 'linear':
          items.push(...await this.scanLinear());
          break;
        default:
          console.warn(`[ScanningAgent] Unknown estate type: ${this.estate.type}`);
      }

      this.estate.lastScanned = new Date();
      this.estate.status = 'connected';
    } catch (error) {
      console.error(`[ScanningAgent] Error scanning ${this.estate.type}:`, error);
      this.estate.status = 'error';
    }

    return items;
  }

  private async scanGitHub(): Promise<ScannedItem[]> {
    // TODO: Implement GitHub scanning using GitHub API
    // - List repositories
    // - Scan README files
    // - Detect modules/packages
    // - Find workflows (.github/workflows)
    // - Identify reusable actions
    return [];
  }

  private async scanGitLab(): Promise<ScannedItem[]> {
    // TODO: Implement GitLab scanning
    return [];
  }

  private async scanBitbucket(): Promise<ScannedItem[]> {
    // TODO: Implement Bitbucket scanning
    return [];
  }

  private async scanVercel(): Promise<ScannedItem[]> {
    // TODO: Implement Vercel scanning
    return [];
  }

  private async scanGoogleDrive(): Promise<ScannedItem[]> {
    // TODO: Implement Google Drive scanning
    return [];
  }

  private async scanOneDrive(): Promise<ScannedItem[]> {
    // TODO: Implement OneDrive scanning
    return [];
  }

  private async scanDropbox(): Promise<ScannedItem[]> {
    // TODO: Implement Dropbox scanning
    return [];
  }

  private async scanNotion(): Promise<ScannedItem[]> {
    // TODO: Implement Notion scanning
    return [];
  }

  private async scanLinear(): Promise<ScannedItem[]> {
    // TODO: Implement Linear scanning
    return [];
  }
}

// ============================================================================
// ANALYSIS AGENT (Specialized Analyzers)
// ============================================================================

export class AnalysisAgent {
  constructor(private scanType: ScanType) {}

  /**
   * Analyze scanned items
   */
  async analyze(items: ScannedItem[]): Promise<void> {
    const relevantItems = items.filter(item => item.scanType === this.scanType);

    if (relevantItems.length === 0) {
      return;
    }

    console.log(`[AnalysisAgent:${this.scanType}] Analyzing ${relevantItems.length} items`);

    // Use AI to analyze items
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are an analysis agent specializing in ${this.scanType}. 
Analyze the provided items and extract:
1. Key characteristics
2. Quality metrics
3. Reusability potential
4. Integration opportunities
5. Improvement suggestions

Return structured analysis.`,
        },
        {
          role: 'user',
          content: JSON.stringify(relevantItems.slice(0, 20)), // Limit to 20 items per analysis
        },
      ],
    });

    // Store analysis results in item metadata
    for (const item of relevantItems) {
      item.metadata.analysis = {
        analyzedAt: new Date(),
        analyzer: this.scanType,
        summary: response.choices[0].message.content,
      };
    }
  }
}

// ============================================================================
// INJECTION AGENT (Integration Point Identifiers)
// ============================================================================

export class InjectionAgent {
  constructor(private injectionType: InjectionPointType) {}

  /**
   * Identify injection points for scanned items
   */
  async identifyInjectionPoints(items: ScannedItem[]): Promise<InjectionPoint[]> {
    console.log(`[InjectionAgent:${this.injectionType}] Identifying injection points`);

    const injectionPoints: InjectionPoint[] = [];

    // Use AI to identify injection opportunities
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are an injection agent specializing in ${this.injectionType}.
Analyze scanned items and identify opportunities to integrate them into the platform.

For each opportunity, provide:
1. Source item ID
2. Target location in platform
3. Description of integration
4. Benefits (array)
5. Risks (array)
6. Effort (low/medium/high)
7. Impact (low/medium/high)
8. Priority (1-10)

Return JSON array of injection points.`,
        },
        {
          role: 'user',
          content: JSON.stringify(items.slice(0, 20)),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'injection_points',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              points: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    sourceItemId: { type: 'string' },
                    targetLocation: { type: 'string' },
                    description: { type: 'string' },
                    benefits: { type: 'array', items: { type: 'string' } },
                    risks: { type: 'array', items: { type: 'string' } },
                    effort: { type: 'string', enum: ['low', 'medium', 'high'] },
                    impact: { type: 'string', enum: ['low', 'medium', 'high'] },
                    priority: { type: 'number' },
                  },
                  required: ['sourceItemId', 'targetLocation', 'description', 'benefits', 'risks', 'effort', 'impact', 'priority'],
                  additionalProperties: false,
                },
              },
            },
            required: ['points'],
            additionalProperties: false,
          },
        },
      },
    });

    const content2 = typeof response.choices[0].message.content === 'string' 
      ? response.choices[0].message.content 
      : '{"points":[]}';
    const parsed = JSON.parse(content2 || '{"points":[]}');

    for (const point of parsed.points) {
      injectionPoints.push({
        id: `injection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sourceItemId: point.sourceItemId,
        targetLocation: point.targetLocation,
        injectionType: this.injectionType,
        description: point.description,
        benefits: point.benefits,
        risks: point.risks,
        effort: point.effort,
        impact: point.impact,
        priority: point.priority,
        status: 'proposed',
        proposedAt: new Date(),
        proposedBy: 'hive',
      });
    }

    return injectionPoints;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Singleton instance
let hiveInstance: HiveCoordinator | null = null;

export function getHive(): HiveCoordinator {
  if (!hiveInstance) {
    hiveInstance = new HiveCoordinator();
  }
  return hiveInstance;
}

export async function initializeHive(estates: EstateConnection[]): Promise<void> {
  const hive = getHive();
  await hive.initialize(estates);
}

export async function executeScanCycle() {
  const hive = getHive();
  return await hive.executeScanCycle();
}
