/**
 * Conversation Analytics
 * 
 * Intent classification, topic modeling, and quality scoring for agent conversations
 */

import { invokeLLM } from "../_core/llm";

export interface ConversationIntent {
  intent: string;
  confidence: number;
  category: "question" | "command" | "feedback" | "discussion" | "request";
  entities: Array<{ type: string; value: string }>;
}

export interface ConversationTopic {
  topic: string;
  relevance: number;
  keywords: string[];
}

export interface QualityScore {
  overall: number;
  clarity: number;
  completeness: number;
  relevance: number;
  actionability: number;
  feedback: string;
}

export interface ConversationAnalytics {
  intent: ConversationIntent;
  topics: ConversationTopic[];
  quality: QualityScore;
  sentiment: {
    score: number; // -1 to 1
    label: "positive" | "neutral" | "negative";
  };
  suggestedActions: string[];
}

/**
 * Classify conversation intent
 */
export async function classifyIntent(message: string): Promise<ConversationIntent> {
  const prompt = `Analyze this user message and classify its intent.

**Message:** ${message}

Determine:
1. Primary intent (what the user wants to accomplish)
2. Confidence level (0-1)
3. Category: question, command, feedback, discussion, or request
4. Extract any entities (names, dates, technologies, etc.)

Respond in JSON format:
{
  "intent": "description of intent",
  "confidence": 0.95,
  "category": "question",
  "entities": [
    {"type": "technology", "value": "React"},
    {"type": "action", "value": "create"}
  ]
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are an expert at understanding user intent in conversations." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "intent_classification",
        strict: true,
        schema: {
          type: "object",
          properties: {
            intent: { type: "string" },
            confidence: { type: "number" },
            category: {
              type: "string",
              enum: ["question", "command", "feedback", "discussion", "request"],
            },
            entities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  value: { type: "string" },
                },
                required: ["type", "value"],
                additionalProperties: false,
              },
            },
          },
          required: ["intent", "confidence", "category", "entities"],
          additionalProperties: false,
        },
      },
    },
  });

  const result = JSON.parse((typeof response.choices[0].message.content === "string" ? response.choices[0].message.content : JSON.stringify(response.choices[0].message.content)) || "{}");
  return result;
}

/**
 * Extract topics from conversation
 */
export async function extractTopics(messages: string[]): Promise<ConversationTopic[]> {
  const conversationText = messages.join("\n\n");

  const prompt = `Analyze this conversation and extract the main topics discussed.

**Conversation:**
${conversationText}

Identify 3-5 main topics with:
1. Topic name
2. Relevance score (0-1)
3. Key keywords for each topic

Respond in JSON format:
{
  "topics": [
    {
      "topic": "topic name",
      "relevance": 0.95,
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ]
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are an expert at topic modeling and conversation analysis." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "topic_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            topics: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  topic: { type: "string" },
                  relevance: { type: "number" },
                  keywords: { type: "array", items: { type: "string" } },
                },
                required: ["topic", "relevance", "keywords"],
                additionalProperties: false,
              },
            },
          },
          required: ["topics"],
          additionalProperties: false,
        },
      },
    },
  });

  const result = JSON.parse((typeof response.choices[0].message.content === "string" ? response.choices[0].message.content : JSON.stringify(response.choices[0].message.content)) || "{}");
  return result.topics || [];
}

/**
 * Score conversation quality
 */
