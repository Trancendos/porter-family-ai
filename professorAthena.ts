/**
 * Professor Athena - The Educator
 * 
 * AI instructor for the Academy platform
 * Provides personalized learning, interactive tutorials, code review,
 * quiz generation, and certification exams
 * 
 * Personality: Patient, encouraging, knowledgeable educator
 */

import { invokeLLM } from "../_core/llm";
import { logger } from "./errorLoggingService";

export interface LearningProfile {
  userId: number;
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  completedCourses: number[];
  currentCourse?: number;
  currentModule?: number;
  totalPoints: number;
  badges: string[];
  certifications: string[];
  strengths: string[];
  areasForImprovement: string[];
}

export interface InteractiveTutorial {
  step: number;
  totalSteps: number;
  instruction: string;
  code?: string;
  expectedOutput?: string;
  hints: string[];
  feedback?: string;
}

export interface CodeReview {
  code: string;
  language: string;
  feedback: string;
  suggestions: Array<{
    line: number;
    issue: string;
    suggestion: string;
    severity: 'info' | 'warning' | 'error';
  }>;
  score: number;
  strengths: string[];
  areasForImprovement: string[];
}

export interface Quiz {
  id: string;
  courseId: number;
  moduleId: number;
  questions: Array<{
    id: string;
    question: string;
    type: 'multiple_choice' | 'true_false' | 'code_completion' | 'short_answer';
    options?: string[];
    correctAnswer: string | string[];
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  passingScore: number;
  timeLimit?: number;
}

export interface CertificationExam {
  id: string;
  certificationName: string;
  duration: number;
  totalQuestions: number;
  passingScore: number;
  questions: Array<{
    id: string;
    question: string;
    type: 'multiple_choice' | 'code_completion' | 'scenario';
    options?: string[];
    correctAnswer: string | string[];
    points: number;
  }>;
}

/**
 * Get personalized learning recommendation
 */
export async function getPersonalizedRecommendation(profile: LearningProfile): Promise<string> {
  logger.info(`[Athena] Generating personalized recommendation for user ${profile.userId}`);
  
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `You are Professor Athena, a patient and encouraging AI educator. 
You help students learn about the Trancendos platform by providing personalized recommendations 
based on their skill level, learning style, and progress.

Be supportive, clear, and actionable in your recommendations.`,
      },
      {
        role: 'user',
        content: `Based on this student's profile, provide a personalized learning recommendation:

Skill Level: ${profile.skillLevel}
Learning Style: ${profile.learningStyle}
Completed Courses: ${profile.completedCourses.length}
Total Points: ${profile.totalPoints}
Badges: ${profile.badges.join(', ') || 'None yet'}
Certifications: ${profile.certifications.join(', ') || 'None yet'}
Strengths: ${profile.strengths.join(', ') || 'To be determined'}
Areas for Improvement: ${profile.areasForImprovement.join(', ') || 'To be determined'}

What should they focus on next? Provide specific course recommendations and learning strategies.`,
      },
    ],
  });
  
  return response.choices[0].message.content;
}

/**
 * Provide interactive tutorial guidance
 */
export async function provideInteractiveTutorialGuidance(
  tutorial: InteractiveTutorial,
  userCode?: string,
  userQuestion?: string
): Promise<string> {
  logger.info(`[Athena] Providing tutorial guidance for step ${tutorial.step}/${tutorial.totalSteps}`);
  
  const messages = [
    {
      role: 'system',
      content: `You are Professor Athena, guiding a student through an interactive tutorial.
Be patient, encouraging, and provide clear explanations. If they're stuck, offer hints
without giving away the answer immediately.`,
    },
    {
      role: 'user',
      content: `Tutorial Step ${tutorial.step}/${tutorial.totalSteps}:
${tutorial.instruction}

${tutorial.code ? `Example Code:\n\`\`\`\n${tutorial.code}\n\`\`\`` : ''}
${tutorial.expectedOutput ? `Expected Output: ${tutorial.expectedOutput}` : ''}`,
    },
  ];
  
  if (userCode) {
    messages.push({
      role: 'user',
      content: `The student submitted this code:\n\`\`\`\n${userCode}\n\`\`\`\n\nProvide feedback.`,
    });
  }
  
  if (userQuestion) {
    messages.push({
      role: 'user',
      content: `The student asked: "${userQuestion}"\n\nProvide guidance.`,
    });
  }
  
  const response = await invokeLLM({ messages });
  const content = response.choices[0].message.content;
  return typeof content === 'string' ? content : JSON.stringify(content);
}

