/**
 * 聊天历史管理 Hook
 *
 * 核心职责：
 * - 管理聊天消息的持久化存储
 * - 提供聊天历史的增删改查操作
 * - 处理本地存储的异常情况
 * - 维护聊天会话的状态同步
 *
 * 设计哲学：
 * - 数据持久化：利用 localStorage 实现跨会话的数据保持
 * - 容错处理：优雅处理存储异常，确保应用稳定性
 * - 状态同步：保持内存状态与持久化存储的一致性
 * - 接口简洁：提供直观的 CRUD 操作接口
 */

import { useState, useEffect } from 'react';

/**
 * 聊天消息角色类型
 * 定义消息的发送者身份
 */
type MessageRole = 'user' | 'assistant' | 'system';

/**
 * 消息内容项类型
 * 支持多种内容格式的消息组成部分
 */
interface MessageContent {
  type: string;
  content: unknown;
}

/**
 * 聊天消息数据结构
 *
 * 设计考量：
 * - role: 标识消息发送者，支持用户、助手、系统角色
 * - content: 主要消息内容，通常为文本
 * - contents: 扩展内容数组，支持多媒体或结构化内容
 */
interface ChatMessage {
  role: MessageRole;
  content: string;
  contents?: MessageContent[];
}

/**
 * 聊天历史数组类型
 * 按时间顺序存储的消息列表
 */
type ChatHistory = ChatMessage[];

/**
 * Hook 返回值接口
 * 定义对外暴露的状态和操作方法
 */
interface UseChatHistoryReturn {
  messageHistory: ChatHistory;
  loadChatHistory: () => ChatHistory;
  saveChatHistory: (history: ChatHistory) => void;
  addToHistory: (
    role: MessageRole,
    content: string,
    currentHistory?: ChatHistory | null,
    contents?: MessageContent[],
  ) => ChatHistory;
  clearChatHistory: () => void;
}

/**
 * 本地存储键名常量
 * 集中管理存储键，避免硬编码散落
 */
const STORAGE_KEY = 'chatHistory';

/**
 * 聊天历史管理 Hook
 *
 * @returns 聊天历史状态和操作方法
 *
 * 核心特性：
 * - 自动加载：组件挂载时自动从本地存储加载历史
 * - 实时同步：每次操作都同步更新内存和存储
 * - 异常处理：存储操作失败时提供降级方案
 */
const useChatHistory = (): UseChatHistoryReturn => {
  const [messageHistory, setMessageHistory] = useState<ChatHistory>([]);

  /**
   * 加载聊天历史
   *
   * 功能：从 localStorage 读取并解析聊天历史数据
   * @returns 加载的聊天历史数组
   *
   * 错误处理：
   * - JSON 解析失败时返回空数组
   * - 存储访问异常时重置状态
   */
  const loadChatHistory = (): ChatHistory => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const history: ChatHistory = JSON.parse(saved);
        setMessageHistory(history);
        return history;
      }
      return [];
    } catch (error) {
      console.warn('加载聊天历史失败:', error);
      setMessageHistory([]);
      return [];
    }
  };

  /**
   * 保存聊天历史
   *
   * 功能：将聊天历史序列化并存储到 localStorage
   * @param history - 要保存的聊天历史数组
   *
   * 容错机制：
   * - 序列化失败时记录警告但不中断程序
   * - 存储空间不足时优雅降级
   */
  const saveChatHistory = (history: ChatHistory): void => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.warn('保存聊天历史失败:', error);
    }
  };

  /**
   * 添加消息到历史记录
   *
   * 功能：向聊天历史追加新消息并持久化
   *
   * @param role - 消息角色（用户/助手/系统）
   * @param content - 消息主要内容
   * @param currentHistory - 可选的当前历史基础，默认使用 Hook 状态
   * @param contents - 可选的扩展内容数组
   * @returns 更新后的聊天历史
   *
   * 设计特点：
   * - 不可变更新：使用扩展运算符创建新数组
   * - 灵活基础：支持基于指定历史或当前状态进行追加
   * - 同步更新：同时更新内存状态和持久化存储
   */
  const addToHistory = (
    role: MessageRole,
    content: string,
    currentHistory: ChatHistory | null = null,
    contents: MessageContent[] = [],
  ): ChatHistory => {
    const baseHistory = currentHistory || messageHistory;
    const newMessage: ChatMessage = { role, content, contents };
    const newHistory = [...baseHistory, newMessage];

    setMessageHistory(newHistory);
    saveChatHistory(newHistory);
    return newHistory;
  };

  /**
   * 清除聊天历史
   *
   * 功能：重置聊天历史状态并清除持久化数据
   *
   * 使用场景：
   * - 用户主动清除历史记录
   * - 会话重置或注销操作
   * - 数据损坏时的恢复操作
   */
  const clearChatHistory = (): void => {
    setMessageHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  /**
   * 初始化效果
   *
   * 功能：组件挂载时自动加载历史记录
   * 依赖：空数组确保只在挂载时执行一次
   *
   * 设计意图：提供开箱即用的历史记录加载
   */
  useEffect(() => {
    loadChatHistory();
  }, []);

  return {
    messageHistory,
    loadChatHistory,
    saveChatHistory,
    addToHistory,
    clearChatHistory,
  };
};

export default useChatHistory;
