/**
 * 聊天页面组件
 *
 * 核心职责：
 * - 提供聊天应用的主要布局容器
 * - 管理左右面板的响应式布局
 * - 协调 ChatApp 和 TabPanel 的交互
 * - 支持可调节的分屏界面
 *
 * 设计哲学：
 * - 响应式优先：移动端单列，桌面端双列布局
 * - 用户控制：通过拖拽调节面板宽度
 * - 渐进增强：基础功能在小屏幕可用，大屏幕提供更多交互
 * - 组合优于继承：通过组合现有组件构建复杂布局
 *
 * 架构原理：
 * - 容器组件模式：专注于布局和状态管理，不处理业务逻辑
 * - 状态提升：将布局状态管理在页面级别
 * - 依赖注入：通过 props 向子组件传递必要的配置
 * - 关注点分离：布局逻辑与业务逻辑分离
 */

import React, { useState, useRef } from 'react';
import ChatApp from '../components/ChatApp';
import TabPanel from '../components/TabPanel';
import ResizableDivider from '../components/ResizableDivider';

/**
 * 任务目标接口
 * 定义任务的描述和相关文件
 */
interface TaskTarget {
  message: string;
  targets: string[];
}

/**
 * Chat 组件的属性接口
 *
 * 设计原则：
 * - 可选配置：提供合理的默认值
 * - 类型安全：明确定义所有属性的类型
 * - 向下兼容：支持可选的初始化参数
 */
interface ChatProps {
  /** 初始消息内容，用于预填充聊天输入框 */
  initialMessage?: string;
  /** 任务目标对象，包含任务描述和相关文件列表 */
  selectTask?: TaskTarget;
}

/**
 * 布局配置常量
 *
 * 设计考量：
 * - 提供合理的默认值和边界约束
 * - 确保用户界面的可用性和美观性
 * - 支持用户自定义调节
 */
const LAYOUT_CONFIG = {
  /** 左侧面板默认宽度百分比 */
  DEFAULT_LEFT_WIDTH: 50,
  /** 左侧面板最小宽度百分比 */
  MIN_LEFT_WIDTH: 20,
  /** 左侧面板最大宽度百分比 */
  MAX_LEFT_WIDTH: 80,
} as const;

/**
 * 聊天页面主组件
 *
 * 实现策略：
 * - 状态管理：使用 useState 管理左侧面板宽度
 * - 引用管理：使用 useRef 获取容器 DOM 引用
 * - 事件处理：通过回调函数处理面板宽度变化
 * - 条件渲染：根据屏幕尺寸决定是否显示分隔器
 *
 * 性能优化：
 * - 避免不必要的重渲染：使用 useRef 而非 state 存储 DOM 引用
 * - 合理的默认值：减少初始化时的计算开销
 * - 条件渲染：在小屏幕设备上避免渲染不必要的组件
 *
 * 用户体验：
 * - 响应式设计：自动适配不同屏幕尺寸
 * - 平滑交互：拖拽调节面板宽度时的流畅体验
 * - 边界保护：限制面板宽度在合理范围内
 * - 视觉反馈：清晰的分隔线和拖拽指示器
 */
const Chat: React.FC<ChatProps> = ({ initialMessage = '', selectTask }) => {
  /**
   * 左侧面板宽度状态
   * 使用百分比值便于响应式计算
   */
  const [leftWidth, setLeftWidth] = useState<number>(
    LAYOUT_CONFIG.DEFAULT_LEFT_WIDTH,
  );

  /**
   * 容器引用
   * 用于获取容器尺寸和位置信息，支持拖拽计算
   * 使用 HTMLDivElement 类型，通过类型断言传递给 ResizableDivider
   */
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * 面板宽度变化处理器
   *
   * 职责：
   * - 接收新的宽度百分比值
   * - 更新组件状态
   * - 触发界面重新渲染
   *
   * 参数：
   * @param newWidth - 新的左侧面板宽度百分比（0-100）
   */
  const handleWidthChange = (newWidth: number): void => {
    setLeftWidth(newWidth);
  };

  return (
    <div ref={containerRef} className="flex h-screen bg-gray-50">
      {/* 左侧聊天面板 */}
      <div
        className="flex-shrink-0 bg-white border-r border-gray-200 lg:block"
        style={{
          width: `${leftWidth}%`,
          minWidth: `${LAYOUT_CONFIG.MIN_LEFT_WIDTH}%`,
          maxWidth: `${LAYOUT_CONFIG.MAX_LEFT_WIDTH}%`,
        }}
      >
        <ChatApp initialMessage={initialMessage} selectTask={selectTask} />
      </div>

      {/* 可调节分隔器 - 仅在大屏幕显示 */}
      <ResizableDivider
        containerRef={containerRef as React.RefObject<HTMLElement>}
        onWidthChange={handleWidthChange}
        minWidth={LAYOUT_CONFIG.MIN_LEFT_WIDTH}
        maxWidth={LAYOUT_CONFIG.MAX_LEFT_WIDTH}
      />

      {/* 右侧标签面板 */}
      <div
        className="flex-1 bg-white"
        style={{
          width: `${100 - leftWidth}%`,
          minWidth: `${100 - LAYOUT_CONFIG.MAX_LEFT_WIDTH}%`,
          maxWidth: `${100 - LAYOUT_CONFIG.MIN_LEFT_WIDTH}%`,
        }}
      >
        <TabPanel />
      </div>
    </div>
  );
};

export default Chat;
