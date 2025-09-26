/**
 * 自定义事件管理系统
 *
 * 核心职责：
 * - 提供跨组件的事件通信机制
 * - 封装浏览器原生 CustomEvent API
 * - 提供 React Hook 形式的事件管理接口
 * - 支持事件的注册、分发、监听和清理
 *
 * 设计哲学：
 * - 发布-订阅模式：解耦组件间的直接依赖关系
 * - 类型安全：通过 TypeScript 确保事件数据的类型正确性
 * - 资源管理：自动处理事件监听器的清理，防止内存泄漏
 * - 渐进增强：提供从简单函数到复杂类的多层次抽象
 */

import { useEffect, useRef } from 'react';

/**
 * 事件详情数据的通用类型
 * 支持任意结构的事件载荷数据
 */
type EventDetail = unknown;

/**
 * 事件回调函数类型
 * @param detail - 事件携带的数据
 */
type EventCallback = (detail: EventDetail) => void;

/**
 * 事件清理函数类型
 * 用于移除事件监听器
 */
type CleanupFunction = () => void;

/**
 * 事件监听器映射类型
 * 将事件类型映射到对应的清理函数数组
 */
type ListenerMap = Map<string, CleanupFunction[]>;

/**
 * 预定义的事件类型常量
 *
 * 设计原则：
 * - 集中管理：避免事件类型字符串散落在各处
 * - 类型安全：通过常量减少拼写错误
 * - 语义化：事件名称清晰表达其用途
 */
export const EVENT_TYPES = {
  OPEN_FILE: 'openFile', // 打开文件事件
  INSERT_TEMPLATE: 'insertTemplate', // 插入模板事件
  UPDATE_TOKEN_CONTENT: 'updateTokenContent', // 更新令牌内容事件
  INSERT_FILE_TO_INPUT: 'insertFileToInput', // 插入文件到输入框事件
  SEND_MESSAGE: 'sendMessage', // 发送消息事件
  SEND_MESSAGE_RESULT: 'sendMessageResult', // 消息发送结果事件
} as const;

/**
 * 通用事件分发器
 *
 * 功能：将自定义数据通过浏览器的 CustomEvent 机制分发
 *
 * @param eventType - 事件类型标识符
 * @param detail - 事件携带的数据载荷
 *
 * 设计考量：
 * - 使用 window 作为事件总线，确保全局可达性
 * - CustomEvent 提供标准化的事件分发机制
 */
export const dispatchCustomEvent = (
  eventType: string,
  detail: EventDetail,
): void => {
  const event = new CustomEvent(eventType, { detail });
  window.dispatchEvent(event);
};

/**
 * 通用事件监听器
 *
 * 功能：为指定事件类型注册监听器，并返回清理函数
 *
 * @param eventType - 要监听的事件类型
 * @param callback - 事件触发时的回调函数
 * @returns 清理函数，用于移除监听器
 *
 * 设计模式：
 * - 函数式编程：返回清理函数而非依赖外部状态
 * - 防御性编程：确保每个监听器都能被正确清理
 */
export const addCustomEventListener = (
  eventType: string,
  callback: EventCallback,
): CleanupFunction => {
  const handleEvent = (event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail);
  };

  window.addEventListener(eventType, handleEvent);

  // 返回清理函数 - 闭包保持对 handleEvent 的引用
  return () => {
    window.removeEventListener(eventType, handleEvent);
  };
};

/**
 * 事件管理器类 - 高级事件管理抽象
 *
 * 核心价值：
 * - 批量管理：统一管理多个事件监听器的生命周期
 * - 内存安全：防止监听器泄漏导致的内存问题
 * - 接口统一：提供面向对象的事件操作接口
 */
export class EventManager {
  private listeners: ListenerMap;

  constructor() {
    this.listeners = new Map();
  }

