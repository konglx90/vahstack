import React, { useState } from 'react';
import FileExplorer from './file-explorer/FileExplorer';
import AssistantPanel from './assistant-panel';
import { useFile } from '../TaskContext';

/**
 * 标签页类型定义
 *
 * 设计原则：类型安全的状态管理
 * - 限制标签页只能是预定义的值，避免运行时错误
 * - 便于扩展新的标签页类型
 */
type TabType = 'assistant' | 'files';

/**
 * 标签页配置接口
 *
 * 设计哲学：配置驱动的UI
 * - 将标签页的视觉和行为配置抽象为数据结构
 * - 支持图标、标题和点击行为的统一管理
 */
interface TabConfig {
  id: TabType;
  title: string;
  icon: React.ReactElement;
  onClick?: () => void;
}

/**
 * 标签面板组件 - 多功能工作区的统一入口
 *
 * 核心职责：
 * 1. 工作区切换：在助手面板和文件浏览器之间无缝切换
 * 2. 状态管理：维护当前活跃标签页状态
 * 3. 视觉层次：通过渐变背景和毛玻璃效果提供现代化UI体验
 * 4. 交互反馈：提供平滑的过渡动画和视觉反馈
 *
 * 设计模式：
 * - 标签页模式：经典的多面板切换界面
 * - 状态机：管理标签页的激活状态
 * - 组合模式：将不同功能模块组合为统一界面
 * - 观察者模式：通过回调函数与子组件通信
 *
 * UX 设计原则：
 * - 视觉连续性：保持界面元素的一致性和连贯性
 * - 即时反馈：点击操作立即响应，提供清晰的状态指示
 * - 空间效率：最大化内容区域，最小化导航开销
 */
function TabPanel(): React.ReactElement {
  /**
   * 活跃标签页状态管理
   *
   * 设计考量：
   * - 默认显示助手面板，符合用户主要使用场景
   * - 使用类型安全的 TabType 确保状态一致性
   * - 支持程序化切换，便于组件间协调
   */
  const [activeTab, setActiveTab] = useState<TabType>('assistant');

  /**
   * 文件操作钩子
   *
   * 职责分离：
   * - 将文件树获取逻辑委托给专门的 Context
   * - 保持组件的单一职责原则
   */
  const { fetchFileTree } = useFile();

  /**
   * 标签页配置数组
   *
   * 设计优势：
   * - 数据驱动的UI渲染，易于维护和扩展
   * - 集中管理标签页的视觉和行为配置
   * - 支持动态添加新标签页类型
   */
  const tabConfigs: TabConfig[] = [
    {
      id: 'assistant',
      title: '系分助手',
      icon: (
        <svg
          className="w-4 h-4 stroke-2"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path d="M9.31 6.95 15 12l-5.69 5.05a2 2 0 0 1-3.31-1.52V8.47a2 2 0 0 1 3.31-1.52Z" />
          <path d="m10 14-2.5 2.5M15 12H5" />
        </svg>
      ),
    },
    {
      id: 'files',
      title: '文件',
      icon: (
        <svg
          className="w-4 h-4 stroke-2"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      ),
      onClick: () => {
        // 延迟加载策略：只在用户访问时获取文件树
        fetchFileTree();
      },
    },
  ];

  /**
   * 标签页点击处理器
   *
   * 交互逻辑：
   * 1. 更新活跃标签页状态
   * 2. 执行标签页特定的初始化逻辑
   * 3. 提供平滑的状态过渡
   */
  const handleTabClick = (tabId: TabType): void => {
    setActiveTab(tabId);
    const config = tabConfigs.find((tab) => tab.id === tabId);
    config?.onClick?.();
  };

  /**
   * 标签页按钮渲染器
   *
   * 视觉设计：
   * - 活跃状态：白色背景 + 阴影 + 底部渐变指示器
   * - 非活跃状态：透明背景 + 悬停效果
   * - 平滑过渡：300ms 的 CSS 过渡动画
   * - 毛玻璃效果：backdrop-blur 提供现代感
   */
  const renderTabButton = (config: TabConfig): React.ReactElement => {
    const isActive = activeTab === config.id;

    return (
      <button
        key={config.id}
        className={`flex items-center gap-3 px-6 py-3 border-none rounded-lg cursor-pointer text-sm font-medium transition-all duration-300 relative overflow-hidden ${
          isActive
            ? 'bg-white text-gray-800 shadow-md border border-gray-200/50'
            : 'bg-transparent text-gray-600 hover:bg-white/60 hover:text-gray-800'
        }`}
        onClick={() => handleTabClick(config.id)}
      >
        {config.icon}
        {config.title}
        {/* 活跃状态指示器 - 渐变底边 */}
        {isActive && (
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"></div>
        )}
      </button>
    );
  };

  /**
   * 主渲染逻辑
   *
   * 布局架构：
   * - 外层容器：渐变背景 + 圆角 + 阴影 + 毛玻璃效果
   * - 导航区域：半透明白色背景 + 毛玻璃模糊
   * - 内容区域：条件渲染 + 隐藏非活跃面板（保持DOM结构）
   *
   * 性能优化：
   * - 使用 CSS 隐藏而非条件渲染，避免组件重新挂载
   * - 保持组件状态，提升用户体验
   */
  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-gray-100 rounded-xl overflow-hidden shadow-xl border border-gray-200/50 backdrop-blur-sm">
      {/* 标签页导航区域 */}
      <div className="flex bg-white/80 backdrop-blur-md border-b border-gray-200/50 p-2 gap-2">
        {tabConfigs.map(renderTabButton)}
      </div>

      {/* 内容区域 - 条件显示不同面板 */}
      <div className="flex-1 overflow-hidden bg-white/30 backdrop-blur-sm">
        {/* 助手面板 */}
        <div className={`h-full ${activeTab === 'assistant' ? '' : 'hidden'}`}>
          <AssistantPanel openFileTab={() => setActiveTab('files')} />
        </div>

        {/* 文件浏览器 */}
        <div className={`h-full ${activeTab === 'files' ? '' : 'hidden'}`}>
          <FileExplorer openFileTab={() => setActiveTab('files')} />
        </div>
      </div>
    </div>
  );
}

export default TabPanel;
