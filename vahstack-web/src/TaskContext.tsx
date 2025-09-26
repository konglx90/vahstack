import React, { createContext, useContext, useMemo } from 'react';
import useTaskHistoryHook from './hooks/useTaskHistory';
import useTaskHook from './components/tasks/useTask';
import useFileHook from './components/file-explorer/useFile';

const TaskCtx = createContext(null);

export const TaskProvider = ({ children }) => {
  const taskHistory = useTaskHistoryHook(); // 历史记录相关逻辑
  const task = useTaskHook(); // 单个任务相关逻辑
  const file = useFileHook();

  /* 用 useMemo 保证 value 的引用只在依赖变化时更新 */
  const value = useMemo(
    () => ({ taskHistory, task, file }),
    [taskHistory, task, file],
  );

  return <TaskCtx.Provider value={value}>{children}</TaskCtx.Provider>;
};

export const useTaskHistory = () => {
  const ctx = useContext(TaskCtx);
  if (!ctx) throw new Error('useTaskHistory 必须在 <TaskProvider> 内使用');
  return ctx.taskHistory;
};

export const useFile = () => {
  const ctx = useContext(TaskCtx);
  if (!ctx) throw new Error('useTaskHistory 必须在 <TaskProvider> 内使用');
  return ctx.file;
};

export const useTask = () => {
  const ctx = useContext(TaskCtx);
  if (!ctx) throw new Error('useTask 必须在 <TaskProvider> 内使用');
  return ctx.task;
};
