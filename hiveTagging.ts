/**
 * Hive-Specific Smart Tagging Integration
 * 
 * Extends the platform's smart tagging capabilities for estate scanning,
 * relationship discovery, and knowledge graph building
 */

import { invokeLLM } from "../_core/llm";

export interface HiveTaggingResult {
  tags: string[];
  confidence: number;
  category: string;
  subcategories: string[];
}

export interface RelationshipDiscovery {
  itemId: string;
  similarity: number;
  reason: string;
  commonTags: string[];
}

/**
 * Generate smart tags for scanned items in The Hive
 */
export async function generateHiveTags(item: {
  name: string;
  description?: string;
  content?: string;
  type: string;
  path: string;
  language?: string;
  framework?: string;
}): Promise<HiveTaggingResult> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an expert code and content analyzer for The Hive Intelligence System.
        
Generate relevant tags that help discover relationships and build knowledge graphs.

Tags should include:
- Technology stack (languages, frameworks, libraries)
- Functional categories (auth, api, ui, data, workflow, etc.)
- Architectural patterns (mvc, microservices, serverless, etc.)
- Domain concepts (user management, payment, notification, etc.)
- Integration points (rest api, graphql, webhooks, etc.)
- Development stage (prototype, production, deprecated, etc.)

Return 5-15 tags with a primary category and subcategories.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          name: item.name,
          description: item.description,
          type: item.type,
          path: item.path,
          language: item.language,
          framework: item.framework,
          contentSample: item.content?.substring(0, 2000),
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "hive_tags",
        strict: true,
        schema: {
          type: "object",
          properties: {
            tags: {
              type: "array",
              items: { type: "string" },
            },
            confidence: { type: "number" },
            category: { type: "string" },
            subcategories: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["tags", "confidence", "category", "subcategories"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = typeof response.choices[0].message.content === 'string' 
    ? response.choices[0].message.content 
    : '{"tags":[],"confidence":0,"category":"unknown","subcategories":[]}';
  const parsed = JSON.parse(content);

  return {
    tags: parsed.tags,
    confidence: parsed.confidence,
    category: parsed.category,
    subcategories: parsed.subcategories,
  };
}

/**
 * Discover relationships between items based on tag similarity
 */
export function discoverRelationships(
  targetItem: {
    id: string;
    tags: string[];
  },
  allItems: {
    id: string;
    name: string;
    tags: string[];
    type: string;
  }[]
): RelationshipDiscovery[] {
  const relationships: RelationshipDiscovery[] = [];

  for (const item of allItems) {
    if (item.id === targetItem.id) continue;

    // Calculate Jaccard similarity
    const commonTags = targetItem.tags.filter((tag) => item.tags.includes(tag));
    const allTags = new Set([...targetItem.tags, ...item.tags]);
    const similarity = commonTags.length / allTags.size;

    if (similarity > 0.2) {
      relationships.push({
        itemId: item.id,
        similarity,
        reason: `Shares ${commonTags.length} common tags: ${commonTags.slice(0, 3).join(", ")}${commonTags.length > 3 ? "..." : ""}`,
        commonTags,
      });
    }
  }

  return relationships.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Build tag-based clusters for relationship visualization
 */
export function buildTagClusters(
  items: {
    id: string;
    name: string;
    tags: string[];
    type: string;
  }[]
): {
  name: string;
  tags: string[];
  items: string[];
  strength: number;
}[] {
  const tagToItems = new Map<string, Set<string>>();

  // Build tag-to-items mapping
  for (const item of items) {
    for (const tag of item.tags) {
      if (!tagToItems.has(tag)) {
        tagToItems.set(tag, new Set());
      }
      tagToItems.get(tag)!.add(item.id);
    }
  }

  // Create clusters from tags with multiple items
  const clusters: {
    name: string;
    tags: string[];
    items: string[];
    strength: number;
  }[] = [];

  for (const [tag, itemIds] of tagToItems.entries()) {
    if (itemIds.size >= 2) {
      clusters.push({
        name: tag,
        tags: [tag],
        items: Array.from(itemIds),
        strength: itemIds.size / items.length, // Normalized strength
      });
    }
  }

  return clusters.sort((a, b) => b.strength - a.strength);
}

/**
 * Analyze relationship graph and identify patterns
 */
export async function analyzeRelationshipPatterns(
  items: {
    id: string;
    name: string;
    tags: string[];
    type: string;
    description?: string;
  }[]
): Promise<{
  patterns: {
    name: string;
    description: string;
    items: string[];
    confidence: number;
  }[];
  recommendations: {
    type: string;
    description: string;
    priority: "low" | "medium" | "high";
  }[];
}> {
  // Build relationship matrix
  const relationships: {
    source: string;
    target: string;
    strength: number;
    commonTags: string[];
  }[] = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const item1 = items[i];
      const item2 = items[j];

      const commonTags = item1.tags.filter((tag) => item2.tags.includes(tag));
      const allTags = new Set([...item1.tags, ...item2.tags]);
      const similarity = commonTags.length / allTags.size;

      if (similarity >= 0.3) {
        relationships.push({
          source: item1.id,
          target: item2.id,
          strength: similarity,
          commonTags,
        });
      }
    }
  }

  // Use AI to identify patterns
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are The Hive's pattern recognition system. Analyze the relationship data and identify:
1. Common patterns across items
2. Potential integration opportunities
3. Architectural insights
4. Recommendations for enhancement`,
      },
      {
        role: "user",
        content: JSON.stringify({
          itemCount: items.length,
          relationshipCount: relationships.length,
          sampleItems: items.slice(0, 10).map((i) => ({
            name: i.name,
            type: i.type,
            tags: i.tags,
          })),
          strongRelationships: relationships.slice(0, 10).map((r) => ({
            strength: r.strength,
            commonTags: r.commonTags,
          })),
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "pattern_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            patterns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  itemCount: { type: "number" },
                  confidence: { type: "number" },
                },
                required: ["name", "description", "itemCount", "confidence"],
                additionalProperties: false,
              },
            },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  description: { type: "string" },
                  priority: {
                    type: "string",
                    enum: ["low", "medium", "high"],
                  },
                },
                required: ["type", "description", "priority"],
                additionalProperties: false,
              },
            },
          },
          required: ["patterns", "recommendations"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = typeof response.choices[0].message.content === 'string' 
    ? response.choices[0].message.content 
    : '{"patterns":[],"recommendations":[]}';
  const parsed = JSON.parse(content);

  // Map itemCount back to actual item IDs (simplified - in production would need more sophisticated mapping)
  const patterns = parsed.patterns.map((p: any) => ({
    name: p.name,
    description: p.description,
    items: items.slice(0, p.itemCount).map((i) => i.id),
    confidence: p.confidence,
  }));

  return {
    patterns,
    recommendations: parsed.recommendations,
  };
}

/**
 * Calculate tag-based similarity score between two items
 */
export function calculateTagSimilarity(
  tags1: string[],
  tags2: string[]
): {
  similarity: number;
  commonTags: string[];
  uniqueTags1: string[];
  uniqueTags2: string[];
} {
  const set1 = new Set(tags1);
  const set2 = new Set(tags2);

  const commonTags = tags1.filter((tag) => set2.has(tag));
  const uniqueTags1 = tags1.filter((tag) => !set2.has(tag));
  const uniqueTags2 = tags2.filter((tag) => !set1.has(tag));

  const allTags = new Set([...tags1, ...tags2]);
  const similarity = commonTags.length / allTags.size;

  return {
    similarity,
    commonTags,
    uniqueTags1,
    uniqueTags2,
  };
}
