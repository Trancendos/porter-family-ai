/**
 * The Dr's Dependency Analyzer Service
 * 
 * Analyzes project dependencies to identify:
 * - Circular dependencies
 * - Unused dependencies
 * - Outdated packages
 * - Security vulnerabilities
 * - Dependency graph visualization data
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';

export interface DependencyNode {
  id: string;
  name: string;
  type: 'file' | 'package' | 'module';
  path: string;
  imports: string[];
  exports: string[];
  size: number;
  lastModified: Date;
}

export interface DependencyEdge {
  source: string;
  target: string;
  type: 'import' | 'require' | 'dynamic';
  count: number;
}

export interface CircularDependency {
  cycle: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  suggestion: string;
}

export interface UnusedDependency {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency';
  reason: string;
  canRemove: boolean;
}

export interface DependencyHealth {
  score: number; // 0-100
  totalDependencies: number;
  circularDependencies: number;
  unusedDependencies: number;
  outdatedDependencies: number;
  vulnerabilities: number;
  issues: string[];
  recommendations: string[];
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  clusters: {
    id: string;
    name: string;
    nodes: string[];
  }[];
}

class DependencyAnalyzer {
  private projectRoot: string;
  private nodeCache: Map<string, DependencyNode> = new Map();
  private edgeCache: Map<string, DependencyEdge> = new Map();

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Analyze all project dependencies
   */
  async analyzeDependencies(): Promise<{
    graph: DependencyGraph;
    circular: CircularDependency[];
    unused: UnusedDependency[];
    health: DependencyHealth;
  }> {
    console.log('[Dependency Analyzer] Starting analysis...');

    // Build dependency graph
    const graph = await this.buildDependencyGraph();

    // Detect circular dependencies
    const circular = this.detectCircularDependencies(graph);

    // Find unused dependencies
    const unused = await this.findUnusedDependencies(graph);

    // Calculate health score
    const health = this.calculateHealthScore(graph, circular, unused);

    console.log('[Dependency Analyzer] Analysis complete');
    return { graph, circular, unused, health };
  }

  /**
   * Build dependency graph from project files
   */
  private async buildDependencyGraph(): Promise<DependencyGraph> {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const clusters: { id: string; name: string; nodes: string[] }[] = [];

    // Scan project files
    const files = this.scanProjectFiles([
      join(this.projectRoot, 'server'),
      join(this.projectRoot, 'client/src'),
      join(this.projectRoot, 'drizzle'),
    ]);

    // Parse each file
    for (const filePath of files) {
      try {
        const node = this.parseFile(filePath);
        nodes.push(node);
        this.nodeCache.set(node.id, node);

        // Create edges from imports
        for (const importPath of node.imports) {
          const edgeKey = `${node.id}->${importPath}`;
          if (this.edgeCache.has(edgeKey)) {
            const edge = this.edgeCache.get(edgeKey)!;
            edge.count++;
          } else {
            const edge: DependencyEdge = {
              source: node.id,
              target: importPath,
              type: 'import',
              count: 1,
            };
            edges.push(edge);
            this.edgeCache.set(edgeKey, edge);
          }
        }
      } catch (error) {
        console.error(`[Dependency Analyzer] Error parsing ${filePath}:`, error);
      }
    }

    // Create clusters by directory
    const clusterMap = new Map<string, string[]>();
    for (const node of nodes) {
      const dir = node.path.split('/').slice(0, -1).join('/');
      if (!clusterMap.has(dir)) {
        clusterMap.set(dir, []);
      }
      clusterMap.get(dir)!.push(node.id);
    }

    for (const [dir, nodeIds] of clusterMap) {
      clusters.push({
        id: dir,
        name: dir.split('/').pop() || 'root',
        nodes: nodeIds,
      });
    }

    return { nodes, edges, clusters };
  }

  /**
   * Scan project files recursively
   */
  private scanProjectFiles(directories: string[]): string[] {
    const files: string[] = [];

    const scan = (dir: string) => {
      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);

          if (stat.isDirectory()) {
            // Skip node_modules and hidden directories
            if (entry !== 'node_modules' && !entry.startsWith('.')) {
              scan(fullPath);
            }
          } else if (stat.isFile()) {
            // Include TypeScript and JavaScript files
            if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Ignore errors (permission denied, etc.)
      }
    };

    for (const dir of directories) {
      scan(dir);
    }

    return files;
  }

  /**
   * Parse a single file to extract dependencies
   */
  private parseFile(filePath: string): DependencyNode {
    const content = readFileSync(filePath, 'utf-8');
    const stat = statSync(filePath);
    const relativePath = relative(this.projectRoot, filePath);

    // Extract imports using regex
    const imports: string[] = [];
    const exports: string[] = [];

    // Match ES6 imports
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Match require statements
    const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Match exports
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+(\w+)/g;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    return {
      id: relativePath,
      name: filePath.split('/').pop() || 'unknown',
      type: 'file',
      path: relativePath,
      imports: [...new Set(imports)], // Remove duplicates
      exports: [...new Set(exports)],
      size: stat.size,
      lastModified: stat.mtime,
    };
  }

  /**
   * Detect circular dependencies using DFS
   */
  private detectCircularDependencies(graph: DependencyGraph): CircularDependency[] {
    const circular: CircularDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      // Get all edges from this node
      const edges = graph.edges.filter(e => e.source === nodeId);
      for (const edge of edges) {
        const targetId = edge.target;

        // If target is in recursion stack, we found a cycle
        if (recursionStack.has(targetId)) {
          const cycleStart = path.indexOf(targetId);
          const cycle = path.slice(cycleStart);
          cycle.push(targetId); // Complete the cycle

          // Calculate severity based on cycle length
          let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
          if (cycle.length === 2) severity = 'critical';
          else if (cycle.length === 3) severity = 'high';
          else if (cycle.length <= 5) severity = 'medium';

          circular.push({
            cycle,
            severity,
            impact: `Circular dependency of length ${cycle.length} can cause initialization issues`,
            suggestion: this.generateCircularDependencySuggestion(cycle),
          });
        } else if (!visited.has(targetId)) {
          dfs(targetId, [...path]);
        }
      }

      recursionStack.delete(nodeId);
    };

    // Run DFS from each node
    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return circular;
  }

  /**
   * Generate suggestion for fixing circular dependency
   */
  private generateCircularDependencySuggestion(cycle: string[]): string {
    if (cycle.length === 2) {
      return `Extract shared logic into a third module that both ${cycle[0]} and ${cycle[1]} can import`;
    } else if (cycle.length === 3) {
      return `Consider using dependency injection or event-driven architecture to break the cycle`;
    } else {
      return `Refactor to create a clearer module hierarchy. Consider splitting ${cycle[0]} into smaller modules`;
    }
  }

  /**
   * Find unused dependencies
   */
  private async findUnusedDependencies(graph: DependencyGraph): Promise<UnusedDependency[]> {
    const unused: UnusedDependency[] = [];

    try {
      // Read package.json
      const packageJsonPath = join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Check which dependencies are actually imported
      const importedPackages = new Set<string>();
      for (const node of graph.nodes) {
        for (const imp of node.imports) {
          // Extract package name from import path
          if (!imp.startsWith('.') && !imp.startsWith('/')) {
            const packageName = imp.startsWith('@') 
              ? imp.split('/').slice(0, 2).join('/')
              : imp.split('/')[0];
            importedPackages.add(packageName);
          }
        }
      }

      // Find unused dependencies
      for (const [name, version] of Object.entries(allDeps)) {
        if (!importedPackages.has(name)) {
          const isDev = name in (packageJson.devDependencies || {});
          unused.push({
            name,
            version: version as string,
            type: isDev ? 'devDependency' : 'dependency',
            reason: 'Not imported in any project file',
            canRemove: !this.isEssentialDependency(name),
          });
        }
      }
    } catch (error) {
      console.error('[Dependency Analyzer] Error finding unused dependencies:', error);
    }

    return unused;
  }

  /**
   * Check if a dependency is essential (should not be removed)
   */
  private isEssentialDependency(name: string): boolean {
    const essential = [
      'react',
      'react-dom',
      'vite',
      'typescript',
      'tsx',
      '@types/node',
      '@types/react',
      '@types/react-dom',
      'drizzle-orm',
      'drizzle-kit',
      'express',
      '@trpc/server',
      '@trpc/client',
      '@trpc/react-query',
    ];
    return essential.includes(name);
  }

  /**
   * Calculate overall dependency health score
   */
  private calculateHealthScore(
    graph: DependencyGraph,
    circular: CircularDependency[],
    unused: UnusedDependency[]
  ): DependencyHealth {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Deduct points for circular dependencies
    const criticalCircular = circular.filter(c => c.severity === 'critical').length;
    const highCircular = circular.filter(c => c.severity === 'high').length;
    score -= criticalCircular * 20;
    score -= highCircular * 10;
    score -= circular.length * 2;

    if (circular.length > 0) {
      issues.push(`Found ${circular.length} circular dependencies`);
      recommendations.push('Refactor circular dependencies to improve code maintainability');
    }

    // Deduct points for unused dependencies
    const removableUnused = unused.filter(u => u.canRemove).length;
    score -= removableUnused * 3;

    if (removableUnused > 0) {
      issues.push(`Found ${removableUnused} unused dependencies`);
      recommendations.push('Remove unused dependencies to reduce bundle size');
    }

    // Bonus points for good practices
    if (graph.clusters.length > 5) {
      score += 5; // Good modular structure
    }

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      totalDependencies: graph.nodes.length,
      circularDependencies: circular.length,
      unusedDependencies: unused.length,
      outdatedDependencies: 0, // TODO: Implement outdated check
      vulnerabilities: 0, // TODO: Implement vulnerability check
      issues,
      recommendations,
    };
  }

  /**
   * Get real-time system health metrics
   */
  getSystemMetrics(): {
    cpu: number;
    memory: { used: number; total: number; percentage: number };
    uptime: number;
    errorRate: number;
  } {
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const usedMem = memUsage.heapUsed;

    return {
      cpu: process.cpuUsage().user / 1000000, // Convert to seconds
      memory: {
        used: Math.round(usedMem / 1024 / 1024), // MB
        total: Math.round(totalMem / 1024 / 1024), // MB
        percentage: Math.round((usedMem / totalMem) * 100),
      },
      uptime: Math.round(process.uptime()),
      errorRate: 0, // TODO: Calculate from error logs
    };
  }
}

// Create singleton instance
const dependencyAnalyzer = new DependencyAnalyzer();

// Export functions
export async function analyzeDependencies() {
  return dependencyAnalyzer.analyzeDependencies();
}

export function getSystemMetrics() {
  return dependencyAnalyzer.getSystemMetrics();
}
