import { invokeLLM } from "../_core/llm";
import { executeTask } from "./mlOrchestration";

/**
 * Governance & Compliance Validation System
 * 
 * Ensures all AI decisions and generated artifacts comply with:
 * - Regulatory frameworks (GDPR, HIPAA, SOC2, etc.)
 * - Security standards (OWASP, CWE, etc.)
 * - Quality standards (ISO, IEEE, etc.)
 * - Ethical AI principles
 * - Internal policies
 */

export interface ComplianceRule {
  id: string;
  name: string;
  framework: string;
  ruleType: "security" | "privacy" | "regulatory" | "quality" | "ethical";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  validationLogic: string;
}

export interface ValidationResult {
  ruleId: string;
  ruleName: string;
  result: "pass" | "fail" | "warning" | "not_applicable";
  findings: string[];
  remediation?: string;
  confidence: number;
}

export interface ComplianceReport {
  targetType: string;
  targetId: string;
  timestamp: Date;
  overallStatus: "compliant" | "non_compliant" | "partial";
  results: ValidationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

/**
 * GDPR Compliance Rules
 */
const GDPR_RULES: ComplianceRule[] = [
  {
    id: "gdpr_data_minimization",
    name: "Data Minimization",
    framework: "GDPR",
    ruleType: "privacy",
    severity: "high",
    description: "Only collect and process data that is necessary for the specified purpose",
    validationLogic: "Check if data collection is justified and minimal",
  },
  {
    id: "gdpr_consent",
    name: "User Consent",
    framework: "GDPR",
    ruleType: "privacy",
    severity: "critical",
    description: "Obtain explicit consent before processing personal data",
    validationLogic: "Verify consent mechanism exists",
  },
  {
    id: "gdpr_right_to_erasure",
    name: "Right to Erasure",
    framework: "GDPR",
    ruleType: "privacy",
    severity: "high",
    description: "Provide mechanism for users to delete their data",
    validationLogic: "Check for data deletion functionality",
  },
  {
    id: "gdpr_data_portability",
    name: "Data Portability",
    framework: "GDPR",
    ruleType: "privacy",
    severity: "medium",
    description: "Allow users to export their data in machine-readable format",
    validationLogic: "Verify data export functionality",
  },
];

/**
 * Security Compliance Rules (OWASP Top 10)
 */
const SECURITY_RULES: ComplianceRule[] = [
  {
    id: "sec_injection",
    name: "Injection Prevention",
    framework: "OWASP",
    ruleType: "security",
    severity: "critical",
    description: "Prevent SQL, NoSQL, OS, and LDAP injection attacks",
    validationLogic: "Check for parameterized queries and input validation",
  },
  {
    id: "sec_broken_auth",
    name: "Authentication Security",
    framework: "OWASP",
    ruleType: "security",
    severity: "critical",
    description: "Implement secure authentication and session management",
    validationLogic: "Verify strong authentication mechanisms",
  },
  {
    id: "sec_sensitive_data",
    name: "Sensitive Data Protection",
    framework: "OWASP",
    ruleType: "security",
    severity: "high",
    description: "Encrypt sensitive data at rest and in transit",
    validationLogic: "Check for encryption and secure storage",
  },
  {
    id: "sec_xxe",
    name: "XXE Prevention",
    framework: "OWASP",
    ruleType: "security",
    severity: "high",
    description: "Prevent XML External Entity attacks",
    validationLogic: "Check XML parser configuration",
  },
  {
    id: "sec_access_control",
    name: "Access Control",
    framework: "OWASP",
    ruleType: "security",
    severity: "critical",
    description: "Implement proper authorization checks",
    validationLogic: "Verify access control mechanisms",
  },
];

/**
 * Ethical AI Rules
 */
const ETHICAL_AI_RULES: ComplianceRule[] = [
  {
    id: "ai_fairness",
    name: "Fairness and Non-Discrimination",
    framework: "Ethical AI",
    ruleType: "ethical",
    severity: "high",
    description: "AI decisions must not discriminate based on protected characteristics",
    validationLogic: "Check for bias in training data and model outputs",
  },
  {
    id: "ai_transparency",
    name: "Transparency and Explainability",
    framework: "Ethical AI",
    ruleType: "ethical",
    severity: "medium",
    description: "AI decisions must be explainable to users",
    validationLogic: "Verify explanation mechanism exists",
  },
  {
    id: "ai_accountability",
    name: "Accountability",
    framework: "Ethical AI",
    ruleType: "ethical",
    severity: "high",
    description: "Clear responsibility for AI decisions",
    validationLogic: "Check for audit logging and human oversight",
  },
  {
    id: "ai_privacy",
    name: "Privacy by Design",
    framework: "Ethical AI",
    ruleType: "ethical",
    severity: "high",
    description: "Privacy considerations integrated from the start",
    validationLogic: "Verify privacy-preserving techniques",
  },
];

/**
 * Validate code against security rules
 */
export async function validateCodeSecurity(code: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const rule of SECURITY_RULES) {
    try {
      const response = await executeTask(
        `Analyze this code for compliance with: ${rule.name} (${rule.description})

Code:
\`\`\`
${code}
\`\`\`

Return JSON with: result (pass/fail/warning), findings (array of issues), remediation (suggested fix).`,
        { taskType: "analysis", priority: "high" },
        "You are a security expert. Analyze code for security vulnerabilities and compliance issues."
      );

      const analysis = JSON.parse(response.content);

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        result: analysis.result,
        findings: analysis.findings || [],
        remediation: analysis.remediation,
        confidence: 0.85,
      });
    } catch (error) {
      console.error(`Failed to validate rule ${rule.id}:`, error);
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        result: "not_applicable",
        findings: ["Validation failed"],
        confidence: 0,
      });
    }
  }

  return results;
}

