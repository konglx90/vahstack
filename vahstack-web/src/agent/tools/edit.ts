import { z } from 'zod';
import { fileSystemManager } from '../../utils/fileSystem';

export function createEditTool() {
  return {
    name: 'edit',
    description: `
Edit files in the local filesystem.
Usage:
- You must use your read tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file.
- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the old_string or new_string.
- For moving or renaming files, you should generally use the Bash tool with the 'mv' command instead.
- For larger edits, use the Write tool to overwrite files.
- For file creation, use the Write tool.
- When making multiple file edits in a row to the same file, you should prefer to send all edits in a single message with multiple calls to this tool, rather than multiple messages with a single call each.
`.trim(),
    parameters: z.object({
      file_path: z.string().describe('The path of the file to modify'),
      old_string: z.string().describe('The text to replace'),
      new_string: z
        .string()
        .describe('The text to replace the old_string with'),
    }),
    getDescription: (params: { file_path?: string }) => {
      if (!params.file_path || typeof params.file_path !== 'string') {
        return 'No file path provided';
      }
      return params.file_path;
    },
    execute: async ({
      file_path,
      old_string,
      new_string,
    }: {
      file_path: string;
      old_string: string;
      new_string: string;
    }) => {
      try {
        const { updatedFile } = applyEdit(
          file_path,
          old_string,
          new_string,
          'search-replace',
        );

        fileSystemManager.writeFileSync(file_path, updatedFile);

        return {
          llmContent: `File ${file_path} successfully edited.`,
          returnDisplay: JSON.stringify({
            type: 'diff_viewer',
            filePath: file_path,
            originalContent: old_string,
            newContent: new_string,
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

function applyEdit(
  file_path: string,
  old_string: string,
  new_string: string,
  mode: 'search-replace' | 'whole-file' = 'search-replace',
): { updatedFile: string } {
  let originalFile;
  let updatedFile;

  if (mode === 'whole-file') {
    // In whole-file mode, we directly use the new content
    originalFile =
      old_string === '' ? '' : fileSystemManager.readFileSync(file_path);
    updatedFile = new_string;
  } else {
    if (old_string === '') {
      originalFile = '';
      updatedFile = new_string;
    } else {
      originalFile = fileSystemManager.readFileSync(file_path);
      updatedFile = originalFile.replace(old_string, () => new_string);
    }
  }

  if (updatedFile === originalFile) {
    throw new Error(
      `Original and edited file match exactly. Failed to apply edit. ${JSON.stringify(
        {
          file_path,
          old_string,
          new_string,
        },
      )}`,
    );
  }

  return { updatedFile };
}
