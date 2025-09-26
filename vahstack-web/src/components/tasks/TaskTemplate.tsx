import React, { useState } from 'react';
import { useTask } from '../../TaskContext';
import TaskGraph from './TaskGraph';

/**
 * 任务类型枚举
 *
 * 分类体系：
 * - beautify-feature: 功能美化任务，专注于用户体验优化
 * - component-hook: 组件Hook任务，涉及React状态逻辑
 * - rpc-interface: RPC接口任务，处理远程过程调用
 * - component-ui: 组件UI任务，专注于界面组件开发
 */
type TaskType =
  | 'beautify-feature'
  | 'component-hook'
  | 'rpc-interface'
  | 'component-ui'
  | string;

/**
 * 任务依赖引用接口
 */
interface TaskReference {
  path: string;
}

/**
 * 任务依赖项接口
 */
interface TaskDependency {
  taskname: string;
  references?: TaskReference[];
}

/**
 * 源文件依赖接口
 */
interface SourceDependency {
  path: string;
}

/**
 * 任务目标文件接口
 */
interface TaskTarget {
  path: string;
}

/**
 * 任务依赖关系集合接口
 */
interface TaskDependencies {
  specs?: string[];
  tasks?: TaskDependency[];
  sources?: SourceDependency[];
}

/**
 * 任务数据模型接口
 *
 * 数据结构设计：
 * - 核心标识：id, taskname, type
 * - 显示信息：meta（用户友好名称）, content（详细描述）
 * - 状态管理：docStatus, output, parsedAt
 * - 关系映射：dependencies, references, targets
 * - 文件系统：sourcePath（源文件位置）
 */
interface Task {
  id: string;
  taskname: string;
  type: TaskType;
  meta?: string;
  content?: string;
  docStatus?: string;
  output?: string;
  parsedAt: string;
  dependencies?: TaskDependencies;
  references?: string[];
  targets?: TaskTarget[];
  sourcePath?: string;
}

/**
 * 任务卡片组件 Props
 */
interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
  isSelected: boolean;
  onStartTask?: (task: Task) => void;
}

/**
 * 任务详情组件 Props
 */
interface TaskDetailProps {
  task: Task | null;
  onClose: () => void;
  tasks: Task[];
}

/**
 * 主组件 Props
 */
interface TaskTemplateProps {
  onStartTask?: (task: Task) => void;
}

/**
 * 任务卡片组件 - 任务信息的紧凑展示单元
 *
 * 核心职责：
 * 1. 信息展示：任务名称、类型、依赖关系的层次化显示
 * 2. 视觉识别：基于任务类型的颜色编码系统
 * 3. 交互入口：点击查看详情、快速启动任务
 * 4. 状态反馈：选中状态的视觉高亮
 *
 * 设计模式：
 * - 策略模式：基于任务类型选择颜色和标签
 * - 命令模式：封装任务启动和详情查看操作
 * - 装饰器模式：为基础卡片添加选中状态装饰
 *
 * 用户体验：
 * - 信息密度：在有限空间内展示关键信息
 * - 视觉层次：标题、类型、依赖、操作的清晰层次
 * - 交互反馈：悬停效果和选中状态的即时反馈
 */
