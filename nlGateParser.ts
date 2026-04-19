/**
 * Natural Language Gate Parser
 * 
 * Parses natural language descriptions into structured gate submission data.
 * 
 * Example Input:
 * "I completed Gate 5 for the login feature. I wrote 45 unit tests with 92% coverage.
 *  All tests are passing. The Dr reviewed and approved the code. Test report is at
 *  https://example.com/test-report.html"
 * 
 * Example Output:
 * {
 *   gateId: 5,
 *   gateName: "Gate 5: Code Generation",
 *   checklist: [
 *     { item: "Test cases written (TDD)", checked: true, evidence: "45 unit tests" },
 *     { item: "Code implemented", checked: true, evidence: "Implied" },
 *     { item: "Unit tests passing", checked: true, evidence: "All tests passing" },
 *     { item: "The Dr approval obtained", checked: true, evidence: "The Dr reviewed and approved" }
 *   ],
 *   evidence: {
 *     description: "...",
 *     testCoverage: 92,
 *     testCount: 45,
 *     approvals: ["The Dr"],
 *     links: ["https://example.com/test-report.html"]
 *   }
 * }
 */

import { invokeLLM } from '../_core/llm';

/**
 * Gate definitions with checklists
 */
const GATE_DEFINITIONS = [
  {
    id: 0,
    name: "Gate 0: Intake",
    checklist: [
      "Clear problem statement documented",
      "Success criteria defined (SMART goals)",
      "Stakeholders identified",
      "Initial scope defined",
    ],
  },
  {
    id: 1,
    name: "Gate 1: 0-Cost Validation",
    checklist: [
      "Zero-cost solution proposed",
      "Cost analysis completed",
      "Doris approval obtained",
      "Alternative approaches considered",
    ],
  },
  {
    id: 2,
    name: "Gate 2: Specification",
    checklist: [
      "Functional requirements documented",
      "Non-functional requirements defined (performance, security, scalability)",
      "User stories written",
      "Acceptance criteria defined",
    ],
  },
  {
    id: 3,
    name: "Gate 3: Security",
    checklist: [
      "STRIDE threat model completed",
      "OWASP Top 10 vulnerabilities addressed",
      "Security controls identified",
      "Guardian approval obtained",
    ],
  },
  {
    id: 4,
    name: "Gate 4: Design",
    checklist: [
      "System architecture diagram created",
      "UI/UX mockups completed",
      "Database schema designed",
      "Auditor review completed",
    ],
  },
  {
    id: 5,
    name: "Gate 5: Code Generation",
    checklist: [
      "Test cases written (TDD)",
      "Code implemented",
      "Unit tests passing",
      "The Dr approval obtained",
    ],
  },
  {
    id: 6,
    name: "Gate 6: Testing",
    checklist: [
      "Unit tests passing (80%+ coverage)",
      "Integration tests passing",
      "End-to-end tests passing",
      "Test report generated",
    ],
  },
  {
    id: 7,
    name: "Gate 7: Dependency Management",
    checklist: [
      "Dependencies documented",
      "Malicious packages scanned",
      "License compliance verified",
      "CARL approval obtained",
    ],
  },
  {
    id: 8,
    name: "Gate 8: Build",
    checklist: [
      "Build successful",
      "No compilation errors",
      "Build artifacts generated",
      "Build time acceptable (<5 minutes)",
    ],
  },
  {
    id: 9,
    name: "Gate 9: Compliance",
    checklist: [
      "GDPR compliance verified",
      "SOC 2 controls implemented",
      "ISO 27001 requirements met",
      "Senator approval obtained",
    ],
  },
  {
    id: 10,
    name: "Gate 10: Legal/IP",
    checklist: [
      "Legal risks assessed",
      "IP compliance verified",
      "Justitia approval obtained",
      "Patent Clerk approval obtained",
    ],
  },
  {
    id: 11,
    name: "Gate 11: Pre-Deployment",
    checklist: [
      "Deployment plan created",
      "Rollback plan documented",
      "Monitoring configured",
      "Prometheus approval obtained",
    ],
  },
  {
    id: 12,
    name: "Gate 12: UAT & Go-Live",
    checklist: [
      "UAT completed by customer",
      "Customer sign-off obtained",
      "Production deployment successful",
      "Post-deployment verification completed",
    ],
  },
];

/**
 * Parsed gate submission
 */
export interface ParsedGateSubmission {
  gateId: number;
  gateName: string;
  checklist: Array<{
    item: string;
    checked: boolean;
    evidence: string;
  }>;
  evidence: {
    description: string;
    testCoverage?: number;
    testCount?: number;
    approvals?: string[];
    links?: string[];
    metrics?: Record<string, any>;
  };
  confidence: number; // 0-100
}

/**
 * Parse natural language gate submission
 */
