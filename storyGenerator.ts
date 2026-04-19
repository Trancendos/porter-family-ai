import { getDb } from "../db";
import { agileBacklog, epics, InsertAgileBacklogItem, InsertEpic } from "../../drizzle/schema";

/**
 * Story Generator Service
 * Creates properly formatted user stories with INVEST criteria
 */

export interface UserStoryTemplate {
  title: string;
  asA: string; // "As a [user type]"
  iWant: string; // "I want [goal]"
  soThat: string; // "So that [benefit]"
  acceptanceCriteria: string[];
  priority: "critical" | "high" | "medium" | "low";
  storyPoints: number;
  epicTitle: string;
  tags: string[];
}

/**
 * Generate user story description in standard format
 */
function generateStoryDescription(story: UserStoryTemplate): string {
  return `**User Story:**
As a ${story.asA}
I want ${story.iWant}
So that ${story.soThat}

**Acceptance Criteria:**
${story.acceptanceCriteria.map((criteria, index) => `${index + 1}. ${criteria}`).join('\n')}`;
}

/**
 * Create epic in database
 */
export async function createEpic(
  userId: number,
  epicTitle: string,
  description: string,
  tags: string[]
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const epicId = `EPIC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const result = await db.insert(epics).values({
    epicId,
    title: epicTitle,
    description,
    createdBy: userId,
    status: "planning",
    priority: "high",
    startDate: null,
    targetDate: null,
    completedDate: null,
    completionPercentage: 0,
  });

  return result[0].insertId;
}

/**
 * Create user story in backlog
 */
export async function createUserStory(
  userId: number,
  story: UserStoryTemplate,
  epicId: number
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const backlogId = `STORY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const description = generateStoryDescription(story);

  await db.insert(agileBacklog).values({
    backlogId,
    itemType: "user_story",
    title: story.title,
    description,
    acceptanceCriteria: JSON.stringify(story.acceptanceCriteria),
    priority: story.priority,
    status: "backlog",
    storyPoints: story.storyPoints,
    assignedTo: null,
    parentId: epicId, // Link to epic via parentId
    sprintId: null,
    labels: JSON.stringify(story.tags),
    dependencies: null,
    reportedBy: userId,
    blockedBy: null,
    attachments: null,
    completedAt: null,
  });

  return backlogId;
}

/**
 * Digital Twin Epic Stories
 */
