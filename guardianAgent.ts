import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { errorLogs } from "../../drizzle/schema";
import { broadcastNotification } from "./messageBus";

export interface SecurityVulnerability {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  recommendation: string;
  location?: string;
}

export interface SecurityAuditResult {
  vulnerabilities: SecurityVulnerability[];
  score: number; // 1-10
  summary: string;
}

export interface ComplianceCheckResult {
  compliant: boolean;
  issues: string[];
  recommendations: string[];
  regulations: string[]; // e.g., ["GDPR", "CCPA", "OWASP"]
}

/**
 * The Guardian - AI Security and Compliance Officer
 * Responsible for Gate 9: Security Deep Dive
 */
export class GuardianAgent {
  private static readonly AGENT_NAME = "the_guardian";

  /**
   * Perform comprehensive security audit on code
   */
  static async auditCode(code: string): Promise<SecurityAuditResult> {
    console.log("[Guardian] Starting security audit...");

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are The Guardian, an expert security officer. Analyze code for vulnerabilities including:
- SQL injection
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- Authentication/Authorization flaws
- Insecure data storage
- Weak cryptography
- Hardcoded secrets
- Insecure dependencies
- Input validation issues
- Output encoding problems

Provide a security score from 1-10 (10 being most secure).`,
        },
        {
          role: "user",
          content: `Audit this code:\n\n${code.slice(0, 10000)}`, // Limit to 10k chars
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "security_audit",
          strict: true,
          schema: {
            type: "object",
            properties: {
              vulnerabilities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                    description: { type: "string" },
                    recommendation: { type: "string" },
                  },
                  required: ["type", "severity", "description", "recommendation"],
                  additionalProperties: false,
                },
              },
              score: { type: "integer", minimum: 1, maximum: 10 },
              summary: { type: "string" },
            },
            required: ["vulnerabilities", "score", "summary"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;


    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    const result = JSON.parse(typeof content === 'string' ? content : '{}');

    // Broadcast audit completion
    broadcastNotification(this.AGENT_NAME, {
      event: "security_audit_completed",
      score: result.score,
      vulnerabilityCount: result.vulnerabilities.length,
      criticalCount: result.vulnerabilities.filter((v: any) => v.severity === "critical").length,
    });

    console.log(`[Guardian] Security audit complete. Score: ${result.score}/10, Vulnerabilities: ${result.vulnerabilities.length}`);

    return result;
  }

  /**
   * Check GDPR compliance
   */
  static async checkGDPRCompliance(features: string[]): Promise<ComplianceCheckResult> {
    console.log("[Guardian] Checking GDPR compliance...");

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are The Guardian, a compliance expert. Check if these features comply with GDPR regulations. Consider:
- Right to access
- Right to erasure (right to be forgotten)
- Data portability
- Consent management
- Data minimization
- Purpose limitation
- Storage limitation
- Data protection by design and default
- Security of processing
- Breach notification`,
        },
        {
          role: "user",
          content: `Features: ${features.join(", ")}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "gdpr_check",
          strict: true,
          schema: {
            type: "object",
            properties: {
              compliant: { type: "boolean" },
              issues: { type: "array", items: { type: "string" } },
              recommendations: { type: "array", items: { type: "string" } },
            },
            required: ["compliant", "issues", "recommendations"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;


    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    const result = JSON.parse(typeof content === 'string' ? content : '{}');

    console.log(`[Guardian] GDPR compliance check complete. Compliant: ${result.compliant}`);

    return {
      ...result,
      regulations: ["GDPR"],
    };
  }

  /**
   * Check CCPA compliance
   */
  static async checkCCPACompliance(features: string[]): Promise<ComplianceCheckResult> {
    console.log("[Guardian] Checking CCPA compliance...");

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are The Guardian, a compliance expert. Check if these features comply with CCPA regulations. Consider:
- Right to know
- Right to delete
- Right to opt-out of sale
- Right to non-discrimination
- Notice at collection
- Privacy policy requirements`,
        },
        {
          role: "user",
          content: `Features: ${features.join(", ")}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ccpa_check",
          strict: true,
          schema: {
            type: "object",
            properties: {
              compliant: { type: "boolean" },
              issues: { type: "array", items: { type: "string" } },
              recommendations: { type: "array", items: { type: "string" } },
            },
            required: ["compliant", "issues", "recommendations"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;


    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    const result = JSON.parse(typeof content === 'string' ? content : '{}');

    console.log(`[Guardian] CCPA compliance check complete. Compliant: ${result.compliant}`);

    return {
      ...result,
      regulations: ["CCPA"],
    };
  }

  /**
   * Check OWASP Top 10 compliance
   */
  static async checkOWASPCompliance(code: string): Promise<ComplianceCheckResult> {
    console.log("[Guardian] Checking OWASP Top 10 compliance...");

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are The Guardian, a security expert. Check if this code complies with OWASP Top 10 security standards:
1. Broken Access Control
2. Cryptographic Failures
3. Injection
4. Insecure Design
5. Security Misconfiguration
6. Vulnerable and Outdated Components
7. Identification and Authentication Failures
8. Software and Data Integrity Failures
9. Security Logging and Monitoring Failures
10. Server-Side Request Forgery (SSRF)`,
        },
        {
          role: "user",
          content: `Code:\n\n${code.slice(0, 10000)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "owasp_check",
          strict: true,
          schema: {
            type: "object",
            properties: {
              compliant: { type: "boolean" },
              issues: { type: "array", items: { type: "string" } },
              recommendations: { type: "array", items: { type: "string" } },
            },
            required: ["compliant", "issues", "recommendations"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;


    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    const result = JSON.parse(typeof content === 'string' ? content : '{}');

    console.log(`[Guardian] OWASP compliance check complete. Compliant: ${result.compliant}`);

    return {
      ...result,
      regulations: ["OWASP Top 10"],
    };
  }

  /**
   * Comprehensive security and compliance check
   */
  static async comprehensiveCheck(code: string, features: string[]): Promise<{
    security: SecurityAuditResult;
    gdpr: ComplianceCheckResult;
    ccpa: ComplianceCheckResult;
    owasp: ComplianceCheckResult;
    overallScore: number;
  }> {
    console.log("[Guardian] Starting comprehensive security and compliance check...");

    const [security, gdpr, ccpa, owasp] = await Promise.all([
      this.auditCode(code),
      this.checkGDPRCompliance(features),
      this.checkCCPACompliance(features),
      this.checkOWASPCompliance(code),
    ]);

    // Calculate overall score (weighted average)
    const overallScore = Math.round(
      (security.score * 0.4 + 
       (gdpr.compliant ? 10 : 5) * 0.2 + 
       (ccpa.compliant ? 10 : 5) * 0.2 + 
       (owasp.compliant ? 10 : 5) * 0.2)
    );

    broadcastNotification(this.AGENT_NAME, {
      event: "comprehensive_check_completed",
      overallScore,
      securityScore: security.score,
      gdprCompliant: gdpr.compliant,
      ccpaCompliant: ccpa.compliant,
      owaspCompliant: owasp.compliant,
    });

    console.log(`[Guardian] Comprehensive check complete. Overall score: ${overallScore}/10`);

    return {
      security,
      gdpr,
      ccpa,
      owasp,
      overallScore,
    };
  }
}