/**
 * Validate data handling against GDPR
 */
export async function validateGDPRCompliance(
  dataHandlingDescription: string
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const rule of GDPR_RULES) {
    try {
      const response = await executeTask(
        `Analyze this data handling practice for GDPR compliance with: ${rule.name}

Description:
${dataHandlingDescription}

Rule: ${rule.description}

Return JSON with: result (pass/fail/warning), findings (array of issues), remediation (suggested fix).`,
        { taskType: "analysis", priority: "high" },
        "You are a GDPR compliance expert. Analyze data practices for regulatory compliance."
      );

      const analysis = JSON.parse(response.content);

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        result: analysis.result,
        findings: analysis.findings || [],
        remediation: analysis.remediation,
        confidence: 0.88,
      });
    } catch (error) {
      console.error(`Failed to validate rule ${rule.id}:`, error);
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        result: "not_applicable",
        findings: ["Validation failed"],
        confidence: 0,
      });
    }
  }

  return results;
}

/**
 * Validate AI decision for ethical compliance
 */
export async function validateEthicalAI(decision: {
  description: string;
  inputData: any;
  outputData: any;
  reasoning: string;
}): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const rule of ETHICAL_AI_RULES) {
    try {
      const response = await executeTask(
        `Analyze this AI decision for ethical compliance with: ${rule.name}

Decision: ${decision.description}
Input: ${JSON.stringify(decision.inputData)}
Output: ${JSON.stringify(decision.outputData)}
Reasoning: ${decision.reasoning}

Rule: ${rule.description}

Return JSON with: result (pass/fail/warning), findings (array of issues), remediation (suggested improvement).`,
        { taskType: "analysis", priority: "high" },
        "You are an AI ethics expert. Analyze AI decisions for ethical compliance and fairness."
      );

      const analysis = JSON.parse(response.content);

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        result: analysis.result,
        findings: analysis.findings || [],
        remediation: analysis.remediation,
        confidence: 0.82,
      });
    } catch (error) {
      console.error(`Failed to validate rule ${rule.id}:`, error);
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        result: "not_applicable",
        findings: ["Validation failed"],
        confidence: 0,
      });
    }
  }

  return results;
}

/**
 * Detect bias in data or model
 */
export async function detectBias(data: {
  type: "training_data" | "model_output";
  content: any;
  protectedAttributes: string[];
}): Promise<{
  hasBias: boolean;
  biasScore: number;
  findings: string[];
  recommendations: string[];
}> {
  try {
    const response = await executeTask(
      `Analyze this ${data.type} for bias related to protected attributes: ${data.protectedAttributes.join(', ')}

Data:
${JSON.stringify(data.content, null, 2)}

Return JSON with: hasBias (boolean), biasScore (0-1), findings (array), recommendations (array).`,
      { taskType: "analysis", priority: "high" },
      "You are a fairness and bias detection expert. Identify potential discrimination or unfair treatment."
    );

    return JSON.parse(response.content);
  } catch (error) {
    console.error("Failed to detect bias:", error);
    return {
      hasBias: false,
      biasScore: 0,
      findings: ["Bias detection failed"],
      recommendations: [],
    };
  }
}

/**
 * Generate compliance report
 */
