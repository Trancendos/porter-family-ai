import { invokeLLM } from "../_core/llm";
import { executeTask } from "./mlOrchestration";

/**
 * Auto-Generation System
 * 
 * Generates production-ready artifacts:
 * - Code templates
 * - Database schemas
 * - CI/CD pipelines
 * - Workflows and automations
 * - API specifications
 * - Documentation
 */

export interface GenerationRequest {
  type: "template" | "schema" | "pipeline" | "workflow" | "api" | "documentation";
  description: string;
  requirements: string[];
  context?: any;
  basedonEntities?: number[]; // Knowledge entity IDs
}

export interface GeneratedArtifact {
  name: string;
  type: string;
  content: string;
  language?: string;
  metadata: any;
  confidence: number;
  usageInstructions: string;
}

/**
 * Generate code template
 */
export async function generateCodeTemplate(request: {
  description: string;
  language: string;
  framework?: string;
  features: string[];
}): Promise<GeneratedArtifact> {
  const systemPrompt = `You are an expert software engineer. Generate production-ready, well-documented code templates following best practices and design patterns.`;

  const userPrompt = `Generate a ${request.language} ${request.framework ? `${request.framework} ` : ''}code template for: ${request.description}

Features to include:
${request.features.map(f => `- ${f}`).join('\n')}

Requirements:
- Follow ${request.language} best practices
- Include comprehensive comments
- Add error handling
- Make it extensible and maintainable
- Include usage examples

Return the complete code template.`;

  const response = await executeTask(
    userPrompt,
    { taskType: "code_generation", priority: "high" },
    systemPrompt
  );

  return {
    name: `${request.description.replace(/\s+/g, '_').toLowerCase()}_template`,
    type: "code",
    content: response.content,
    language: request.language,
    metadata: {
      framework: request.framework,
      features: request.features,
      generatedBy: response.modelUsed,
    },
    confidence: 0.85,
    usageInstructions: `1. Review the generated code\n2. Customize parameters and configuration\n3. Add your business logic\n4. Test thoroughly before deployment`,
  };
}

/**
 * Generate database schema
 */
export async function generateDatabaseSchema(request: {
  description: string;
  entities: string[];
  relationships: string[];
  dbType: "mysql" | "postgresql" | "mongodb";
}): Promise<GeneratedArtifact> {
  const systemPrompt = `You are a database architect. Generate optimized, normalized database schemas with proper indexing and constraints.`;

  const userPrompt = `Generate a ${request.dbType} database schema for: ${request.description}

Entities:
${request.entities.map(e => `- ${e}`).join('\n')}

Relationships:
${request.relationships.map(r => `- ${r}`).join('\n')}

Requirements:
- Proper normalization (3NF minimum)
- Appropriate data types
- Primary and foreign keys
- Indexes for performance
- Constraints for data integrity
- Comments explaining design decisions

Return the complete schema definition.`;

  const response = await executeTask(
    userPrompt,
    { taskType: "generation", priority: "high" },
    systemPrompt
  );

  return {
    name: `${request.description.replace(/\s+/g, '_').toLowerCase()}_schema`,
    type: "database_schema",
    content: response.content,
    language: request.dbType === "mongodb" ? "javascript" : "sql",
    metadata: {
      dbType: request.dbType,
      entities: request.entities,
      relationships: request.relationships,
      generatedBy: response.modelUsed,
    },
    confidence: 0.88,
    usageInstructions: `1. Review the schema design\n2. Adjust data types if needed\n3. Run migrations in a test environment\n4. Verify constraints and indexes\n5. Deploy to production`,
  };
}

/**
 * Generate CI/CD pipeline
 */
export async function generateCICDPipeline(request: {
  description: string;
  platform: "github_actions" | "gitlab_ci" | "jenkins" | "azure_devops";
  language: string;
  stages: string[];
  deploymentTarget?: string;
}): Promise<GeneratedArtifact> {
  const systemPrompt = `You are a DevOps engineer. Generate robust CI/CD pipelines with best practices for testing, security, and deployment.`;

  const userPrompt = `Generate a ${request.platform} pipeline for: ${request.description}

Language/Framework: ${request.language}
${request.deploymentTarget ? `Deployment Target: ${request.deploymentTarget}` : ''}

Pipeline Stages:
${request.stages.map(s => `- ${s}`).join('\n')}

Requirements:
- Automated testing
- Code quality checks
- Security scanning
- Build optimization
- Deployment automation
- Rollback capability
- Notifications on failure

Return the complete pipeline configuration.`;

  const response = await executeTask(
    userPrompt,
    { taskType: "generation", priority: "high" },
    systemPrompt
  );

  const fileExtensions: Record<string, string> = {
    github_actions: "yml",
    gitlab_ci: "yml",
    jenkins: "groovy",
    azure_devops: "yml",
  };

  return {
    name: `${request.description.replace(/\s+/g, '_').toLowerCase()}_pipeline`,
    type: "ci_cd_pipeline",
    content: response.content,
    language: fileExtensions[request.platform],
    metadata: {
      platform: request.platform,
      stages: request.stages,
      deploymentTarget: request.deploymentTarget,
      generatedBy: response.modelUsed,
    },
    confidence: 0.82,
    usageInstructions: `1. Review pipeline stages\n2. Configure secrets and environment variables\n3. Test in a separate branch\n4. Monitor first few runs\n5. Adjust timeouts and resources as needed`,
  };
}

