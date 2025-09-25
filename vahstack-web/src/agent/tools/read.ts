import { z } from 'zod';
import type { ToolResult } from '../../types';
import { fileSystemManager } from '../../utils/fileSystem';

type ImageMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'image/bmp'
  | 'image/svg+xml'
  | 'image/tiff';

const MAX_IMAGE_SIZE = 3.75 * 1024 * 1024; // 3.75MB in bytes
const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
  '.svg',
  '.tiff',
  '.tif',
]);

function getImageMimeType(ext: string): ImageMediaType {
  const mimeTypes: Record<string, ImageMediaType> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

function createImageResponse(buffer: Buffer, ext: string): ToolResult {
  const mimeType = getImageMimeType(ext);
  const base64 = buffer.toString('base64');
  const data = `data:${mimeType};base64,${base64}`;
  return {
    llmContent: JSON.stringify([{ type: 'image', data, mimeType }]),
    returnDisplay: 'Read image file successfully.',
  };
}

async function processImage(filePath: string): Promise<ToolResult> {
  try {
    const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));

    // Check if it's a supported image format
    if (!IMAGE_EXTENSIONS.has(ext)) {
      return {
        isError: true,
        returnDisplay: `Unsupported image format: ${ext}`,
        llmContent: JSON.stringify({
          type: 'error',
          message: `Unsupported image format: ${ext}`,
        }),
      };
    }

    const buffer = fileSystemManager.readFileBinarySync(filePath);

    if (buffer.length > MAX_IMAGE_SIZE) {
      return {
        isError: true,
        returnDisplay: `Image file too large: ${buffer.length} bytes (max: ${MAX_IMAGE_SIZE} bytes)`,
        llmContent: JSON.stringify({
          type: 'error',
          message: `Image file too large: ${buffer.length} bytes (max: ${MAX_IMAGE_SIZE} bytes)`,
        }),
      };
    }

    return createImageResponse(buffer, ext);
  } catch (error) {
    return {
      isError: true,
      returnDisplay: `Failed to read image: ${error}`,
      llmContent: JSON.stringify({
        type: 'error',
        message: `Failed to read image: ${error}`,
      }),
    };
  }
}

const MAX_LINES_TO_READ = 2000;
const MAX_LINE_LENGTH = 2000;

export function createReadTool() {
  return {
    name: 'read',
    description: `
Reads a file from the local filesystem. You can access any file directly by using this tool.

Usage:
- By default, it reads up to ${MAX_LINES_TO_READ} lines starting from the beginning of the file
- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters
- Any lines longer than ${MAX_LINE_LENGTH} characters will be truncated
- This tool allows reading images (eg PNG, JPG, etc). When reading an image file the contents are presented visually.
      `,
    parameters: z.object({
      file_path: z.string().describe('The absolute path to the file to read'),
      offset: z
        .number()
        .optional()
        .nullable()
        .describe(
          'The line number to start reading from. Only provide if the file is too large to read at once',
        ),
      limit: z
        .number()
        .optional()
        .nullable()
        .describe(
          `The number of lines to read. Only provide if the file is too large to read at once`,
        ),
    }),
    getDescription: (params: { file_path?: string }) => {
      if (!params.file_path || typeof params.file_path !== 'string') {
        return 'No file path provided';
      }
      return params.file_path;
    },
    execute: async ({
      file_path,
      offset,
      limit,
    }: {
      file_path: string;
      offset?: number | null;
      limit?: number | null;
    }) => {
      try {
        // Validate parameters
        if (!file_path || typeof file_path !== 'string') {
          throw new Error('File path is required and must be a string');
        }
        if (offset !== undefined && offset !== null && offset < 1) {
          throw new Error('Offset must be >= 1');
        }
        if (limit !== undefined && limit !== null && limit < 1) {
          throw new Error('Limit must be >= 1');
        }

        const ext = '.' + (file_path.split('.').pop()?.toLowerCase() || '');

        if (!fileSystemManager.existsSync(file_path)) {
          throw new Error(`File ${file_path} does not exist.`);
        }

        // Handle image files
        if (IMAGE_EXTENSIONS.has(ext)) {
          const result = await processImage(file_path);
          return result;
        }

        // Handle text files
        const content = fileSystemManager.readFileSync(file_path);
        const allLines = content.split(/\r?\n/);
        const totalLines = allLines.length;

        // Apply offset and limit with defaults
        const actualOffset = offset ?? 1;
        const actualLimit = limit ?? MAX_LINES_TO_READ;
        const startLine = Math.max(0, actualOffset - 1); // Convert 1-based to 0-based
        const endLine = Math.min(totalLines, startLine + actualLimit);
        const selectedLines = allLines.slice(startLine, endLine);

        // Truncate long lines
        const truncatedLines = selectedLines.map((line: string) =>
          line.length > MAX_LINE_LENGTH
            ? line.substring(0, MAX_LINE_LENGTH) + '...'
            : line,
        );

        const processedContent = truncatedLines.join('\n');
        const actualLinesRead = selectedLines.length;

        return {
          returnDisplay:
            offset !== undefined || limit !== undefined
              ? `Read ${actualLinesRead} lines (from line ${startLine + 1} to ${endLine}).`
              : `Read ${actualLinesRead} lines.`,
          llmContent: JSON.stringify({
            type: 'text',
            filePath: file_path,
            content: processedContent,
            totalLines,
            offset: startLine + 1, // Convert back to 1-based
            limit: actualLimit,
            actualLinesRead,
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
