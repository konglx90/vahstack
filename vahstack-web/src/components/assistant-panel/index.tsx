import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Button, Modal, Input, Table, message, Tag, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  dispatchCustomEvent,
  EVENT_TYPES,
  useEventManager,
} from '../../hooks/useCustomEvent';
import { useTask } from '../../TaskContext';
import {
  sortTasksByDependency,
  parseYuqueUrl,
  parseTaskPlanning,
} from '../../utils/tasks';

const { TextArea } = Input;

/**
 * 任务依赖项类型定义
 *
 * 设计哲学：明确的依赖关系建模
 * - 区分任务依赖和源文件依赖，支持复杂的依赖图管理
 * - 每个依赖项都有明确的状态标识，便于可视化展示
 */
interface TaskDependency {
  taskname: string;
  references?: Array<{ content: string }>;
}

interface SourceDependency {
  path: string;
  content: string;
}

/**
 * 任务目标文件类型定义
 *
 * 设计原则：输出导向
 * - 每个任务都有明确的输出目标，便于跟踪完成状态
 * - path 和 content 分离，支持文件路径规划和内容生成的解耦合
 */
interface TaskTarget {
  path: string;
  content?: string;
}

/**
 * 任务对象类型定义
 *
 * 核心设计：任务驱动的开发流程
 * - 每个任务都有唯一标识和元数据描述
 * - 依赖关系明确，支持 DAG（有向无环图）调度
 * - 目标文件清晰，便于验证任务完成度
 */
interface Task {
  id: string;
  taskname: string;
  meta: string;
  relativePath: string;
  dependencies?: {
    tasks?: TaskDependency[];
    sources?: SourceDependency[];
  };
  targets?: TaskTarget[];
}

/**
 * 功能特性类型定义
 *
 * 设计意图：功能导向的任务组织
 * - 将相关任务按功能特性分组，提升项目管理的可理解性
 * - 支持功能级别的状态跟踪和进度展示
 */
interface Feature {
  name: string;
  status?: string;
  tasks: Task[];
}

/**
 * 表格数据源类型定义
 *
 * 设计原则：视图数据分离
 * - 专门为 Ant Design Table 组件设计的数据结构
 * - key 字段确保 React 列表渲染的性能优化
 */
interface TableDataSource {
  key: string;
  featureName: string;
  status?: string;
  tasks: Task[];
}

/**
 * 组件 Props 类型定义
 *
 * 设计哲学：接口最小化
 * - 只暴露必要的回调函数，保持组件的独立性
 * - 通过回调实现与父组件的松耦合通信
 */
interface AssistantPanelProps {
  openFileTab: () => void;
}

/**
 * 系统分析助手面板组件
 *
 * 核心职责：
 * 1. 需求文档解析：从语雀等平台获取需求文档并解析
 * 2. 任务规划管理：基于需求生成任务依赖图和执行计划
 * 3. 开发流程协调：提供任务执行入口和状态跟踪
 * 4. 文件导航支持：集成文件浏览器，支持快速文件定位
 *
 * 设计哲学：
 * - 事件驱动架构：通过自定义事件实现组件间解耦通信
 * - 状态机模式：明确的加载、成功、错误状态管理
 * - 依赖注入：通过 props 注入外部依赖，提升可测试性
 * - 防御性编程：完善的错误处理和边界条件检查
 */
