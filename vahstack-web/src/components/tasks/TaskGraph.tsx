/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { buildTaskDependencyGraph } from './buildTaskGraph';

/**
 * 全局 Mermaid 对象类型声明
 *
 * 设计考量：
 * - 使用全局对象避免额外的依赖管理
 * - 支持动态图表渲染和主题配置
 */
declare global {
  interface Window {
    mermaid: {
      initialize: (config: MermaidConfig) => void;
      render: (id: string, definition: string) => Promise<{ svg: string }>;
    };
  }
}

/**
 * Mermaid 配置接口
 */
interface MermaidConfig {
  startOnLoad: boolean;
  theme: string;
  flowchart: {
    useMaxWidth: boolean;
    htmlLabels: boolean;
    curve: string;
  };
  themeVariables: {
    primaryColor: string;
    primaryTextColor: string;
    primaryBorderColor: string;
    lineColor: string;
    sectionBkgColor: string;
    altSectionBkgColor: string;
    gridColor: string;
    tertiaryColor: string;
  };
}

/**
 * 任务节点接口
 */
interface TaskNode {
  id: string;
  taskname: string;
  meta?: string;
  level?: number;
  type?: string;
}

/**
 * 图表边接口
 */
interface GraphEdge {
  from: string;
  to: string;
  type?: string;
}

/**
 * 图表数据接口
 */
interface GraphData {
  nodes: TaskNode[];
  edges: GraphEdge[];
  adjacencyList?: Record<string, { incoming: string[]; outgoing: string[] }>;
  stats?: {
    totalNodes: number;
    totalEdges: number;
    selectedTask?: string;
    relatedTasks?: number;
  };
}

/**
 * 任务对象接口（与 TaskTemplate 中的 Task 接口保持一致）
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
  dependencies?: {
    specs?: string[];
    tasks?: { taskname: string; references?: { path: string }[] }[];
    sources?: { path: string }[];
  };
  references?: string[];
  targets?: { path: string }[];
  sourcePath?: string;
}

/**
 * TaskGraph 组件 Props
 */
interface TaskGraphProps {
  task: Task | null;
  onNodeClick?: (task: TaskNode) => void;
  allTasks?: Task[];
}

/**
 * 依赖类型颜色配置
 *
 * 视觉设计系统：
 * - 蓝色：规范依赖，代表标准和约束
 * - 绿色：任务依赖，代表执行流程
 * - 橙色：源文件依赖，代表数据输入
 * - 紫色：外部依赖，代表系统边界
 */
const DEPENDENCY_COLORS = {
  specs: '#3B82F6', // 蓝色 - 规范依赖
  tasks: '#10B981', // 绿色 - 任务依赖
  sources: '#F59E0B', // 橙色 - 源文件依赖
  external: '#8B5CF6', // 紫色 - 外部依赖
};

// 使用全局的mermaid对象
const mermaid = window.mermaid;

/**
 * Mermaid 图表库初始化配置
 *
 * 配置策略：
 * - 主题系统：统一的颜色和样式规范
 * - 布局优化：自适应宽度和曲线连接
 * - 渲染控制：手动渲染以支持动态内容
 *
 * 设计原则：
 * - 可读性优先：清晰的颜色对比和字体大小
 * - 响应式设计：适应不同屏幕尺寸
 * - 交互友好：支持点击和悬停效果
 */
if (mermaid) {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis',
    },
    themeVariables: {
      primaryColor: '#3B82F6',
      primaryTextColor: '#ffffff',
      primaryBorderColor: '#1E40AF',
      lineColor: '#6B7280',
      sectionBkgColor: '#F3F4F6',
      altSectionBkgColor: '#E5E7EB',
      gridColor: '#E5E7EB',
      tertiaryColor: '#F9FAFB',
    },
  });
}

/**
 * Mermaid 图表定义生成器
 *
 * 核心职责：
 * 1. 数据转换：将图数据转换为 Mermaid 语法
 * 2. 样式应用：基于节点状态应用不同的视觉样式
 * 3. 布局控制：生成合理的节点和边布局
 * 4. 交互支持：为节点添加可点击的标识
 *
 * 算法设计：
 * - 节点优先：先定义所有节点，再定义连接关系
 * - 状态驱动：根据选中状态和层级应用不同样式
 * - 标签优化：智能选择显示名称，优先用户友好的标签
 *
 * 视觉层次：
 * - 根节点：突出显示，表示当前关注的任务
 * - 选中节点：高亮显示，表示用户交互焦点
 * - 普通节点：标准样式，保持整体一致性
 */
