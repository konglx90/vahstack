import { zodToJsonSchema } from 'zod-to-json-schema';
import { resolveTools, Tools, type BrowserContext } from './tool';
import { runLoop, type LoopResult, type RunLoopOptions } from './loop';
import type { ToolResult } from '../types';

// Export additional agent components
export { History } from './history';
export type { Message, MessageContent, OnMessageCallback } from './history';
export { parseMessage } from './parse-message';
export type { ParsedContent } from './parse-message';
export { Usage } from './usage';

// Export types for backward compatibility
export type { BrowserContext, ToolResult };

// Default browser context configuration
const defaultContext: BrowserContext = {
  cwd: '/',
  productName: 'vahstack-next',
  enableWrite: true,
  enableTodo: true,
};

// Generate tool schemas for DeepSeek API
export function generateToolSchemas(tools: Tools) {
  const schemas = [];

  for (const [name, tool] of Object.entries(tools.tools)) {
    const schema = {
      type: 'function' as const,
      function: {
        name,
        description: tool.description,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parameters: zodToJsonSchema(tool.parameters as any, {
          target: 'openApi3',
          $refStrategy: 'none',
        }),
      },
    };
    schemas.push(schema);
  }

  return schemas;
}

// Create Agent using DeepSeek API
export async function createAgentWithTools(
  apiKey: string,
  context: BrowserContext = defaultContext,
  sessionId?: string,
) {
  // Create tools instance using the existing tool management system
  const toolsInstance = new Tools(
    await resolveTools({
      context,
      sessionId,
      write: context.enableWrite,
      todo: context.enableTodo,
    }),
  );

  // Generate tool schemas for DeepSeek API
  const toolSchemas = generateToolSchemas(toolsInstance);

  // Create tool functions map for runLoop
  const toolFunctions: Record<
    string,
    (params: Record<string, unknown>) => Promise<ToolResult>
  > = {};
  for (const [name, tool] of Object.entries(toolsInstance.tools)) {
    toolFunctions[name] = async (params: Record<string, unknown>) => {
      return await tool.execute(params);
    };
  }

  return {
    runLoop: async (
      input: string,
      options?: {
        maxTurns?: number;
        onTextDelta?: (text: string) => void;
        onToolApprove?: (toolUse: {
          name: string;
          params: Record<string, unknown>;
          callId: string;
        }) => Promise<boolean>;
      },
    ): Promise<LoopResult> => {
      const runOptions: RunLoopOptions = {
        input,
        apiKey,
        tools: toolFunctions,
        toolSchemas,
        maxTurns: options?.maxTurns,
        onTextDelta: options?.onTextDelta,
        onToolApprove: options?.onToolApprove,
      };

      return runLoop(runOptions);
    },
    toolsInstance,
  };
}

// Create default agent with DeepSeek API key
export const createDefaultAgent = () => {
  const key = 'sk-e01d55d672994105998e4a03fa545a9c';
  return createAgentWithTools(key);
};

// Backward compatibility - keep the old interface
export const defaultAgent = createDefaultAgent();
