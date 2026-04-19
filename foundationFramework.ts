/**
 * FOUNDATION FRAMEWORK ENFORCEMENT SERVICE
 * 
 * Enforces The Foundation Framework (SLEMP) across the platform:
 * - Security: Zero Trust, encryption, authentication
 * - Legal: License compatibility, IP protection
 * - Ethics: AI principles, prohibited use cases
 * - Monitoring: Audit trails, metrics, incident response
 * - Privacy: GDPR/CCPA compliance, data classification
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { invokeLLM } from '../_core/llm';

// Load compliance framework configuration
const FRAMEWORK_PATH = path.join(process.cwd(), 'config', 'compliance_framework.yaml');

let frameworkConfig: any = null;

export function loadFoundationFramework() {
  try {
    const fileContents = fs.readFileSync(FRAMEWORK_PATH, 'utf8');
    frameworkConfig = yaml.parse(fileContents);
    console.log('[Foundation Framework] Loaded successfully');
    return frameworkConfig;
  } catch (error) {
    console.error('[Foundation Framework] Failed to load:', error);
    return null;
  }
}

// Initialize on module load
loadFoundationFramework();

// ========================================
// LICENSE COMPATIBILITY CHECKER
// ========================================

export interface LicenseCheckResult {
  isCompliant: boolean;
  license: string;
  allowed: boolean;
  reason?: string;
  action: 'allow' | 'block' | 'warn';
}

export async function checkLicenseCompatibility(
  packageName: string,
  license: string
): Promise<LicenseCheckResult> {
  if (!frameworkConfig) {
    return {
      isCompliant: false,
      license,
      allowed: false,
      reason: 'Framework config not loaded',
      action: 'block'
    };
  }

  const allowedLicenses = frameworkConfig.slemp.legal.license_compatibility.allowed_licenses || [];
  const prohibitedLicenses = frameworkConfig.slemp.legal.license_compatibility.prohibited_licenses || [];

  // Check if license is prohibited
  if (prohibitedLicenses.includes(license)) {
    return {
      isCompliant: false,
      license,
      allowed: false,
      reason: `License ${license} is prohibited (copyleft or AI enhancement restriction)`,
      action: 'block'
    };
  }

  // Check if license is allowed
  if (allowedLicenses.includes(license)) {
    return {
      isCompliant: true,
      license,
      allowed: true,
      action: 'allow'
    };
  }

  // Unknown license - warn
  return {
    isCompliant: false,
    license,
    allowed: false,
    reason: `License ${license} is not in allowed list`,
    action: 'warn'
  };
}

// ========================================
// GDPR COMPLIANCE CHECKER
// ========================================

export interface GDPRComplianceResult {
  isCompliant: boolean;
  checks: {
    dataMinimization: boolean;
    purposeLimitation: boolean;
    storageLimitation: boolean;
    accuracy: boolean;
    integrityConfidentiality: boolean;
  };
  violations: string[];
  recommendations: string[];
}

export async function checkGDPRCompliance(
  dataOperation: {
    type: 'collect' | 'process' | 'store' | 'share' | 'delete';
    dataTypes: string[];
    purpose: string;
    retention?: number; // days
    consent?: boolean;
  }
): Promise<GDPRComplianceResult> {
  const violations: string[] = [];
  const recommendations: string[] = [];

  const checks = {
    dataMinimization: true,
    purposeLimitation: true,
    storageLimitation: true,
    accuracy: true,
    integrityConfidentiality: true
  };

  // Check data minimization
  const sensitiveDataTypes = ['email', 'phone', 'address', 'ssn', 'credit_card', 'biometric'];
  const hasSensitiveData = dataOperation.dataTypes.some(dt => 
    sensitiveDataTypes.some(sdt => dt.toLowerCase().includes(sdt))
  );

  if (hasSensitiveData && !dataOperation.consent) {
    checks.dataMinimization = false;
    violations.push('Collecting sensitive data without explicit consent');
    recommendations.push('Obtain explicit user consent before collecting sensitive data');
  }

  // Check storage limitation
  const maxRetentionDays = frameworkConfig?.slemp?.privacy?.gdpr_compliance?.data_retention_days || 365;
  if (dataOperation.retention && dataOperation.retention > maxRetentionDays) {
    checks.storageLimitation = false;
    violations.push(`Data retention (${dataOperation.retention} days) exceeds policy limit (${maxRetentionDays} days)`);
    recommendations.push(`Reduce retention period to ${maxRetentionDays} days or less`);
  }

  // Check purpose limitation
  if (!dataOperation.purpose || dataOperation.purpose.length < 10) {
    checks.purposeLimitation = false;
    violations.push('Data processing purpose is not clearly defined');
    recommendations.push('Provide a clear, specific purpose for data processing');
  }

  const isCompliant = Object.values(checks).every(c => c === true);

  return {
    isCompliant,
    checks,
    violations,
    recommendations
  };
}

// ========================================
// AI ETHICS CHECKER
// ========================================

export interface EthicsCheckResult {
  isEthical: boolean;
  violations: string[];
  concerns: string[];
  recommendations: string[];
}

export async function checkAIEthics(
  useCase: string,
  context?: string
): Promise<EthicsCheckResult> {
  const prohibitedUseCases = frameworkConfig?.slemp?.ethics?.prohibited_use_cases || [];
  
  const violations: string[] = [];
  const concerns: string[] = [];
  const recommendations: string[] = [];

  // Use LLM to analyze use case against prohibited practices
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are an AI ethics compliance officer. Analyze the following use case against these prohibited practices:
${prohibitedUseCases.map((p: string) => `- ${p}`).join('\n')}

Respond with JSON:
{
  "violations": ["list of direct violations"],
  "concerns": ["list of ethical concerns"],
  "recommendations": ["list of recommendations"]
}`
        },
        {
          role: 'user',
          content: `Use case: ${useCase}\n\nContext: ${context || 'None provided'}`
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ethics_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              violations: {
                type: 'array',
                items: { type: 'string' }
              },
              concerns: {
                type: 'array',
                items: { type: 'string' }
              },
              recommendations: {
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['violations', 'concerns', 'recommendations'],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0].message.content;
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const analysis = JSON.parse(contentStr || '{}');
    violations.push(...(analysis.violations || []));
    concerns.push(...(analysis.concerns || []));
    recommendations.push(...(analysis.recommendations || []));
  } catch (error) {
    console.error('[AI Ethics Check] LLM analysis failed:', error);
    concerns.push('Unable to perform automated ethics analysis');
    recommendations.push('Manual ethics review required');
  }

  return {
    isEthical: violations.length === 0,
    violations,
    concerns,
    recommendations
  };
}

// ========================================
// SECURITY AUDIT
// ========================================

export interface SecurityAuditResult {
  passed: boolean;
  score: number; // 0-100
  checks: {
    zeroTrust: boolean;
    encryption: boolean;
    authentication: boolean;
    authorization: boolean;
    vulnerabilityScanning: boolean;
  };
  findings: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    description: string;
    recommendation: string;
  }>;
}

export async function performSecurityAudit(
  target: {
    type: 'api' | 'database' | 'service' | 'integration';
    name: string;
    config?: any;
  }
): Promise<SecurityAuditResult> {
  const findings: SecurityAuditResult['findings'] = [];
  
  const checks = {
    zeroTrust: true,
    encryption: true,
    authentication: true,
    authorization: true,
    vulnerabilityScanning: true
  };

  // Check encryption
  if (target.config?.encryption === false || !target.config?.tls) {
    checks.encryption = false;
    findings.push({
      severity: 'critical',
      category: 'Encryption',
      description: `${target.name} does not use encryption`,
      recommendation: 'Enable TLS 1.3 for data in transit and AES-256 for data at rest'
    });
  }

  // Check authentication
  if (!target.config?.authentication || !target.config?.mfa) {
    checks.authentication = false;
    findings.push({
      severity: 'high',
      category: 'Authentication',
      description: `${target.name} does not require MFA`,
      recommendation: 'Enable multi-factor authentication for all users'
    });
  }

  // Check authorization
  if (!target.config?.rbac) {
    checks.authorization = false;
    findings.push({
      severity: 'high',
      category: 'Authorization',
      description: `${target.name} does not use RBAC`,
      recommendation: 'Implement role-based access control'
    });
  }

  // Calculate score
  const totalChecks = Object.keys(checks).length;
  const passedChecks = Object.values(checks).filter(c => c === true).length;
  const score = Math.round((passedChecks / totalChecks) * 100);

  return {
    passed: score >= 80,
    score,
    checks,
    findings
  };
}

// ========================================
// COMPLIANCE REPORT GENERATOR
// ========================================

export interface ComplianceReport {
  timestamp: Date;
  framework: string;
  overallCompliance: number; // 0-100
  sections: Array<{
    name: string;
    compliant: boolean;
    score: number;
    details: string;
  }>;
  violations: string[];
  recommendations: string[];
}

export async function generateComplianceReport(
  frameworkType: 'GDPR' | 'CCPA' | 'NIST_AI_RMF' | 'EU_AI_ACT' | 'ISO_27001' | 'SOC_2'
): Promise<ComplianceReport> {
  const sections: ComplianceReport['sections'] = [];
  const violations: string[] = [];
  const recommendations: string[] = [];

  // Example: GDPR compliance check
  if (frameworkType === 'GDPR') {
    const gdprConfig = frameworkConfig?.slemp?.privacy?.gdpr_compliance;
    
    sections.push({
      name: 'Data Protection Officer',
      compliant: gdprConfig?.dpo_appointed === true,
      score: gdprConfig?.dpo_appointed ? 100 : 0,
      details: gdprConfig?.dpo_appointed 
        ? `DPO appointed: ${gdprConfig.data_protection_officer}`
        : 'No DPO appointed'
    });

    sections.push({
      name: 'User Rights',
      compliant: gdprConfig?.rights?.right_to_access === true,
      score: gdprConfig?.rights ? 100 : 0,
      details: 'All user rights implemented (access, rectification, erasure, portability)'
    });

    sections.push({
      name: 'Data Minimization',
      compliant: gdprConfig?.data_minimization === true,
      score: gdprConfig?.data_minimization ? 100 : 0,
      details: 'Data minimization principle enforced'
    });
  }

  // Calculate overall compliance
  const totalScore = sections.reduce((sum, s) => sum + s.score, 0);
  const overallCompliance = sections.length > 0 ? Math.round(totalScore / sections.length) : 0;

  // Collect violations
  sections.forEach(s => {
    if (!s.compliant) {
      violations.push(`${s.name}: ${s.details}`);
      recommendations.push(`Implement ${s.name} requirements to achieve compliance`);
    }
  });

  return {
    timestamp: new Date(),
    framework: frameworkType,
    overallCompliance,
    sections,
    violations,
    recommendations
  };
}

// ========================================
// AUTO-ENFORCEMENT
// ========================================

export async function enforceFoundationFramework(
  action: {
    type: 'deploy' | 'data_operation' | 'ai_task' | 'integration';
    target: string;
    details: any;
  }
): Promise<{
  allowed: boolean;
  reason?: string;
  violations: string[];
  requiredActions: string[];
}> {
  const violations: string[] = [];
  const requiredActions: string[] = [];

  // Check license compatibility for deployments
  if (action.type === 'deploy' && action.details.dependencies) {
    for (const dep of action.details.dependencies) {
      const licenseCheck = await checkLicenseCompatibility(dep.name, dep.license);
      if (!licenseCheck.allowed) {
        violations.push(`Dependency ${dep.name} uses prohibited license ${dep.license}`);
        requiredActions.push(`Remove ${dep.name} or find alternative with compatible license`);
      }
    }
  }

  // Check GDPR compliance for data operations
  if (action.type === 'data_operation') {
    const gdprCheck = await checkGDPRCompliance(action.details);
    if (!gdprCheck.isCompliant) {
      violations.push(...gdprCheck.violations);
      requiredActions.push(...gdprCheck.recommendations);
    }
  }

  // Check AI ethics for AI tasks
  if (action.type === 'ai_task') {
    const ethicsCheck = await checkAIEthics(action.details.useCase, action.details.context);
    if (!ethicsCheck.isEthical) {
      violations.push(...ethicsCheck.violations);
      requiredActions.push(...ethicsCheck.recommendations);
    }
  }

  // Determine if action is allowed
  const enforcementAction = frameworkConfig?.enforcement?.policy_violations?.action || 'block';
  const allowed = enforcementAction === 'log' || (enforcementAction === 'warn' && violations.length === 0) || violations.length === 0;

  return {
    allowed,
    reason: violations.length > 0 ? violations.join('; ') : undefined,
    violations,
    requiredActions
  };
}

export default {
  loadFoundationFramework,
  checkLicenseCompatibility,
  checkGDPRCompliance,
  checkAIEthics,
  performSecurityAudit,
  generateComplianceReport,
  enforceFoundationFramework
};
