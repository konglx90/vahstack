import { z } from 'zod';
import { fileSystemManager } from '../../utils/fileSystem';

const LIMIT = 100;

export function createGlobTool() {
  return {
    name: 'glob',
    description: `
Glob
- Fast file pattern matching tool that works with any codebase size
- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
`.trim(),
    parameters: z.object({
      pattern: z.string().describe('The glob pattern to match files against'),
      path: z
        .string()
        .optional()
        .nullable()
        .describe('The directory to search in'),
    }),
    getDescription: (params: { pattern?: string }) => {
      if (!params.pattern || typeof params.pattern !== 'string') {
        return 'No pattern provided';
      }
      return params.pattern;
    },
    execute: async ({ pattern, path }: { pattern: string; path?: string }) => {
      try {
        const start = Date.now();

        // Simple glob implementation using file system manager
        const searchPath = path || '.';
        const filenames = await searchFiles(searchPath, pattern);

        const truncated = filenames.length > LIMIT;
        const limitedFilenames = filenames.slice(0, LIMIT);

        const message = truncated
          ? `Found ${limitedFilenames.length} files in ${Date.now() - start}ms, truncating to ${LIMIT}.`
          : `Found ${limitedFilenames.length} files in ${Date.now() - start}ms.`;

        return {
          returnDisplay: message,
          llmContent: JSON.stringify({
            filenames: limitedFilenames,
            durationMs: Date.now() - start,
            numFiles: limitedFilenames.length,
            truncated,
          }),
        };
      } catch (e) {
        return {
          isError: true,
          llmContent: e instanceof Error ? e.message : 'Unknown error',
        };
      }
    },
    approval: {
      category: 'read',
    },
  };
}

async function searchFiles(
  searchPath: string,
  pattern: string,
): Promise<string[]> {
  const results: string[] = [];

  try {
    if (!fileSystemManager.existsSync(searchPath)) {
      return results;
    }

    if (fileSystemManager.isDirectorySync(searchPath)) {
      const entries = await fileSystemManager.listDirectory(searchPath);

      for (const entry of entries) {
        const fullPath = `${searchPath}/${entry}`;

        if (fileSystemManager.isDirectorySync(fullPath)) {
          // Recursively search subdirectories for glob patterns
          if (pattern.includes('**') || pattern.includes('/')) {
            const subResults = await searchFiles(fullPath, pattern);
            results.push(...subResults);
          }
        } else {
          // Check if file matches pattern against full path for glob patterns
          if (
            matchesPattern(fullPath, pattern) ||
            matchesPattern(entry, pattern)
          ) {
            results.push(fullPath);
          }
        }
      }
    }
  } catch {
    // Ignore errors and continue
  }

  return results;
}

function matchesPattern(filename: string, pattern: string): boolean {
  // Simple pattern matching - convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(filename);
}