/**
 * Generate workflow automation
 */
export async function generateWorkflow(request: {
  description: string;
  trigger: string;
  steps: string[];
  integrations: string[];
}): Promise<GeneratedArtifact> {
  const systemPrompt = `You are an automation expert. Generate efficient, reliable workflow automations with proper error handling and logging.`;

  const userPrompt = `Generate a workflow automation for: ${request.description}

Trigger: ${request.trigger}

Steps:
${request.steps.map(s => `- ${s}`).join('\n')}

Integrations:
${request.integrations.map(i => `- ${i}`).join('\n')}

Requirements:
- Clear step definitions
- Error handling and retries
- Logging and monitoring
- Conditional logic
- Parallel execution where possible
- Timeout handling

Return the complete workflow definition (JSON or YAML format).`;

  const response = await executeTask(
    userPrompt,
    { taskType: "generation", priority: "high" },
    systemPrompt
  );

  return {
    name: `${request.description.replace(/\s+/g, '_').toLowerCase()}_workflow`,
    type: "workflow",
    content: response.content,
    language: "yaml",
    metadata: {
      trigger: request.trigger,
      steps: request.steps,
      integrations: request.integrations,
      generatedBy: response.modelUsed,
    },
    confidence: 0.80,
    usageInstructions: `1. Review workflow logic\n2. Configure integration credentials\n3. Test with sample data\n4. Set up monitoring and alerts\n5. Deploy and monitor execution`,
  };
}

/**
 * Generate API specification
 */
export async function generateAPISpec(request: {
  description: string;
  endpoints: Array<{ method: string; path: string; description: string }>;
  authentication: string;
  format: "openapi" | "graphql";
}): Promise<GeneratedArtifact> {
  const systemPrompt = `You are an API architect. Generate complete, well-documented API specifications following industry standards.`;

  const userPrompt = `Generate a ${request.format} API specification for: ${request.description}

Authentication: ${request.authentication}

Endpoints:
${request.endpoints.map(e => `- ${e.method} ${e.path}: ${e.description}`).join('\n')}

Requirements:
- Complete request/response schemas
- Error responses
- Authentication details
- Rate limiting
- Versioning strategy
- Examples for each endpoint
- Comprehensive documentation

Return the complete API specification.`;

  const response = await executeTask(
    userPrompt,
    { taskType: "generation", priority: "high" },
    systemPrompt
  );

  return {
    name: `${request.description.replace(/\s+/g, '_').toLowerCase()}_api_spec`,
    type: "api_specification",
    content: response.content,
    language: request.format === "openapi" ? "yaml" : "graphql",
    metadata: {
      format: request.format,
      authentication: request.authentication,
      endpointCount: request.endpoints.length,
      generatedBy: response.modelUsed,
    },
    confidence: 0.87,
    usageInstructions: `1. Review API design\n2. Validate with API tools (Swagger/GraphQL Playground)\n3. Implement server-side handlers\n4. Generate client SDKs\n5. Publish documentation`,
  };
}

/**
 * Generate documentation
 */
export async function generateDocumentation(request: {
  subject: string;
  type: "user_guide" | "api_docs" | "technical_spec" | "tutorial";
  sections: string[];
  audience: string;
}): Promise<GeneratedArtifact> {
  const systemPrompt = `You are a technical writer. Generate clear, comprehensive documentation that helps users understand and use the system effectively.`;

  const userPrompt = `Generate ${request.type} documentation for: ${request.subject}

Target Audience: ${request.audience}

Sections to include:
${request.sections.map(s => `- ${s}`).join('\n')}

Requirements:
- Clear, concise language
- Logical structure
- Code examples where applicable
- Visual aids descriptions
- Troubleshooting section
- FAQs
- Markdown format

Return the complete documentation.`;

  const response = await executeTask(
    userPrompt,
    { taskType: "generation", priority: "high" },
    systemPrompt
  );

  return {
    name: `${request.subject.replace(/\s+/g, '_').toLowerCase()}_${request.type}`,
    type: "documentation",
    content: response.content,
    language: "markdown",
    metadata: {
      docType: request.type,
      audience: request.audience,
      sections: request.sections,
      generatedBy: response.modelUsed,
    },
    confidence: 0.90,
    usageInstructions: `1. Review content for accuracy\n2. Add screenshots/diagrams\n3. Test all code examples\n4. Get feedback from target audience\n5. Publish and maintain`,
  };
}

/**
 * Generate test suite
 */