export const digitalTwinStories: UserStoryTemplate[] = [
  // Epic 1: Smart Onboarding
  {
    title: "OAuth Auto-Capture User Profile",
    asA: "new user signing up with OAuth",
    iWant: "my language, region, and profile details automatically captured",
    soThat: "I don't have to manually enter information the system already knows",
    acceptanceCriteria: [
      "Language is captured from OAuth provider",
      "Region/timezone is captured from device",
      "Name, email, and avatar are populated",
      "User can review and edit auto-captured data",
      "System creates initial linguistic profile",
    ],
    priority: "high",
    storyPoints: 5,
    epicTitle: "Smart User Onboarding",
    tags: ["onboarding", "oauth", "profile"],
  },
  {
    title: "Email Registration Onboarding Flow",
    asA: "new user signing up with email",
    iWant: "a guided onboarding flow that asks essential questions",
    soThat: "the AI can understand my linguistic and communication preferences",
    acceptanceCriteria: [
      "Mandatory questions: language, region, communication preferences",
      "Optional questions: dialect, cultural context, neurodiversity support",
      "Progress indicator shows completion status",
      "User can skip optional questions",
      "Profile is created after completion",
    ],
    priority: "high",
    storyPoints: 8,
    epicTitle: "Smart User Onboarding",
    tags: ["onboarding", "email", "profile"],
  },
  {
    title: "Communication Preferences Setup",
    asA: "user with specific communication needs",
    iWant: "to specify my neurodiversity support requirements and response style",
    soThat: "the AI adapts to my cognitive and communication preferences",
    acceptanceCriteria: [
      "Neurodiversity options: ADHD, Dyslexia, Autism, etc.",
      "Response style: concise, detailed, visual",
      "Terminology complexity: technical, general, simplified",
      "Preferences are saved to user profile",
      "AI immediately adapts responses based on preferences",
    ],
    priority: "critical",
    storyPoints: 5,
    epicTitle: "Smart User Onboarding",
    tags: ["accessibility", "neurodiversity", "preferences"],
  },

  // Epic 2: Personal ToR System
  {
    title: "Create Personal Terms of Reference",
    asA: "user with specific terminology preferences",
    iWant: "to define my own terms and their meanings",
    soThat: "the AI understands my unique vocabulary and context",
    acceptanceCriteria: [
      "User can add term, definition, context, and examples",
      "Terms are stored in Personal ToR",
      "User can edit and delete their terms",
      "AI uses Personal ToR when interpreting user input",
      "Search and filter Personal ToR entries",
    ],
    priority: "high",
    storyPoints: 8,
    epicTitle: "Personal Terms of Reference",
    tags: ["tor", "terminology", "personalization"],
  },
  {
    title: "AI-Powered Term Suggestion",
    asA: "user who frequently uses specific terms",
    iWant: "the AI to suggest adding terms to my Personal ToR",
    soThat: "I can build my vocabulary profile without manual effort",
    acceptanceCriteria: [
      "AI detects repeated terms in conversations",
      "Suggests adding term with auto-generated definition",
      "User can accept, edit, or reject suggestion",
      "Suggestions appear in notification or dashboard",
      "User can disable auto-suggestions",
    ],
    priority: "medium",
    storyPoints: 5,
    epicTitle: "Personal Terms of Reference",
    tags: ["tor", "ai", "automation"],
  },
  {
    title: "Central ToR Consolidation",
    asA: "system administrator",
    iWant: "all user definitions consolidated into a Central ToR",
    soThat: "the AI can learn from collective knowledge and handle ambiguity",
    acceptanceCriteria: [
      "Central ToR aggregates all user definitions",
      "Tracks multiple definitions for same term",
      "Stores user contexts for disambiguation",
      "Updates automatically when users add/edit terms",
      "Provides disambiguation rules (jam = food vs traffic vs music)",
    ],
    priority: "high",
    storyPoints: 13,
    epicTitle: "Personal Terms of Reference",
    tags: ["tor", "central", "disambiguation"],
  },
  {
    title: "Context-Aware Term Disambiguation",
    asA: "user using ambiguous terms",
    iWant: "the AI to ask for clarification when meaning is unclear",
    soThat: "I get accurate responses without misunderstandings",
    acceptanceCriteria: [
      "AI detects ambiguous terms (multiple definitions)",
      "Asks clarifying question with context options",
      "Learns from user's choice for future interactions",
      "Updates Personal ToR with contextual usage",
      "Reduces disambiguation requests over time",
    ],
    priority: "high",
    storyPoints: 8,
    epicTitle: "Personal Terms of Reference",
    tags: ["tor", "disambiguation", "ai"],
  },

  // Epic 3: Linguistic Libraries
  {
    title: "Dictionary Library Foundation",
    asA: "system",
    iWant: "a comprehensive dictionary library with 50k+ terms",
    soThat: "the AI can understand standard definitions and etymology",
    acceptanceCriteria: [
      "Dictionary library table created",
      "Seeded with 50k+ common terms",
      "Includes definition, part of speech, etymology",
      "Search and filter functionality",
      "API for term lookup",
    ],
    priority: "high",
    storyPoints: 13,
    epicTitle: "Linguistic Intelligence Libraries",
    tags: ["dictionary", "library", "foundation"],
  },
  {
    title: "Cultural Context Library",
    asA: "user from a specific cultural background",
    iWant: "the AI to understand cultural references and context",
    soThat: "I don't have to explain cultural nuances every time",
    acceptanceCriteria: [
      "Cultural library table created",
      "Seeded with regional references",
      "Includes cultural context, region, references",
      "Linked to user's region from profile",
      "AI uses cultural library for context-aware responses",
    ],
    priority: "medium",
    storyPoints: 13,
    epicTitle: "Linguistic Intelligence Libraries",
    tags: ["cultural", "library", "context"],
  },
  {
    title: "Dialect Variations Library",
    asA: "user speaking a regional dialect",
    iWant: "the AI to understand my dialect and regional variations",
    soThat: "I can communicate naturally without adjusting my language",
    acceptanceCriteria: [
      "Dialects library table created",
      "Seeded with regional variations",
      "Includes dialect, region, term variations",
      "Linked to user's dialect from profile",
      "AI interprets dialect-specific terms correctly",
    ],
    priority: "medium",
    storyPoints: 13,
    epicTitle: "Linguistic Intelligence Libraries",
    tags: ["dialect", "library", "regional"],
  },
  {
    title: "Multi-Lingual Support Foundation",
    asA: "non-English speaker",
    iWant: "the AI to support my native language",
    soThat: "I can use the system in my preferred language",
    acceptanceCriteria: [
      "Language detection from user profile",
      "Translation service integration",
      "Multi-lingual dictionary support",
      "Language-specific ToR support",
      "Progressive language learning (AI improves over time)",
    ],
    priority: "medium",
    storyPoints: 21,
    epicTitle: "Linguistic Intelligence Libraries",
    tags: ["multilingual", "translation", "i18n"],
  },

  // Epic 4: Digital Twin Extended Profile
  {
    title: "Professional Context Profile",
    asA: "professional user",
    iWant: "to specify my role, industry, and work patterns",
    soThat: "the AI provides relevant, industry-specific assistance",
    acceptanceCriteria: [
      "Professional context form (role, industry, skills)",
      "Work patterns (async vs sync, deep work hours)",
      "Technical skill level selection",
      "Saved to Digital Twin profile",
      "AI adapts responses to professional context",
    ],
    priority: "medium",
    storyPoints: 5,
    epicTitle: "Digital Twin Extended Profile",
    tags: ["profile", "professional", "digital-twin"],
  },
  {
    title: "Cognitive Profile Setup",
    asA: "user with specific cognitive preferences",
    iWant: "to specify my attention span, processing speed, and memory needs",
    soThat: "the AI adapts content delivery to my cognitive style",
    acceptanceCriteria: [
      "Cognitive profile form (attention span, processing speed)",
      "Memory aids preferences (visual cues, repetition, summaries)",
      "Cognitive strengths (pattern recognition, verbal, spatial)",
      "Saved to Digital Twin profile",
      "AI adjusts response length and complexity",
    ],
    priority: "high",
    storyPoints: 8,
    epicTitle: "Digital Twin Extended Profile",
    tags: ["profile", "cognitive", "accessibility"],
  },
  {
    title: "Digital Twin Dashboard",
    asA: "user curious about my Digital Twin",
    iWant: "to see how the AI understands me",
    soThat: "I can verify accuracy and make corrections",
    acceptanceCriteria: [
      "Dashboard shows all Digital Twin attributes",
      "Visualizes learning progress over time",
      "Shows AI's understanding of preferences",
      "User can edit any attribute",
      "Privacy controls for what AI can learn",
    ],
    priority: "medium",
    storyPoints: 13,
    epicTitle: "Digital Twin Extended Profile",
    tags: ["dashboard", "digital-twin", "visualization"],
  },
  {
    title: "AI Learning Engine for Digital Twin",
    asA: "system",
    iWant: "to automatically update Digital Twin from user interactions",
    soThat: "the Digital Twin evolves without manual updates",
    acceptanceCriteria: [
      "Analyzes conversation patterns",
      "Detects work hour patterns",
      "Identifies tool usage preferences",
      "Learns from error corrections",
      "Suggests profile updates to user",
    ],
    priority: "high",
    storyPoints: 21,
    epicTitle: "Digital Twin Extended Profile",
    tags: ["ai", "learning", "automation"],
  },

  // Epic 5: Neurodiversity-Aware AI
  {
    title: "ADHD-Friendly Response Formatting",
    asA: "user with ADHD",
    iWant: "responses that are clear, structured, and not overwhelming",
    soThat: "I can process information without cognitive overload",
    acceptanceCriteria: [
      "Responses use clear headings and structure",
      "Information is chunked into digestible sections",
      "Key points are highlighted",
      "Avoids overwhelming detail",
      "Provides summaries for long content",
    ],
    priority: "critical",
    storyPoints: 5,
    epicTitle: "Neurodiversity-Aware AI",
    tags: ["adhd", "accessibility", "formatting"],
  },
  {
    title: "Dyslexia-Friendly Features",
    asA: "user with dyslexia",
    iWant: "the AI to focus on my intent rather than spelling errors",
    soThat: "I feel respected and not judged for typos",
    acceptanceCriteria: [
      "AI interprets intent despite spelling errors",
      "No patronizing corrections",
      "Gentle suggestions only when critical",
      "Respects user's communication style",
      "Learns user's common typos",
    ],
    priority: "critical",
    storyPoints: 8,
    epicTitle: "Neurodiversity-Aware AI",
    tags: ["dyslexia", "accessibility", "respect"],
  },
  {
    title: "Adaptive Response Length",
    asA: "user with attention span preferences",
    iWant: "responses adjusted to my preferred length",
    soThat: "I can engage without losing focus",
    acceptanceCriteria: [
      "Detects user's attention span from profile",
      "Adjusts response length accordingly",
      "Offers 'Read More' for detailed info",
      "Provides TL;DR summaries",
      "Learns optimal length from user behavior",
    ],
    priority: "high",
    storyPoints: 5,
    epicTitle: "Neurodiversity-Aware AI",
    tags: ["attention", "adaptive", "ux"],
  },
];

