import { z } from 'zod';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5min
const urlCache = new Map();
const MAX_CONTENT_LENGTH = 15000; // 15k

export function createFetchTool() {
  return {
    name: 'fetch',
    description: `
Fetch content from url.
Remembers:
- IMPORTANT: If an MCP-provided web fetch tool is available, prefer using that tool instead of this one, as it may have fewer restrictions. All MCP-provided tools start with "mcp__"
    `.trim(),
    parameters: z.object({
      url: z.string().describe('The url to fetch content from'),
      prompt: z.string().describe('The prompt to run on the fetched content'),
    }),
    getDescription: (params: { url?: string }) => {
      if (!params.url || typeof params.url !== 'string') {
        return 'No URL provided';
      }
      return params.url;
    },
    execute: async ({ url, prompt }: { url: string; prompt: string }) => {
      try {
        const startTime = Date.now();
        const key = `${url}-${prompt}`;
        const cached = urlCache.get(key);
        if (cached && cached.durationMs < CACHE_TTL_MS) {
          return {
            returnDisplay: `Successfully fetched content from ${url} (cached)`,
            llmContent: JSON.stringify({
              ...cached,
              cached: true,
              durationMs: Date.now() - startTime,
            }),
          };
        }

        try {
          new URL(url);
        } catch {
          throw new Error('Invalid URL');
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
          );
        }
        const rawText = await response.text();
        const contentType = response.headers.get('content-type') ?? '';
        const bytes = Buffer.byteLength(rawText, 'utf-8');

        let content;
        if (contentType.includes('text/html')) {
          // Simple HTML to text conversion (without TurndownService dependency)
          content = rawText
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        } else {
          content = rawText;
        }

        if (content.length > MAX_CONTENT_LENGTH) {
          content =
            content.substring(0, MAX_CONTENT_LENGTH) + '...[content truncated]';
        }

        // Simplified processing without LLM query
        const result = `Content from ${url}:\n\n${content}\n\nPrompt: ${prompt}`;

        const code = response.status;
        const codeText = response.statusText;
        const data = {
          result,
          code,
          codeText,
          url,
          bytes,
          contentType,
          durationMs: Date.now() - startTime,
        };
        urlCache.set(key, data);
        return {
          llmContent: JSON.stringify(data),
          returnDisplay: `Successfully fetched content from ${url}`,
        };
      } catch (e) {
        return {
          isError: true,
          llmContent: e instanceof Error ? e.message : 'Unknown error',
        };
      }
    },
    approval: {
      category: 'network',
    },
  };
}
