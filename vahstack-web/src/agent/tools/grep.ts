import { z } from 'zod';
import { fileSystemManager } from '../../utils/fileSystem';

export function createGrepTool() {
  return {
    name: 'grep',
    description: 'Search for a pattern in files or directories.',
    parameters: z.object({
      pattern: z.string().describe('The pattern to search for'),
      search_path: z
        .string()
        .optional()
        .nullable()
        .describe('The path to search in (defaults to current directory)'),
      recursive: z
        .boolean()
        .optional()
        .describe('Whether to search recursively in subdirectories'),
    }),
    getDescription: ({ params }: { params: { pattern?: string } }) => {
      if (!params.pattern || typeof params.pattern !== 'string') {
        return 'No pattern provided';
      }
      return `Search for "${params.pattern}"`;
    },
    execute: async ({
      pattern,
      search_path,
      recursive = false,
    }: {
      pattern: string;
      search_path?: string | null;
      recursive?: boolean;
    }) => {
      try {
        const searchPath = search_path || '.';
        const results: string[] = [];

        const searchInFile = async (filePath: string) => {
          try {
            const content = await fileSystemManager.readFile(filePath);
            const lines = content.split('\n');
            lines.forEach((line: string, index: number) => {
              if (line.includes(pattern)) {
                results.push(`${filePath}:${index + 1}:${line.trim()}`);
              }
            });
          } catch {
            // Skip files that can't be read
          }
        };

        const searchDirectory = async (dirPath: string) => {
          try {
            const entries = await fileSystemManager.listDirectory(dirPath);
            for (const entry of entries) {
              const fullPath = dirPath === '.' ? entry : `${dirPath}/${entry}`;

              if (await fileSystemManager.exists(fullPath)) {
                const isDir = fileSystemManager.isDirectorySync(fullPath);

                if (!isDir) {
                  await searchInFile(fullPath);
                } else if (recursive) {
                  await searchDirectory(fullPath);
                }
              }
            }
          } catch {
            // Skip directories that can't be read
          }
        };

        if (await fileSystemManager.exists(searchPath)) {
          const isDir = fileSystemManager.isDirectorySync(searchPath);
          if (!isDir) {
            await searchInFile(searchPath);
          } else {
            await searchDirectory(searchPath);
          }
        }

        const output =
          results.length > 0
            ? results.join('\n')
            : `No matches found for pattern: ${pattern}`;

        return {
          llmContent: output,
          returnDisplay: `Found ${results.length} matches for "${pattern}"`,
        };
      } catch (error) {
        return {
          isError: true,
          llmContent:
            error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    },
    approval: {
      category: 'read' as const,
    },
  };
}
