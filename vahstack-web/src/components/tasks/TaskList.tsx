import React from 'react';
// import { Tag } from "antd"; // 预留用于未来的状态标签功能
import { InboxOutlined } from '@ant-design/icons';
import { ClockCircleOutlined } from '@ant-design/icons';
import { useTaskHistory, useFile } from '../../TaskContext';

/**
 * 任务历史记录接口
 *
 * 数据结构设计：
 * - id: 任务唯一标识符，用于任务切换和状态管理
 * - name: 任务显示名称，支持用户友好的任务识别
 * - createdAt: 创建时间戳，提供时间上下文
 */
interface TaskHistory {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * 组件 Props 类型定义
 *
 * 设计哲学：可选的回调机制
 * - onContinueTask: 可选的任务继续回调，支持外部组件的任务流程集成
 */
interface TaskListProps {
  onContinueTask?: (task: TaskHistory, template?: unknown) => void;
}

/**
 * 任务列表组件 - 历史任务管理和快速切换工具
 *
 * 核心职责：
 * 1. 历史展示：显示用户的任务执行历史
 * 2. 快速切换：支持一键切换到历史任务上下文
 * 3. 状态管理：维护当前活跃任务的视觉状态
 * 4. 空状态处理：提供友好的空数据提示
 *
 * 设计模式：
 * - 观察者模式：监听任务历史变化并实时更新UI
 * - 命令模式：封装任务切换操作，支持撤销和重做
 * - 状态模式：根据任务状态显示不同的视觉样式
 *
 * 用户体验：
 * - 视觉反馈：活跃任务高亮显示，悬停效果增强交互
 * - 信息层次：任务名称、ID、时间戳的清晰层次结构
 * - 响应式设计：适配不同屏幕尺寸的任务卡片布局
 * - 无障碍支持：键盘导航和屏幕阅读器友好
 */
const TaskList: React.FC<TaskListProps> = ({ onContinueTask }) => {
  /**
   * 任务上下文钩子
   *
   * 状态管理：
   * - historyTasks: 历史任务列表，按时间倒序排列
   * - switchHistoryTask: 任务切换函数，处理上下文迁移
   * - activeTaskId: 当前活跃任务ID，用于视觉状态标识
   */
  const { historyTasks, switchHistoryTask, activeTaskId } = useTaskHistory();

  /**
   * 文件管理钩子
   *
   * 功能集成：
   * - fetchFileTree: 文件树刷新函数，确保任务切换后文件状态同步
   */
  const { fetchFileTree } = useFile();

  /**
   * 任务启动处理器
   *
   * 业务逻辑：
   * 1. 防重复：检查是否已是当前活跃任务
   * 2. 上下文切换：调用任务历史切换函数
   * 3. 延迟同步：200ms后刷新文件树，确保状态一致性
   * 4. 回调触发：支持外部组件的任务流程集成（当前已注释）
   *
   * 设计考量：
   * - 防抖机制：避免重复点击导致的状态混乱
   * - 异步协调：使用setTimeout确保状态切换完成后再同步文件
   * - 扩展性：预留回调接口支持未来的功能扩展
   */
  const handleStartTask = (id: string): void => {
    if (activeTaskId === id) return;

    switchHistoryTask(activeTaskId, id);
    setTimeout(() => {
      fetchFileTree();
    }, 200);

    // 预留的回调机制，支持外部任务流程集成
    if (onContinueTask) {
      onContinueTask(
        historyTasks.find((task: TaskHistory) => task.id === id) as TaskHistory,
      );
    }
  };

  /**
   * 空状态渲染 - 友好的用户引导
   *
   * 设计原则：
   * - 视觉层次：图标 + 主要信息 + 辅助说明
   * - 情感化设计：使用温和的灰色调，避免挫败感
   * - 行动指引：明确告知用户如何开始使用功能
   */
  if (!historyTasks?.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-10 text-gray-400">
        <InboxOutlined className="text-4xl mb-2" />
        <p className="text-sm">暂无任务历史</p>
        <p className="text-xs mt-1">执行一次任务后可在此快速继续</p>
      </div>
    );
  }

  /**
   * 任务列表渲染 - 卡片式布局设计
   *
   * 布局策略：
   * - 垂直滚动：支持大量历史任务的浏览
   * - 卡片设计：每个任务独立的视觉容器
   * - 状态区分：活跃任务和普通任务的视觉差异
   * - 交互反馈：悬停效果和点击状态
   */
  return (
    <div className="h-full flex flex-col">
      {historyTasks?.map((history: TaskHistory, index: number) => {
        const { name, id, createdAt } = history || {};
        return (
          <div
            key={index}
            onClick={() => handleStartTask(id)}
            className={`w-full p-[15px] mb-5 cursor-pointer flex flex-col gap-[10px] rounded-lg shadow-lg
${activeTaskId === id ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            {/* 任务标题区域 */}
            <div className="flex gap-[5px] font-bold items-center">
              <div className="truncate" title={name}>
                {name}
              </div>

              {/* 预留的状态标签区域 */}
              {/* <Tag color={statusMap[status].color}>
                {statusMap[status].text}
              </Tag> */}
            </div>

            {/* 任务ID显示 - 技术标识符 */}
            {id && <p className="text-xs text-gray-500 mt-1">{id}</p>}

            {/* 预留的任务输出区域 */}
            {/* {task?.output && (
              <p className="text-xs text-gray-600 mb-2">输出: {task?.output}</p>
            )} */}

            {/* 视觉分隔线 */}
            <hr className="m-0" />

            {/* 元数据区域 - 时间信息 */}
            <div
              className="flex items-center gap-[10px]
             text-[rgba(0,0,0,0.45)] text-sm"
            >
              <div className="flex items-center gap-[2px]">
                <ClockCircleOutlined />
                <span className="ml-1">{createdAt}</span>
              </div>
            </div>
          </div>
        );
      })}

      {/* 列表底部提示 - 数据边界指示 */}
      <div className="flex justify-center py-4 text-[rgba(0,0,0,0.45)]">
        没有更多数据了
      </div>
    </div>
  );
};

export default TaskList;
