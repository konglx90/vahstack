import { z } from 'zod';
import { fileSystemManager } from '../../utils/fileSystem';

export function createWriteTool() {
  return {
    name: 'write',
    description: 'Write a file to the local filesystem',
    parameters: z.object({
      file_path: z.string().describe('The path to the file to write'),
      content: z.string().describe('The content to write to the file'),
    }),
    getDescription: (params: { file_path?: string }) => {
      if (!params.file_path || typeof params.file_path !== 'string') {
        return 'No file path provided';
      }
      return params.file_path;
    },
    execute: async ({
      file_path,
      content,
    }: {
      file_path: string;
      content: string;
    }) => {
      try {
        const oldFileExists = fileSystemManager.existsSync(file_path);
        const oldContent = oldFileExists
          ? fileSystemManager.readFileSync(file_path)
          : '';

        // Write the file with formatted content
        fileSystemManager.writeFileSync(file_path, format(content));

        return {
          llmContent: `File successfully written to ${file_path}`,
          returnDisplay: JSON.stringify({
            type: 'diff_viewer',
            filePath: file_path,
            originalContent: oldContent,
            newContent: content,
            writeType: oldFileExists ? 'replace' : 'add',
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
      category: 'write',
    },
  };
}

function format(content: string) {
  if (!content.endsWith('\n')) {
    return content + '\n';
  }
  return content;
}
