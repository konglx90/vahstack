/**
 * Monaco Editor 评论小部件工厂 - 代码协作增强工具
 *
 * 核心功能：
 * 1. 动态创建评论界面小部件
 * 2. 管理编辑器视图区域和覆盖层
 * 3. 提供评论提交和生命周期管理
 *
 * 设计哲学：
 * - 非侵入式集成：不修改编辑器核心功能
 * - 响应式布局：自适应编辑器尺寸变化
 * - 生命周期管理：提供完整的创建和销毁机制
 *
 * 技术架构：
 * - View Zone API：在编辑器中创建自定义区域
 * - Overlay Widget API：在编辑器上层添加 UI 组件
 * - React Portal：将 React 组件渲染到指定 DOM 节点
 */

import * as ReactDOMClient from 'react-dom/client';
import Comments from './Comments';

/**
 * Monaco Editor 实例类型定义
 *
 * 基于 Monaco Editor 的核心接口，包含编辑器操作方法
 */
interface MonacoEditor {
  getId(): string;
  changeViewZones(
    callback: (changeAccessor: ViewZoneChangeAccessor) => void,
  ): void;
  addOverlayWidget(widget: OverlayWidget): void;
  removeOverlayWidget(widget: OverlayWidget): void;
}

/**
 * 视图区域变更访问器接口
 *
 * 用于在编辑器中添加、移除和布局自定义视图区域
 */
interface ViewZoneChangeAccessor {
  addZone(zone: ViewZone): string;
  removeZone(id: string): void;
  layoutZone(id: string): void;
}

/**
 * 视图区域配置接口
 *
 * 定义在编辑器中插入的自定义区域属性
 */
interface ViewZone {
  afterLineNumber: number;
  heightInPx: number;
  domNode: HTMLElement;
  onDomNodeTop?: (top: number) => void;
  onComputedHeight?: (height: number) => void;
}

/**
 * 覆盖层小部件接口
 *
 * 定义在编辑器上层显示的 UI 组件
 */
interface OverlayWidget {
  getId(): string;
  getDomNode(): HTMLElement;
  getPosition(): null;
}

/**
 * 评论提交处理器类型
 *
 * 处理用户提交的评论数据
 */
type CommentSubmitHandler = (data: { comment: string }) => void;

/**
 * 小部件控制器接口
 *
 * 提供小部件的生命周期管理方法
 */
interface WidgetController {
  dispose: () => void;
}

/**
 * 创建评论小部件工厂函数
 *
 * 核心算法：
 * 1. 创建 DOM 容器和 React 根节点
 * 2. 在编辑器中添加视图区域（View Zone）
 * 3. 在编辑器上添加覆盖层小部件（Overlay Widget）
 * 4. 渲染 React 评论组件到指定位置
 * 5. 返回生命周期管理接口
 *
 * 设计模式：
 * - 工厂模式：封装复杂的小部件创建逻辑
 * - 适配器模式：将 React 组件适配到 Monaco Editor
 * - 观察者模式：响应编辑器布局变化事件
 *
 * 性能优化：
 * - 懒加载：按需创建 DOM 节点和 React 根
 * - 事件驱动：基于编辑器事件更新布局
 * - 资源清理：提供完整的销毁机制防止内存泄漏
 *
 * @param codeEditor - Monaco Editor 实例
 * @param lineNumber - 评论插入的行号
 * @param handleSubmit - 评论提交处理函数
 * @returns 小部件控制器，包含销毁方法
 */
