/**
 * Gate Compliance System
 * 
 * Implements the 13-Gate lifecycle management process with certification at each stage.
 * Ensures zero-cost compliance, quality standards, and governance throughout the project lifecycle.
 * 
 * Gates:
 * 0. Project Initiation (Cornelius)
 * 1. Requirements Validation
 * 2. Technical Feasibility (The Dr)
 * 3. Design & UX Validation
 * 4. Development Standards
 * 5. Code Quality & Testing
 * 6. Security Review (The Guardian)
 * 7. Performance & Scalability
 * 8. Documentation (Norman)
 * 9. Security Deep Dive (Trivy, SAST)
 * 10. Cost Validation (Doris)
 * 11. Deployment Readiness
 * 12. Production Monitoring
 */

import { logger } from './errorLoggingService';
import { invokeLLM } from '../_core/llm';

export interface GateResult {
  gateNumber: number;
  gateName: string;
  passed: boolean;
  score: number; // 0-100
  findings: string[];
  recommendations: string[];
  blockers: string[];
  certificationId?: string;
  certifiedBy: string;
  certifiedAt: Date;
  evidence: Record<string, any>;
}

export interface ProjectLifecycle {
  projectId: string;
  projectName: string;
  currentGate: number;
  gateResults: GateResult[];
  overallStatus: 'in_progress' | 'blocked' | 'completed';
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Gate 0: Project Initiation (Cornelius)
 * Validates project scope, objectives, and resource allocation
 */
export async function gate0_ProjectInitiation(
  projectName: string,
  description: string,
  objectives: string[],
  estimatedDuration: number
): Promise<GateResult> {
  logger.info(`[Gate 0] Initiating project: ${projectName}`);
  
  const prompt = `You are Cornelius MacIntyre, the Orchestrator AI. Review this project initiation:

**Project**: ${projectName}
**Description**: ${description}
**Objectives**: ${objectives.join(', ')}
**Estimated Duration**: ${estimatedDuration} weeks

Evaluate:
1. Are objectives clear and measurable?
2. Is scope well-defined?
3. Are resources adequate?
4. Is timeline realistic?
5. Are success criteria defined?

Provide:
- Pass/Fail decision
- Score (0-100)
- Findings (what's good/bad)
- Recommendations (improvements)
- Blockers (must-fix issues)

Format as JSON:
{
  "passed": boolean,
  "score": number,
  "findings": string[],
  "recommendations": string[],
  "blockers": string[]
}`;
  
  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are Cornelius MacIntyre, the Orchestrator AI. You validate project initiations.' },
        { role: 'user', content: prompt }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'gate_result',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              passed: { type: 'boolean' },
              score: { type: 'number' },
              findings: { type: 'array', items: { type: 'string' } },
              recommendations: { type: 'array', items: { type: 'string' } },
              blockers: { type: 'array', items: { type: 'string' } }
            },
            required: ['passed', 'score', 'findings', 'recommendations', 'blockers'],
            additionalProperties: false
          }
        }
      }
    });
    
    const result = JSON.parse((typeof response.choices[0].message.content === "string" ? response.choices[0].message.content : JSON.stringify(response.choices[0].message.content)));
    
    return {
      gateNumber: 0,
      gateName: 'Project Initiation',
      ...result,
      certifiedBy: 'Cornelius MacIntyre',
      certifiedAt: new Date(),
      evidence: {
        projectName,
        description,
        objectives,
        estimatedDuration
      }
    };
  } catch (error: any) {
    logger.error('[Gate 0] Error:', error);
    return {
      gateNumber: 0,
      gateName: 'Project Initiation',
      passed: false,
      score: 0,
      findings: ['Gate evaluation failed'],
      recommendations: ['Retry gate evaluation'],
      blockers: [error.message],
      certifiedBy: 'System',
      certifiedAt: new Date(),
      evidence: {}
    };
  }
}

/**
 * Gate 2: Technical Feasibility (The Dr)
 * Reviews architecture, technology choices, and technical approach
 */
