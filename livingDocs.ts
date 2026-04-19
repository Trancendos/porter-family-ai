import * as fs from "fs/promises";
import * as path from "path";
import { invokeLLM } from "../_core/llm";

interface DocFile {
  path: string;
  content: string;
  type: "code" | "markdown" | "config";
}

/**
 * Extract documentation from source code files
 */
export async function extractDocsFromCode(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    
    // Use AI to extract meaningful documentation
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting and generating technical documentation from source code. Focus on API interfaces, key functions, data structures, and usage examples.",
        },
        {
          role: "user",
          content: `Extract documentation from this code file (${path.basename(filePath)}):\n\n${content}\n\nGenerate comprehensive markdown documentation including:\n1. Overview\n2. Key Functions/Components\n3. Data Structures\n4. Usage Examples\n5. Notes/Warnings`,
        },
      ],
    });

    return response.choices[0]?.message?.content as string || "";
  } catch (error) {
    console.error(`Failed to extract docs from ${filePath}:`, error);
    return "";
  }
}

/**
 * Scan project directory for documentation-worthy files
 */
export async function scanProjectFiles(projectRoot: string): Promise<DocFile[]> {
  const docFiles: DocFile[] = [];
  
  const dirsToScan = [
    path.join(projectRoot, "server"),
    path.join(projectRoot, "client/src"),
    path.join(projectRoot, "drizzle"),
  ];

  for (const dir of dirsToScan) {
    try {
      await scanDirectory(dir, docFiles);
    } catch (error) {
      console.warn(`Could not scan directory ${dir}:`, error);
    }
  }

  return docFiles;
}

async function scanDirectory(dir: string, files: DocFile[]): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip node_modules and hidden directories
      if (entry.name.startsWith(".") || entry.name === "node_modules") {
        continue;
      }

      if (entry.isDirectory()) {
        await scanDirectory(fullPath, files);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        
        // Include TypeScript, JavaScript, and markdown files
        if ([".ts", ".tsx", ".js", ".jsx", ".md"].includes(ext)) {
          const content = await fs.readFile(fullPath, "utf-8");
          
          files.push({
            path: fullPath,
            content,
            type: ext === ".md" ? "markdown" : "code",
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
  }
}

/**
 * Generate documentation for a specific module/component
 */
export async function generateModuleDocs(
  moduleName: string,
  files: DocFile[]
): Promise<string> {
  // Filter files related to this module
  const relevantFiles = files.filter((f) =>
    f.path.toLowerCase().includes(moduleName.toLowerCase())
  );

  if (relevantFiles.length === 0) {
    return `# ${moduleName}\n\nNo files found for this module.`;
  }

  // Combine file contents
  const combinedContent = relevantFiles
    .map((f) => `## File: ${path.basename(f.path)}\n\n${f.content}`)
    .join("\n\n---\n\n");

  // Use AI to generate comprehensive documentation
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are an expert technical writer creating comprehensive module documentation. Focus on clarity, completeness, and practical examples.",
      },
      {
        role: "user",
        content: `Generate detailed documentation for the "${moduleName}" module based on these files:\n\n${combinedContent}\n\nInclude:\n1. Module Overview\n2. Architecture\n3. Key Components\n4. API Reference\n5. Usage Examples\n6. Best Practices\n\nFormat in clean markdown.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  return typeof content === 'string' ? content : `# ${moduleName}\n\nDocumentation generation failed.`;
}

/**
 * Update documentation when code changes
 */
export async function syncDocumentation(
  projectRoot: string,
  changedFiles: string[]
): Promise<{ updated: string[]; errors: string[] }> {
  const updated: string[] = [];
  const errors: string[] = [];

  for (const filePath of changedFiles) {
    try {
      const docs = await extractDocsFromCode(filePath);
      if (docs) {
        updated.push(filePath);
        // Store docs in database (handled by caller)
      }
    } catch (error) {
      errors.push(`${filePath}: ${error}`);
    }
  }

  return { updated, errors };
}

/**
 * Generate API documentation from tRPC routers
 */
export async function generateAPIDoc(routerContent: string): Promise<string> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are an expert at generating API documentation. Extract all procedures, their inputs, outputs, and generate clear documentation.",
      },
      {
        role: "user",
        content: `Generate API documentation for this tRPC router:\n\n${routerContent}\n\nInclude:\n1. Endpoint list\n2. Input schemas\n3. Return types\n4. Usage examples\n5. Error handling\n\nFormat in markdown with code examples.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  return typeof content === 'string' ? content : "# API Documentation\n\nGeneration failed.";
}
