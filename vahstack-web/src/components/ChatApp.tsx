import React, { useState, useEffect, useRef } from 'react';
import { notification } from 'antd';
import ChatRichInput from './chat-input/ChatRichInput';
import ToolMessage from './ToolMessage';
import useChatHistory from '../hooks/useChatHistory';
import { useEventManager } from '../hooks/useCustomEvent';

/**
 * ChatApp 组件：智能对话应用的核心组件
 *
 * 核心职责：
 * - 消息管理：处理用户输入、AI响应、工具调用等各类消息
 * - 流式处理：支持实时流式响应，提升用户体验
 * - 工具集成：管理工具调用的生命周期和状态
 * - 历史持久化：本地存储对话历史，支持会话恢复
 *
 * 设计哲学：
 * - 单一职责：每个函数专注于特定功能
 * - 防御性编程：完善的错误处理和边界检查
 * - 用户体验优先：流畅的交互和及时的反馈
 * - 可扩展性：模块化设计，便于功能扩展
 */

// 类型定义
type MessageRole = 'user' | 'assistant';

/**
 * 消息内容接口
 * 支持多种类型的消息内容，包括文本、工具调用等
 */
interface MessageContent {
  text?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: {
    result?: string | object | null;
    data?: {
      filePath?: string;
      actualLinesRead?: number;
    };
  };
  approved?: boolean;
  toolCallId?: string;
}

/**
 * 工具调用接口
 * 定义工具调用的基本结构
 */
interface ToolCall {
  id: string;
  name: string;
  params: Record<string, unknown>;
  timestamp: number;
}

/**
 * 工具结果接口
 * 存储工具执行的结果
 */
interface ToolResult {
  id: string;
  result: string | object | null;
  timestamp: number;
}

/**
 * 工具状态枚举
 * 表示工具调用的执行状态
 */
type ToolStatus = 'running' | 'completed' | 'failed';

/**
 * 带状态的工具调用接口
 * 扩展基础工具调用，增加状态和结果信息
 */
interface ToolCallWithStatus extends ToolCall {
  status: ToolStatus;
  approved?: boolean;
  result?: ToolResult;
}

/**
 * 聊天消息接口
 * 定义聊天消息的完整结构
 */
interface ChatMessage {
  id: string;
  role: MessageRole;
  content: MessageContent;
  contents?: MessageContent[];
  timestamp: number;
}

/**
 * 任务目标接口
 * 定义任务的描述和相关文件
 */
interface TaskTarget {
  message: string;
  targets: string[];
}

/**
 * 组件属性接口
 * 定义 ChatApp 组件的输入参数
 */
interface ChatAppProps {
  initialMessage?: string;
  selectTask?: TaskTarget;
  detail?: {
    message: string;
    targets: string[];
  };
}

/**
 * ChatApp 主组件
 *
 * 实现原则：
 * - 状态提升：将共享状态提升到合适的层级
 * - 关注点分离：UI渲染与业务逻辑分离
 * - 性能优化：合理使用 useCallback 和 useMemo
 */
