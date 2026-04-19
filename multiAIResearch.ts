import { invokeLLM } from "../_core/llm";

export interface ResearchQuery {
  topic: string;
  context?: string;
  maxStories?: number;
}

export interface UserStory {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  storyPoints: number;
  priority: "low" | "medium" | "high" | "critical";
  cardType: "story" | "task" | "bug" | "epic";
  complexity: "simple" | "moderate" | "complex";
  dependencies?: string[];
  technicalNotes?: string;
}

export interface ResearchResult {
  stories: UserStory[];
  summary: string;
  totalStoryPoints: number;
  recommendedSprints: number;
}

/**
 * Multi-AI Research Service
 * Orchestrates multiple AI models in parallel to generate comprehensive user stories
 */
export class MultiAIResearchService {
  /**
   * Generate user stories from a research topic using multiple AI models
   */
  async generateUserStories(query: ResearchQuery): Promise<ResearchResult> {
    const { topic, context = "", maxStories = 10 } = query;

    // Parallel AI orchestration: Use multiple perspectives
    const [storiesFromGemini, storiesFromClaude, complexityAnalysis] = await Promise.allSettled([
      this.generateStoriesWithGemini(topic, context, maxStories),
      this.generateStoriesWithClaude(topic, context, maxStories),
      this.analyzeComplexity(topic, context),
    ]);

    // Merge and deduplicate stories from different AI models
    const allStories: UserStory[] = [];
    
    if (storiesFromGemini.status === "fulfilled") {
      allStories.push(...storiesFromGemini.value);
    }
    
    if (storiesFromClaude.status === "fulfilled") {
      allStories.push(...storiesFromClaude.value);
    }

    // Deduplicate based on title similarity
    const uniqueStories = this.deduplicateStories(allStories);

    // Apply complexity analysis
    let complexityInfo = "moderate";
    if (complexityAnalysis.status === "fulfilled") {
      complexityInfo = complexityAnalysis.value;
    }

    // Calculate total story points
    const totalStoryPoints = uniqueStories.reduce((sum, story) => sum + story.storyPoints, 0);
    
    // Estimate sprints (assuming 20 points per sprint)
    const recommendedSprints = Math.ceil(totalStoryPoints / 20);

    // Generate summary
    const summary = await this.generateSummary(topic, uniqueStories, complexityInfo);

    return {
      stories: uniqueStories.slice(0, maxStories),
      summary,
      totalStoryPoints,
      recommendedSprints,
    };
  }