  /**
   * 注册事件监听器
   *
   * @param eventType - 事件类型
   * @param callback - 回调函数
   * @returns 清理函数
   *
   * 实现细节：
   * - 维护监听器清理函数的映射关系
   * - 支持同一事件类型的多个监听器
   */
  on(eventType: string, callback: EventCallback): CleanupFunction {
    const cleanup = addCustomEventListener(eventType, callback);

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(cleanup);

    return cleanup;
  }

  /**
   * 分发事件
   *
   * @param eventType - 事件类型
   * @param detail - 事件数据
   *
   * 设计意图：提供与监听器配套的分发接口
   */
  emit(eventType: string, detail: EventDetail): void {
    dispatchCustomEvent(eventType, detail);
  }

  /**
   * 移除特定类型的所有监听器
   *
   * @param eventType - 要移除的事件类型
   *
   * 使用场景：组件卸载或功能模块禁用时的批量清理
   */
  off(eventType: string): void {
    const cleanupFunctions = this.listeners.get(eventType);
    if (cleanupFunctions) {
      cleanupFunctions.forEach((cleanup) => cleanup());
      this.listeners.delete(eventType);
    }
  }

  /**
   * 移除所有监听器
   *
   * 使用场景：应用关闭或重置时的全量清理
   * 防御措施：确保不会有遗留的事件监听器
   */
  removeAllListeners(): void {
    this.listeners.forEach((cleanupFunctions) => {
      cleanupFunctions.forEach((cleanup) => cleanup());
    });
    this.listeners.clear();
  }
}

/**
 * 全局事件管理器实例
 *
 * 设计模式：单例模式
 * 使用场景：需要跨组件、跨模块的事件通信
 */
export const globalEventManager = new EventManager();

/**
 * 事件分发 Hook
 *
 * 功能：为 React 组件提供事件分发能力
 * @returns 事件分发函数
 *
 * 设计优势：
 * - Hook 形式：符合 React 函数组件的使用习惯
 * - 无状态：纯函数式接口，无副作用
 */
export const useEventDispatcher = (): ((
  eventType: string,
  detail: EventDetail,
) => void) => {
  const dispatch = (eventType: string, detail: EventDetail) => {
    dispatchCustomEvent(eventType, detail);
  };

  return dispatch;
};

/**
 * 事件管理 Hook 的返回值类型
 */
interface UseEventManagerReturn {
  emit: (detail: EventDetail) => void;
}

/**
 * 简化的事件管理 Hook
 *
 * 功能：为特定事件类型提供监听和分发能力
 *
 * @param EVENT_KEY - 事件类型标识符
 * @param callback - 可选的事件回调函数
 * @returns 包含 emit 方法的对象
 *
 * 设计特点：
 * - 专用性：绑定到特定事件类型，简化使用
 * - 自动清理：利用 useEffect 的清理机制防止内存泄漏
 * - 引用稳定：使用 useRef 避免回调函数变化导致的重复注册
 */
export const useEventManager = (
  EVENT_KEY: string,
  callback?: EventCallback,
): UseEventManagerReturn => {
  const callbackRef = useRef(callback);
  const cleanupRef = useRef<CleanupFunction | null>(null);

  // 更新回调引用 - 保持最新的回调函数
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // 事件监听和清理 - 核心的生命周期管理
  useEffect(() => {
    if (!EVENT_KEY || !callbackRef.current) return;

    // 清理之前的监听器 - 防止重复注册
    if (cleanupRef.current) {
      cleanupRef.current();
    }

    // 添加新的事件监听器
    const cleanup = addCustomEventListener(EVENT_KEY, (detail) => {
      callbackRef.current?.(detail);
    });

    cleanupRef.current = cleanup;

    // 组件卸载时清理 - React 的清理机制
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [EVENT_KEY]);

  /**
   * 返回绑定到特定事件类型的分发函数
   *
   * 设计意图：提供便捷的事件分发接口
   */
  const emit = (detail: EventDetail) => {
    if (EVENT_KEY) {
      dispatchCustomEvent(EVENT_KEY, detail);
    }
  };

  return { emit };
};
