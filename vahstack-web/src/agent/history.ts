import type { ToolResult } from '../types';
import { Usage } from './usage';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContent[];
  timestamp?: string;
  uuid?: string;
  parentUuid?: string | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface MessageContent {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  result?: ToolResult;
}

export interface OnMessageCallback {
  (data: { message: Message }): Promise<void> | void;
}

export class History {
  private messages: Message[] = [];
  private onMessage?: OnMessageCallback;

  constructor(options?: {
    messages?: Message[];
    onMessage?: OnMessageCallback;
  }) {
    this.messages = options?.messages || [];
    this.onMessage = options?.onMessage;
  }

  async addMessage(message: Message): Promise<void> {
    // 生成UUID和时间戳
    if (!message.uuid) {
      message.uuid = this.generateUUID();
    }
    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }

    this.messages.push(message);

    if (this.onMessage) {
      await this.onMessage({ message });
    }
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  // 转换为DeepSeek API格式
  toApiMessages(): Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }> {
    return this.messages.map((message) => {
      let content = '';

      if (typeof message.content === 'string') {
        content = message.content;
      } else if (Array.isArray(message.content)) {
        // 处理复杂内容
        content = message.content
          .map((item) => {
            if (item.type === 'text') {
              return item.text || '';
            } else if (item.type === 'tool_use') {
              return `<use_tool>\n<tool_name>${item.name}</tool_name>\n<arguments>\n${JSON.stringify(item.input, null, 2)}\n</arguments>\n</use_tool>`;
            } else if (item.type === 'tool_result') {
              return `Tool result: ${JSON.stringify(item.result)}`;
            }
            return '';
          })
          .join('\n');
      }

      return {
        role: message.role,
        content: content.trim(),
      };
    });
  }

  // 获取最后一条助手消息的使用统计
  getLastAssistantUsage(): Usage {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const message = this.messages[i];
      if (message.role === 'assistant' && message.usage) {
        return new Usage({
          promptTokens: message.usage.input_tokens,
          completionTokens: message.usage.output_tokens,
          totalTokens: message.usage.input_tokens + message.usage.output_tokens,
        });
      }
    }
    return Usage.empty();
  }

  // 清空历史
  clear(): void {
    this.messages = [];
  }

  // 获取消息数量
  length(): number {
    return this.messages.length;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }
}