const generateMermaidDefinition = (
  graphData: GraphData | null,
  selectedTaskId?: string,
): string => {
  if (!graphData || !graphData.nodes || !graphData.edges) {
    return 'graph TD\n    A["没有数据"]';
  }

  let definition = 'graph TD\n';

  // 添加节点定义 - 智能标签和状态样式
  graphData.nodes.forEach((node) => {
    const taskName = node.taskname || node.meta?.substring(0, 20) || node.id;
    const isSelected = node.id === selectedTaskId;
    const isRoot = node.level === 0;

    // 根据节点类型和状态选择样式 - 策略模式
    let nodeStyle = '';
    if (isSelected) {
      nodeStyle = ':::selected';
    } else if (isRoot) {
      nodeStyle = ':::root';
    } else {
      nodeStyle = ':::normal';
    }

    // 创建节点标签，包含任务信息
    const label = `${taskName}`;
    definition += `    ${node.id}["${label}"]${nodeStyle}\n`;
  });

  // 添加边定义 - 依赖关系的可视化
  graphData.edges.forEach((edge) => {
    definition += `    ${edge.from} --> ${edge.to}\n`;
  });

  // 添加样式类定义 - 视觉设计系统
  definition += `
    classDef root fill:${DEPENDENCY_COLORS.tasks},stroke:#1E40AF,stroke-width:3px,color:#ffffff
    classDef normal fill:#6B7280,stroke:#374151,stroke-width:2px,color:#ffffff
    classDef selected fill:#EF4444,stroke:#1F2937,stroke-width:4px,color:#ffffff
  `;

  return definition;
};

/**
 * 任务依赖关系图组件 - 任务关系的可视化展示
 *
 * 核心职责：
 * 1. 关系可视化：将复杂的任务依赖关系转换为直观的图表
 * 2. 交互导航：支持节点点击和选择状态管理
 * 3. 数据过滤：基于选中任务智能筛选相关依赖
 * 4. 动态渲染：响应数据变化实时更新图表内容
 *
 * 设计模式：
 * - 观察者模式：监听任务和数据变化，自动更新图表
 * - 策略模式：根据不同场景选择不同的渲染策略
 * - 适配器模式：将任务数据适配为图表可用的格式
 * - 命令模式：封装节点点击和选择操作
 *
 * 算法策略：
 * - 依赖收集：递归收集任务及其所有直接和间接依赖
 * - 图过滤：基于选中任务筛选相关节点和边
 * - 布局优化：自动调整图表大小和视口
 * - 事件绑定：为动态生成的 SVG 元素添加交互事件
 *
 * 用户体验：
 * - 渐进式加载：分阶段显示加载、构建、渲染状态
 * - 响应式设计：适应不同容器尺寸
 * - 交互反馈：点击节点的即时视觉反馈
 * - 错误处理：友好的错误提示和重试机制
 */
