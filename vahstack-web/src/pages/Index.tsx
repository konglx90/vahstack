import React, { useState } from 'react';
import ChatRichInput from '../components/chat-input/ChatRichInput';
import { buildTaskTemplate } from '../components/chat-input/token';
import TaskTemplate from '../components/tasks/TaskTemplate';
import { useEventManager, EVENT_TYPES } from '../hooks/useCustomEvent';
import { useTask } from '../TaskContext';
import TaskList from '../components/tasks/TaskList';
import { useTaskHistory } from '../TaskContext';

/**
 * 任务依赖项接口定义
 *
 * 设计原则：依赖关系的精确建模
 * - taskname: 依赖任务的唯一标识符
 * - references: 可选的引用信息，支持复杂依赖场景
 */
interface TaskDependency {
  taskname: string;
  references?: Array<{ path: string }>;
}

/**
 * 源文件依赖接口定义
 *
 * 设计意图：文件级依赖的抽象
 * - path: 文件路径，支持相对和绝对路径
 */
interface SourceDependency {
  path: string;
}

/**
 * 任务依赖关系集合接口
 *
 * 架构设计：多维度依赖关系的统一管理
 * - specs: 规范文档依赖
 * - tasks: 任务间依赖关系
 * - sources: 源文件依赖关系
 */
interface TaskDependencies {
  specs?: string[];
  tasks?: TaskDependency[];
  sources?: SourceDependency[];
}

/**
 * 任务对象接口定义
 *
 * 设计原则：数据结构的完整性和一致性
 * - 与其他组件中的 Task 接口保持一致
 * - 支持任务的完整生命周期管理
 * - 提供足够的元数据用于任务识别和展示
 */
interface Task {
  id: string;
  taskname: string;
  type?: string;
  meta?: string;
  content?: string;
  docStatus?: string;
  output?: string;
  parsedAt: string;
  dependencies?: TaskDependencies;
  references?: string[];
  targets?: Array<{ path: string }>;
  sourcePath?: string;
}

/**
 * 任务历史记录接口定义
 *
 * 数据结构设计：
 * - 与 TaskList 组件期望的接口保持一致
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
 * 任务目标接口定义
 *
 * 设计意图：任务导航的数据载体
 * - message: 任务描述信息，用于聊天界面的上下文
 * - targets: 相关文件路径列表，支持多文件任务场景
 */
interface TaskTarget {
  message: string;
  targets: string[];
}

/**
 * 标签页类型定义
 *
 * 约束性设计：限制可选值，确保界面状态的一致性
 */
type TabType = 'template' | 'list';

/**
 * Index 组件属性接口
 *
 * 设计哲学：依赖注入原则
 * - 通过 props 注入导航函数，实现组件间的松耦合
 * - 支持不同的导航策略，提升组件的可复用性
 */
interface IndexProps {
  /** 导航到聊天页面的回调函数 */
  onNavigateToChat: (message: string, task?: Task | TaskTarget) => void;
}

/**
 * Index 页面组件 - 应用程序的主入口和任务管理中心
 *
 * 核心职责：
 * 1. 用户交互入口：提供富文本输入界面，支持复杂任务描述
 * 2. 任务管理中心：集成任务模板和任务列表的统一管理
 * 3. 工作流协调：连接任务选择、模板构建和聊天导航的完整流程
 * 4. 状态管理：维护输入状态、任务选择状态和界面切换状态
 *
 * 设计模式：
 * - 门面模式：为复杂的任务管理系统提供简化的统一接口
 * - 中介者模式：协调多个子组件之间的交互和数据流
 * - 状态机模式：管理标签页切换和任务选择的状态转换
 * - 观察者模式：通过事件系统与其他组件进行解耦通信
 *
 * 架构设计：
 * - 分层架构：UI层、业务逻辑层、数据访问层的清晰分离
 * - 组件组合：通过组合多个专业化组件实现复杂功能
 * - 事件驱动：使用自定义事件系统实现组件间的松耦合通信
 *
 * 用户体验设计：
 * - 渐进式披露：通过标签页分组展示不同类型的任务信息
 * - 即时反馈：任务选择和操作提供实时的视觉反馈
 * - 工作流引导：从任务选择到聊天导航的自然流程设计
 * - 上下文保持：在不同操作间保持用户的工作状态
 */
