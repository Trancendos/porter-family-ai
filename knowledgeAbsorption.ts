import { invokeLLM } from "../_core/llm";

/**
 * Knowledge Absorption Service
 * 
 * Extracts knowledge from all platform data sources:
 * - Kanban comments & smart tags
 * - ToR documents
 * - Knowledge base & Wiki
 * - API connectors
 * - Academy modules
 * - Forum discussions
 * - Documentation
 * - Compliance frameworks
 * - Code techniques
 */

export interface KnowledgeEntity {
  entityType: string;
  name: string;
  description: string;
  content: string;
  confidence: number;
  sourceType: string;
  sourceId: number;
  metadata?: any;
}

export interface KnowledgeRelationship {
  fromEntityId: number;
  toEntityId: number;
  relationshipType: string;
  strength: number;
  metadata?: any;
}

/**
 * Extract knowledge from Kanban comments
 */
export async function extractFromKanbanComments(comments: any[]): Promise<KnowledgeEntity[]> {
  const entities: KnowledgeEntity[] = [];

  for (const comment of comments) {
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an expert at extracting structured knowledge from user comments. Identify techniques, patterns, best practices, issues, and solutions mentioned in the text.",
          },
          {
            role: "user",
            content: `Extract knowledge entities from this comment:\n\n${comment.content}\n\nReturn a JSON array of entities with: entityType (concept/technique/pattern/best_practice/anti_pattern), name, description, content, confidence (0-1).`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "knowledge_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                entities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      entityType: { type: "string" },
                      name: { type: "string" },
                      description: { type: "string" },
                      content: { type: "string" },
                      confidence: { type: "number" },
                    },
                    required: ["entityType", "name", "description", "content", "confidence"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["entities"],
              additionalProperties: false,
            },
          },
        },
      });

      const result = JSON.parse(response.choices[0]?.message?.content as string || "{}");
      
      for (const entity of result.entities || []) {
        entities.push({
          ...entity,
          sourceType: "kanban_comment",
          sourceId: comment.id,
        });
      }
    } catch (error) {
      console.error(`Failed to extract knowledge from comment ${comment.id}:`, error);
    }
  }

  return entities;
}

/**
 * Extract knowledge from smart tags
 */
export async function extractFromSmartTags(tags: any[]): Promise<KnowledgeEntity[]> {
  const tagGroups = new Map<string, number>();
  
  // Group tags by name to identify patterns
  for (const tag of tags) {
    tagGroups.set(tag.tagName, (tagGroups.get(tag.tagName) || 0) + 1);
  }

  const entities: KnowledgeEntity[] = [];

  // Extract patterns from frequently used tags
  for (const [tagName, count] of Array.from(tagGroups.entries())) {
    if (count >= 3) { // Threshold for pattern recognition
      entities.push({
        entityType: "pattern",
        name: `Tag Pattern: ${tagName}`,
        description: `Frequently used tag indicating a common theme or category`,
        content: `Tag "${tagName}" appears ${count} times across the platform`,
        confidence: Math.min(count / 10, 1.0), // Higher usage = higher confidence
        sourceType: "smart_tag",
        sourceId: 0,
        metadata: { tagName, usageCount: count },
      });
    }
  }

  return entities;
}

/**
 * Extract knowledge from documentation
 */
export async function extractFromDocumentation(docContent: string, docId: number): Promise<KnowledgeEntity[]> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting structured knowledge from technical documentation. Identify frameworks, techniques, best practices, code patterns, and important concepts.",
        },
        {
          role: "user",
          content: `Extract knowledge entities from this documentation:\n\n${docContent}\n\nReturn a JSON array of entities with: entityType, name, description, content, confidence.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "doc_knowledge_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              entities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    entityType: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    content: { type: "string" },
                    confidence: { type: "number" },
                  },
                  required: ["entityType", "name", "description", "content", "confidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["entities"],
            additionalProperties: false,
          },
        },
      },
    });

    const result = JSON.parse(response.choices[0]?.message?.content as string || "{}");
    
    return (result.entities || []).map((entity: any) => ({
      ...entity,
      sourceType: "documentation",
      sourceId: docId,
    }));
  } catch (error) {
    console.error(`Failed to extract knowledge from documentation ${docId}:`, error);
    return [];
  }
}

/**
 * Extract knowledge from code files
 */
export async function extractFromCode(codeContent: string, filePath: string): Promise<KnowledgeEntity[]> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing code and extracting development techniques, design patterns, best practices, and reusable patterns.",
        },
        {
          role: "user",
          content: `Analyze this code file (${filePath}) and extract knowledge:\n\n${codeContent}\n\nReturn a JSON array of entities with: entityType (technique/pattern/best_practice/code_snippet), name, description, content, confidence.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "code_knowledge_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              entities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    entityType: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    content: { type: "string" },
                    confidence: { type: "number" },
                  },
                  required: ["entityType", "name", "description", "content", "confidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["entities"],
            additionalProperties: false,
          },
        },
      },
    });

    const result = JSON.parse(response.choices[0]?.message?.content as string || "{}");
    
    return (result.entities || []).map((entity: any) => ({
      ...entity,
      sourceType: "code_file",
      sourceId: 0,
      metadata: { filePath },
    }));
  } catch (error) {
    console.error(`Failed to extract knowledge from code file ${filePath}:`, error);
    return [];
  }
}