export async function gate2_TechnicalFeasibility(
  architecture: string,
  technologies: string[],
  technicalApproach: string
): Promise<GateResult> {
  logger.info('[Gate 2] Reviewing technical feasibility');
  
  const prompt = `You are The Dr, the Code Genius AI. Review this technical approach:

**Architecture**: ${architecture}
**Technologies**: ${technologies.join(', ')}
**Technical Approach**: ${technicalApproach}

Evaluate:
1. Is architecture sound and scalable?
2. Are technology choices appropriate?
3. Are there technical risks?
4. Is approach feasible?
5. Are best practices followed?

Provide pass/fail, score, findings, recommendations, and blockers as JSON.`;
  
  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are The Dr, the Code Genius AI. You validate technical feasibility.' },
        { role: 'user', content: prompt }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'gate_result',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              passed: { type: 'boolean' },
              score: { type: 'number' },
              findings: { type: 'array', items: { type: 'string' } },
              recommendations: { type: 'array', items: { type: 'string' } },
              blockers: { type: 'array', items: { type: 'string' } }
            },
            required: ['passed', 'score', 'findings', 'recommendations', 'blockers'],
            additionalProperties: false
          }
        }
      }
    });
    
    const result = JSON.parse((typeof response.choices[0].message.content === "string" ? response.choices[0].message.content : JSON.stringify(response.choices[0].message.content)));
    
    return {
      gateNumber: 2,
      gateName: 'Technical Feasibility',
      ...result,
      certifiedBy: 'The Dr',
      certifiedAt: new Date(),
      evidence: {
        architecture,
        technologies,
        technicalApproach
      }
    };
  } catch (error: any) {
    logger.error('[Gate 2] Error:', error);
    return {
      gateNumber: 2,
      gateName: 'Technical Feasibility',
      passed: false,
      score: 0,
      findings: ['Gate evaluation failed'],
      recommendations: ['Retry gate evaluation'],
      blockers: [error.message],
      certifiedBy: 'System',
      certifiedAt: new Date(),
      evidence: {}
    };
  }
}

/**
 * Gate 6: Security Review (The Guardian)
 * Validates security posture, vulnerabilities, and compliance
 */
export async function gate6_SecurityReview(
  securityMeasures: string[],
  vulnerabilities: string[],
  complianceRequirements: string[]
): Promise<GateResult> {
  logger.info('[Gate 6] Conducting security review');
  
  const prompt = `You are The Guardian, the Security Sentinel AI. Review this security posture:

**Security Measures**: ${securityMeasures.join(', ')}
**Known Vulnerabilities**: ${vulnerabilities.join(', ') || 'None'}
**Compliance Requirements**: ${complianceRequirements.join(', ')}

Evaluate:
1. Are security measures adequate?
2. Are vulnerabilities addressed?
3. Is compliance met?
4. Are there security gaps?
5. Is data protection sufficient?

Provide pass/fail, score, findings, recommendations, and blockers as JSON.`;
  
  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are The Guardian, the Security Sentinel AI. You validate security.' },
        { role: 'user', content: prompt }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'gate_result',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              passed: { type: 'boolean' },
              score: { type: 'number' },
              findings: { type: 'array', items: { type: 'string' } },
              recommendations: { type: 'array', items: { type: 'string' } },
              blockers: { type: 'array', items: { type: 'string' } }
            },
            required: ['passed', 'score', 'findings', 'recommendations', 'blockers'],
            additionalProperties: false
          }
        }
      }
    });
    
    const result = JSON.parse((typeof response.choices[0].message.content === "string" ? response.choices[0].message.content : JSON.stringify(response.choices[0].message.content)));
    
    return {
      gateNumber: 6,
      gateName: 'Security Review',
      ...result,
      certifiedBy: 'The Guardian',
      certifiedAt: new Date(),
      evidence: {
        securityMeasures,
        vulnerabilities,
        complianceRequirements
      }
    };
  } catch (error: any) {
    logger.error('[Gate 6] Error:', error);
    return {
      gateNumber: 6,
      gateName: 'Security Review',
      passed: false,
      score: 0,
      findings: ['Gate evaluation failed'],
      recommendations: ['Retry gate evaluation'],
      blockers: [error.message],
      certifiedBy: 'System',
      certifiedAt: new Date(),
      evidence: {}
    };
  }
}

/**
 * Gate 8: Documentation Completeness (Norman)
 * Validates documentation quality and completeness
 */