/**
 * Bulk create all Digital Twin stories
 */
export async function seedDigitalTwinStories(
  userId: number,
  stories: UserStoryTemplate[] = digitalTwinStories
): Promise<{
  epicsCreated: number;
  storiesCreated: number;
  duplicatesSkipped: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check for existing epics to avoid duplicates
  const existingEpics = await db.select().from(epics);
  const existingEpicTitles = new Set(existingEpics.map(e => e.title));

  // Check for existing stories to avoid duplicates
  const existingStories = await db.select().from(agileBacklog);
  const existingStoryTitles = new Set(existingStories.map(s => s.title));

  // Group stories by epic
  const epicGroups = new Map<string, UserStoryTemplate[]>();
  for (const story of stories) {
    if (!epicGroups.has(story.epicTitle)) {
      epicGroups.set(story.epicTitle, []);
    }
    epicGroups.get(story.epicTitle)!.push(story);
  }

  let epicsCreated = 0;
  let storiesCreated = 0;
  let duplicatesSkipped = 0;

  // Create epics and their stories
  for (const [epicTitle, stories] of Array.from(epicGroups.entries())) {
    let epicId: number;

    // Check if epic already exists
    if (existingEpicTitles.has(epicTitle)) {
      const existingEpic = existingEpics.find(e => e.title === epicTitle);
      epicId = existingEpic!.id;
      duplicatesSkipped++;
    } else {
      epicId = await createEpic(
        userId,
        epicTitle,
        `Epic for ${epicTitle} functionality in Digital Twin system`,
        ["digital-twin", "phase-23"]
      );
      epicsCreated++;
    }

    for (const story of stories) {
      // Check if story already exists
      if (existingStoryTitles.has(story.title)) {
        duplicatesSkipped++;
        continue;
      }

      await createUserStory(userId, story, epicId);
      storiesCreated++;
    }
  }

  return { epicsCreated, storiesCreated, duplicatesSkipped };
}