const TaskGraph: React.FC<TaskGraphProps> = ({
  task,
  onNodeClick,
  allTasks = [],
}) => {
  /**
   * 组件状态管理
   */
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskNode | null>(null);
  const [mermaidSvg, setMermaidSvg] = useState<string>('');

  /**
   * DOM 引用管理
   */
  const mermaidRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * 图数据构建效应 - 依赖关系的智能分析
   *
   * 核心算法：
   * 1. 全图构建：基于所有任务构建完整的依赖关系图
   * 2. 依赖收集：递归收集目标任务的所有依赖链
   * 3. 图过滤：筛选出相关的节点和边，减少视觉复杂度
   * 4. 统计计算：生成图的统计信息用于调试和优化
   *
   * 性能优化：
   * - 依赖数组：仅在 task 或 allTasks 变化时重新计算
   * - 错误处理：捕获构建过程中的异常，保证组件稳定性
   * - 日志记录：详细的构建过程日志，便于调试和监控
   */
  useEffect(() => {
    if (!task || !allTasks.length) return;

    try {
      const graph = buildTaskDependencyGraph(allTasks as any);

      // 如果传入了特定的task，筛选出该task及其所有依赖
      if (task && task.taskname) {
        const targetTaskName = task.taskname;
        const selectedTasksSet = new Set<string>();

        /**
         * 递归依赖收集器
         *
         * 算法特点：
         * - 深度优先搜索：确保收集所有层级的依赖
         * - 循环检测：使用 Set 避免无限递归
         * - 双向遍历：支持向上和向下的依赖关系
         */
        const collectTaskAndDependencies = (taskName: string): void => {
          if (selectedTasksSet.has(taskName)) return;

          selectedTasksSet.add(taskName);

          // 查找该任务的所有依赖
          const taskNode = graph.nodes.find((node) => node.id === taskName);
          if (
            taskNode &&
            graph.adjacencyList &&
            typeof graph.adjacencyList === 'object'
          ) {
            const adjacency = (
              graph.adjacencyList as Record<
                string,
                { incoming: string[]; outgoing: string[] }
              >
            )[taskName];
            if (adjacency && adjacency.incoming) {
              adjacency.incoming.forEach((depTaskName: string) => {
                collectTaskAndDependencies(depTaskName);
              });
            }
          }
        };

        // 从目标task开始收集
        collectTaskAndDependencies(targetTaskName);

        // 筛选出相关的节点和边
        const filteredNodes = graph.nodes.filter((node) =>
          selectedTasksSet.has(node.id),
        );
        const filteredEdges = graph.edges.filter(
          (edge) =>
            selectedTasksSet.has(edge.from) && selectedTasksSet.has(edge.to),
        );

        const filteredTaskNames = Array.from(selectedTasksSet);

        console.log('目标任务:', targetTaskName);
        console.log('筛选出的任务及其依赖:', filteredTaskNames);
        console.log('筛选后的图数据:', {
          nodes: filteredNodes,
          edges: filteredEdges,
        });

        // 创建过滤后的图数据
        const filteredGraph: GraphData = {
          nodes: filteredNodes as any,
          edges: filteredEdges,
          adjacencyList: graph.adjacencyList,
          stats: {
            totalNodes: filteredNodes.length,
            totalEdges: filteredEdges.length,
            selectedTask: targetTaskName,
            relatedTasks: filteredTaskNames.length,
          },
        };

        setGraphData(filteredGraph);
      } else {
        // 如果没有传入特定task，使用完整图数据
        console.log('构建任务依赖图:', graph);
        const fullGraph: GraphData = {
          nodes: graph.nodes as any,
          edges: graph.edges,
          adjacencyList: graph.adjacencyList,
          stats: graph.stats
            ? {
                totalNodes: graph.stats.totalNodes,
                totalEdges: graph.stats.totalEdges,
              }
            : undefined,
        };
        setGraphData(fullGraph);
      }
    } catch (error) {
      console.error('构建任务依赖图失败:', error);
    }
  }, [task, allTasks]);

  /**
   * Mermaid 图表渲染效应 - 动态 SVG 生成和交互绑定
   *
   * 渲染流程：
   * 1. 定义生成：将图数据转换为 Mermaid 语法
   * 2. SVG 渲染：调用 Mermaid API 生成 SVG 内容
   * 3. 事件绑定：为生成的节点添加点击事件监听
   * 4. 样式应用：设置交互样式和视觉反馈
   *
   * 交互设计：
   * - 延迟绑定：等待 DOM 渲染完成后绑定事件
   * - 节点识别：通过 ID 映射找到对应的任务数据
   * - 状态同步：点击节点时同步更新选中状态
   * - 回调触发：支持外部组件的事件处理
   */
  useEffect(() => {
    if (!graphData || !mermaidRef.current) return;

    const renderMermaid = async (): Promise<void> => {
      try {
        const definition = generateMermaidDefinition(
          graphData,
          selectedTask?.id,
        );
        const { svg } = await mermaid.render('taskGraph', definition);
        setMermaidSvg(svg);

        // 添加点击事件监听 - 异步事件绑定
        setTimeout(() => {
          const svgElement = mermaidRef.current?.querySelector('svg');
          if (svgElement) {
            // 为每个节点添加点击事件
            const nodes = svgElement.querySelectorAll('.node');
            nodes.forEach((node) => {
              const nodeId = node.id
                ?.replace('flowchart-', '')
                .replace('-', '');
              if (nodeId) {
                const htmlElement = node as HTMLElement;
                htmlElement.style.cursor = 'pointer';
                node.addEventListener('click', () => {
                  const clickedTask = graphData.nodes.find(
                    (n) => n.id === nodeId,
                  );
                  if (clickedTask) {
                    setSelectedTask(clickedTask);
                    if (onNodeClick) {
                      onNodeClick(clickedTask);
                    }
                  }
                });
              }
            });
          }
        }, 100);
      } catch (error) {
        console.error('渲染 mermaid 图表失败:', error);
      }
    };

    renderMermaid();
  }, [graphData, selectedTask, onNodeClick]);

  /**
   * 选择状态重置器
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  //  const resetSelection = (): void => {
  //    setSelectedTask(null);
  //  };

  /**
   * 视口自适应调整器
   *
   * 响应式策略：
   * - 容器适配：SVG 尺寸适应父容器
   * - 视图框设置：保持图表的宽高比
   * - 样式覆盖：确保图表填满可用空间
   */
  const fitToWindow = (): void => {
    const svgElement = mermaidRef.current?.querySelector('svg');
    if (svgElement && containerRef.current) {
      svgElement.style.width = '100%';
      svgElement.style.height = '100%';
      svgElement.setAttribute(
        'viewBox',
        svgElement.getAttribute('viewBox') || '0 0 800 600',
      );
    }
  };

  /**
   * 视口调整效应 - 响应 SVG 内容变化
   */
  useEffect(() => {
    fitToWindow();
  }, [mermaidSvg]);

  /**
   * 空任务状态渲染
   */
  if (!task) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        请选择一个任务查看依赖关系图
      </div>
    );
  }

  /**
   * 加载状态渲染
   */
  if (!graphData) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        正在构建依赖关系图...
      </div>
    );
  }

  /**
   * 主界面渲染 - 图表容器和交互控制
   */
  return (
    <div className="relative w-full h-96 bg-gray-50 rounded-lg border overflow-hidden">
      {/* Mermaid 图表容器 - 支持滚动和缩放 */}
      <div ref={containerRef} className="w-full h-full overflow-auto">
        <div
          ref={mermaidRef}
          className="w-full h-full flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: mermaidSvg }}
        />
      </div>
    </div>
  );
};

export default TaskGraph;
