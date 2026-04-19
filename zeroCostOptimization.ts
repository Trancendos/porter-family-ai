/**
 * Zero-Cost Optimization Service
 * Maximizes free tier usage and minimizes costs across all services
 */

interface FreeTierLimit {
  service: string;
  feature: string;
  limit: number;
  unit: string;
  resetPeriod: 'daily' | 'monthly' | 'yearly';
  currentUsage: number;
  percentageUsed: number;
}

interface CostOptimization {
  service: string;
  currentCost: number;
  optimizedCost: number;
  savings: number;
  recommendation: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  implementationSteps: string[];
}

interface ZeroCostAlternative {
  paidService: string;
  freeAlternative: string;
  features: string[];
  limitations: string[];
  migrationEffort: 'easy' | 'medium' | 'hard';
  estimatedSavings: number;
}

/**
 * Free Tier Limits for Popular Services
 */
export const FREE_TIER_LIMITS = {
  cloudflare: {
    bandwidth: { limit: Infinity, unit: 'GB', resetPeriod: 'monthly' as const },
    requests: { limit: Infinity, unit: 'requests', resetPeriod: 'monthly' as const },
    dns_queries: { limit: Infinity, unit: 'queries', resetPeriod: 'monthly' as const },
    page_rules: { limit: 3, unit: 'rules', resetPeriod: 'monthly' as const },
    workers_requests: { limit: 100000, unit: 'requests', resetPeriod: 'daily' as const },
    workers_cpu: { limit: 10, unit: 'ms', resetPeriod: 'daily' as const },
  },
  
  vercel: {
    bandwidth: { limit: 100, unit: 'GB', resetPeriod: 'monthly' as const },
    builds: { limit: 6000, unit: 'minutes', resetPeriod: 'monthly' as const },
    serverless_executions: { limit: 100, unit: 'GB-hours', resetPeriod: 'monthly' as const },
  },
  
  netlify: {
    bandwidth: { limit: 100, unit: 'GB', resetPeriod: 'monthly' as const },
    build_minutes: { limit: 300, unit: 'minutes', resetPeriod: 'monthly' as const },
    serverless_functions: { limit: 125000, unit: 'invocations', resetPeriod: 'monthly' as const },
  },
  
  github: {
    actions_minutes: { limit: 2000, unit: 'minutes', resetPeriod: 'monthly' as const },
    storage: { limit: 500, unit: 'MB', resetPeriod: 'monthly' as const },
    repositories: { limit: Infinity, unit: 'repos', resetPeriod: 'monthly' as const },
  },
  
  sendgrid: {
    emails: { limit: 100, unit: 'emails', resetPeriod: 'daily' as const },
  },
  
  mailgun: {
    emails: { limit: 5000, unit: 'emails', resetPeriod: 'monthly' as const },
  },
  
  sentry: {
    errors: { limit: 5000, unit: 'events', resetPeriod: 'monthly' as const },
    projects: { limit: 1, unit: 'projects', resetPeriod: 'monthly' as const },
  },
  
  stripe: {
    // Stripe doesn't have free tier limits, but has no monthly fees
    // Only pay per transaction: 2.9% + $0.30
    transactions: { limit: Infinity, unit: 'transactions', resetPeriod: 'monthly' as const },
  },
};

/**
 * Zero-Cost Alternatives to Paid Services
 */
export const ZERO_COST_ALTERNATIVES: ZeroCostAlternative[] = [
  {
    paidService: 'DataDog',
    freeAlternative: 'Grafana + Prometheus',
    features: ['Metrics', 'Dashboards', 'Alerts', 'Logs'],
    limitations: ['Self-hosted', 'Requires setup'],
    migrationEffort: 'medium',
    estimatedSavings: 180, // $15/host/month * 12 months
  },
  {
    paidService: 'New Relic',
    freeAlternative: 'Elastic APM',
    features: ['Application monitoring', 'Performance tracking', 'Error tracking'],
    limitations: ['Self-hosted', 'Complex setup'],
    migrationEffort: 'hard',
    estimatedSavings: 1188, // $99/month * 12 months
  },
  {
    paidService: 'Intercom',
    freeAlternative: 'Chatwoot',
    features: ['Live chat', 'Help desk', 'Customer support'],
    limitations: ['Self-hosted', 'Fewer integrations'],
    migrationEffort: 'medium',
    estimatedSavings: 888, // $74/month * 12 months
  },
  {
    paidService: 'Algolia',
    freeAlternative: 'Meilisearch',
    features: ['Full-text search', 'Typo tolerance', 'Faceted search'],
    limitations: ['Self-hosted', 'Less scalable'],
    migrationEffort: 'medium',
    estimatedSavings: 120, // $10/month * 12 months (estimated)
  },
  {
    paidService: 'Auth0',
    freeAlternative: 'Keycloak',
    features: ['OAuth', 'SSO', 'User management'],
    limitations: ['Self-hosted', 'Complex configuration'],
    migrationEffort: 'hard',
    estimatedSavings: 420, // $35/month * 12 months
  },
  {
    paidService: 'SendGrid Pro',
    freeAlternative: 'Mailgun Free + SMTP',
    features: ['Email sending', 'Templates', 'Analytics'],
    limitations: ['5,000 emails/month limit'],
    migrationEffort: 'easy',
    estimatedSavings: 239, // $19.95/month * 12 months
  },
  {
    paidService: 'LogRocket',
    freeAlternative: 'OpenReplay',
    features: ['Session replay', 'Error tracking', 'Performance monitoring'],
    limitations: ['Self-hosted', 'Requires storage'],
    migrationEffort: 'medium',
    estimatedSavings: 1188, // $99/month * 12 months
  },
];

