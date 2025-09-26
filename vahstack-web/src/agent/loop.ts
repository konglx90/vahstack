import type { ToolResult, ToolUse } from '../types';
import { Usage } from './usage';
import { History, type Message, type OnMessageCallback } from './history';
import { parseMessage, type ParsedContent } from './parse-message';

export interface LoopResult {
  success: boolean;
  data?: {
    text: string;
    history: History;
    usage: Usage;
  };
  error?: {
    type:
      | 'api_error'
      | 'tool_error'
      | 'max_turns_exceeded'
      | 'canceled'
      | 'tool_denied';
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
  input: string | Message[];
  apiKey: string;
  tools?: {
    [key: string]: (params: Record<string, unknown>) => Promise<ToolResult>;
  };
  toolSchemas?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  systemPrompt?: string;
  maxTurns?: number;
  signal?: AbortSignal;
  onTextDelta?: (text: string) => void;
  onText?: (text: string) => void;
  onReasoning?: (text: string) => void;
  onToolUse?: (toolUse: ToolUse) => Promise<ToolUse>;
  onToolResult?: (
    toolUse: ToolUse,
    toolResult: ToolResult,
    approved: boolean,
  ) => Promise<ToolResult>;
  onToolApprove?: (toolUse: ToolUse) => Promise<boolean>;
  onMessage?: OnMessageCallback;
  onTurn?: (turn: {
    usage: Usage;
    startTime: Date;
    endTime: Date;
  }) => Promise<void>;
}

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_MAX_TURNS = 20;

export async function runLoop(options: RunLoopOptions): Promise<LoopResult> {
  const startTime = Date.now();
  let turnsCount = 0;
  let toolCallsCount = 0;
  let finalText = '';
  let lastUsage = Usage.empty();
  const totalUsage = Usage.empty();

  // 初始化历史记录
  const history = new History({
    messages: Array.isArray(options.input)
      ? options.input
      : [
          {
            role: 'user',
            content: options.input,
            timestamp: new Date().toISOString(),
            uuid: generateUUID(),
            parentUuid: null,
          },
        ],
    onMessage: options.onMessage,
  });

  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
  const abortController = new AbortController();

  const createCancelError = (): LoopResult => ({
    success: false,
    error: {
      type: 'canceled',
      message: 'Operation was canceled',
      details: { turnsCount, history, usage: totalUsage },
    },
  });

  while (true) {
    // 检查取消信号
    if (options.signal?.aborted && !abortController.signal.aborted) {
      abortController.abort();
      return createCancelError();
    }

    const turnStartTime = new Date();
    turnsCount++;

    if (turnsCount > maxTurns) {
      return {
        success: false,
        error: {
          type: 'max_turns_exceeded',
          message: `Maximum turns (${maxTurns}) exceeded`,
          details: {
            turnsCount,
            history,
            usage: totalUsage,
          },
        },
      };
    }

    lastUsage.reset();

    // 准备API请求
    const messages = history.toApiMessages();

    // 添加系统提示
    if (options.systemPrompt && messages[0]?.role !== 'system') {
      messages.unshift({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    const requestBody = {
      model: 'deepseek-chat',
      messages,
      tools: options.toolSchemas || [],
      stream: true,
      temperature: 0.1,
    };

    let text = '';
    let hasToolUse = false;

    try {
      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (options.signal?.aborted) {
          return createCancelError();
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const chunk = JSON.parse(data);
              const delta = chunk.choices?.[0]?.delta;

              if (delta?.content) {
                const textDelta = delta.content;
                text += textDelta;
                await options.onTextDelta?.(textDelta);
              }

              // 处理使用统计
              if (chunk.usage) {
                lastUsage = Usage.fromApiResponse(chunk.usage);
                totalUsage.add(lastUsage);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          type: 'api_error',
          message:
            error instanceof Error ? error.message : 'Unknown streaming error',
          details: {
            error,
          },
        },
      };
    }

    // 检查取消信号
    if (options.signal?.aborted) {
      return createCancelError();
    }

    // 解析消息内容
    const parsed = parseMessage(text);

    // 处理文本内容
    const textContent = parsed.find(
      (item): item is ParsedContent & { type: 'text' } => item.type === 'text',
    );
    if (textContent) {
      await options.onText?.(textContent.content);
      finalText = textContent.content;
    }

    // 为工具调用生成callId
    parsed.forEach((item) => {
      if (item.type === 'tool_use') {
        item.callId = generateUUID();
      }
    });

    const turnEndTime = new Date();
    await options.onTurn?.({
      usage: lastUsage,
      startTime: turnStartTime,
      endTime: turnEndTime,
    });

    // 添加助手消息到历史
    await history.addMessage({
      role: 'assistant',
      content: parsed.map((item) => {
        if (item.type === 'text') {
          return {
            type: 'text',
            text: item.content,
          };
        } else {
          return {
            type: 'tool_use',
            id: item.callId!,
            name: item.name,
            input: item.params,
          };
        }
      }),
      usage: {
        input_tokens: lastUsage.promptTokens,
        output_tokens: lastUsage.completionTokens,
      },
    });

    // 处理工具调用
    const toolUse = parsed.find(
      (item): item is ParsedContent & { type: 'tool_use' } =>
        item.type === 'tool_use',
    );

    if (toolUse) {
      const processedToolUse = toolUse;

      // 调用onToolUse回调
      if (options.onToolUse) {
        const toolUseForCallback: ToolUse = {
          name: processedToolUse.name,
          params: processedToolUse.params,
          callId: processedToolUse.callId!,
        };
        await options.onToolUse(toolUseForCallback);
      }

      // 检查工具批准
      const approved = options.onToolApprove
        ? await options.onToolApprove({
            name: processedToolUse.name,
            params: processedToolUse.params,
            callId: processedToolUse.callId!,
          })
        : true;

      if (approved) {
        toolCallsCount++;

        // 执行工具
        const toolFunction = options.tools?.[processedToolUse.name];
        if (!toolFunction) {
          const errorResult: ToolResult = {
            llmContent: `Error: Tool '${processedToolUse.name}' not found`,
            isError: true,
          };

          await history.addMessage({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                id: processedToolUse.callId!,
                name: processedToolUse.name,
                input: processedToolUse.params,
                result: errorResult,
              },
            ],
          });

          hasToolUse = true;
          continue;
        }

        try {
          let toolResult = await toolFunction(processedToolUse.params);

          // 调用onToolResult回调
          if (options.onToolResult) {
            toolResult = await options.onToolResult(
              processedToolUse as ToolUse,
              toolResult,
              approved,
            );
          }

          await history.addMessage({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                id: processedToolUse.callId!,
                name: processedToolUse.name,
                input: processedToolUse.params,
                result: toolResult,
              },
            ],
          });
        } catch (error) {
          const errorResult: ToolResult = {
            llmContent: `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
            isError: true,
          };

          await history.addMessage({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                id: processedToolUse.callId!,
                name: processedToolUse.name,
                input: processedToolUse.params,
                result: errorResult,
              },
            ],
          });
        }
      } else {
        const message = 'Error: Tool execution was denied by user.';
        let toolResult: ToolResult = {
          llmContent: message,
          isError: true,
        };

        if (options.onToolResult) {
          toolResult = await options.onToolResult(
            processedToolUse as ToolUse,
            toolResult,
            approved,
          );
        }

        await history.addMessage({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              id: processedToolUse.callId!,
              name: processedToolUse.name,
              input: processedToolUse.params,
              result: toolResult,
            },
          ],
        });

        return {
          success: false,
          error: {
            type: 'tool_denied',
            message,
            details: {
              toolUse: processedToolUse,
              history,
              usage: totalUsage,
            },
          },
        };
      }

      hasToolUse = true;
    }

    // 如果没有工具调用，结束循环
    if (!hasToolUse) {
      break;
    }
  }

  const duration = Date.now() - startTime;
  return {
    success: true,
    data: {
      text: finalText,
      history,
      usage: totalUsage,
    },
    metadata: {
      turnsCount,
      toolCallsCount,
      duration,
    },
  };
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