const AssistantPanel: React.FC<AssistantPanelProps> = ({ openFileTab }) => {
  // 模态框状态管理
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [docURL, setDocURL] = useState<string>('');

  // 异步操作状态管理 - 体现状态机设计模式
  const [loading, setLoading] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 业务数据状态
  const [features, setFeatures] = useState<Feature[]>([]);

  // 任务上下文集成 - 依赖注入模式
  const { tasks } = useTask();

  /**
   * 规划任务查找逻辑
   *
   * 设计意图：单一职责原则
   * - 专门负责从任务列表中定位规划任务
   * - 使用 useMemo 优化性能，避免不必要的重复计算
   */
  const planningTask = useMemo(
    () => tasks.find((t: Task) => t.taskname === 'planning'),
    [tasks],
  );

  /**
   * 规划完成状态计算
   *
   * 设计哲学：声明式编程
   * - 通过数据状态推导界面状态，而非命令式操作
   * - 所有目标文件都有内容才认为规划完成，确保数据完整性
   */
  const planningDone = useMemo(
    () =>
      planningTask
        ? (planningTask.targets ?? []).every((t: TaskTarget) => t.content)
        : false,
    [planningTask],
  );

  /**
   * 功能特性更新逻辑
   *
   * 核心算法：依赖图排序和任务分组
   * - 解析规划内容，提取任务依赖关系
   * - 使用拓扑排序确保任务执行顺序的正确性
   * - 按功能特性分组，提升项目管理的可理解性
   */
  const updateFeatures = useCallback(() => {
    if (!planningDone || !planningTask) return;

    const [{ content = '' } = {}] = planningTask.targets ?? [];
    const planningArr = parseTaskPlanning(content);

    // 任务名称集合提取
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const needNames = new Set(planningArr.map((p: any) => p.taskname));
    const matched = tasks.filter((t: Task) => needNames.has(t.taskname));

    // 依赖图拓扑排序 - 确保任务执行顺序
    const sorted = sortTasksByDependency(matched);

    // 功能特性分组 - 目前硬编码，未来可扩展为动态分组
    setFeatures([{ name: '年金补偿页', tasks: sorted }]);
  }, [planningDone, planningTask, tasks]);

  /**
   * 副作用管理：规划完成后的功能特性更新
   *
   * 设计原则：响应式编程
   * - 监听关键状态变化，自动触发相应的业务逻辑
   * - 确保状态同步的一致性和时序正确性
   */
  useEffect(() => {
    if (submitted && planningDone) {
      updateFeatures();
      setSubmitted(false);
      setLoading(false);
    }
  }, [submitted, planningDone, updateFeatures]);

  /**
   * 消息结果事件监听
   *
   * 设计模式：观察者模式
   * - 监听全局消息发送结果，更新本地状态
   * - 统一的错误处理和成功响应逻辑
   */
  useEventManager(EVENT_TYPES.SEND_MESSAGE_RESULT, (detail: unknown) => {
    const { type } = detail as { type: string };
    setLoading(false);
    if (type === 'success') {
      updateFeatures();
    } else {
      setError(type === 'AbortError' ? '用户取消，请重试' : String(type));
      setSubmitted(false);
    }
  });

  /**
   * 需求文档处理流程
   *
   * 核心业务逻辑：
   * 1. 语雀文档解析：提取文档内容和元数据
   * 2. 文件系统写入：将需求文档保存到指定路径
   * 3. 任务规划触发：如果规划任务未完成，自动启动规划流程
   *
   * 设计原则：
   * - 原子性操作：要么全部成功，要么全部回滚
   * - 错误边界：完善的异常捕获和用户反馈
   * - 状态一致性：确保 UI 状态与业务状态同步
   */
  const handleStart = async (): Promise<void> => {
    if (!docURL) {
      message.warning('请粘贴需求文档链接');
      return;
    }
    try {
      setSubmitted(true);
      setLoading(true);
      setError(null);

      // 语雀 URL 解析 - 提取文档标识符
      const { bookId, docId } = parseYuqueUrl(docURL);
      const url = `/yuque/api/v2/repos/${bookId}/docs/${docId}`;

      // 文档内容获取 - 使用认证令牌访问私有文档
      const res = await fetch(url, {
        headers: {
          'X-Auth-Token': 'rEJMTvqr8NMy6cFtD6eBZ2L8Zz9tLkOH88Q7BzMf',
          'Content-Type': 'application/json',
        },
      });
      const { data } = await res.json();

      // 文档持久化 - 写入本地文件系统
      await fetch('/api-save-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [
            {
              path: 'ragdoll/develop/source/feature.md',
              content: data.body,
            },
            {
              path: 'ragdoll/develop/source/function.md',
              content: data.body,
            },
          ],
        }),
      });

      setModalOpen(false);

      // 条件触发规划任务 - 避免重复执行
      if (!planningDone && planningTask) {
        dispatchCustomEvent(EVENT_TYPES.SEND_MESSAGE, {
          message: planningTask.relativePath,
          targets: planningTask.targets,
        });
      }
    } catch (e) {
      console.error(e);
      message.error('解析文档失败');
      setSubmitted(false);
      setLoading(false);
    }
  };

  /**
   * 任务执行触发器
   *
   * 设计意图：命令模式
   * - 将任务执行请求封装为事件，实现解耦
   * - 通过事件系统与编辑器组件通信
   */
  const handleRunTask = useCallback((task: Task): void => {
    dispatchCustomEvent(EVENT_TYPES.INSERT_FILE_TO_INPUT, {
      filePath: `${task.relativePath} 完成任务`,
      targets: task.targets,
    });
  }, []);

  /**
   * 文件导航处理器
   *
   * 设计模式：适配器模式
   * - 适配文件浏览器和编辑器的交互协议
   * - 使用延时确保标签页切换完成后再打开文件
   */
  const handleOpenFile = useCallback(
    (filePath: string): void => {
      openFileTab();
      setTimeout(() => {
        dispatchCustomEvent(EVENT_TYPES.OPEN_FILE, { filePath });
      }, 200);
    },
    [openFileTab],
  );

  /**
   * 表格列定义
   *
   * 设计哲学：数据驱动的 UI
   * - 通过配置化的列定义实现灵活的表格布局
   * - 渲染函数封装复杂的业务逻辑和交互行为
   * - 依赖状态计算确定任务的可执行性
   */
  const columns: ColumnsType<TableDataSource> = useMemo(
    () => [
      {
        title: '功能点',
        dataIndex: 'featureName',
        key: 'featureName',
        width: 180,
        render: (text: string) => <span className="font-medium">{text}</span>,
      },
      {
        title: '任务列表',
        dataIndex: 'tasks',
        key: 'tasks',
        render: (taskArr: Task[]) => (
          <ul className="divide-y divide-gray-200">
            {taskArr.map((task: Task) => {
              const depsTasks = task.dependencies?.tasks ?? [];
              const depsSources = task.dependencies?.sources ?? [];

              // 依赖完成状态计算 - 确保任务执行的前置条件
              const tasksDone =
                depsTasks.length === 0 ||
                depsTasks.every((t: TaskDependency) =>
                  (t.references ?? []).every(
                    (ref: { content: string }) => ref.content,
                  ),
                );
              const sourcesDone =
                depsSources.length === 0 ||
                depsSources.every((s: SourceDependency) => s.content);

              const canRun = tasksDone && sourcesDone;

              return (
                <li key={task.id} className="py-3 first:pt-0 last:pb-0">
                  {/* 任务标题 + 开始按钮 */}
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {task.meta} ({task.taskname})
                    </span>
                    {canRun && (
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => handleRunTask(task)}
                      >
                        开始任务
                      </Button>
                    )}
                  </div>

                  {/* 依赖 & 目标文件 标签 - 可视化依赖关系 */}
                  <ul className="mt-1">
                    {depsSources.map((s: SourceDependency, i: number) => (
                      <Tag
                        key={i}
                        className="cursor-pointer"
                        color={s.content ? 'success' : 'error'}
                        onClick={() => handleOpenFile(s.path)}
                      >
                        源文件：{s.path}
                      </Tag>
                    ))}

                    {depsTasks.map((t: TaskDependency, i: number) => (
                      <Tag
                        key={i}
                        color={
                          (t.references ?? []).every(
                            (r: { content: string }) => r.content,
                          )
                            ? 'success'
                            : 'error'
                        }
                      >
                        任务依赖：{t.taskname}
                      </Tag>
                    ))}

                    {(task.targets ?? []).map(
                      (t: TaskTarget, i: number) =>
                        t.content && (
                          <Tag
                            key={i}
                            className="cursor-pointer"
                            color="success"
                            onClick={() => handleOpenFile(t.path)}
                          >
                            生成文件：{t.path}
                          </Tag>
                        ),
                    )}
                  </ul>
                </li>
              );
            })}
          </ul>
        ),
      },
    ],
    [handleRunTask, handleOpenFile],
  );

  /**
   * 表格数据源转换
   *
   * 设计原则：视图模型模式
   * - 将业务数据转换为表格组件所需的数据结构
   * - 使用 useMemo 优化性能，避免不必要的重新渲染
   */
  const dataSource: TableDataSource[] = useMemo(
    () =>
      features.map((f: Feature, idx: number) => ({
        key: `feature-${idx}`,
        featureName: f.name,
        status: f.status,
        tasks: f.tasks,
      })),
    [features],
  );

  // 样式配置 - 保持与设计系统一致
  // const contentStyle: React.CSSProperties = {
  //   padding: 50,
  //   borderRadius: 4,
  // };

  // const content = <div style={contentStyle} />;

  /**
   * 组件渲染
   *
   * UI 架构：
   * - 固定定位的操作按钮，确保始终可访问
   * - 条件渲染的加载状态，提供即时反馈
   * - 响应式的表格布局，适配不同屏幕尺寸
   * - 模态框交互，遵循用户体验最佳实践
   */
  return (
    <div className="relative h-full flex flex-col bg-white">
      {/* 右上角按钮 - 固定定位确保可访问性 */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          type="primary"
          onClick={() => setModalOpen(true)}
          disabled={loading}
        >
          上传需求文档
        </Button>
      </div>

      {/* 主内容区域 - 条件渲染优化用户体验 */}
      <div className="flex-1 p-6 pt-16">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Spin size="large" tip="正在处理文档..." />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={() => setError(null)}>重试</Button>
            </div>
          </div>
        ) : features.length > 0 ? (
          <Table
            columns={columns}
            dataSource={dataSource}
            pagination={false}
            size="small"
            className="w-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">请先上传需求文档开始分析</p>
          </div>
        )}
      </div>

      {/* 文档上传模态框 - 用户友好的交互界面 */}
      <Modal
        title="上传需求文档"
        open={modalOpen}
        onOk={handleStart}
        onCancel={() => setModalOpen(false)}
        confirmLoading={loading}
        okText="开始分析"
        cancelText="取消"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              语雀文档链接
            </label>
            <TextArea
              value={docURL}
              onChange={(e) => setDocURL(e.target.value)}
              placeholder="请粘贴语雀文档链接..."
              rows={3}
              className="w-full"
            />
          </div>
          <div className="text-sm text-gray-500">
            <p>支持语雀文档链接，系统将自动解析文档内容并生成开发任务。</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AssistantPanel;
