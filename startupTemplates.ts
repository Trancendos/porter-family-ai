/**
 * Startup Templates System
 * Pre-configured deployment templates for quick setup
 */

export interface StartupTemplate {
  id: string;
  name: string;
  description: string;
  category: "personal" | "business" | "enterprise" | "custom";
  icon: string;
  config: {
    deploymentType: "cloud" | "self-hosted" | "hybrid";
    database: {
      provider: string;
      tier: "free" | "paid";
      estimatedCost: number;
    };
    vectorDatabase?: {
      enabled: boolean;
      provider: string;
      tier: "free" | "paid";
      estimatedCost: number;
    };
    storage: {
      provider: string;
      tier: "free" | "paid";
      estimatedCost: number;
    };
    domain?: {
      name: string;
      registrar: string;
      features: string[];
    };
    features: {
      ai: boolean;
      plm: boolean;
      marketplace: boolean;
      git: boolean;
      analytics: boolean;
    };
    cloudflare?: {
      enabled: boolean;
      features: string[];
    };
  };
  estimatedMonthlyCost: number;
  setupTime: string; // e.g., "5 minutes"
}

export const startupTemplates: StartupTemplate[] = [
  {
    id: "trancendos",
    name: "Trancendos",
    description: "Pre-configured for trancendos.com with Cloudflare integration",
    category: "custom",
    icon: "🚀",
    config: {
      deploymentType: "cloud",
      database: {
        provider: "supabase",
        tier: "free",
        estimatedCost: 0,
      },
      vectorDatabase: {
        enabled: true,
        provider: "qdrant",
        tier: "free",
        estimatedCost: 0,
      },
      storage: {
        provider: "cloudflare-r2",
        tier: "free",
        estimatedCost: 0,
      },
      domain: {
        name: "trancendos.com",
        registrar: "cloudflare",
        features: [
          "DNS Management",
          "SSL/TLS",
          "CDN",
          "DDoS Protection",
          "WAF",
          "Workers",
          "Pages",
          "R2 Storage",
          "Stream",
          "Images",
          "Analytics",
        ],
      },
      features: {
        ai: true,
        plm: true,
        marketplace: true,
        git: true,
        analytics: true,
      },
      cloudflare: {
        enabled: true,
        features: [
          "workers",
          "pages",
          "r2",
          "stream",
          "images",
          "waf",
          "access",
          "analytics",
          "zaraz",
        ],
      },
    },
    estimatedMonthlyCost: 0,
    setupTime: "5 minutes",
  },
  {
    id: "zero-cost",
    name: "Zero Cost Starter",
    description: "Complete platform with $0 monthly cost using free tiers",
    category: "personal",
    icon: "💰",
    config: {
      deploymentType: "cloud",
      database: {
        provider: "supabase",
        tier: "free",
        estimatedCost: 0,
      },
      vectorDatabase: {
        enabled: true,
        provider: "qdrant",
        tier: "free",
        estimatedCost: 0,
      },
      storage: {
        provider: "cloudflare-r2",
        tier: "free",
        estimatedCost: 0,
      },
      features: {
        ai: true,
        plm: true,
        marketplace: false,
        git: true,
        analytics: true,
      },
    },
    estimatedMonthlyCost: 0,
    setupTime: "5 minutes",
  },
  {
    id: "self-hosted",
    name: "Self-Hosted",
    description: "Complete control with self-hosted infrastructure",
    category: "enterprise",
    icon: "🏠",
    config: {
      deploymentType: "self-hosted",
      database: {
        provider: "postgresql",
        tier: "free",
        estimatedCost: 0,
      },
      vectorDatabase: {
        enabled: true,
        provider: "qdrant",
        tier: "free",
        estimatedCost: 0,
      },
      storage: {
        provider: "minio",
        tier: "free",
        estimatedCost: 0,
      },
      features: {
        ai: true,
        plm: true,
        marketplace: true,
        git: true,
        analytics: true,
      },
    },
    estimatedMonthlyCost: 0,
    setupTime: "15 minutes",
  },
  {
    id: "saas",
    name: "SaaS Platform",
    description: "Multi-tenant SaaS with subscriptions and payments",
    category: "business",
    icon: "💼",
    config: {
      deploymentType: "cloud",
      database: {
        provider: "planetscale",
        tier: "paid",
        estimatedCost: 29,
      },
      vectorDatabase: {
        enabled: true,
        provider: "pinecone",
        tier: "paid",
        estimatedCost: 70,
      },
      storage: {
        provider: "aws-s3",
        tier: "paid",
        estimatedCost: 23,
      },
      features: {
        ai: true,
        plm: true,
        marketplace: true,
        git: true,
        analytics: true,
      },
    },
    estimatedMonthlyCost: 122,
    setupTime: "10 minutes",
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    description: "Online store with inventory and payment processing",
    category: "business",
    icon: "🛒",
    config: {
      deploymentType: "cloud",
      database: {
        provider: "neon",
        tier: "free",
        estimatedCost: 0,
      },
      storage: {
        provider: "cloudflare-r2",
        tier: "free",
        estimatedCost: 0,
      },
      features: {
        ai: false,
        plm: false,
        marketplace: true,
        git: false,
        analytics: true,
      },
    },
    estimatedMonthlyCost: 0,
    setupTime: "8 minutes",
  },
  {
    id: "agency",
    name: "Agency Multi-Tenant",
    description: "White-label platform for serving multiple clients",
    category: "enterprise",
    icon: "🏢",
    config: {
      deploymentType: "hybrid",
      database: {
        provider: "tidb",
        tier: "paid",
        estimatedCost: 50,
      },
      vectorDatabase: {
        enabled: true,
        provider: "weaviate",
        tier: "paid",
        estimatedCost: 25,
      },
      storage: {
        provider: "cloudflare-r2",
        tier: "paid",
        estimatedCost: 15,
      },
      features: {
        ai: true,
        plm: true,
        marketplace: true,
        git: true,
        analytics: true,
      },
    },
    estimatedMonthlyCost: 90,
    setupTime: "20 minutes",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Bare minimum setup for testing and development",
    category: "personal",
    icon: "⚡",
    config: {
      deploymentType: "self-hosted",
      database: {
        provider: "sqlite",
        tier: "free",
        estimatedCost: 0,
      },
      storage: {
        provider: "local",
        tier: "free",
        estimatedCost: 0,
      },
      features: {
        ai: false,
        plm: false,
        marketplace: false,
        git: false,
        analytics: false,
      },
    },
    estimatedMonthlyCost: 0,
    setupTime: "2 minutes",
  },
];