/**
 * Get current usage for all free tier services
 */
export async function getFreeTierUsage(): Promise<FreeTierLimit[]> {
  // This would integrate with actual service APIs
  // For now, return mock data
  
  const usage: FreeTierLimit[] = [];
  
  // Example: Cloudflare Workers
  usage.push({
    service: 'Cloudflare Workers',
    feature: 'Daily Requests',
    limit: 100000,
    unit: 'requests',
    resetPeriod: 'daily',
    currentUsage: 15000,
    percentageUsed: 15,
  });
  
  // Example: Vercel Bandwidth
  usage.push({
    service: 'Vercel',
    feature: 'Bandwidth',
    limit: 100,
    unit: 'GB',
    resetPeriod: 'monthly',
    currentUsage: 25,
    percentageUsed: 25,
  });
  
  // Example: GitHub Actions
  usage.push({
    service: 'GitHub Actions',
    feature: 'Build Minutes',
    limit: 2000,
    unit: 'minutes',
    resetPeriod: 'monthly',
    currentUsage: 450,
    percentageUsed: 22.5,
  });
  
  return usage;
}

/**
 * Analyze costs and provide optimization recommendations
 */
export async function analyzeCosts(): Promise<CostOptimization[]> {
  const optimizations: CostOptimization[] = [];
  
  // Example: Cloudflare Pro to Free
  optimizations.push({
    service: 'Cloudflare',
    currentCost: 20,
    optimizedCost: 0,
    savings: 20,
    recommendation: 'Downgrade from Pro to Free tier - you\'re only using features available in Free tier',
    priority: 'high',
    implementationSteps: [
      'Review current Pro features in use',
      'Confirm no Pro-only features are critical',
      'Downgrade plan in Cloudflare dashboard',
      'Monitor for 1 week to ensure no issues',
    ],
  });
  
  // Example: Reduce Vercel bandwidth
  optimizations.push({
    service: 'Vercel',
    currentCost: 40,
    optimizedCost: 0,
    savings: 40,
    recommendation: 'Move static assets to Cloudflare CDN to stay within free tier',
    priority: 'medium',
    implementationSteps: [
      'Identify large static assets (images, videos, PDFs)',
      'Upload to Cloudflare R2 or external CDN',
      'Update asset URLs in application',
      'Monitor bandwidth usage',
    ],
  });
  
  // Example: Email service optimization
  optimizations.push({
    service: 'SendGrid',
    currentCost: 19.95,
    optimizedCost: 0,
    savings: 19.95,
    recommendation: 'Switch to Mailgun free tier (5,000 emails/month)',
    priority: 'low',
    implementationSteps: [
      'Sign up for Mailgun free account',
      'Update SMTP configuration',
      'Test email sending',
      'Cancel SendGrid subscription',
    ],
  });
  
  return optimizations;
}

/**
 * Get zero-cost alternatives for current paid services
 */
export function getZeroCostAlternatives(currentServices: string[]): ZeroCostAlternative[] {
  return ZERO_COST_ALTERNATIVES.filter(alt => 
    currentServices.includes(alt.paidService)
  );
}

/**
 * Calculate total potential savings
 */
export async function calculatePotentialSavings(): Promise<{
  monthly: number;
  yearly: number;
  optimizations: CostOptimization[];
}> {
  const optimizations = await analyzeCosts();
  
  const monthlySavings = optimizations.reduce((sum, opt) => sum + opt.savings, 0);
  
  return {
    monthly: monthlySavings,
    yearly: monthlySavings * 12,
    optimizations,
  };
}

