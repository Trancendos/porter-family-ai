import { UserStoryTemplate } from "./storyGenerator";

/**
 * 12-Gate PLM System User Stories
 * Comprehensive enterprise governance framework
 */

export const plmStories: UserStoryTemplate[] = [
  // ========================================
  // Epic 1: Gate 0 - Defining (Intake & Planning)
  // ========================================
  {
    title: "Auto-Generate Product ID (PID)",
    asA: "product owner",
    iWant: "a unique Product ID automatically assigned when I create a new product request",
    soThat: "every product can be tracked throughout its lifecycle",
    acceptanceCriteria: [
      "PID follows format: PROD-YYYY-XXXXXX (e.g., PROD-2025-ABC123)",
      "PID is guaranteed unique across all products",
      "PID is displayed prominently on all product pages",
      "PID is included in all certificates and documents",
      "System prevents duplicate PIDs",
    ],
    priority: "critical",
    storyPoints: 3,
    epicTitle: "Gate 0: Defining",
    tags: ["plm", "gate-0", "pid"],
  },
  {
    title: "Smart Requirements Form with AI Assistance",
    asA: "product requester",
    iWant: "an intelligent form that helps me capture complete requirements",
    soThat: "developers have all necessary information without back-and-forth questions",
    acceptanceCriteria: [
      "Form includes mandatory fields: product name, description, goals, target audience",
      "AI suggests additional questions based on product type",
      "Form validates completeness before submission",
      "AI highlights missing critical information",
      "Form saves draft automatically every 30 seconds",
      "User can upload reference images/documents",
    ],
    priority: "critical",
    storyPoints: 13,
    epicTitle: "Gate 0: Defining",
    tags: ["plm", "gate-0", "ai", "forms"],
  },
  {
    title: "AI-Powered Wireframe Generation",
    asA: "product requester",
    iWant: "AI to generate a wireframe from my requirements",
    soThat: "I can visualize the product before development starts",
    acceptanceCriteria: [
      "AI analyzes requirements and generates wireframe structure",
      "Wireframe includes all major UI components mentioned",
      "User can approve, reject, or request modifications",
      "Multiple wireframe versions are tracked",
      "Approved wireframe is locked and versioned",
      "Wireframe is exported as PNG/PDF",
    ],
    priority: "high",
    storyPoints: 21,
    epicTitle: "Gate 0: Defining",
    tags: ["plm", "gate-0", "ai", "wireframe"],
  },
  {
    title: "Gate 0 Completion and Approval",
    asA: "product owner",
    iWant: "to review and approve Gate 0 deliverables",
    soThat: "the product can move to Gate 1 with complete requirements",
    acceptanceCriteria: [
      "Requirements Document is auto-generated from form",
      "Wireframe is attached to product",
      "Product owner can approve or request changes",
      "Approval triggers automatic move to Gate 1",
      "Audit log records Gate 0 completion",
    ],
    priority: "high",
    storyPoints: 5,
    epicTitle: "Gate 0: Defining",
    tags: ["plm", "gate-0", "approval"],
  },

  // ========================================
  // Epic 2: Gate 1 - Foundation (Architecture & Standards)
  // ========================================
  {
    title: "Template Library Management",
    asA: "system administrator",
    iWant: "to manage a library of reusable templates",
    soThat: "developers can quickly start projects with proven patterns",
    acceptanceCriteria: [
      "Admin can create, edit, delete templates",
      "Templates are categorized (Architecture, Security, etc.)",
      "Templates include tags for easy searching",
      "Usage count is tracked per template",
      "Templates can be versioned",
    ],
    priority: "high",
    storyPoints: 8,
    epicTitle: "Gate 1: Foundation",
    tags: ["plm", "gate-1", "templates"],
  },
  {
    title: "AI Template Matching",
    asA: "developer",
    iWant: "AI to suggest relevant templates based on product requirements",
    soThat: "I can leverage existing patterns and accelerate development",
    acceptanceCriteria: [
      "AI analyzes product requirements",
      "Suggests 3-5 most relevant templates",
      "Shows match confidence score",
      "Developer can preview template before selection",
      "If no match, system logs new template request",
    ],
    priority: "high",
    storyPoints: 13,
    epicTitle: "Gate 1: Foundation",
    tags: ["plm", "gate-1", "ai", "templates"],
  },
  {
    title: "Compliance Baseline Checker",
    asA: "compliance officer",
    iWant: "automatic compliance baseline checks at Gate 1",
    soThat: "products meet Trancendos standards from the start",
    acceptanceCriteria: [
      "Checks against Trancendos standards library",
      "Validates GDPR/CCPA requirements",
      "Checks accessibility baseline (WCAG 2.1 AA)",
      "Generates compliance checklist",
      "Flags non-compliant areas for review",
    ],
    priority: "critical",
    storyPoints: 13,
    epicTitle: "Gate 1: Foundation",
    tags: ["plm", "gate-1", "compliance"],
  },
  {
    title: "Architecture Plan & DDD Generation",
    asA: "architect",
    iWant: "to create an architecture plan and Detailed Design Document",
    soThat: "developers have a clear technical blueprint",
    acceptanceCriteria: [
      "Architecture plan includes system diagram",
      "DDD includes data models, API specs, tech stack",
      "Documents are generated in PDF format",
      "Architect can edit and version documents",
      "Approved documents are locked",
    ],
    priority: "high",
    storyPoints: 13,
    epicTitle: "Gate 1: Foundation",
    tags: ["plm", "gate-1", "architecture", "ddd"],
  },

  // ========================================
  // Epic 3: Gates 2-3 - Development & QA
  // ========================================
  {
    title: "Link Stories to PLM Products",
    asA: "developer",
    iWant: "user stories automatically linked to the PLM product",
    soThat: "all development work is tracked under the correct product",
    acceptanceCriteria: [
      "Stories are tagged with PID",
      "Product dashboard shows all linked stories",
      "Story completion updates product progress",
      "Stories can be filtered by product",
      "Epic completion triggers gate progress",
    ],
    priority: "high",
    storyPoints: 5,
    epicTitle: "Development & QA",
    tags: ["plm", "gate-2", "stories"],
  },
  {
    title: "Code Review Checkpoint System",
    asA: "tech lead",
    iWant: "mandatory code review checkpoints during development",
    soThat: "code quality is maintained throughout the project",
    acceptanceCriteria: [
      "Code review required before story completion",
      "Reviewer can approve, request changes, or reject",
      "Code quality metrics are tracked",
      "Review comments are logged",
      "Approval required to close story",
    ],
    priority: "high",
    storyPoints: 8,
    epicTitle: "Development & QA",
    tags: ["plm", "gate-2", "code-review"],
  },
  {
    title: "Automated Testing Workflow",
    asA: "QA engineer",
    iWant: "automated testing integrated into the PLM workflow",
    soThat: "quality is verified before gate progression",
    acceptanceCriteria: [
      "Unit tests tracked per story",
      "Integration tests tracked per epic",
      "Test coverage percentage displayed",
      "Failed tests block gate progression",
      "Test reports are auto-generated",
    ],
    priority: "high",
    storyPoints: 13,
    epicTitle: "Development & QA",
    tags: ["plm", "gate-3", "testing"],
  },
  {
    title: "Code Usage Handbook Generation",
    asA: "developer",
    iWant: "automatic generation of Code Usage Handbook",
    soThat: "future maintainers understand the codebase",
    acceptanceCriteria: [
      "Handbook includes architecture overview",
      "Documents key design patterns used",
      "Includes API documentation",
      "Lists dependencies and versions",
      "Generated in PDF and Markdown formats",
    ],
    priority: "medium",
    storyPoints: 8,
    epicTitle: "Development & QA",
    tags: ["plm", "gate-2", "documentation"],
  },

  // ========================================
  // Epic 4: Gate 4 - Security Review
  // ========================================
  {
    title: "Security Checklist & OWASP Compliance",
    asA: "security officer",
    iWant: "a comprehensive security checklist based on OWASP Top 10",
    soThat: "all security vulnerabilities are identified and fixed",
    acceptanceCriteria: [
      "Checklist covers OWASP Top 10 vulnerabilities",
      "Each item has pass/fail/NA status",
      "Failed items block gate progression",
      "Security officer can add custom checks",
      "Checklist is versioned per product",
    ],
    priority: "critical",
    storyPoints: 8,
    epicTitle: "Gate 4: Security",
    tags: ["plm", "gate-4", "security", "owasp"],
  },
  {
    title: "Penetration Testing Tracker",
    asA: "security officer",
    iWant: "to track penetration testing results",
    soThat: "all security issues are documented and resolved",
    acceptanceCriteria: [
      "Upload penetration test reports",
      "Track identified vulnerabilities",
      "Assign severity levels (Critical, High, Medium, Low)",
      "Link vulnerabilities to fix tickets",
      "Verify fixes before gate approval",
    ],
    priority: "critical",
    storyPoints: 8,
    epicTitle: "Gate 4: Security",
    tags: ["plm", "gate-4", "security", "pentest"],
  },
  {
    title: "Security Certificate Generation",
    asA: "security officer",
    iWant: "to issue a Security Certificate when all checks pass",
    soThat: "stakeholders have proof of security compliance",
    acceptanceCriteria: [
      "Certificate includes product name, PID, date",
      "Lists all security checks performed",
      "Includes digital signature",
      "Generated as PDF",
      "Stored in product's certificate collection",
    ],
    priority: "high",
    storyPoints: 5,
    epicTitle: "Gate 4: Security",
    tags: ["plm", "gate-4", "certificate"],
  },

  // ========================================
  // Epic 5: Gate 5 - Legal Review
  // ========================================
  {
    title: "Terms of Service & Privacy Policy Generator",
    asA: "legal counsel",
    iWant: "automated generation of ToS and Privacy Policy",
    soThat: "legal documents are consistent and compliant",
    acceptanceCriteria: [
      "Templates based on product type",
      "Customizable sections",
      "GDPR/CCPA compliant by default",
      "Generated in PDF and HTML formats",
      "Versioned and timestamped",
    ],
    priority: "critical",
    storyPoints: 13,
    epicTitle: "Gate 5: Legal",
    tags: ["plm", "gate-5", "legal", "documents"],
  },
  {
    title: "IP Protection Verification",
    asA: "legal counsel",
    iWant: "to verify IP protection measures are in place",
    soThat: "Trancendos intellectual property is secured",
    acceptanceCriteria: [
      "Checklist for IP protection (trademarks, copyrights, patents)",
      "Verify encryption standards (AES-256)",
      "Check license agreements",
      "Validate code ownership",
      "Document IP assets",
    ],
    priority: "critical",
    storyPoints: 8,
    epicTitle: "Gate 5: Legal",
    tags: ["plm", "gate-5", "legal", "ip"],
  },
  {
    title: "Legal Compliance Certificate",
    asA: "legal counsel",
    iWant: "to issue a Legal Compliance Certificate",
    soThat: "the product is legally cleared for release",
    acceptanceCriteria: [
      "Certificate confirms all legal requirements met",
      "Includes Legal Documents Pack",
      "Digital signature from legal counsel",
      "Generated as PDF",
      "Stored in product's certificate collection",
    ],
    priority: "high",
    storyPoints: 5,
    epicTitle: "Gate 5: Legal",
    tags: ["plm", "gate-5", "certificate"],
  },

  // ========================================
  // Epic 6: Gate 6 - Compliance Review
  // ========================================
  {
    title: "Accessibility Validator (WCAG 2.1 AA)",
    asA: "compliance officer",
    iWant: "automated accessibility testing",
    soThat: "the product is usable by people with disabilities",
    acceptanceCriteria: [
      "Tests against WCAG 2.1 AA standards",
      "Identifies accessibility violations",
      "Provides remediation suggestions",
      "Generates accessibility report",
      "Tracks fixes until all issues resolved",
    ],
    priority: "critical",
    storyPoints: 13,
    epicTitle: "Gate 6: Compliance",
    tags: ["plm", "gate-6", "accessibility", "wcag"],
  },
  {
    title: "Neurodiversity Support Verification",
    asA: "compliance officer",
    iWant: "to verify neurodiversity support features",
    soThat: "users with ADHD, dyslexia, autism are supported",
    acceptanceCriteria: [
      "Check for ADHD-friendly formatting",
      "Verify dyslexia-friendly features",
      "Validate cognitive load considerations",
      "Test with neurodivergent users",
      "Document support features",
    ],
    priority: "high",
    storyPoints: 8,
    epicTitle: "Gate 6: Compliance",
    tags: ["plm", "gate-6", "neurodiversity"],
  },
  {
    title: "Ethics & Inclusion Report",
    asA: "compliance officer",
    iWant: "to generate an Ethics & Inclusion Report",
    soThat: "stakeholders can verify ethical standards",
    acceptanceCriteria: [
      "Report covers social responsibility",
      "Documents ethical AI practices",
      "Includes diversity & inclusion metrics",
      "Cultural sensitivity review results",
      "Generated as PDF",
    ],
    priority: "high",
    storyPoints: 8,
    epicTitle: "Gate 6: Compliance",
    tags: ["plm", "gate-6", "ethics"],
  },

  // ========================================
  // Epic 7: Gates 8-10 - UX/UI, ITSM, Knowledge
  // ========================================
  {
    title: "Style Guide Adherence Checker",
    asA: "UX/UI specialist",
    iWant: "automated style guide validation",
    soThat: "brand consistency is maintained",
    acceptanceCriteria: [
      "Checks colors against brand palette",
      "Validates typography usage",
      "Verifies spacing and layout",
      "Compares wireframe vs final design",
      "Generates design validation report",
    ],
    priority: "high",
    storyPoints: 13,
    epicTitle: "UX/UI & Operations",
    tags: ["plm", "gate-8", "ux-ui"],
  },
  {
    title: "ITSM Integration (Incidents, Problems, Changes)",
    asA: "ITSM manager",
    iWant: "all ITSM items linked to the product",
    soThat: "operational readiness is verified",
    acceptanceCriteria: [
      "All incidents resolved or documented",
      "Problems root-caused and fixed",
      "Changes properly implemented",
      "Release notes auto-generated",
      "Runbook created",
    ],
    priority: "high",
    storyPoints: 13,
    epicTitle: "UX/UI & Operations",
    tags: ["plm", "gate-9", "itsm"],
  },
  {
    title: "Complete Documentation Pack",
    asA: "knowledge manager",
    iWant: "all documentation auto-generated and compiled",
    soThat: "users and developers have complete information",
    acceptanceCriteria: [
      "User documentation complete",
      "Technical documentation complete",
      "API documentation (if applicable)",
      "Training materials created",
      "All docs compiled into single pack",
    ],
    priority: "high",
    storyPoints: 13,
    epicTitle: "UX/UI & Operations",
    tags: ["plm", "gate-10", "documentation"],
  },

  // ========================================
  // Epic 8: Gates 11-12 - Customer Acceptance & Go-Live
  // ========================================
  {
    title: "Customer Pack Generation",
    asA: "product owner",
    iWant: "a complete customer pack auto-generated",
    soThat: "customers receive all deliverables in one package",
    acceptanceCriteria: [
      "Pack includes all certificates (Gates 4-10)",
      "Application link included",
      "GitHub repository access provided",
      "Complete documentation included",
      "Legal agreements included",
      "Support contact information included",
      "Pack delivered as ZIP file",
    ],
    priority: "critical",
    storyPoints: 13,
    epicTitle: "Customer & Go-Live",
    tags: ["plm", "gate-11", "customer-pack"],
  },
  {
    title: "GitHub Repository Auto-Creation",
    asA: "product owner",
    iWant: "GitHub repo automatically created and populated",
    soThat: "customers can access source code",
    acceptanceCriteria: [
      "Repo created via GitHub API",
      "Code pushed to repo",
      "README with documentation added",
      "All certificates included in repo",
      "Customer granted access",
    ],
    priority: "high",
    storyPoints: 13,
    epicTitle: "Customer & Go-Live",
    tags: ["plm", "gate-11", "github"],
  },
  {
    title: "Gate Closure Certificate & Go-Live Approval",
    asA: "review board",
    iWant: "final gate closure certificate when all gates pass",
    soThat: "the product is officially approved for production",
    acceptanceCriteria: [
      "All 12 gates verified closed",
      "All certificates attached",
      "PLM marked as LIVE",
      "Production deployment executed",
      "Monitoring activated",
      "Gate Closure Certificate generated",
      "Go-Live Approval Certificate generated",
    ],
    priority: "critical",
    storyPoints: 8,
    epicTitle: "Customer & Go-Live",
    tags: ["plm", "gate-12", "go-live"],
  },

  // ========================================
  // Epic 9: Certificate System
  // ========================================
  {
    title: "Multi-Level Certificate Generation",
    asA: "system",
    iWant: "to generate certificates at all levels (Story, Epic, Gate, PLM)",
    soThat: "every milestone is formally documented",
    acceptanceCriteria: [
      "Story Completion Certificates",
      "Epic Completion Certificates",
      "Gate Certificates (per gate)",
      "Gate Closure Certificate",
      "Go-Live Certificate",
      "All certificates include digital signatures",
      "Certificates stored in database and S3",
    ],
    priority: "critical",
    storyPoints: 21,
    epicTitle: "Certificate System",
    tags: ["plm", "certificates", "pdf"],
  },
  {
    title: "Certificate Viewer & Download",
    asA: "stakeholder",
    iWant: "to view and download all certificates",
    soThat: "I can verify product compliance",
    acceptanceCriteria: [
      "Certificate gallery per product",
      "Filter by type (Story, Epic, Gate, PLM)",
      "Download individual certificates",
      "Download all certificates as ZIP",
      "Share certificate links",
    ],
    priority: "medium",
    storyPoints: 5,
    epicTitle: "Certificate System",
    tags: ["plm", "certificates", "ui"],
  },

  // ========================================
  // Epic 10: PLM Dashboard & Workflow
  // ========================================
  {
    title: "PLM Overview Dashboard",
    asA: "product owner",
    iWant: "a dashboard showing all products and their gate progress",
    soThat: "I can track portfolio health at a glance",
    acceptanceCriteria: [
      "List all products with current gate",
      "Visual progress bars per product",
      "Filter by status (Defining, In Progress, Live)",
      "Search by PID or product name",
      "Click product to see details",
    ],
    priority: "high",
    storyPoints: 13,
    epicTitle: "PLM Dashboard",
    tags: ["plm", "dashboard", "ui"],
  },
  {
    title: "Gate Progress Visualization",
    asA: "stakeholder",
    iWant: "visual representation of gate progress",
    soThat: "I can quickly understand product status",
    acceptanceCriteria: [
      "Timeline view showing all 12 gates",
      "Color-coded status (Not Started, In Progress, Approved, Rejected)",
      "Hover to see gate details",
      "Click gate to see deliverables",
      "Show panel assignments",
    ],
    priority: "high",
    storyPoints: 13,
    epicTitle: "PLM Dashboard",
    tags: ["plm", "dashboard", "visualization"],
  },
  {
    title: "Panel Sign-Off Workflow",
    asA: "panel member",
    iWant: "a streamlined sign-off interface",
    soThat: "I can efficiently review and approve gates",
    acceptanceCriteria: [
      "Dashboard shows pending reviews",
      "View all gate deliverables",
      "Approve, reject, or request changes",
      "Add comments and feedback",
      "Digital signature on approval",
      "Email notification on sign-off",
    ],
    priority: "high",
    storyPoints: 13,
    epicTitle: "PLM Dashboard",
    tags: ["plm", "workflow", "sign-off"],
  },
  {
    title: "Audit Log Viewer",
    asA: "compliance officer",
    iWant: "complete audit trail of all PLM activities",
    soThat: "I can verify process compliance",
    acceptanceCriteria: [
      "Log all gate progressions",
      "Log all sign-offs",
      "Log all certificate issuances",
      "Log all status changes",
      "Filter by product, date, user",
      "Export audit log as CSV/PDF",
    ],
    priority: "medium",
    storyPoints: 8,
    epicTitle: "PLM Dashboard",
    tags: ["plm", "audit", "compliance"],
  },
];

/**
 * Get total story points for PLM system
 */
export function getPlmTotalStoryPoints(): number {
  return plmStories.reduce((sum, story) => sum + story.storyPoints, 0);
}

/**
 * Get PLM stories grouped by epic
 */
export function getPlmStoriesByEpic(): Map<string, UserStoryTemplate[]> {
  const epicGroups = new Map<string, UserStoryTemplate[]>();
  for (const story of plmStories) {
    if (!epicGroups.has(story.epicTitle)) {
      epicGroups.set(story.epicTitle, []);
    }
    epicGroups.get(story.epicTitle)!.push(story);
  }
  return epicGroups;
}