/**
 * Extract knowledge from compliance frameworks
 */
export async function extractFromComplianceFramework(
  frameworkName: string,
  frameworkContent: string
): Promise<KnowledgeEntity[]> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing compliance and regulatory frameworks. Extract rules, requirements, and best practices.",
        },
        {
          role: "user",
          content: `Extract knowledge from this compliance framework (${frameworkName}):\n\n${frameworkContent}\n\nReturn a JSON array of entities with: entityType (regulation/framework/best_practice), name, description, content, confidence.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "compliance_knowledge_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              entities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    entityType: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    content: { type: "string" },
                    confidence: { type: "number" },
                  },
                  required: ["entityType", "name", "description", "content", "confidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["entities"],
            additionalProperties: false,
          },
        },
      },
    });

    const result = JSON.parse(response.choices[0]?.message?.content as string || "{}");
    
    return (result.entities || []).map((entity: any) => ({
      ...entity,
      sourceType: "compliance_framework",
      sourceId: 0,
      metadata: { frameworkName },
    }));
  } catch (error) {
    console.error(`Failed to extract knowledge from framework ${frameworkName}:`, error);
    return [];
  }
}

/**
 * Identify relationships between knowledge entities
 */
export async function identifyRelationships(
  entities: KnowledgeEntity[]
): Promise<KnowledgeRelationship[]> {
  if (entities.length < 2) return [];

  try {
    const entityDescriptions = entities.map((e, i) => 
      `${i}: ${e.name} - ${e.description}`
    ).join("\n");

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert at identifying relationships between concepts. Analyze the entities and determine how they relate to each other.",
        },
        {
          role: "user",
          content: `Identify relationships between these entities:\n\n${entityDescriptions}\n\nReturn a JSON array of relationships with: fromIndex, toIndex, relationshipType (requires/implements/extends/contradicts/similar_to/part_of/applies_to/supersedes), strength (0-1).`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "relationship_identification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              relationships: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    fromIndex: { type: "number" },
                    toIndex: { type: "number" },
                    relationshipType: { type: "string" },
                    strength: { type: "number" },
                  },
                  required: ["fromIndex", "toIndex", "relationshipType", "strength"],
                  additionalProperties: false,
                },
              },
            },
            required: ["relationships"],
            additionalProperties: false,
          },
        },
      },
    });

    const result = JSON.parse(response.choices[0]?.message?.content as string || "{}");
    
    // Note: fromEntityId and toEntityId will be set after entities are saved to DB
    return (result.relationships || []).map((rel: any) => ({
      fromEntityId: rel.fromIndex, // Temporary index, will be replaced with actual ID
      toEntityId: rel.toIndex,
      relationshipType: rel.relationshipType,
      strength: rel.strength,
    }));
  } catch (error) {
    console.error("Failed to identify relationships:", error);
    return [];
  }
}

/**
 * Generate embeddings for semantic search
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // This would use an embedding model (e.g., OpenAI's text-embedding-3-small)
    // For now, returning a placeholder
    // In production, call: const response = await openai.embeddings.create({ model: "text-embedding-3-small", input: text });
    return [];
  } catch (error) {
    console.error("Failed to generate embedding:", error);
    return [];
  }
}

/**
 * Process a batch of data sources
 */
export async function processBatchSources(sources: any[]): Promise<{
  entities: KnowledgeEntity[];
  relationships: KnowledgeRelationship[];
}> {
  const allEntities: KnowledgeEntity[] = [];

  for (const source of sources) {
    let entities: KnowledgeEntity[] = [];

    switch (source.sourceType) {
      case "kanban_comment":
        entities = await extractFromKanbanComments([source.data]);
        break;
      case "smart_tag":
        entities = await extractFromSmartTags(source.data);
        break;
      case "documentation":
        entities = await extractFromDocumentation(source.data.content, source.data.id);
        break;
      case "code_file":
        entities = await extractFromCode(source.data.content, source.data.path);
        break;
      case "compliance_framework":
        entities = await extractFromComplianceFramework(source.data.name, source.data.content);
        break;
      default:
        console.warn(`Unknown source type: ${source.sourceType}`);
    }

    allEntities.push(...entities);
  }

  // Identify relationships between all extracted entities
  const relationships = await identifyRelationships(allEntities);

  return { entities: allEntities, relationships };
}
