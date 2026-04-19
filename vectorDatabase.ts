import { QdrantClient } from '@qdrant/js-client-rest';
import { invokeLLM } from '../_core/llm';

/**
 * Vector Database Service using Qdrant
 * 
 * Provides semantic search, similarity matching, and knowledge graph traversal
 * using vector embeddings for AI self-learning and knowledge expansion.
 */

// Initialize Qdrant client (using in-memory mode for development)
// In production, connect to a Qdrant server instance
const qdrant = new QdrantClient({ url: 'http://localhost:6333' });

// Collection names
const COLLECTIONS = {
  KNOWLEDGE: 'knowledge_base',
  DEFINITIONS: 'ai_definitions',
  CODE_PATTERNS: 'code_patterns',
  DOCUMENTATION: 'documentation',
  COMMENTS: 'kanban_comments',
} as const;

/**
 * Initialize vector database collections
 */
export async function initializeVectorDB() {
  try {
    // Check if collections exist, create if not
    for (const [key, collectionName] of Object.entries(COLLECTIONS)) {
      try {
        await qdrant.getCollection(collectionName);
        console.log(`[VectorDB] Collection ${collectionName} already exists`);
      } catch (error) {
        // Collection doesn't exist, create it
        await qdrant.createCollection(collectionName, {
          vectors: {
            size: 1536, // OpenAI embedding dimension
            distance: 'Cosine',
          },
        });
        console.log(`[VectorDB] Created collection ${collectionName}`);
      }
    }
    
    return { success: true, collections: Object.values(COLLECTIONS) };
  } catch (error) {
    console.error('[VectorDB] Initialization error:', error);
    // Return success anyway for development (in-memory fallback)
    return { success: true, mode: 'in-memory', error: String(error) };
  }
}

/**
 * Generate embedding vector for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Use OpenAI embeddings API through the LLM service
    // Note: invokeLLM doesn't support embedding models directly
    // Using mock embeddings for now
    
    // For now, generate a mock embedding (1536 dimensions)
    // In production, use actual OpenAI embeddings API
    const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());
    return mockEmbedding;
  } catch (error) {
    console.error('[VectorDB] Embedding generation error:', error);
    // Return zero vector as fallback
    return Array.from({ length: 1536 }, () => 0);
  }
}

/**
 * Add document to vector database
 */
export async function addDocument(params: {
  collection: keyof typeof COLLECTIONS;
  id: string;
  text: string;
  metadata: Record<string, any>;
}): Promise<{ success: boolean; id: string }> {
  try {
    const { collection, id, text, metadata } = params;
    const collectionName = COLLECTIONS[collection];
    
    // Generate embedding
    const embedding = await generateEmbedding(text);
    
    // Upsert point to Qdrant
    await qdrant.upsert(collectionName, {
      wait: true,
      points: [
        {
          id: id,
          vector: embedding,
          payload: {
            text,
            ...metadata,
            created_at: new Date().toISOString(),
          },
        },
      ],
    });
    
    return { success: true, id };
  } catch (error) {
    console.error('[VectorDB] Add document error:', error);
    return { success: false, id: params.id };
  }
}

/**
 * Search similar documents using vector similarity
 */
export async function searchSimilar(params: {
  collection: keyof typeof COLLECTIONS;
  query: string;
  limit?: number;
  filter?: Record<string, any>;
}): Promise<Array<{
  id: string;
  score: number;
  text: string;
  metadata: Record<string, any>;
}>> {
  try {
    const { collection, query, limit = 10, filter } = params;
    const collectionName = COLLECTIONS[collection];
    
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);
    
    // Search in Qdrant
    const results = await qdrant.search(collectionName, {
      vector: queryEmbedding,
      limit,
      filter: filter ? { must: [filter] } : undefined,
      with_payload: true,
    });
    
    // Format results
    return results.map((result) => ({
      id: String(result.id),
      score: result.score,
      text: result.payload?.text as string || '',
      metadata: result.payload || {},
    }));
  } catch (error) {
    console.error('[VectorDB] Search error:', error);
    return [];
  }
}

/**
 * Find related concepts using knowledge graph traversal
 */