export async function scoreConversationQuality(
  userMessage: string,
  agentResponse: string
): Promise<QualityScore> {
  const prompt = `Evaluate the quality of this agent response to the user's message.

**User Message:** ${userMessage}

**Agent Response:** ${agentResponse}

Score the response on these dimensions (0-1 scale):
1. **Clarity**: Is the response clear and easy to understand?
2. **Completeness**: Does it fully address the user's needs?
3. **Relevance**: Is it relevant to the user's question?
4. **Actionability**: Does it provide actionable next steps?

Also provide:
- Overall quality score (0-1)
- Brief feedback for improvement

Respond in JSON format:
{
  "overall": 0.95,
  "clarity": 0.95,
  "completeness": 0.90,
  "relevance": 1.0,
  "actionability": 0.85,
  "feedback": "brief feedback"
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are an expert at evaluating conversation quality." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "quality_score",
        strict: true,
        schema: {
          type: "object",
          properties: {
            overall: { type: "number" },
            clarity: { type: "number" },
            completeness: { type: "number" },
            relevance: { type: "number" },
            actionability: { type: "number" },
            feedback: { type: "string" },
          },
          required: ["overall", "clarity", "completeness", "relevance", "actionability", "feedback"],
          additionalProperties: false,
        },
      },
    },
  });

  const result = JSON.parse((typeof response.choices[0].message.content === "string" ? response.choices[0].message.content : JSON.stringify(response.choices[0].message.content)) || "{}");
  return result;
}

/**
 * Analyze sentiment
 */
export async function analyzeSentiment(message: string): Promise<{ score: number; label: "positive" | "neutral" | "negative" }> {
  const prompt = `Analyze the sentiment of this message.

**Message:** ${message}

Provide:
1. Sentiment score (-1 to 1, where -1 is very negative, 0 is neutral, 1 is very positive)
2. Label: positive, neutral, or negative

Respond in JSON format:
{
  "score": 0.8,
  "label": "positive"
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are an expert at sentiment analysis." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "sentiment_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            score: { type: "number" },
            label: { type: "string", enum: ["positive", "neutral", "negative"] },
          },
          required: ["score", "label"],
          additionalProperties: false,
        },
      },
    },
  });

  const result = JSON.parse((typeof response.choices[0].message.content === "string" ? response.choices[0].message.content : JSON.stringify(response.choices[0].message.content)) || "{}");
  return result;
}

/**
 * Suggest actions based on conversation
 */
export async function suggestActions(
  intent: ConversationIntent,
  topics: ConversationTopic[]
): Promise<string[]> {
  const prompt = `Based on this conversation analysis, suggest 3-5 actionable next steps.

**Intent:** ${intent.intent} (${intent.category})

**Topics:**
${topics.map((t) => `- ${t.topic} (${t.keywords.join(", ")})`).join("\n")}

Suggest specific, actionable next steps that would help address the user's needs.

Respond in JSON format:
{
  "actions": ["action 1", "action 2", "action 3"]
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are an expert at suggesting actionable next steps." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "action_suggestions",
        strict: true,
        schema: {
          type: "object",
          properties: {
            actions: { type: "array", items: { type: "string" } },
          },
          required: ["actions"],
          additionalProperties: false,
        },
      },
    },
  });

  const result = JSON.parse((typeof response.choices[0].message.content === "string" ? response.choices[0].message.content : JSON.stringify(response.choices[0].message.content)) || "{}");
  return result.actions || [];
}

/**
 * Comprehensive conversation analysis
 */
export async function analyzeConversation(
  userMessage: string,
  agentResponse?: string,
  conversationHistory?: string[]
): Promise<ConversationAnalytics> {
  // Classify intent
  const intent = await classifyIntent(userMessage);

  // Extract topics
  const messages = conversationHistory || [userMessage];
  if (agentResponse) {
    messages.push(agentResponse);
  }
  const topics = await extractTopics(messages);

  // Score quality (if we have an agent response)
  let quality: QualityScore;
  if (agentResponse) {
    quality = await scoreConversationQuality(userMessage, agentResponse);
  } else {
    quality = {
      overall: 0,
      clarity: 0,
      completeness: 0,
      relevance: 0,
      actionability: 0,
      feedback: "No response to evaluate",
    };
  }

  // Analyze sentiment
  const sentiment = await analyzeSentiment(userMessage);

  // Suggest actions
  const suggestedActions = await suggestActions(intent, topics);

  return {
    intent,
    topics,
    quality,
    sentiment,
    suggestedActions,
  };
}