/**
 * Monitor free tier usage and send alerts
 */
export async function monitorFreeTierUsage(): Promise<{
  alerts: Array<{
    service: string;
    feature: string;
    percentageUsed: number;
    message: string;
    severity: 'info' | 'warning' | 'critical';
  }>;
}> {
  const usage = await getFreeTierUsage();
  const alerts = [];
  
  for (const item of usage) {
    if (item.percentageUsed >= 90) {
      alerts.push({
        service: item.service,
        feature: item.feature,
        percentageUsed: item.percentageUsed,
        message: `${item.service} ${item.feature} is at ${item.percentageUsed}% of free tier limit`,
        severity: 'critical' as const,
      });
    } else if (item.percentageUsed >= 75) {
      alerts.push({
        service: item.service,
        feature: item.feature,
        percentageUsed: item.percentageUsed,
        message: `${item.service} ${item.feature} is at ${item.percentageUsed}% of free tier limit`,
        severity: 'warning' as const,
      });
    }
  }
  
  return { alerts };
}

/**
 * Generate monthly cost report
 */
export async function generateMonthlyCostReport(): Promise<{
  totalCost: number;
  breakdown: Array<{
    service: string;
    cost: number;
    percentage: number;
  }>;
  optimizationOpportunities: CostOptimization[];
  potentialSavings: number;
}> {
  const optimizations = await analyzeCosts();
  
  // Mock data - would integrate with actual billing APIs
  const breakdown = [
    { service: 'Cloudflare', cost: 0, percentage: 0 },
    { service: 'Vercel', cost: 0, percentage: 0 },
    { service: 'GitHub', cost: 0, percentage: 0 },
    { service: 'Stripe', cost: 0, percentage: 0 }, // Transaction fees only
    { service: 'Server Hosting', cost: 0, percentage: 0 }, // Self-hosted
  ];
  
  const totalCost = breakdown.reduce((sum, item) => sum + item.cost, 0);
  const potentialSavings = optimizations.reduce((sum, opt) => sum + opt.savings, 0);
  
  return {
    totalCost,
    breakdown,
    optimizationOpportunities: optimizations,
    potentialSavings,
  };
}

/**
 * Best practices for zero-cost operations
 */
export const ZERO_COST_BEST_PRACTICES = [
  {
    category: 'Hosting',
    practices: [
      'Use Cloudflare Free tier for CDN and DDoS protection',
      'Self-host on your own server instead of managed hosting',
      'Use Vercel/Netlify free tier for static sites',
      'Leverage GitHub Pages for documentation sites',
    ],
  },
  {
    category: 'Database',
    practices: [
      'Use MySQL/PostgreSQL on your own server',
      'Leverage Supabase free tier (500MB database)',
      'Use PlanetScale free tier for serverless MySQL',
      'Implement proper indexing to reduce resource usage',
    ],
  },
  {
    category: 'Email',
    practices: [
      'Use Mailgun free tier (5,000 emails/month)',
      'Implement email queuing to batch sends',
      'Use transactional emails only (no marketing)',
      'Self-host email server for high volume',
    ],
  },
  {
    category: 'Monitoring',
    practices: [
      'Use Grafana + Prometheus (self-hosted)',
      'Leverage Sentry free tier (5,000 errors/month)',
      'Use UptimeRobot for uptime monitoring',
      'Implement custom logging to files',
    ],
  },
  {
    category: 'Authentication',
    practices: [
      'Implement custom JWT-based auth',
      'Use Supabase Auth (free tier)',
      'Self-host Keycloak for OAuth',
      'Leverage social login (Google, GitHub) - free',
    ],
  },
  {
    category: 'Storage',
    practices: [
      'Use Cloudflare R2 (10GB free)',
      'Self-host files on your server',
      'Leverage Supabase Storage (1GB free)',
      'Optimize images before storage',
    ],
  },
  {
    category: 'CI/CD',
    practices: [
      'Use GitHub Actions free tier (2,000 minutes/month)',
      'Self-host Jenkins for unlimited builds',
      'Optimize build times to reduce minutes',
      'Cache dependencies to speed up builds',
    ],
  },
];

export default {
  getFreeTierUsage,
  analyzeCosts,
  getZeroCostAlternatives,
  calculatePotentialSavings,
  monitorFreeTierUsage,
  generateMonthlyCostReport,
  FREE_TIER_LIMITS,
  ZERO_COST_ALTERNATIVES,
  ZERO_COST_BEST_PRACTICES,
};