export async function parseNaturalLanguageGateSubmission(
  input: string
): Promise<ParsedGateSubmission> {
  const systemPrompt = `You are a gate submission parser. Extract structured data from natural language descriptions.

Gate Definitions:
${GATE_DEFINITIONS.map(g => `${g.name}:\n${g.checklist.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}`).join('\n\n')}

Extract:
1. Gate ID (0-12)
2. Checklist items completion status (true/false) with evidence
3. Test coverage percentage (if mentioned)
4. Test count (if mentioned)
5. Approvals from agents (The Dr, CARL, Guardian, etc.)
6. Links/URLs (if mentioned)
7. Any other relevant metrics

Respond with JSON only, no explanation.`;

  const response = await invokeLLM({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'gate_submission',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            gateId: {
              type: 'integer',
              description: 'Gate ID (0-12)',
            },
            checklist: {
              type: 'array',
              description: 'Checklist items with completion status',
              items: {
                type: 'object',
                properties: {
                  item: { type: 'string' },
                  checked: { type: 'boolean' },
                  evidence: { type: 'string' },
                },
                required: ['item', 'checked', 'evidence'],
                additionalProperties: false,
              },
            },
            testCoverage: {
              type: 'number',
              description: 'Test coverage percentage (0-100)',
            },
            testCount: {
              type: 'integer',
              description: 'Number of tests',
            },
            approvals: {
              type: 'array',
              description: 'Agent approvals',
              items: { type: 'string' },
            },
            links: {
              type: 'array',
              description: 'URLs/links mentioned',
              items: { type: 'string' },
            },
            confidence: {
              type: 'integer',
              description: 'Confidence in parsing (0-100)',
            },
          },
          required: ['gateId', 'checklist', 'confidence'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;


  const contentStr = typeof content === "string" ? content : JSON.stringify(content);
  const parsed = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
  
  const gate = GATE_DEFINITIONS.find(g => g.id === parsed.gateId);
  if (!gate) {
    throw new Error(`Invalid gate ID: ${parsed.gateId}`);
  }

  return {
    gateId: parsed.gateId,
    gateName: gate.name,
    checklist: parsed.checklist,
    evidence: {
      description: input,
      testCoverage: parsed.testCoverage,
      testCount: parsed.testCount,
      approvals: parsed.approvals,
      links: parsed.links,
    },
    confidence: parsed.confidence,
  };
}

/**
 * Validate parsed submission
 */
export function validateParsedSubmission(parsed: ParsedGateSubmission): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check gate ID
  if (parsed.gateId < 0 || parsed.gateId > 12) {
    errors.push(`Invalid gate ID: ${parsed.gateId}`);
  }
  
  // Check confidence
  if (parsed.confidence < 70) {
    errors.push(`Low confidence: ${parsed.confidence}% (minimum 70%)`);
  }
  
  // Check checklist completeness
  const gate = GATE_DEFINITIONS.find(g => g.id === parsed.gateId);
  if (gate) {
    const expectedItems = gate.checklist.length;
    const actualItems = parsed.checklist.length;
    
    if (actualItems < expectedItems) {
      errors.push(`Incomplete checklist: ${actualItems}/${expectedItems} items`);
    }
  }
  
  // Check all items are checked
  const uncheckedItems = parsed.checklist.filter(item => !item.checked);
  if (uncheckedItems.length > 0) {
    errors.push(`${uncheckedItems.length} checklist items not completed`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extract metrics from natural language
 */
export async function extractMetrics(input: string): Promise<Record<string, any>> {
  const systemPrompt = `Extract metrics from the text. Look for:
- Numbers with units (e.g., "92% coverage", "45 tests", "2.5s response time")
- Performance metrics (latency, throughput, error rate)
- Quality metrics (test coverage, code quality score)
- Business metrics (user count, revenue, conversion rate)

Respond with JSON only, no explanation.`;

  const response = await invokeLLM({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'metrics',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            metrics: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  value: { type: 'number' },
                  unit: { type: 'string' },
                },
                required: ['name', 'value', 'unit'],
                additionalProperties: false,
              },
            },
          },
          required: ['metrics'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;


  const contentStr = typeof content === "string" ? content : JSON.stringify(content);
  const parsed = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
  
  // Convert array to object
  const metrics: Record<string, any> = {};
  for (const metric of parsed.metrics) {
    metrics[metric.name] = {
      value: metric.value,
      unit: metric.unit,
    };
  }
  
  return metrics;
}

/**
 * Example usage
 */
export const EXAMPLE_INPUTS = [
  {
    input: `I completed Gate 5 for the login feature. I wrote 45 unit tests with 92% coverage.
All tests are passing. The Dr reviewed and approved the code. Test report is at
https://example.com/test-report.html`,
    expected: {
      gateId: 5,
      testCoverage: 92,
      testCount: 45,
      approvals: ['The Dr'],
      links: ['https://example.com/test-report.html'],
    },
  },
  {
    input: `Gate 3 security review is done. STRIDE threat model completed with 12 threats identified.
All OWASP Top 10 vulnerabilities addressed. Guardian approved. Security report:
https://example.com/security-report.pdf`,
    expected: {
      gateId: 3,
      approvals: ['Guardian'],
      links: ['https://example.com/security-report.pdf'],
    },
  },
  {
    input: `Finished Gate 6 testing. Unit tests: 156 passing (85% coverage). Integration tests: 42 passing.
E2E tests: 18 passing. Test report generated at https://example.com/tests.html`,
    expected: {
      gateId: 6,
      testCoverage: 85,
      testCount: 156,
      links: ['https://example.com/tests.html'],
    },
  },
];