export async function generateTestSuite(request: {
  codeToTest: string;
  language: string;
  testFramework: string;
  coverageTarget: number;
}): Promise<GeneratedArtifact> {
  const systemPrompt = `You are a QA engineer. Generate comprehensive test suites with good coverage, edge cases, and clear assertions.`;

  const userPrompt = `Generate a ${request.testFramework} test suite for this ${request.language} code:

\`\`\`${request.language}
${request.codeToTest}
\`\`\`

Requirements:
- Target ${request.coverageTarget}% code coverage
- Unit tests for all functions
- Edge cases and error conditions
- Integration tests where applicable
- Clear test descriptions
- Setup and teardown
- Mock external dependencies

Return the complete test suite.`;

  const response = await executeTask(
    userPrompt,
    { taskType: "code_generation", priority: "high" },
    systemPrompt
  );

  return {
    name: `test_suite`,
    type: "test_code",
    content: response.content,
    language: request.language,
    metadata: {
      testFramework: request.testFramework,
      coverageTarget: request.coverageTarget,
      generatedBy: response.modelUsed,
    },
    confidence: 0.83,
    usageInstructions: `1. Review test cases\n2. Add missing edge cases\n3. Run tests and verify coverage\n4. Integrate into CI/CD\n5. Maintain as code evolves`,
  };
}

/**
 * Generate configuration file
 */
export async function generateConfig(request: {
  application: string;
  environment: "development" | "staging" | "production";
  settings: Array<{ key: string; description: string }>;
  format: "json" | "yaml" | "env";
}): Promise<GeneratedArtifact> {
  const systemPrompt = `You are a system administrator. Generate secure, well-documented configuration files with sensible defaults.`;

  const userPrompt = `Generate a ${request.format} configuration file for: ${request.application}

Environment: ${request.environment}

Settings:
${request.settings.map(s => `- ${s.key}: ${s.description}`).join('\n')}

Requirements:
- Sensible defaults for ${request.environment}
- Security best practices
- Comments explaining each setting
- Environment-specific values
- Validation rules

Return the complete configuration file.`;

  const response = await executeTask(
    userPrompt,
    { taskType: "generation", priority: "high" },
    systemPrompt
  );

  return {
    name: `config.${request.environment}.${request.format}`,
    type: "configuration",
    content: response.content,
    language: request.format,
    metadata: {
      application: request.application,
      environment: request.environment,
      settingCount: request.settings.length,
      generatedBy: response.modelUsed,
    },
    confidence: 0.85,
    usageInstructions: `1. Review all settings\n2. Replace placeholder values\n3. Secure sensitive data\n4. Validate configuration\n5. Deploy to ${request.environment}`,
  };
}

/**
 * Improve existing code
 */
export async function improveCode(request: {
  code: string;
  language: string;
  improvements: string[];
}): Promise<GeneratedArtifact> {
  const systemPrompt = `You are a senior software engineer. Refactor code to improve quality, performance, and maintainability while preserving functionality.`;

  const userPrompt = `Improve this ${request.language} code:

\`\`\`${request.language}
${request.code}
\`\`\`

Improvements to apply:
${request.improvements.map(i => `- ${i}`).join('\n')}

Requirements:
- Maintain existing functionality
- Improve code quality
- Add comments where helpful
- Follow best practices
- Optimize performance
- Enhance readability

Return the improved code with explanation of changes.`;

  const response = await executeTask(
    userPrompt,
    { taskType: "code_generation", priority: "high" },
    systemPrompt
  );

  return {
    name: `improved_code`,
    type: "code",
    content: response.content,
    language: request.language,
    metadata: {
      improvements: request.improvements,
      generatedBy: response.modelUsed,
    },
    confidence: 0.88,
    usageInstructions: `1. Compare with original code\n2. Review all changes\n3. Run existing tests\n4. Test edge cases\n5. Deploy with monitoring`,
  };
}

/**
 * Generate from knowledge entities
 */
export async function generateFromKnowledge(
  entities: Array<{ name: string; description: string; content: string }>,
  request: GenerationRequest
): Promise<GeneratedArtifact> {
  const knowledgeContext = entities.map(e => 
    `Knowledge: ${e.name}\n${e.description}\n${e.content}`
  ).join('\n\n---\n\n');

  const systemPrompt = `You are an AI system that learns from accumulated knowledge. Use the provided knowledge entities to generate high-quality artifacts.`;

  const userPrompt = `Using the following knowledge base:

${knowledgeContext}

Generate a ${request.type} for: ${request.description}

Requirements:
${request.requirements.map(r => `- ${r}`).join('\n')}

Apply relevant patterns, techniques, and best practices from the knowledge base.`;

  const response = await executeTask(
    userPrompt,
    { taskType: "generation", priority: "high" },
    systemPrompt
  );

  return {
    name: `knowledge_based_${request.type}`,
    type: request.type,
    content: response.content,
    metadata: {
      basedOnEntities: request.basedonEntities || [],
      entityCount: entities.length,
      generatedBy: response.modelUsed,
    },
    confidence: 0.92, // Higher confidence when based on learned knowledge
    usageInstructions: `This artifact was generated using learned knowledge from the platform. Review and customize as needed.`,
  };
}