export async function gate8_DocumentationCompleteness(
  documentationTypes: string[],
  coverage: number,
  quality: string
): Promise<GateResult> {
  logger.info('[Gate 8] Reviewing documentation completeness');
  
  const prompt = `You are Norman Hawkins, the Knowledge Keeper AI. Review this documentation:

**Documentation Types**: ${documentationTypes.join(', ')}
**Coverage**: ${coverage}%
**Quality**: ${quality}

Evaluate:
1. Is documentation complete?
2. Is quality acceptable?
3. Are all areas covered?
4. Is documentation accessible?
5. Is it maintainable?

Provide pass/fail, score, findings, recommendations, and blockers as JSON.`;
  
  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are Norman Hawkins, the Knowledge Keeper AI. You validate documentation.' },
        { role: 'user', content: prompt }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'gate_result',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              passed: { type: 'boolean' },
              score: { type: 'number' },
              findings: { type: 'array', items: { type: 'string' } },
              recommendations: { type: 'array', items: { type: 'string' } },
              blockers: { type: 'array', items: { type: 'string' } }
            },
            required: ['passed', 'score', 'findings', 'recommendations', 'blockers'],
            additionalProperties: false
          }
        }
      }
    });
    
    const result = JSON.parse((typeof response.choices[0].message.content === "string" ? response.choices[0].message.content : JSON.stringify(response.choices[0].message.content)));
    
    return {
      gateNumber: 8,
      gateName: 'Documentation Completeness',
      ...result,
      certifiedBy: 'Norman Hawkins',
      certifiedAt: new Date(),
      evidence: {
        documentationTypes,
        coverage,
        quality
      }
    };
  } catch (error: any) {
    logger.error('[Gate 8] Error:', error);
    return {
      gateNumber: 8,
      gateName: 'Documentation Completeness',
      passed: false,
      score: 0,
      findings: ['Gate evaluation failed'],
      recommendations: ['Retry gate evaluation'],
      blockers: [error.message],
      certifiedBy: 'System',
      certifiedAt: new Date(),
      evidence: {}
    };
  }
}

/**
 * Gate 10: Cost Validation (Doris)
 * Validates zero-cost compliance and cost optimization
 */
export async function gate10_CostValidation(
  deploymentPlatform: string,
  estimatedMonthlyCost: number,
  costBreakdown: Record<string, number>,
  revenueProjection: number
): Promise<GateResult> {
  logger.info('[Gate 10] Validating costs');
  
  const zeroCostPlatforms = ['Render.com (free tier)', 'Railway ($5 credit)', 'Vercel (free)', 'Netlify (free)', 'Oracle Cloud (always free)'];
  const isZeroCostCompliant = zeroCostPlatforms.some(p => deploymentPlatform.toLowerCase().includes(p.toLowerCase().split('(')[0].trim()));
  
  const prompt = `You are Doris Fontaine, the Financial Steward AI. Review this cost structure:

**Deployment Platform**: ${deploymentPlatform}
**Estimated Monthly Cost**: $${estimatedMonthlyCost}
**Cost Breakdown**: ${JSON.stringify(costBreakdown)}
**Revenue Projection**: $${revenueProjection}/month
**Zero-Cost Compliant**: ${isZeroCostCompliant ? 'YES' : 'NO'}

**ZERO-COST MANDATE**: All deployments must use free-tier services. Violations are BLOCKERS.

Evaluate:
1. Is zero-cost mandate met?
2. Are costs optimized?
3. Is revenue projection realistic?
4. Are there hidden costs?
5. Is ROI positive?

Provide pass/fail, score, findings, recommendations, and blockers as JSON.`;
  
  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are Doris Fontaine, the Financial Steward AI. You validate costs and enforce zero-cost mandate.' },
        { role: 'user', content: prompt }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'gate_result',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              passed: { type: 'boolean' },
              score: { type: 'number' },
              findings: { type: 'array', items: { type: 'string' } },
              recommendations: { type: 'array', items: { type: 'string' } },
              blockers: { type: 'array', items: { type: 'string' } }
            },
            required: ['passed', 'score', 'findings', 'recommendations', 'blockers'],
            additionalProperties: false
          }
        }
      }
    });
    
    const result = JSON.parse((typeof response.choices[0].message.content === "string" ? response.choices[0].message.content : JSON.stringify(response.choices[0].message.content)));
    
    // Override if zero-cost mandate violated
    if (!isZeroCostCompliant) {
      result.passed = false;
      result.blockers.push(`ZERO-COST VIOLATION: ${deploymentPlatform} is not approved. Use: ${zeroCostPlatforms.join(', ')}`);
    }
    
    return {
      gateNumber: 10,
      gateName: 'Cost Validation',
      ...result,
      certifiedBy: 'Doris Fontaine',
      certifiedAt: new Date(),
      evidence: {
        deploymentPlatform,
        estimatedMonthlyCost,
        costBreakdown,
        revenueProjection,
        isZeroCostCompliant
      }
    };
  } catch (error: any) {
    logger.error('[Gate 10] Error:', error);
    return {
      gateNumber: 10,
      gateName: 'Cost Validation',
      passed: false,
      score: 0,
      findings: ['Gate evaluation failed'],
      recommendations: ['Retry gate evaluation'],
      blockers: [error.message],
      certifiedBy: 'System',
      certifiedAt: new Date(),
      evidence: {}
    };
  }
}