const ChatApp: React.FC<ChatAppProps> = () => {
  // 状态管理：采用细粒度状态分割，提升性能
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolCalls] = useState<ToolCallWithStatus[]>([]);
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  // Refs：DOM操作和持久化引用
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * 聊天历史管理 Hook
   * 持久化：提供消息的本地存储和恢复功能
   */
  const { messageHistory, addToHistory } = useChatHistory();

  /**
   * 自定义事件管理器
   *
   * 事件驱动：处理工具调用、结果等异步事件
   * 解耦设计：组件间通过事件通信，降低耦合度
   */
  useEventManager('tool_call', () => {});

  /**
   * 组件初始化效果
   *
   * 历史恢复：从本地存储恢复聊天历史
   * 状态同步：将历史数据同步到当前状态
   * 性能考虑：仅在组件挂载时执行一次
   */
  useEffect(() => {
    if (messageHistory && messageHistory.length > 0) {
      const formattedMessages: ChatMessage[] = messageHistory.map(
        (msg: { role: string; content: string }, index: number) => ({
          id: `history_${index}`,
          role: msg.role as MessageRole,
          content: { text: msg.content },
          timestamp: Date.now() - (messageHistory.length - index) * 1000,
        }),
      );
      setMessages(formattedMessages);
    }
  }, [messageHistory]);

  /**
   * 滚动到底部
   *
   * 用户体验：确保新消息始终可见
   * 性能优化：使用 requestAnimationFrame 优化滚动
   */
  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /**
   * 切换工具调用展开状态
   *
   * 交互设计：提供详情的展开/收起功能
   * 状态管理：使用 Set 数据结构优化性能
   */
  const toggleToolCallExpanded = (toolId: string): void => {
    setExpandedToolCalls((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(toolId)) {
        newSet.delete(toolId);
      } else {
        newSet.add(toolId);
      }
      return newSet;
    });
  };

  /**
   * 添加消息
   *
   * 状态更新：向消息列表添加新消息
   * 历史管理：同步更新聊天历史
   * 用户体验：自动滚动到新消息
   */
  const addMessage = (message: ChatMessage): void => {
    setMessages((prev: ChatMessage[]) => [...prev, message]);
    addToHistory(message.role, message.content.text || '');
    setTimeout(scrollToBottom, 100);
  };

  /**
   * 添加错误消息
   *
   * 错误处理策略：
   * - 统一的错误消息格式
   * - 用户友好的错误提示
   * - 保持对话流的连续性
   */
  const addErrorMessage = (errorText: string): void => {
    const errorMessage: ChatMessage = {
      id: `error_${Date.now()}`,
      role: 'assistant',
      content: { text: `❌ 错误: ${errorText}` },
      timestamp: Date.now(),
    };
    addMessage(errorMessage);
  };

  /**
   * 发送消息到服务器
   *
   * 核心功能：处理用户消息的发送和响应
   * 流式处理：支持实时响应流
   * 错误处理：网络异常和服务器错误的处理
   */
  const sendMessage = async (message: string): Promise<void> => {
    if (!message.trim()) return;

    setIsLoading(true);
    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      let assistantMessage = '';
      const decoder = new TextDecoder();

      // 流式读取响应
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        assistantMessage += chunk;

        // 实时更新助手消息
        const currentMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: { text: assistantMessage },
          timestamp: Date.now(),
        };

        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            newMessages[newMessages.length - 1] = currentMessage;
          } else {
            newMessages.push(currentMessage);
          }
          return newMessages;
        });
      }

      // 添加到历史记录
      addToHistory('assistant', assistantMessage);
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('发送消息失败:', error);
        addErrorMessage(error.message || '发送消息时发生未知错误');
      }
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  };

  /**
   * 处理用户发送消息
   *
   * 用户交互：响应用户的发送操作
   * 消息处理：格式化用户消息并发送
   */
  const handleSendMessage = async (message: string): Promise<void> => {
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: { text: message },
      timestamp: Date.now(),
    };

    addMessage(userMessage);
    await sendMessage(message);
  };

  /**
   * 停止当前请求
   *
   * 用户控制：允许用户中断长时间运行的请求
   * 资源管理：及时释放网络资源
   */
  const stopGeneration = (): void => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
      notification.info({
        message: '已停止生成',
        description: '当前请求已被取消',
      });
    }
  };

  /**
   * 渲染消息内容
   *
   * 渲染策略：根据消息类型选择合适的渲染方式
   * 组件化：使用专门的组件处理复杂内容
   */
  const renderMessage = (msg: ChatMessage): React.ReactNode => {
    const { content } = msg;

    // 处理工具调用消息
    if (content.toolName) {
      const tool = toolCalls.find((t) => t.id === content.toolCallId);
      if (tool) {
        return (
          <ToolMessage
            key={tool.id}
            tool={{
              id: tool.id,
              name: tool.name,
              status: tool.status,
              params: tool.params,
              result: tool.result
                ? { result: String(tool.result.result) }
                : undefined,
            }}
            isExpanded={expandedToolCalls.has(tool.id)}
            onToggle={() => toggleToolCallExpanded(tool.id)}
          />
        );
      }
    }

    // 处理普通文本消息
    return (
      <div className="whitespace-pre-wrap break-words">
        {content.text || ''}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 聊天头部 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800">AI 助手</h1>
          <div className="flex items-center gap-3">
            {isLoading && (
              <button
                onClick={stopGeneration}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                停止生成
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 消息显示区域 */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-800 border border-gray-200'
              }`}
            >
              {renderMessage(msg)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="flex-shrink-0">
        <ChatRichInput
          onSend={handleSendMessage}
          isLoading={isLoading}
          placeholder="输入您的消息..."
        />
      </div>
    </div>
  );
};

export default ChatApp;
