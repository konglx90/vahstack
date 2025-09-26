/**
 * 可调整大小的分割器组件
 *
 * 核心职责：
 * - 提供拖拽式界面分割功能
 * - 实时调整左右面板的宽度比例
 * - 维护用户界面的响应性和流畅性
 * - 确保分割操作的边界约束
 *
 * 设计哲学：
 * - 直接操作：用户通过拖拽直接控制界面布局
 * - 即时反馈：拖拽过程中实时更新视觉状态
 * - 约束明确：通过最小/最大宽度防止极端布局
 * - 状态外置：将布局状态管理交由父组件控制
 *
 * 交互原理：
 * - 基于百分比的响应式布局系统
 * - 全局事件监听确保拖拽体验的连续性
 * - 视觉反馈增强用户操作的可预测性
 */

import React, { useRef, useEffect } from 'react';

/**
 * ResizableDivider 组件的属性接口
 */
interface ResizableDividerProps {
  /** 宽度变化回调函数 */
  onWidthChange: (newWidth: number) => void;
  /** 最小宽度百分比，防止面板过小影响可用性 */
  minWidth?: number;
  /** 最大宽度百分比，防止面板过大影响布局平衡 */
  maxWidth?: number;
  /** 自定义 CSS 类名 */
  className?: string;
  /** 容器元素引用，用于计算相对位置 */
  containerRef: React.RefObject<HTMLElement>;
}

/**
 * 可调整大小的分割器组件
 *
 * 实现策略：
 * - 事件委托：使用全局事件监听确保拖拽的连续性
 * - 相对定位：基于容器边界计算百分比位置
 * - 状态分离：拖拽状态与布局状态分离管理
 *
 * 用户体验考量：
 * - 视觉提示：hover 状态和拖拽指示器
 * - 平滑过渡：CSS transition 提供视觉连续性
 * - 边界保护：防止用户操作导致不可用的布局
 *
 * 性能优化：
 * - useRef 避免不必要的重渲染
 * - 事件监听器的正确清理防止内存泄漏
 * - 条件判断减少不必要的计算
 */
const ResizableDivider: React.FC<ResizableDividerProps> = ({
  onWidthChange,
  minWidth = 40,
  maxWidth = 80,
  className = '',
  containerRef,
}) => {
  /**
   * 拖拽状态引用
   *
   * 设计考量：
   * - 使用 useRef 而非 useState 避免状态更新导致的重渲染
   * - 拖拽是瞬时状态，不需要触发组件更新
   * - 提升拖拽操作的性能和响应速度
   */
  const isDragging = useRef<boolean>(false);

  /**
   * 鼠标按下事件处理器
   *
   * 功能：启动拖拽操作
   * - 设置拖拽状态标志
   * - 阻止默认行为避免文本选择等干扰
   *
   * 用户体验：为后续的拖拽操作做准备
   */
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    isDragging.current = true;
    e.preventDefault();
  };

  /**
   * 鼠标移动事件处理器
   *
   * 核心算法：
   * 1. 获取容器边界信息
   * 2. 计算鼠标相对于容器的位置
   * 3. 转换为百分比宽度
   * 4. 应用边界约束
   * 5. 触发宽度变化回调
   *
   * 边界处理：
   * - 最小宽度：确保左侧面板不会过小
   * - 最大宽度：确保右侧面板有足够空间
   * - 容器检查：防止在容器未就绪时执行计算
   */
  const handleMouseMove = (e: MouseEvent): void => {
    if (!isDragging.current || !containerRef.current) return;

    // 获取容器的边界矩形信息
    const containerRect = containerRef.current.getBoundingClientRect();

    // 计算新的左侧宽度百分比
    // 公式：(鼠标X坐标 - 容器左边界) / 容器宽度 * 100
    const newLeftWidth =
      ((e.clientX - containerRect.left) / containerRect.width) * 100;

    // 应用宽度约束，确保布局的可用性
    if (newLeftWidth >= minWidth && newLeftWidth <= maxWidth) {
      onWidthChange(newLeftWidth);
    }
  };

  /**
   * 鼠标释放事件处理器
   *
   * 功能：结束拖拽操作
   * - 重置拖拽状态标志
   * - 完成本次调整操作
   *
   * 设计简洁：拖拽结束后无需额外处理
   */
  const handleMouseUp = (): void => {
    isDragging.current = false;
  };

  /**
   * 全局事件监听效果
   *
   * 设计原理：
   * - 全局监听确保拖拽操作的连续性
   * - 即使鼠标移出分割器区域，拖拽仍能继续
   * - 提供更自然的拖拽体验
   *
   * 内存管理：
   * - 组件卸载时正确清理事件监听器
   * - 防止内存泄漏和意外的事件触发
   *
   * 依赖数组为空：
   * - 事件处理器使用 useRef，不依赖组件状态
   * - 避免频繁的监听器重新绑定
   */
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []); // 空依赖数组：仅在组件挂载/卸载时执行

  return (
    <div
      className={`w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors duration-200 relative group ${className}`}
      onMouseDown={handleMouseDown}
    >
      {/* 
        拖拽指示器
        
        视觉设计：
        - 居中定位：提供明确的拖拽目标
        - 状态响应：hover 时颜色变化增强交互反馈
        - 尺寸适中：既不过于突兀，又便于操作
        
        交互增强：
        - group 类配合实现整体 hover 效果
        - 圆角设计提升视觉美感
        - 过渡动画增加操作的流畅感
      */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-gray-400 group-hover:bg-blue-500 rounded-full transition-colors duration-200"></div>
    </div>
  );
};

export default ResizableDivider;
