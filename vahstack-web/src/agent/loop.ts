import type { ToolResult, ToolUse } from '../types';
import { toolSchemas } from './index';

export interface LoopResult {
  success: boolean;
  data?: {
    text: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  error?: {
    type: 'api_error' | 'tool_error' | 'max_turns_exceeded' | 'canceled';
    message: string;
    details?: Record<string, unknown>;
  };
  metadata?: {
    turnsCount: number;
    toolCallsCount: number;
    duration: number;
  };
}

export interface RunLoopOptions {
  input: string;
  apiKey: string;
  tools?: {
    [key: string]: (params: Record<string, unknown>) => Promise<ToolResult>;
  };
  maxTurns?: number;
  signal?: AbortSignal;
  onTextDelta?: (text: string) => void;
  onToolUse?: (toolUse: ToolUse) => Promise<boolean>;
}

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_MAX_TURNS = 20;

export async function runLoop(options: RunLoopOptions): Promise<LoopResult> {
  const startTime = Date.now();
  let turnsCount = 0;
  let toolCallsCount = 0;
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;

  interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
    tool_call_id?: string;
  }

  const messages: Message[] = [
    {
      role: 'system',
      content:
        'You are a helpful AI assistant. You can use tools to help users with various tasks.',
    },
    {
      role: 'user',
      content: options.input,
    },
  ];

  while (turnsCount < maxTurns) {
    if (options.signal?.aborted) {
      return {
        success: false,
        error: {
          type: 'canceled',
          message: 'Operation was canceled',
        },
      };
    }

    turnsCount++;

    try {
      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messages,
          stream: false,
          tools: options.tools ? generateToolsSchema(options.tools) : undefined,
        }),
        signal: options.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: {
            type: 'api_error',
            message: `API request failed: ${response.status} ${response.statusText}`,
            details: errorData,
          },
        };
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      if (!choice) {
        return {
          success: false,
          error: {
            type: 'api_error',
            message: 'No response choice received from API',
          },
        };
      }

      const message = choice.message;

      // Add assistant message to conversation
      messages.push({
        role: 'assistant',
        content: message.content || '',
        tool_calls: message.tool_calls,
      });

      // Handle tool calls if present
      if (
        message.tool_calls &&
        message.tool_calls.length > 0 &&
        options.tools
      ) {
        for (const toolCall of message.tool_calls) {
          toolCallsCount++;

          const toolName = toolCall.function.name;
          const toolParams = JSON.parse(toolCall.function.arguments);

          // Check if tool exists
          if (!options.tools[toolName]) {
            return {
              success: false,
              error: {
                type: 'tool_error',
                message: `Tool '${toolName}' not found`,
              },
            };
          }

          // Ask for approval if callback provided
          if (options.onToolUse) {
            const approved = await options.onToolUse({
              id: toolCall.id,
              name: toolName,
              params: toolParams,
            });

            if (!approved) {
              return {
                success: false,
                error: {
                  type: 'tool_error',
                  message: 'Tool use was not approved',
                },
              };
            }
          }

          try {
            const toolResult = await options.tools[toolName](toolParams);

            // Add tool result to messages
            messages.push({
              role: 'tool',
              content: toolResult.llmContent || 'Tool executed successfully',
              tool_call_id: toolCall.id,
            });

            // Continue the loop for next turn
            continue;
          } catch (error) {
            return {
              success: false,
              error: {
                type: 'tool_error',
                message: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
                details:
                  error instanceof Error
                    ? { message: error.message, stack: error.stack }
                    : { error },
              },
            };
          }
        }
      } else {
        // No tool calls, return the assistant's response
        const text = message.content || '';

        if (options.onTextDelta) {
          options.onTextDelta(text);
        }

        return {
          success: true,
          data: {
            text,
            usage: {
              input_tokens: data.usage?.prompt_tokens || 0,
              output_tokens: data.usage?.completion_tokens || 0,
            },
          },
          metadata: {
            turnsCount,
            toolCallsCount,
            duration: Date.now() - startTime,
          },
        };
      }
    } catch (error) {
      if (options.signal?.aborted) {
        return {
          success: false,
          error: {
            type: 'canceled',
            message: 'Operation was canceled',
          },
        };
      }

      return {
        success: false,
        error: {
          type: 'api_error',
          message: `Request failed: ${error instanceof Error ? error.message : String(error)}`,
          details:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : { error },
        },
      };
    }
  }

  return {
    success: false,
    error: {
      type: 'max_turns_exceeded',
      message: `Maximum turns (${maxTurns}) exceeded`,
    },
    metadata: {
      turnsCount,
      toolCallsCount,
      duration: Date.now() - startTime,
    },
  };
}

function generateToolsSchema(_tools: {
  [key: string]: (params: Record<string, unknown>) => Promise<ToolResult>;
}) {
  // Use the properly defined toolSchemas from index.ts instead of generating empty schemas
  return toolSchemas;
}