const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onClick,
  isSelected,
  onStartTask,
}) => {
  /**
   * 任务类型颜色映射器
   *
   * 视觉设计系统：
   * - 蓝色系：功能美化，代表优化和改进
   * - 绿色系：组件Hook，代表逻辑和状态
   * - 紫色系：RPC接口，代表通信和集成
   * - 黄色系：组件UI，代表界面和交互
   * - 灰色系：默认类型，保持中性
   */
  const getTypeColor = (type: TaskType): string => {
    const colors: Record<string, string> = {
      'beautify-feature': 'bg-blue-100 border-blue-300',
      'component-hook': 'bg-green-100 border-green-300',
      'rpc-interface': 'bg-purple-100 border-purple-300',
      'component-ui': 'bg-yellow-100 border-yellow-300',
      default: 'bg-gray-100 border-gray-300',
    };
    return colors[type] || colors.default;
  };

  /**
   * 任务类型标签映射器
   *
   * 本地化设计：
   * - 将英文类型标识转换为中文用户友好标签
   * - 提供统一的类型识别体系
   */
  const getTypeLabel = (type: TaskType): string => {
    const labels: Record<string, string> = {
      'beautify-feature': '功能美化',
      'component-hook': '组件Hook',
      'rpc-interface': 'RPC接口',
      'component-ui': '组件UI',
      default: '其他',
    };
    return labels[type] || labels.default;
  };

  /**
   * 任务启动处理器
   *
   * 事件处理逻辑：
   * 1. 阻止事件冒泡，避免触发卡片点击
   * 2. 调用外部回调函数启动任务
   *
   * 设计考量：
   * - 事件隔离：防止按钮点击触发卡片选择
   * - 可选回调：支持外部组件的任务流程集成
   */
  const handleStartTask = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (onStartTask) {
      onStartTask(task);
    }
  };

  return (
    <div
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md relative ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      } ${getTypeColor(task.type)}`}
      onClick={() => onClick(task)}
    >
      {/* 任务标题和类型区域 */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 min-w-0 mr-2">
          {/* 主标题：优先显示用户友好的meta，回退到技术名称 */}
          <h3 className="font-semibold text-gray-800 text-sm leading-tight">
            {task.meta || task.taskname}
          </h3>
          {/* 副标题：当存在meta时显示技术名称作为补充 */}
          {task.meta && task.taskname && (
            <p className="text-xs text-gray-500 mt-1">{task.taskname}</p>
          )}
        </div>
        {/* 类型标签：右上角的类型标识 */}
        <span className="text-xs px-2 py-1 bg-white rounded border text-gray-600 flex-shrink-0">
          {getTypeLabel(task.type)}
        </span>
      </div>

      {/* 任务输出信息 */}
      {task.output && (
        <p className="text-xs text-gray-600 mb-2">输出: {task.output}</p>
      )}

      {/* 依赖关系展示 - 最多显示2个，其余用数量表示 */}
      <div className="flex flex-wrap gap-1 mb-2">
        {task.dependencies?.tasks?.slice(0, 2).map((dep, index) => (
          <span
            key={index}
            className="text-xs px-1 py-0.5 bg-white rounded border text-gray-500"
          >
            依赖: {dep.taskname}
          </span>
        ))}
        {task.dependencies?.tasks && task.dependencies.tasks.length > 2 && (
          <span className="text-xs text-gray-400">
            +{task.dependencies.tasks.length - 2}个依赖
          </span>
        )}
      </div>

      {/* 底部信息栏：时间戳和操作按钮 */}
      <div className="flex justify-between items-end">
        <div className="text-xs text-gray-400">
          {new Date(task.parsedAt).toLocaleString()}
        </div>
        <button
          onClick={handleStartTask}
          className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex-shrink-0"
        >
          开始任务
        </button>
      </div>
    </div>
  );
};

/**
 * 任务详情组件 - 任务信息的完整展示面板
 *
 * 核心职责：
 * 1. 详细展示：任务的完整信息和元数据
 * 2. 关系可视化：依赖关系图和文件引用
 * 3. 结构化信息：分类展示不同类型的任务数据
 * 4. 导航控制：关闭详情面板的用户控制
 *
 * 设计模式：
 * - 门面模式：为复杂的任务数据提供统一的展示接口
 * - 组合模式：将不同类型的信息组合成完整的详情视图
 * - 观察者模式：响应任务选择变化并更新显示内容
 *
 * 信息架构：
 * - 基本信息：任务标识、类型、状态等核心数据
 * - 任务内容：详细的任务描述和要求
 * - 依赖关系：规范、任务、源文件的多层依赖
 * - 文件引用：输入和输出文件的路径信息
 */
const TaskDetail: React.FC<TaskDetailProps> = ({ task, onClose, tasks }) => {
  if (!task) return null;

  return (
    <div className="bg-white border-l border-gray-200 p-6 overflow-y-auto">
      {/* 详情面板头部 */}
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-bold text-gray-800">
          {task.meta || task.taskname}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl"
        >
          ×
        </button>
      </div>

      {/* 任务关系图 - 可视化依赖关系 */}
      <TaskGraph task={task} allTasks={tasks} onNodeClick={undefined} />

      <div className="space-y-4">
        {/* 基本信息区域 */}
        <div>
          <h3 className="font-semibold text-gray-700 mb-2">基本信息</h3>
          <div className="bg-gray-50 p-3 rounded">
            <p>
              <span className="font-medium">任务ID:</span> {task.id}
            </p>
            <p>
              <span className="font-medium">类型:</span> {task.type}
            </p>
            <p>
              <span className="font-medium">状态:</span> {task.docStatus}
            </p>
            {task.output && (
              <p>
                <span className="font-medium">输出:</span> {task.output}
              </p>
            )}
            <p>
              <span className="font-medium">解析时间:</span>{' '}
              {new Date(task.parsedAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* 任务内容区域 */}
        {task.content && (
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">任务内容</h3>
            <div className="bg-gray-50 p-3 rounded">
              <pre className="whitespace-pre-wrap text-sm">{task.content}</pre>
            </div>
          </div>
        )}

        {/* 依赖关系区域 - 分类展示不同类型的依赖 */}
        <div>
          <h3 className="font-semibold text-gray-700 mb-2">依赖关系</h3>
          <div className="space-y-2">
            {/* 规范依赖 */}
            {task.dependencies?.specs && task.dependencies.specs.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-600">规范依赖:</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 ml-2">
                  {task.dependencies.specs.map((spec, index) => (
                    <li key={index}>{spec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 任务依赖 - 支持嵌套的文件引用 */}
            {task.dependencies?.tasks && task.dependencies.tasks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-600">任务依赖:</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 ml-2">
                  {task.dependencies.tasks.map((dep, index) => (
                    <li key={index}>
                      {dep.taskname}
                      {dep.references && (
                        <ul className="list-disc list-inside ml-4">
                          {dep.references.map((ref, refIndex) => (
                            <li
                              key={refIndex}
                              className="text-xs text-gray-500"
                            >
                              {ref.path}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 源文件依赖 */}
            {task.dependencies?.sources &&
              task.dependencies.sources.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-600">
                    源文件依赖:
                  </h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 ml-2">
                    {task.dependencies.sources.map((source, index) => (
                      <li key={index}>{source.path}</li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        </div>

        {/* 引用和目标文件区域 - 并排布局 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 引用文件列表 */}
          {task.references && task.references.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">引用文件</h3>
              <ul className="list-disc list-inside text-sm text-gray-600 bg-gray-50 p-3 rounded">
                {task.references.map((ref, index) => (
                  <li key={index}>{ref}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 目标文件列表 */}
          {task.targets && task.targets.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">目标文件</h3>
              <ul className="list-disc list-inside text-sm text-gray-600 bg-gray-50 p-3 rounded">
                {task.targets.map((target, index) => (
                  <li key={index}>{target.path}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 源文件路径区域 */}
        {task.sourcePath && (
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">源文件路径</h3>
            <div className="bg-gray-50 p-3 rounded">
              <code className="text-sm">{task.sourcePath}</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 任务模板主组件 - 任务管理的完整界面
 *
 * 核心职责：
 * 1. 任务列表：展示所有可用任务的网格布局
 * 2. 详情面板：提供任务的详细信息查看
 * 3. 状态管理：处理加载、错误、空数据等状态
 * 4. 交互协调：管理列表选择和详情显示的联动
 *
 * 设计模式：
 * - 主从模式：列表为主视图，详情为从视图
 * - 状态机模式：管理加载、错误、正常等不同状态
 * - 观察者模式：监听任务数据变化并更新UI
 * - 命令模式：封装任务操作和状态切换
 *
 * 布局策略：
 * - 响应式设计：根据详情面板状态调整列表宽度
 * - 网格布局：任务卡片的自适应网格排列
 * - 分屏模式：列表和详情的并排显示
 * - 状态反馈：加载、错误、空数据的友好提示
 */
const TaskTemplate: React.FC<TaskTemplateProps> = ({ onStartTask }) => {
  /**
   * 任务数据和状态管理
   */
  const { tasks, loading, error, refreshTasks } = useTask();

  /**
   * 组件内部状态
   * - selectedTask: 当前选中的任务对象
   * - showDetail: 详情面板的显示状态
   */
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDetail, setShowDetail] = useState<boolean>(false);

  /**
   * 任务点击处理器 - 显示任务详情
   */
  const handleTaskClick = (task: Task): void => {
    setSelectedTask(task);
    setShowDetail(true);
  };

  /**
   * 详情面板关闭处理器 - 重置选择状态
   */
  const handleCloseDetail = (): void => {
    setShowDetail(false);
    setSelectedTask(null);
  };

  /**
   * 加载状态渲染
   */
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">加载任务列表中...</div>
      </div>
    );
  }

  /**
   * 错误状态渲染 - 提供重试机制
   */
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <div className="text-red-500">加载失败: {error}</div>
        <button
          onClick={refreshTasks}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          重试
        </button>
      </div>
    );
  }

  /**
   * 主界面渲染 - 分屏布局
   */
  return (
    <div className="h-full flex">
      {/* 任务列表区域 - 响应式宽度 */}
      <div
        className={`${showDetail ? 'w-1/2' : 'w-full'} transition-all duration-300`}
      >
        {/* 列表头部 - 标题和操作栏 */}
        <div className="p-4 border-b bg-white">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-800" />
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">
                共 {tasks.length} 个任务
              </span>
              <button
                onClick={refreshTasks}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                刷新
              </button>
            </div>
          </div>
        </div>

        {/* 任务列表内容区域 */}
        <div
          className="p-4 overflow-y-auto"
          style={{ height: 'calc(100% - 80px)' }}
        >
          {tasks.length === 0 ? (
            // 空状态提示
            <div className="text-center text-gray-500 mt-8">暂无任务数据</div>
          ) : (
            // 任务网格布局
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map((task: Task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={handleTaskClick}
                  isSelected={selectedTask?.id === task.id}
                  onStartTask={onStartTask}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 任务详情区域 - 条件渲染 */}
      {showDetail && (
        <div className="w-1/2 transition-all duration-300">
          <TaskDetail
            task={selectedTask}
            onClose={handleCloseDetail}
            tasks={tasks}
          />
        </div>
      )}
    </div>
  );
};

export default TaskTemplate;