export async function generateComplianceReport(
  targetType: string,
  targetId: string,
  validationResults: ValidationResult[]
): Promise<ComplianceReport> {
  const summary = {
    total: validationResults.length,
    passed: validationResults.filter(r => r.result === "pass").length,
    failed: validationResults.filter(r => r.result === "fail").length,
    warnings: validationResults.filter(r => r.result === "warning").length,
  };

  const overallStatus: "compliant" | "non_compliant" | "partial" =
    summary.failed === 0 && summary.warnings === 0
      ? "compliant"
      : summary.failed > 0
      ? "non_compliant"
      : "partial";

  return {
    targetType,
    targetId,
    timestamp: new Date(),
    overallStatus,
    results: validationResults,
    summary,
  };
}

/**
 * Validate generated artifact
 */
export async function validateGeneratedArtifact(artifact: {
  type: string;
  content: string;
  metadata: any;
}): Promise<ComplianceReport> {
  const results: ValidationResult[] = [];

  // Security validation for code artifacts
  if (artifact.type === "code" || artifact.type === "template") {
    const securityResults = await validateCodeSecurity(artifact.content);
    results.push(...securityResults);
  }

  // Quality checks
  const qualityResult = await validateQuality(artifact);
  results.push(qualityResult);

  // Ethical AI check if AI-generated
  if (artifact.metadata.generatedBy) {
    const ethicalResults = await validateEthicalAI({
      description: `Generated ${artifact.type}`,
      inputData: artifact.metadata,
      outputData: { content: artifact.content },
      reasoning: "AI-generated artifact",
    });
    results.push(...ethicalResults);
  }

  return generateComplianceReport(artifact.type, artifact.metadata.id || "unknown", results);
}

/**
 * Validate quality standards
 */
async function validateQuality(artifact: {
  type: string;
  content: string;
}): Promise<ValidationResult> {
  try {
    const response = await executeTask(
      `Evaluate the quality of this ${artifact.type}:

${artifact.content}

Check for:
- Completeness
- Correctness
- Clarity
- Best practices
- Maintainability

Return JSON with: result (pass/fail/warning), findings (array), remediation.`,
      { taskType: "analysis", priority: "medium" },
      "You are a quality assurance expert. Evaluate artifacts for quality standards."
    );

    const analysis = JSON.parse(response.content);

    return {
      ruleId: "quality_standards",
      ruleName: "Quality Standards",
      result: analysis.result,
      findings: analysis.findings || [],
      remediation: analysis.remediation,
      confidence: 0.80,
    };
  } catch (error) {
    return {
      ruleId: "quality_standards",
      ruleName: "Quality Standards",
      result: "not_applicable",
      findings: ["Quality validation failed"],
      confidence: 0,
    };
  }
}

/**
 * Audit AI decision
 */
export async function auditAIDecision(decision: {
  decisionType: string;
  inputData: any;
  outputData: any;
  modelUsed: string;
  reasoning: string;
  alternatives?: any[];
}): Promise<{
  isAuditable: boolean;
  explainability: number; // 0-1
  transparency: number; // 0-1
  accountability: number; // 0-1;
  issues: string[];
  recommendations: string[];
}> {
  try {
    const response = await executeTask(
      `Audit this AI decision for governance compliance:

Decision Type: ${decision.decisionType}
Model: ${decision.modelUsed}
Input: ${JSON.stringify(decision.inputData)}
Output: ${JSON.stringify(decision.outputData)}
Reasoning: ${decision.reasoning}
${decision.alternatives ? `Alternatives Considered: ${JSON.stringify(decision.alternatives)}` : ''}

Evaluate:
- Explainability: Can the decision be explained to users?
- Transparency: Is the process clear and documented?
- Accountability: Is there clear responsibility?

Return JSON with: isAuditable, explainability (0-1), transparency (0-1), accountability (0-1), issues (array), recommendations (array).`,
      { taskType: "analysis", priority: "high" },
      "You are an AI governance auditor. Evaluate AI decisions for compliance and accountability."
    );

    return JSON.parse(response.content);
  } catch (error) {
    console.error("Failed to audit AI decision:", error);
    return {
      isAuditable: false,
      explainability: 0,
      transparency: 0,
      accountability: 0,
      issues: ["Audit failed"],
      recommendations: [],
    };
  }
}

/**
 * Get all compliance rules
 */
export function getAllComplianceRules(): ComplianceRule[] {
  return [...GDPR_RULES, ...SECURITY_RULES, ...ETHICAL_AI_RULES];
}

/**
 * Get rules by framework
 */
export function getRulesByFramework(framework: string): ComplianceRule[] {
  return getAllComplianceRules().filter(rule => rule.framework === framework);
}

/**
 * Get rules by severity
 */
export function getRulesBySeverity(severity: string): ComplianceRule[] {
  return getAllComplianceRules().filter(rule => rule.severity === severity);
}
