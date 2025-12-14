import { invokeLLM } from "../_core/llm";
import { createTagSuggestion, getTagSuggestions } from "../db-card-features";

interface TagSuggestion {
  tagName: string;
  tagColor: string;
  confidence: number;
  reasoning: string;
}

/**
 * Generate smart tag suggestions using AI based on card content
 */
export async function generateSmartTags(
  boardId: number,
  cardTitle: string,
  cardDescription?: string
): Promise<TagSuggestion[]> {
  try {
    // Get existing tag suggestions for this board to maintain consistency
    const existingTags = await getTagSuggestions(boardId);
    const existingTagNames = existingTags.map(t => t.tagName);

    const prompt = `Analyze this card and suggest 3-5 relevant tags for categorization and filtering.

Card Title: ${cardTitle}
Card Description: ${cardDescription || "No description"}

${existingTagNames.length > 0 ? `Existing tags in this board: ${existingTagNames.join(", ")}` : ""}

Requirements:
1. Suggest tags that are concise (1-2 words max)
2. Focus on: technical domain, feature area, priority indicators, workflow stage
3. Reuse existing tags when appropriate for consistency
4. Provide confidence score (0-100) for each suggestion
5. Suggest appropriate colors based on tag meaning

Return JSON array with format:
[
  {
    "tagName": "backend",
    "tagColor": "#3b82f6",
    "confidence": 95,
    "reasoning": "Card involves API development"
  }
]

Color guidelines:
- Technical/Infrastructure: #3b82f6 (blue)
- Frontend/UI: #8b5cf6 (purple)
- Backend/API: #06b6d4 (cyan)
- Database: #10b981 (green)
- Security: #ef4444 (red)
- Performance: #f59e0b (orange)
- Bug/Issue: #dc2626 (dark red)
- Feature: #22c55e (bright green)
- Documentation: #6366f1 (indigo)`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert at categorizing software development tasks and suggesting relevant tags.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "tag_suggestions",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    tagName: { type: "string" },
                    tagColor: { type: "string" },
                    confidence: { type: "number" },
                    reasoning: { type: "string" },
                  },
                  required: ["tagName", "tagColor", "confidence", "reasoning"],
                  additionalProperties: false,
                },
              },
            },
            required: ["suggestions"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      return [];
    }

    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const parsed = JSON.parse(contentStr);
    const suggestions: TagSuggestion[] = parsed.suggestions || [];

    // Store suggestions in database for future reference
    for (const suggestion of suggestions) {
      try {
        await createTagSuggestion({
          boardId,
          tagName: suggestion.tagName,
          tagColor: suggestion.tagColor,
          confidence: Math.round(suggestion.confidence),
          source: "ai",
        });
      } catch (error) {
        // Ignore duplicate tag suggestions
        console.warn(`Tag suggestion already exists: ${suggestion.tagName}`);
      }
    }

    return suggestions;
  } catch (error) {
    console.error("Failed to generate smart tags:", error);
    return [];
  }
}

/**
 * Analyze card content and suggest tags from existing board tags
 */
export async function suggestExistingTags(
  boardId: number,
  cardTitle: string,
  cardDescription?: string
): Promise<string[]> {
  try {
    const existingTags = await getTagSuggestions(boardId);
    
    if (existingTags.length === 0) {
      return [];
    }

    const tagNames = existingTags.map(t => t.tagName);

    const prompt = `Given this card, which of the following existing tags are most relevant?

Card Title: ${cardTitle}
Card Description: ${cardDescription || "No description"}

Available Tags: ${tagNames.join(", ")}

Return JSON array of relevant tag names (maximum 5):
{
  "tags": ["tag1", "tag2", "tag3"]
}`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert at categorizing content with existing tags.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "tag_selection",
          strict: true,
          schema: {
            type: "object",
            properties: {
              tags: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["tags"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      return [];
    }

    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const parsed = JSON.parse(contentStr);
    return parsed.tags || [];
  } catch (error) {
    console.error("Failed to suggest existing tags:", error);
    return [];
  }
}