/**
 * Review student code
 */
export async function reviewCode(code: string, language: string, context?: string): Promise<CodeReview> {
  logger.info(`[Athena] Reviewing ${language} code`);
  
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `You are Professor Athena, providing code review feedback to students.
Analyze the code for:
1. Correctness
2. Best practices
3. Performance
4. Readability
5. Security

Be constructive and educational in your feedback. Highlight both strengths and areas for improvement.

Respond in JSON format:
{
  "feedback": "Overall feedback",
  "suggestions": [
    {
      "line": 1,
      "issue": "Description of issue",
      "suggestion": "How to fix it",
      "severity": "info|warning|error"
    }
  ],
  "score": 85,
  "strengths": ["List of strengths"],
  "areasForImprovement": ["List of areas to improve"]
}`,
      },
      {
        role: 'user',
        content: `Review this ${language} code${context ? ` (Context: ${context})` : ''}:

\`\`\`${language}
${code}
\`\`\``,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'code_review',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            feedback: { type: 'string' },
            suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  line: { type: 'integer' },
                  issue: { type: 'string' },
                  suggestion: { type: 'string' },
                  severity: { type: 'string', enum: ['info', 'warning', 'error'] },
                },
                required: ['line', 'issue', 'suggestion', 'severity'],
                additionalProperties: false,
              },
            },
            score: { type: 'integer' },
            strengths: { type: 'array', items: { type: 'string' } },
            areasForImprovement: { type: 'array', items: { type: 'string' } },
          },
          required: ['feedback', 'suggestions', 'score', 'strengths', 'areasForImprovement'],
          additionalProperties: false,
        },
      },
    },
  });
  
  const review = JSON.parse(response.choices[0].message.content);
  return {
    code,
    language,
    ...review,
  };
}

/**
 * Generate quiz questions
 */
