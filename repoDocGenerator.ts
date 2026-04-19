/**
 * Repository Documentation Generator
 * 
 * Auto-generate README, code structure diagrams, and dependency graphs
 */

import { invokeLLM } from "../_core/llm";
import * as fs from "fs/promises";
import * as path from "path";

export interface RepoStructure {
  name: string;
  type: "file" | "directory";
  path: string;
  children?: RepoStructure[];
  size?: number;
  extension?: string;
}

export interface DependencyGraph {
  nodes: Array<{ id: string; label: string; type: "internal" | "external" }>;
  edges: Array<{ from: string; to: string; type: "imports" | "depends-on" }>;
}

export interface READMEContent {
  title: string;
  description: string;
  features: string[];
  installation: string;
  usage: string;
  apiDocs: string;
  contributing: string;
  license: string;
}

/**
 * Analyze repository structure
 */
export async function analyzeRepoStructure(repoPath: string): Promise<RepoStructure> {
  const stats = await fs.stat(repoPath);
  const name = path.basename(repoPath);

  if (stats.isFile()) {
    return {
      name,
      type: "file",
      path: repoPath,
      size: stats.size,
      extension: path.extname(name),
    };
  }

  const entries = await fs.readdir(repoPath);
  const children: RepoStructure[] = [];

  for (const entry of entries) {
    // Skip node_modules, .git, etc.
    if (entry === "node_modules" || entry === ".git" || entry === "dist" || entry === "build") {
      continue;
    }

    const entryPath = path.join(repoPath, entry);
    try {
      const child = await analyzeRepoStructure(entryPath);
      children.push(child);
    } catch (error) {
      // Skip inaccessible files
    }
  }

  return {
    name,
    type: "directory",
    path: repoPath,
    children,
  };
}

/**
 * Generate README content from repository analysis
 */
export async function generateREADME(
  repoPath: string,
  structure: RepoStructure,
  packageJson?: any
): Promise<READMEContent> {
  // Read key files for context
  const keyFiles: Record<string, string> = {};

  try {
    const mainFile = await findMainFile(repoPath);
    if (mainFile) {
      keyFiles.main = await fs.readFile(mainFile, "utf-8");
    }
  } catch (error) {
    // No main file found
  }

  const structureTree = generateStructureTree(structure);

  const prompt = `Generate comprehensive README content for this repository.

**Repository Structure:**
\`\`\`
${structureTree}
\`\`\`

${packageJson ? `**Package.json:**\n\`\`\`json\n${JSON.stringify(packageJson, null, 2)}\n\`\`\`` : ""}

${keyFiles.main ? `**Main File:**\n\`\`\`\n${keyFiles.main.slice(0, 1000)}\n\`\`\`` : ""}

Generate:
1. Project title and description
2. Key features (3-5 bullet points)
3. Installation instructions
4. Usage examples
5. API documentation overview
6. Contributing guidelines
7. License information

Respond in JSON format:
{
  "title": "Project Title",
  "description": "Brief description",
  "features": ["Feature 1", "Feature 2"],
  "installation": "Installation instructions",
  "usage": "Usage examples",
  "apiDocs": "API documentation",
  "contributing": "Contributing guidelines",
  "license": "License info"
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are an expert at writing clear, comprehensive README documentation." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "readme_content",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            features: { type: "array", items: { type: "string" } },
            installation: { type: "string" },
            usage: { type: "string" },
            apiDocs: { type: "string" },
            contributing: { type: "string" },
            license: { type: "string" },
          },
          required: ["title", "description", "features", "installation", "usage", "apiDocs", "contributing", "license"],
          additionalProperties: false,
        },
      },
    },
  });

  const result = JSON.parse((typeof response.choices[0].message.content === "string" ? response.choices[0].message.content : JSON.stringify(response.choices[0].message.content)) || "{}");
  return result;
}

/**
 * Generate dependency graph
 */
export async function generateDependencyGraph(repoPath: string): Promise<DependencyGraph> {
  const nodes: Array<{ id: string; label: string; type: "internal" | "external" }> = [];
  const edges: Array<{ from: string; to: string; type: "imports" | "depends-on" }> = [];

  // Read package.json for external dependencies
  try {
    const packageJsonPath = path.join(repoPath, "package.json");
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));

    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const dep of Object.keys(dependencies)) {
      nodes.push({
        id: dep,
        label: dep,
        type: "external",
      });
    }
  } catch (error) {
    // No package.json
  }

  // Analyze internal files for imports
  // TODO: Implement import analysis

  return { nodes, edges };
}

/**
 * Generate code structure diagram
 */
export async function generateStructureDiagram(structure: RepoStructure): Promise<string> {
  // Generate Mermaid diagram
  const mermaid = `graph TD\n${generateMermaidNodes(structure, "")}`;
  return mermaid;
}

function generateMermaidNodes(node: RepoStructure, prefix: string): string {
  const nodeId = prefix + node.name.replace(/[^a-zA-Z0-9]/g, "_");
  let result = `  ${nodeId}["${node.name}"]\n`;

  if (node.children) {
    for (const child of node.children) {
      const childId = nodeId + "_" + child.name.replace(/[^a-zA-Z0-9]/g, "_");
      result += `  ${nodeId} --> ${childId}\n`;
      result += generateMermaidNodes(child, nodeId + "_");
    }
  }

  return result;
}

/**
 * Helper: Generate structure tree string
 */
function generateStructureTree(node: RepoStructure, indent: string = ""): string {
  let result = indent + (node.type === "directory" ? "📁 " : "📄 ") + node.name + "\n";

  if (node.children) {
    for (const child of node.children) {
      result += generateStructureTree(child, indent + "  ");
    }
  }

  return result;
}

/**
 * Helper: Find main entry file
 */
async function findMainFile(repoPath: string): Promise<string | null> {
  const candidates = [
    "index.ts",
    "index.js",
    "main.ts",
    "main.js",
    "app.ts",
    "app.js",
    "server.ts",
    "server.js",
  ];

  for (const candidate of candidates) {
    const filePath = path.join(repoPath, candidate);
    try {
      await fs.access(filePath);
      return filePath;
    } catch (error) {
      // File doesn't exist
    }
  }

  return null;
}

/**
 * Write README file
 */
export async function writeREADME(repoPath: string, content: READMEContent): Promise<void> {
  const markdown = `# ${content.title}

${content.description}

## Features

${content.features.map((f) => `- ${f}`).join("\n")}

## Installation

${content.installation}

## Usage

${content.usage}

## API Documentation

${content.apiDocs}

## Contributing

${content.contributing}

## License

${content.license}
`;

  const readmePath = path.join(repoPath, "README.md");
  await fs.writeFile(readmePath, markdown, "utf-8");
}
