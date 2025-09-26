import React, { useState, useEffect } from 'react';
import IndexPage from './pages/Index';
import ChatPage from './pages/Chat';

/**
 * 页面类型定义
 *
 * 设计原则：类型安全的路由管理
 * - 限制页面只能是预定义的值，避免路由错误
 * - 便于扩展新的页面类型
 */
type PageType = 'index' | 'chat';

/**
 * 任务类型定义（根据使用上下文推断）
 *
 * 注：此类型可能需要根据实际的任务数据结构进行调整
 */
type Task = string | object | null;

/**
 * 应用程序主组件 - 单页应用的路由控制中心
 *
 * 核心职责：
 * 1. 路由管理：基于浏览器路径和状态控制页面切换
 * 2. 状态传递：在不同页面间传递初始化数据
 * 3. 历史管理：处理浏览器前进/后退导航
 * 4. 页面协调：统一管理页面间的数据流和导航逻辑
 *
 * 设计模式：
 * - 状态机：管理页面切换的状态转换
 * - 中介者模式：协调不同页面组件间的通信
 * - 观察者模式：监听浏览器历史变化事件
 *
 * 架构特点：
 * - 客户端路由：无需服务器端路由配置
 * - 状态保持：在页面切换时保持必要的应用状态
 * - 渐进增强：支持浏览器原生导航行为
 */
function App(): React.ReactElement {
  /**
   * 当前页面状态管理
   *
   * 设计考量：
   * - 默认显示首页，符合用户访问流程
   * - 使用类型安全的 PageType 确保路由一致性
   * - 支持程序化和用户导航的双重控制
   */
  const [currentPage, setCurrentPage] = useState<PageType>('index');

  /**
   * 页面间数据传递状态
   *
   * 职责分离：
   * - initialMessage: 从首页传递到聊天页的初始消息
   * - selectTask: 选中的任务数据，支持上下文连续性
   */
  const [initialMessage, setInitialMessage] = useState<string>('');
  const [selectTask, seSelectTask] = useState<Task>('');

  /**
   * 页面初始化效果
   *
   * 启动逻辑：
   * 1. 读取当前浏览器路径
   * 2. 根据路径设置对应的页面状态
   * 3. 确保应用状态与URL同步
   *
   * 设计原则：URL即状态
   * - 用户可以直接通过URL访问特定页面
   * - 支持书签和分享功能
   */
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/chat') {
      setCurrentPage('chat');
    } else {
      setCurrentPage('index');
    }
  }, []);

  /**
   * 浏览器历史导航监听器
   *
   * 交互逻辑：
   * 1. 监听浏览器前进/后退按钮事件
   * 2. 根据新路径更新页面状态
   * 3. 处理特殊路径的规范化
   *
   * 用户体验优化：
   * - 支持浏览器原生导航行为
   * - 保持URL与应用状态的一致性
   * - 自动清理无效路径状态
   */
  useEffect(() => {
    const handlePopState = (): void => {
      const path = window.location.pathname;
      if (path === '/chat') {
        setCurrentPage('chat');
      } else {
        setCurrentPage('index');
        // 规范化根路径，确保URL整洁
        window.history.replaceState(null, '', '/');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  /**
   * 聊天页面导航处理器
   *
   * 导航流程：
   * 1. 设置传递给聊天页的初始数据
   * 2. 切换到聊天页面状态
   * 3. 更新浏览器URL和历史记录
   *
   * 参数设计：
   * - message: 可选的初始消息，支持快速开始对话
   * - task: 选中的任务上下文，保持工作连续性
   */
  const handleNavigateToChat = (
    message: string = '',
    task: Task = null,
  ): void => {
    setInitialMessage(message);
    seSelectTask(task);
    setCurrentPage('chat');
    // 更新浏览器历史，支持后退导航
    window.history.pushState(null, '', '/chat');
  };

  /**
   * 条件渲染逻辑
   *
   * 渲染策略：
   * - 基于当前页面状态选择对应组件
   * - 传递必要的导航回调和初始数据
   * - 保持组件间的松耦合关系
   *
   * 性能考虑：
   * - 使用条件渲染而非同时挂载，优化内存使用
   * - 每次只渲染当前活跃页面，提升性能
   */
  if (currentPage === 'index') {
    return <IndexPage onNavigateToChat={handleNavigateToChat} />;
  }

  // 聊天页面渲染
  return <ChatPage initialMessage={initialMessage} selectTask={selectTask} />;
}

export default App;