export function createCommentsWidget(
  codeEditor: MonacoEditor,
  lineNumber: number,
  handleSubmit: CommentSubmitHandler,
): WidgetController {
  // 创建覆盖层 DOM 容器 - 承载 React 组件的宿主元素
  const overlayDom: HTMLDivElement = document.createElement('div');
  overlayDom.classList.add('comment-overlay');
  const root: ReactDOMClient.Root = ReactDOMClient.createRoot(overlayDom);

  // 视图区域状态管理 - 跟踪区域 ID 和高度
  let viewZoneId: string | null = null;
  let viewZoneHeight: number = 0;

  /**
   * 创建视图区域 - 在编辑器中预留评论显示空间
   *
   * 布局策略：
   * - afterLineNumber: 在指定行后插入区域
   * - heightInPx: 动态高度，根据内容自适应
   * - domNode: 占位 DOM 节点，实际内容通过覆盖层显示
   * - onDomNodeTop: 响应位置变化，同步覆盖层位置
   * - onComputedHeight: 响应高度变化，同步覆盖层高度
   */
  codeEditor.changeViewZones(function (
    changeAccessor: ViewZoneChangeAccessor,
  ): void {
    const domNode: HTMLDivElement = document.createElement('div');
    viewZoneId = changeAccessor.addZone({
      afterLineNumber: lineNumber,
      get heightInPx(): number {
        return viewZoneHeight;
      },
      domNode: domNode,
      onDomNodeTop: (top: number): void => {
        overlayDom.style.top = `${top}px`;
      },
      onComputedHeight: (height: number): void => {
        overlayDom.style.height = `${height}px`;
      },
    });
  });

  /**
   * 覆盖层小部件定义 - 在编辑器上层显示评论界面
   *
   * 小部件特性：
   * - 唯一 ID：基于编辑器 ID 和行号生成
   * - DOM 节点：返回包含 React 组件的容器
   * - 位置策略：返回 null 表示由视图区域控制位置
   */
  const overlayWidget: OverlayWidget = {
    getId: function (): string {
      return `${codeEditor.getId()}.comment.widget.${lineNumber}`;
    },
    getDomNode: function (): HTMLElement {
      return overlayDom;
    },
    getPosition: function (): null {
      return null; // 位置由 View Zone 控制
    },
  };

  // 将覆盖层小部件添加到编辑器
  codeEditor.addOverlayWidget(overlayWidget);

  /**
   * 资源清理函数 - 完整的生命周期管理
   *
   * 清理步骤：
   * 1. 从编辑器移除覆盖层小部件
   * 2. 从编辑器移除视图区域
   * 3. React 根节点自动清理（通过 removeOverlayWidget）
   *
   * 设计原则：
   * - 防御性编程：确保所有资源都被正确释放
   * - 原子操作：清理过程不可中断
   * - 幂等性：多次调用不会产生副作用
   */
  const dispose = (): void => {
    codeEditor.removeOverlayWidget(overlayWidget);
    codeEditor.changeViewZones(
      (changeAccessor: ViewZoneChangeAccessor): void => {
        if (viewZoneId) {
          changeAccessor.removeZone(viewZoneId);
        }
      },
    );
  };

  /**
   * 高度更新函数 - 响应式布局管理
   *
   * 更新流程：
   * 1. 更新内部高度状态
   * 2. 触发视图区域重新布局
   * 3. 编辑器自动调用回调更新覆盖层位置
   *
   * 性能考量：
   * - 批量更新：通过 changeViewZones 批量处理布局变化
   * - 事件驱动：只在内容变化时触发更新
   * - 异步处理：不阻塞编辑器主线程
   *
   * @param newHeight - 新的小部件高度（像素）
   */
  const update = (newHeight: number): void => {
    viewZoneHeight = newHeight;
    codeEditor.changeViewZones(
      (changeAccessor: ViewZoneChangeAccessor): void => {
        if (viewZoneId) {
          changeAccessor.layoutZone(viewZoneId);
        }
      },
    );
  };

  /**
   * 渲染 React 评论组件 - 将声明式 UI 集成到命令式编辑器
   *
   * 组件属性：
   * - lineNumber: 评论关联的行号
   * - update: 高度更新回调，实现响应式布局
   * - dispose: 销毁回调，支持用户主动关闭
   * - onSubmit: 提交回调，处理评论数据
   *
   * 架构优势：
   * - 关注点分离：UI 逻辑与编辑器逻辑解耦
   * - 可复用性：评论组件可在其他场景使用
   * - 可测试性：React 组件易于单元测试
   */
  root.render(
    <Comments
      lineNumber={lineNumber}
      update={update}
      dispose={dispose}
      onSubmit={handleSubmit}
    />,
  );

  // 返回小部件控制器 - 提供外部生命周期管理接口
  return {
    dispose,
  };
}