  /**
   * Generate stories using Gemini model
   */
  private async generateStoriesWithGemini(
    topic: string,
    context: string,
    maxStories: number
  ): Promise<UserStory[]> {
    const prompt = `You are a senior product manager and agile coach. Generate ${maxStories} user stories for the following feature:

**Feature**: ${topic}

${context ? `**Context**: ${context}` : ""}

For each user story, provide:
1. Title (concise, user-focused)
2. Description (As a [user], I want [feature] so that [benefit])
3. Acceptance criteria (3-5 testable conditions)
4. Story points (1, 2, 3, 5, 8, 13, 21)
5. Priority (low, medium, high, critical)
6. Card type (story, task, bug, epic)
7. Complexity (simple, moderate, complex)
8. Dependencies (if any)
9. Technical notes (implementation hints)

Return ONLY a JSON array of user stories with this exact structure:
[
  {
    "title": "string",
    "description": "string",
    "acceptanceCriteria": ["string"],
    "storyPoints": number,
    "priority": "low" | "medium" | "high" | "critical",
    "cardType": "story" | "task" | "bug" | "epic",
    "complexity": "simple" | "moderate" | "complex",
    "dependencies": ["string"] (optional),
    "technicalNotes": "string" (optional)
  }
]`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an expert agile product manager. Always respond with valid JSON only, no markdown formatting.",
          },
          { role: "user", content: prompt },
        ],
      });

      const content = typeof response.choices[0]?.message?.content === 'string'
        ? response.choices[0].message.content
        : "[]";
      
      // Clean markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      const stories = JSON.parse(cleanedContent) as UserStory[];
      return stories;
    } catch (error) {
      console.error("Gemini story generation failed:", error);
      return [];
    }
  }

  /**
   * Generate stories using Claude model (via built-in LLM)
   */
  private async generateStoriesWithClaude(
    topic: string,
    context: string,
    maxStories: number
  ): Promise<UserStory[]> {
    const prompt = `As an experienced agile practitioner, create ${maxStories} well-structured user stories for:

**Feature**: ${topic}

${context ? `**Additional Context**: ${context}` : ""}

Focus on:
- Clear user value proposition
- Testable acceptance criteria
- Realistic story point estimates
- Proper prioritization
- Technical feasibility

Return a JSON array with this structure:
[
  {
    "title": "string",
    "description": "string (As a [user], I want [feature] so that [benefit])",
    "acceptanceCriteria": ["criterion1", "criterion2", "criterion3"],
    "storyPoints": number (1, 2, 3, 5, 8, 13, 21),
    "priority": "low" | "medium" | "high" | "critical",
    "cardType": "story" | "task" | "bug" | "epic",
    "complexity": "simple" | "moderate" | "complex",
    "dependencies": ["dependency1"] (optional),
    "technicalNotes": "string" (optional)
  }
]`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a senior agile coach and product owner. Respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
      });

      const content = typeof response.choices[0]?.message?.content === 'string'
        ? response.choices[0].message.content
        : "[]";
      const cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const stories = JSON.parse(cleanedContent) as UserStory[];
      return stories;
    } catch (error) {
      console.error("Claude story generation failed:", error);
      return [];
    }
  }

  /**
   * Analyze feature complexity
   */
  private async analyzeComplexity(topic: string, context: string): Promise<string> {
    const prompt = `Analyze the complexity of this feature:

**Feature**: ${topic}
${context ? `**Context**: ${context}` : ""}

Provide a brief complexity assessment (2-3 sentences) covering:
- Technical complexity
- Integration challenges
- Risk factors
- Recommended approach`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a technical architect analyzing feature complexity.",
          },
          { role: "user", content: prompt },
        ],
      });

      const content = response.choices[0]?.message?.content;
      return typeof content === 'string' ? content : "Moderate complexity";
    } catch (error) {
      console.error("Complexity analysis failed:", error);
      return "Moderate complexity";
    }
  }

  /**
   * Deduplicate stories based on title similarity
   */
  private deduplicateStories(stories: UserStory[]): UserStory[] {
    const seen = new Set<string>();
    const unique: UserStory[] = [];

    for (const story of stories) {
      const normalizedTitle = story.title.toLowerCase().trim();
      
      // Simple similarity check (can be enhanced with Levenshtein distance)
      let isDuplicate = false;
      const seenTitles = Array.from(seen);
      for (const seenTitle of seenTitles) {
        if (this.calculateSimilarity(normalizedTitle, seenTitle) > 0.8) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        seen.add(normalizedTitle);
        unique.push(story);
      }
    }

    return unique;
  }

  /**
   * Calculate string similarity (Jaccard similarity)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(" ");
    const words2 = str2.split(" ");
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    // Calculate intersection
    let intersectionCount = 0;
    set1.forEach(word => {
      if (set2.has(word)) intersectionCount++;
    });
    
    // Calculate union size
    const unionSize = set1.size + set2.size - intersectionCount;
    
    return unionSize > 0 ? intersectionCount / unionSize : 0;
  }

  /**
   * Generate executive summary
   */
  private async generateSummary(
    topic: string,
    stories: UserStory[],
    complexity: string
  ): Promise<string> {
    const prompt = `Create a brief executive summary (3-4 sentences) for this feature breakdown:

**Feature**: ${topic}
**Total Stories**: ${stories.length}
**Complexity**: ${complexity}
**Story Points**: ${stories.reduce((sum, s) => sum + s.storyPoints, 0)}

Summarize:
- Overall scope
- Key deliverables
- Estimated effort
- Main risks`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a product manager creating executive summaries.",
          },
          { role: "user", content: prompt },
        ],
      });

      const content = response.choices[0]?.message?.content;
      return typeof content === 'string' ? content : "Feature breakdown complete.";
    } catch (error) {
      console.error("Summary generation failed:", error);
      return `Generated ${stories.length} user stories for ${topic}. Total effort: ${stories.reduce((sum, s) => sum + s.storyPoints, 0)} story points.`;
    }
  }

  /**
   * Split large epic into smaller stories
   */
  async splitEpic(epic: UserStory): Promise<UserStory[]> {
    if (epic.storyPoints < 13) {
      return [epic]; // No need to split
    }

    const prompt = `This epic is too large and needs to be split into smaller user stories:

**Epic**: ${epic.title}
**Description**: ${epic.description}
**Story Points**: ${epic.storyPoints}

Split this into 3-5 smaller, independent user stories that:
- Each can be completed in 1-2 sprints
- Have clear acceptance criteria
- Maintain the original value proposition
- Are properly sequenced

Return a JSON array of user stories with the same structure as the original.`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an agile coach helping split large epics. Respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
      });

      const content = typeof response.choices[0]?.message?.content === 'string'
        ? response.choices[0].message.content
        : "[]";
      const cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const splitStories = JSON.parse(cleanedContent) as UserStory[];
      
      return splitStories.length > 0 ? splitStories : [epic];
    } catch (error) {
      console.error("Epic splitting failed:", error);
      return [epic];
    }
  }
}

// Export singleton instance
export const multiAIResearch = new MultiAIResearchService();