export async function generateQuiz(
  courseId: number,
  moduleId: number,
  topic: string,
  difficulty: 'easy' | 'medium' | 'hard',
  questionCount: number = 5
): Promise<Quiz> {
  logger.info(`[Athena] Generating ${difficulty} quiz on ${topic} with ${questionCount} questions`);
  
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `You are Professor Athena, creating educational quiz questions.
Generate ${questionCount} ${difficulty} questions about ${topic}.

Include a mix of:
- Multiple choice (4 options)
- True/False
- Code completion
- Short answer

Each question should have:
- Clear question text
- Correct answer(s)
- Explanation of why the answer is correct

Respond in JSON format.`,
      },
      {
        role: 'user',
        content: `Generate ${questionCount} ${difficulty} quiz questions about: ${topic}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'quiz',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  question: { type: 'string' },
                  type: { type: 'string', enum: ['multiple_choice', 'true_false', 'code_completion', 'short_answer'] },
                  options: { type: 'array', items: { type: 'string' } },
                  correctAnswer: { type: 'string' },
                  explanation: { type: 'string' },
                  difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                },
                required: ['id', 'question', 'type', 'correctAnswer', 'explanation', 'difficulty'],
                additionalProperties: false,
              },
            },
          },
          required: ['questions'],
          additionalProperties: false,
        },
      },
    },
  });
  
  const quizData = JSON.parse(response.choices[0].message.content);
  
  return {
    id: `quiz-${courseId}-${moduleId}-${Date.now()}`,
    courseId,
    moduleId,
    questions: quizData.questions,
    passingScore: 80,
    timeLimit: questionCount * 3, // 3 minutes per question
  };
}

/**
 * Grade quiz submission
 */
export async function gradeQuiz(
  quiz: Quiz,
  answers: Record<string, string>
): Promise<{
  score: number;
  passed: boolean;
  feedback: string;
  questionResults: Array<{
    questionId: string;
    correct: boolean;
    userAnswer: string;
    correctAnswer: string;
    explanation: string;
  }>;
}> {
  logger.info(`[Athena] Grading quiz ${quiz.id}`);
  
  let correctCount = 0;
  const questionResults = [];
  
  for (const question of quiz.questions) {
    const userAnswer = answers[question.id];
    const correct = userAnswer === question.correctAnswer;
    
    if (correct) correctCount++;
    
    questionResults.push({
      questionId: question.id,
      correct,
      userAnswer,
      correctAnswer: question.correctAnswer as string,
      explanation: question.explanation,
    });
  }
  
  const score = (correctCount / quiz.questions.length) * 100;
  const passed = score >= quiz.passingScore;
  
  // Generate personalized feedback
  const feedbackResponse = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `You are Professor Athena, providing encouraging feedback on a quiz.
Be supportive regardless of the score. Highlight what they did well and provide
constructive guidance on areas to review.`,
      },
      {
        role: 'user',
        content: `The student scored ${score.toFixed(1)}% (${correctCount}/${quiz.questions.length} correct).
${passed ? 'They passed!' : `They need ${quiz.passingScore}% to pass.`}

Provide encouraging feedback and study recommendations.`,
      },
    ],
  });
  
  return {
    score,
    passed,
    feedback: feedbackResponse.choices[0].message.content,
    questionResults,
  };
}

/**
 * Generate certification exam
 */
export async function generateCertificationExam(
  certificationName: string,
  topics: string[]
): Promise<CertificationExam> {
  logger.info(`[Athena] Generating certification exam for ${certificationName}`);
  
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `You are Professor Athena, creating a comprehensive certification exam.
Generate 50 challenging questions covering: ${topics.join(', ')}

Question types:
- Multiple choice (70%)
- Code completion (20%)
- Scenario-based (10%)

Questions should be challenging but fair, testing real-world knowledge.`,
      },
      {
        role: 'user',
        content: `Generate a certification exam for: ${certificationName}
Topics: ${topics.join(', ')}`,
      },
    ],
  });
  
  // Note: In production, this would use structured output
  // For now, return a template
  return {
    id: `cert-exam-${Date.now()}`,
    certificationName,
    duration: 90,
    totalQuestions: 50,
    passingScore: 85,
    questions: [], // Would be populated from LLM response
  };
}

/**
 * Provide real-time learning assistance
 */
export async function provideLearningAssistance(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<string> {
  logger.info(`[Athena] Providing learning assistance`);
  
  const messages = [
    {
      role: 'system',
      content: `You are Professor Athena, an AI educator helping students learn the Trancendos platform.

Your teaching style:
- Patient and encouraging
- Use analogies and examples
- Break down complex concepts
- Ask guiding questions
- Provide code examples when relevant
- Celebrate progress and effort

Always be supportive and make learning enjoyable!`,
    },
    ...conversationHistory,
    {
      role: 'user',
      content: userMessage,
    },
  ];
  
  const response = await invokeLLM({ messages });
  const content = response.choices[0].message.content;
  return typeof content === 'string' ? content : JSON.stringify(content);
}

/**
 * Track learning progress
 */
export async function trackProgress(userId: number, event: {
  type: 'course_started' | 'course_completed' | 'module_completed' | 'quiz_passed' | 'quiz_failed' | 'badge_earned' | 'certification_earned';
  courseId?: number;
  moduleId?: number;
  quizId?: string;
  score?: number;
  badgeId?: string;
  certificationId?: string;
}): Promise<void> {
  logger.info(`[Athena] Tracking progress for user ${userId}: ${event.type}`);
  
  // TODO: Store in database
  // This would update the user's learning profile, award points, badges, etc.
  
  // Generate encouraging message
  let message = '';
  switch (event.type) {
    case 'course_started':
      message = 'Great start! I\'m excited to guide you through this course.';
      break;
    case 'course_completed':
      message = 'Congratulations on completing the course! You\'ve made excellent progress.';
      break;
    case 'module_completed':
      message = 'Well done on completing this module! Keep up the great work.';
      break;
    case 'quiz_passed':
      message = `Excellent work! You scored ${event.score}% on the quiz.`;
      break;
    case 'quiz_failed':
      message = `Don't worry! Learning takes time. Review the material and try again.`;
      break;
    case 'badge_earned':
      message = 'Congratulations on earning a new badge! 🏆';
      break;
    case 'certification_earned':
      message = 'Amazing! You\'ve earned your certification! This is a significant achievement.';
      break;
  }
  
  logger.info(`[Athena] ${message}`);
}