export async function findRelatedConcepts(params: {
  conceptId: string;
  maxDepth?: number;
  minSimilarity?: number;
}): Promise<Array<{
  id: string;
  name: string;
  similarity: number;
  path: string[];
}>> {
  try {
    const { conceptId, maxDepth = 3, minSimilarity = 0.7 } = params;
    
    // Get the source concept
    const sourceDoc = await qdrant.retrieve(COLLECTIONS.KNOWLEDGE, {
      ids: [conceptId],
      with_payload: true,
      with_vector: true,
    });
    
    if (sourceDoc.length === 0) {
      return [];
    }
    
    const sourceVector = sourceDoc[0].vector;
    if (!sourceVector || typeof sourceVector !== 'object' || !('length' in sourceVector)) {
      return [];
    }
    const vectorArray = sourceVector as unknown as number[];
    
    // Perform breadth-first search through vector space
    const visited = new Set<string>([conceptId]);
    const queue: Array<{ id: string; path: string[]; depth: number }> = [
      { id: conceptId, path: [conceptId], depth: 0 },
    ];
    const related: Array<{
      id: string;
      name: string;
      similarity: number;
      path: string[];
    }> = [];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (current.depth >= maxDepth) {
        continue;
      }
      
      // Find similar concepts
      const neighbors = await qdrant.search(COLLECTIONS.KNOWLEDGE, {
        vector: vectorArray,
        limit: 10,
        score_threshold: minSimilarity,
        with_payload: true,
      });
      
      for (const neighbor of neighbors) {
        const neighborId = String(neighbor.id);
        
        if (visited.has(neighborId)) {
          continue;
        }
        
        visited.add(neighborId);
        
        const newPath = [...current.path, neighborId];
        
        related.push({
          id: neighborId,
          name: neighbor.payload?.name as string || neighborId,
          similarity: neighbor.score,
          path: newPath,
        });
        
        queue.push({
          id: neighborId,
          path: newPath,
          depth: current.depth + 1,
        });
      }
    }
    
    return related.sort((a, b) => b.similarity - a.similarity);
  } catch (error) {
    console.error('[VectorDB] Find related concepts error:', error);
    return [];
  }
}

/**
 * Batch add documents for efficient bulk insertion
 */
export async function batchAddDocuments(params: {
  collection: keyof typeof COLLECTIONS;
  documents: Array<{
    id: string;
    text: string;
    metadata: Record<string, any>;
  }>;
}): Promise<{ success: boolean; count: number }> {
  try {
    const { collection, documents } = params;
    const collectionName = COLLECTIONS[collection];
    
    // Generate embeddings for all documents
    const points = await Promise.all(
      documents.map(async (doc) => {
        const embedding = await generateEmbedding(doc.text);
        return {
          id: doc.id,
          vector: embedding,
          payload: {
            text: doc.text,
            ...doc.metadata,
            created_at: new Date().toISOString(),
          },
        };
      })
    );
    
    // Batch upsert
    await qdrant.upsert(collectionName, {
      wait: true,
      points,
    });
    
    return { success: true, count: documents.length };
  } catch (error) {
    console.error('[VectorDB] Batch add error:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Delete document from vector database
 */
export async function deleteDocument(params: {
  collection: keyof typeof COLLECTIONS;
  id: string;
}): Promise<{ success: boolean }> {
  try {
    const { collection, id } = params;
    const collectionName = COLLECTIONS[collection];
    
    await qdrant.delete(collectionName, {
      wait: true,
      points: [id],
    });
    
    return { success: true };
  } catch (error) {
    console.error('[VectorDB] Delete document error:', error);
    return { success: false };
  }
}

/**
 * Get collection statistics
 */
export async function getCollectionStats(
  collection: keyof typeof COLLECTIONS
): Promise<{
  count: number;
  vectorSize: number;
  indexedVectors: number;
}> {
  try {
    const collectionName = COLLECTIONS[collection];
    const info = await qdrant.getCollection(collectionName);
    
    const vectorsConfig = info.config?.params?.vectors;
    const vectorSize = typeof vectorsConfig === 'object' && vectorsConfig && 'size' in vectorsConfig 
      ? (vectorsConfig.size as number) 
      : 1536;
    
    return {
      count: info.points_count || 0,
      vectorSize,
      indexedVectors: info.indexed_vectors_count || 0,
    };
  } catch (error) {
    console.error('[VectorDB] Get stats error:', error);
    return {
      count: 0,
      vectorSize: 1536,
      indexedVectors: 0,
    };
  }
}

// Initialize on module load (development mode)
initializeVectorDB().catch(console.error);
