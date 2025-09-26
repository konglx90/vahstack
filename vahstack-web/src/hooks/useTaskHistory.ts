/**
 * 任务历史管理 Hook
 *
 * 核心职责：
 * - 管理任务历史记录的 CRUD 操作
 * - 处理任务切换和状态同步
 * - 维护当前活跃任务的本地存储
 * - 处理页面生命周期中的任务状态保存
 *
 * 设计哲学：
 * - 状态管理：集中管理任务历史的加载、错误和数据状态
 * - 生命周期感知：响应页面卸载和导航事件，确保数据一致性
 * - 异步处理：优雅处理网络请求的各种状态
 * - 用户体验：提供加载状态和错误反馈
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * 本地存储键名常量
 * 用于存储当前活跃任务的 ID
 */
const LS_KEY = 'ragdoll-active-task-id';

/**
 * 任务历史项数据结构
 * 表示单个历史任务的基本信息
 */
interface HistoryTask {
  taskId: string;
  taskName: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
}

/**
 * API 响应的通用结构
 * 标准化后端接口的返回格式
 */
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 创建任务的响应数据
 */
interface CreateTaskResponse {
  taskId: string;
  taskName: string;
}

/**
 * 切换任务的响应数据
 */
interface SwitchTaskResponse {
  oldTaskId?: string;
  taskId?: string;
  message?: string;
}

/**
 * Hook 返回值接口
 * 定义对外暴露的状态和操作方法
 */
interface UseTaskHistoryReturn {
  historyTasks: HistoryTask[];
  activeTaskId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createHistoryTask: (taskName: string) => Promise<CreateTaskResponse>;
  deleteHistoryTask: (taskId: string) => Promise<void>;
  switchHistoryTask: (
    oldTaskId?: string,
    taskId?: string,
  ) => Promise<SwitchTaskResponse>;
}

/**
 * 任务历史管理 Hook
 *
 * @returns 任务历史状态和操作方法
 *
 * 核心特性：
 * - 自动加载：组件挂载时自动获取任务历史列表
 * - 状态同步：维护本地存储与服务端状态的一致性
 * - 生命周期管理：处理页面卸载和导航时的状态保存
 * - 错误处理：提供统一的错误状态管理
 */
export default function useTaskHistory(): UseTaskHistoryReturn {
  const [historyTasks, setHistoryTasks] = useState<HistoryTask[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const activeTaskId = localStorage.getItem(LS_KEY);

  /**
   * 刷新任务历史列表
   *
   * 功能：从服务端获取最新的任务历史数据
   *
   * 状态管理：
   * - 设置加载状态，提供用户反馈
   * - 清除之前的错误状态
   * - 处理请求成功和失败的情况
   */
  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api-task-history/list');
      const json: ApiResponse<HistoryTask[]> = await res.json();
      if (!json.success) throw new Error(json.error || 'list error');

      setHistoryTasks(json.data || []);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 创建新的历史任务
   *
   * 功能：在服务端创建新任务并更新本地状态
   *
   * @param taskName - 任务名称
   * @returns 创建的任务数据
   *
   * 副作用：
   * - 将新任务 ID 保存到本地存储
   * - 刷新任务列表以反映最新状态
   */
  const createHistoryTask = useCallback(
    async (taskName: string): Promise<CreateTaskResponse> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api-task-history/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskName }),
        });
        const json: ApiResponse<CreateTaskResponse> = await res.json();
        if (!json.success) throw new Error(json.error || 'create error');

        // 保存当前 taskId 到本地存储
        localStorage.setItem(LS_KEY, json.data!.taskId);
        await refresh();
        return json.data!;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'unknown error';
        setError(errorMessage);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [refresh],
  );

  /**
   * 删除历史任务
   *
   * 功能：从服务端删除指定任务并更新本地列表
   *
   * @param taskId - 要删除的任务 ID
   *
   * 注意：删除操作不设置 loading 状态，避免影响列表显示
   */
  const deleteHistoryTask = useCallback(
    async (taskId: string): Promise<void> => {
      setError(null);
      try {
        const res = await fetch(`/api-task-history/${taskId}`, {
          method: 'DELETE',
        });
        const json: ApiResponse = await res.json();
        if (!json.success) throw new Error(json.error || 'delete error');

        await refresh();
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'unknown error';
        setError(errorMessage);
        throw e;
      }
    },
    [refresh],
  );

  /**
   * 切换任务
   *
   * 功能：在服务端执行任务切换操作
   *
   * @param oldTaskId - 当前任务 ID（可选）
   * @param taskId - 目标任务 ID（可选）
   * @returns 切换操作的结果数据
   *
   * 设计考量：
   * - 支持从任务切换到空状态（taskId 为空）
   * - 更新本地存储中的活跃任务 ID
   * - 提供错误日志但不中断程序执行
   */
  const switchHistoryTask = useCallback(
    async (
      oldTaskId?: string,
      taskId?: string,
    ): Promise<SwitchTaskResponse> => {
      try {
        const res = await fetch('/api-task-history/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldTaskId,
            taskId,
          }),
        });
        const json: ApiResponse<SwitchTaskResponse> = await res.json();
        if (!json.success) throw new Error(json.error || 'switch error');

        // 更新本地存储中的活跃任务 ID
        if (taskId) {
          localStorage.setItem(LS_KEY, taskId);
        }
        return json.data!;
      } catch (e) {
        console.warn('switchHistoryTask failed:', e);
        throw e;
      }
    },
    [],
  );

  /**
   * 初始化效果：加载任务历史列表
   *
   * 功能：组件挂载时自动获取任务历史数据
   * 依赖：refresh 函数，确保使用最新的实现
   */
  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * 页面卸载处理效果
   *
   * 功能：在页面卸载前保存当前任务状态
   *
   * 实现细节：
   * - 使用 navigator.sendBeacon 确保数据能够发送
   * - 在页面关闭时将活跃任务切换为空状态
   * - 避免数据丢失和状态不一致
   */
  useEffect(() => {
    const handler = () => {
      if (activeTaskId) {
        // 使用 sendBeacon 确保在页面卸载时数据能够发送
        navigator.sendBeacon(
          '/api-task-history/switch',
          JSON.stringify({ oldTaskId: activeTaskId, taskId: '' }),
        );
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [activeTaskId]);

  /**
   * 浏览器导航处理效果
   *
   * 功能：响应浏览器的前进/后退操作
   *
   * 使用场景：
   * - 用户使用浏览器导航按钮时保存任务状态
   * - 确保任务状态与页面导航保持同步
   */
  useEffect(() => {
    const onPop = () => {
      if (activeTaskId) switchHistoryTask(activeTaskId);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [activeTaskId, switchHistoryTask]);

  return {
    historyTasks,
    activeTaskId,
    loading,
    error,
    refresh,
    createHistoryTask,
    deleteHistoryTask,
    switchHistoryTask,
  };
}