const Index: React.FC<IndexProps> = ({ onNavigateToChat }) => {
  /**
   * 输入值状态管理
   *
   * 设计考量：
   * - 支持富文本输入的复杂内容结构
   * - 与 ChatRichInput 组件的双向数据绑定
   * - 为后续的模板插入和内容处理提供基础
   */
  const [inputValue, setInputValue] = useState<string>('');

  /**
   * 选中任务状态管理
   *
   * 状态设计：
   * - 支持 Task 对象的完整信息存储
   * - null 状态表示未选择任务的初始状态
   * - 为任务模板构建和历史记录创建提供数据源
   */
  const [selectTask, seSelectTask] = useState<Task | null>(null);

  /**
   * 活跃标签页状态管理
   *
   * 界面组织：
   * - template: 任务模板视图，用于浏览和选择预定义任务
   * - list: 任务列表视图，用于管理和继续现有任务
   * - 默认显示模板页，符合新用户的使用习惯
   */
  const [activeTab, setActiveTab] = useState<TabType>('template');

  /**
   * 模板插入事件管理器
   *
   * 事件驱动设计：
   * - 通过自定义事件系统与 ChatRichInput 组件通信
   * - 实现任务模板的动态插入功能
   * - 保持组件间的松耦合关系
   */
  const { emit: emitInsertTemplate } = useEventManager(
    EVENT_TYPES.INSERT_TEMPLATE,
  );

  /**
   * 任务数据访问钩子
   *
   * 数据层集成：
   * - 获取全局任务数据，用于模板构建和依赖分析
   * - 通过 Context 模式实现数据的统一管理
   * - 支持任务间依赖关系的解析和处理
   */
  const { tasks } = useTask();

  /**
   * 任务历史管理钩子
   *
   * 持久化设计：
   * - 支持任务历史记录的创建和管理
   * - 为用户提供任务执行的可追溯性
   * - 与后端服务的集成接口
   */
  const { createHistoryTask } = useTaskHistory();

  /**
   * 发送处理器 - 启动聊天会话的核心逻辑
   *
   * 业务流程：
   * 1. 导航到聊天界面，传递用户输入和选中任务
   * 2. 创建任务历史记录，支持后续的任务跟踪
   * 3. 异常处理：安全地处理任务名称可能为空的情况
   *
   * 设计模式：命令模式 - 封装复杂的业务操作序列
   */
  const handleSend = (): void => {
    // 类型安全的导航调用：处理 null 值情况
    onNavigateToChat(inputValue, selectTask || undefined);

    // 防御性编程：确保任务名称存在时才创建历史记录
    if (selectTask?.taskname) {
      createHistoryTask(selectTask.taskname);
    }
  };

  /**
   * 输入变化处理器 - 响应用户输入的实时更新
   *
   * 数据流设计：
   * - 单向数据流：从子组件向父组件传递数据变化
   * - 调试支持：保留控制台日志用于开发阶段的问题诊断
   * - 类型安全：明确指定参数类型，避免运行时错误
   */
  const handleInputChange = (value: string): void => {
    console.log('handleInputChange', value);
    setInputValue(value);
  };

  /**
   * 任务启动处理器 - 任务模板选择的核心逻辑
   *
   * 业务流程：
   * 1. 参数验证：确保任务对象的有效性
   * 2. 状态更新：设置当前选中的任务
   * 3. 模板构建：基于任务和依赖关系生成完整模板
   * 4. 事件触发：通知输入组件插入生成的模板
   *
   * 设计模式：
   * - 模板方法模式：定义任务启动的标准流程
   * - 策略模式：根据不同任务类型生成相应的模板
   * - 发布-订阅模式：通过事件系统通知相关组件
   */
  const handleStartTask = (task: Task): void => {
    // 防御性编程：早期返回避免无效操作
    if (!task) {
      return;
    }

    // 状态更新：设置当前选中的任务
    seSelectTask(task);

    // 模板构建：集成任务信息和依赖关系
    // 类型适配：由于不同模块间的接口定义略有差异，使用类型断言确保兼容性
    // buildTaskTemplate 函数来自 token.tsx，其 Task 接口定义与当前文件略有不同
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const template = buildTaskTemplate(task as any, tasks);
    console.log('🚀 ~ handleStartTask ~ template:', template);

    // 事件触发：通知输入组件插入模板
    // 传递模板内容和任务名称，支持富文本编辑器的智能插入
    emitInsertTemplate({
      template,
      taskname: task.taskname,
    });
  };

  /**
   * 任务继续处理器 - 恢复现有任务的执行流程
   *
   * 业务场景：
   * - 用户从任务列表中选择已存在的任务
   * - 直接导航到聊天界面，跳过模板构建步骤
   * - 保持任务的上下文信息和执行状态
   *
   * 设计考量：
   * - 与 handleStartTask 的职责分离
   * - 支持不同的任务启动路径
   * - 参数验证确保操作的安全性
   */
  const handleContinueTask = (
    taskHistory: TaskHistory,
    template?: unknown,
  ): void => {
    // 防御性编程：确保任务对象的有效性
    if (!taskHistory) {
      return;
    }

    // 构建任务目标对象：将历史任务转换为导航所需的格式
    const taskTarget: TaskTarget = {
      message: (template as string) || taskHistory.name,
      targets: [], // 历史任务可能没有具体的目标文件
    };

    // 直接导航：跳过模板构建，使用现有模板或任务名称
    onNavigateToChat((template as string) || taskHistory.name, taskTarget);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* 
          欢迎区域 - 品牌展示和功能介绍
          
          设计原则：
          - 品牌一致性：统一的视觉风格和语言表达
          - 信息层次：标题和副标题的清晰层次结构
          - 用户引导：简洁明了的功能说明
        */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            早上好，欢迎来到 👏🏻 Ragdoll
          </h1>
          <p className="text-lg text-gray-600">
            SpecRefiner 完善精准系分，让出码更加准确
          </p>
        </div>

        {/* 
          输入区域 - 用户交互的主要入口
          
          组件集成：
          - ChatRichInput: 富文本编辑器，支持复杂内容输入
          - 工作目录显示：提供上下文信息，增强用户的空间感知
          
          UX 设计：
          - 卡片式布局：通过阴影和圆角营造层次感
          - 相对定位：工作目录信息的非侵入式展示
          - 占位符文本：引导用户输入的友好提示
        */}
        <div className="bg-white rounded-lg shadow-lg mb-8 relative">
          <div className="relative">
            <ChatRichInput
              onSend={handleSend}
              isLoading={false}
              placeholder="描述你想要实现的功能或遇到的问题..."
              onChange={handleInputChange}
              initialValue={inputValue}
              onlyCheckEmpty={true}
            />
            {/* 工作目录指示器 - 提供上下文信息 */}
            <div className="absolute bottom-4 right-32 text-xs text-gray-500 bg-white px-2 py-1 rounded border">
              📁 code-parser
            </div>
          </div>
        </div>

        {/* 
          标签页导航 - 功能区域的切换控制
          
          交互设计：
          - 点击切换：简单直观的标签页切换机制
          - 视觉反馈：活跃状态的背景色和字体粗细变化
          - 一致性：统一的样式规范和交互行为
          
          信息架构：
          - 任务模板：预定义任务的浏览和选择
          - 任务列表：现有任务的管理和继续执行
        */}
        <div className="flex items-center gap-2.5 mt-10 mb-4">
          <div
            onClick={() => setActiveTab('template')}
            className={`text-lg py-[5px] px-[10px] rounded-[15px] cursor-pointer
${activeTab === 'template' ? 'bg-gray-100 font-bold' : ''}`}
          >
            任务模板
          </div>

          <div
            onClick={() => setActiveTab('list')}
            className={`text-lg py-[5px] px-[10px] rounded-[15px] cursor-pointer
${activeTab === 'list' ? 'bg-gray-100 font-bold' : ''}`}
          >
            任务列表
          </div>
        </div>

        {/* 
          条件渲染区域 - 基于标签页状态的内容展示
          
          组件职责分离：
          - TaskList: 现有任务的管理界面，支持任务继续执行
          - TaskTemplate: 任务模板的浏览界面，支持新任务创建
          
          状态驱动：
          - 通过 activeTab 状态控制组件的显示和隐藏
          - 保持组件的独立性和可维护性
        */}
        {activeTab === 'list' && (
          <TaskList onContinueTask={handleContinueTask} />
        )}

        {activeTab === 'template' && (
          <div className="bg-white rounded-lg shadow-lg">
            <TaskTemplate onStartTask={handleStartTask} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