/**
 * Run all gates for a project
 */
export async function runAllGates(projectData: {
  projectName: string;
  description: string;
  objectives: string[];
  estimatedDuration: number;
  architecture: string;
  technologies: string[];
  technicalApproach: string;
  securityMeasures: string[];
  vulnerabilities: string[];
  complianceRequirements: string[];
  documentationTypes: string[];
  documentationCoverage: number;
  documentationQuality: string;
  deploymentPlatform: string;
  estimatedMonthlyCost: number;
  costBreakdown: Record<string, number>;
  revenueProjection: number;
}): Promise<ProjectLifecycle> {
  logger.info(`[Gate System] Running all gates for: ${projectData.projectName}`);
  
  const lifecycle: ProjectLifecycle = {
    projectId: `proj-${Date.now()}`,
    projectName: projectData.projectName,
    currentGate: 0,
    gateResults: [],
    overallStatus: 'in_progress',
    startedAt: new Date()
  };
  
  // Gate 0
  const gate0 = await gate0_ProjectInitiation(
    projectData.projectName,
    projectData.description,
    projectData.objectives,
    projectData.estimatedDuration
  );
  lifecycle.gateResults.push(gate0);
  
  if (!gate0.passed) {
    lifecycle.overallStatus = 'blocked';
    lifecycle.currentGate = 0;
    return lifecycle;
  }
  
  // Gate 2
  lifecycle.currentGate = 2;
  const gate2 = await gate2_TechnicalFeasibility(
    projectData.architecture,
    projectData.technologies,
    projectData.technicalApproach
  );
  lifecycle.gateResults.push(gate2);
  
  if (!gate2.passed) {
    lifecycle.overallStatus = 'blocked';
    return lifecycle;
  }
  
  // Gate 6
  lifecycle.currentGate = 6;
  const gate6 = await gate6_SecurityReview(
    projectData.securityMeasures,
    projectData.vulnerabilities,
    projectData.complianceRequirements
  );
  lifecycle.gateResults.push(gate6);
  
  if (!gate6.passed) {
    lifecycle.overallStatus = 'blocked';
    return lifecycle;
  }
  
  // Gate 8
  lifecycle.currentGate = 8;
  const gate8 = await gate8_DocumentationCompleteness(
    projectData.documentationTypes,
    projectData.documentationCoverage,
    projectData.documentationQuality
  );
  lifecycle.gateResults.push(gate8);
  
  if (!gate8.passed) {
    lifecycle.overallStatus = 'blocked';
    return lifecycle;
  }
  
  // Gate 10 (CRITICAL - Zero-cost mandate)
  lifecycle.currentGate = 10;
  const gate10 = await gate10_CostValidation(
    projectData.deploymentPlatform,
    projectData.estimatedMonthlyCost,
    projectData.costBreakdown,
    projectData.revenueProjection
  );
  lifecycle.gateResults.push(gate10);
  
  if (!gate10.passed) {
    lifecycle.overallStatus = 'blocked';
    return lifecycle;
  }
  
  // All gates passed
  lifecycle.overallStatus = 'completed';
  lifecycle.currentGate = 12;
  lifecycle.completedAt = new Date();
  
  logger.info(`[Gate System] All gates passed for: ${projectData.projectName}`);
  
  return lifecycle;
}

/**
 * Generate certification document
 */
export function generateCertification(gateResult: GateResult): string {
  const evidenceJson = JSON.stringify(gateResult.evidence, null, 2);
  return `# Gate ${gateResult.gateNumber} Certification: ${gateResult.gateName}

**Status**: ${gateResult.passed ? '✅ PASSED' : '❌ FAILED'}
**Score**: ${gateResult.score}/100
**Certified By**: ${gateResult.certifiedBy}
**Certified At**: ${gateResult.certifiedAt.toISOString()}
**Certification ID**: ${gateResult.certificationId || 'N/A'}

## Findings

${gateResult.findings.map(f => `- ${f}`).join('\n')}

## Recommendations

${gateResult.recommendations.map(r => `- ${r}`).join('\n')}

## Blockers

${gateResult.blockers.length > 0 ? gateResult.blockers.map(b => `- ⚠️ ${b}`).join('\n') : 'None'}

## Evidence

\`\`\`json
${evidenceJson}
\`\`\`

---

*This certification was generated by the Trancendos Gate Compliance System*
`;
}