export function getTemplateById(id: string): StartupTemplate | undefined {
  return startupTemplates.find(t => t.id === id);
}

export function getTemplatesByCategory(category: StartupTemplate["category"]): StartupTemplate[] {
  return startupTemplates.filter(t => t.category === category);
}

export function getZeroCostTemplates(): StartupTemplate[] {
  return startupTemplates.filter(t => t.estimatedMonthlyCost === 0);
}

/**
 * Convert template to deployment config
 */
export function templateToDeploymentConfig(
  template: StartupTemplate,
  customization: {
    organizationName: string;
    organizationEmail: string;
    databaseConnectionString?: string;
    storageConfig?: Record<string, string>;
    vectorDbConfig?: Record<string, string>;
  }
) {
  return {
    deploymentType: template.config.deploymentType,
    platform: "trancendos" as const, // Default to trancendos, can be changed
    database: {
      provider: template.config.database.provider,
      connectionString: customization.databaseConnectionString || "",
    },
    vectorDatabase: template.config.vectorDatabase?.enabled
      ? {
          enabled: true,
          provider: template.config.vectorDatabase.provider,
          config: customization.vectorDbConfig || {},
        }
      : undefined,
    storage: {
      provider: template.config.storage.provider,
      config: customization.storageConfig || {},
    },
    domain: template.config.domain?.name,
    organization: {
      name: customization.organizationName,
      email: customization.organizationEmail,
    },
  };
}
