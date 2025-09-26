/**
 * 任务依赖关系图构建工具
 *
 * 核心功能：
 * 1. 将任务数据转换为可视化的依赖关系图
 * 2. 构建任务间的依赖关系网络
 * 3. 计算图的拓扑结构和统计信息
 * 4. 检测循环依赖和异常情况
 *
 * 设计哲学：
 * - 数据驱动：基于任务数据的结构化图构建
 * - 类型安全：完整的 TypeScript 类型保护
 * - 性能优化：高效的图算法和数据结构
 * - 可扩展性：支持多种依赖类型和图分析
 */

/**
 * 任务依赖项接口定义
 */
interface TaskDependency {
  taskname: string;
  references?: string[];
}

/**
 * 任务依赖关系集合接口
 */
interface TaskDependencies {
  tasks?: TaskDependency[];
  specs?: unknown[];
  sources?: unknown[];
  external?: unknown[];
}

/**
 * 原始任务数据接口定义
 *
 * 数据结构说明：
 * - taskname: 任务唯一标识符
 * - meta: 任务元数据描述
 * - type: 任务类型分类
 * - dependencies: 任务依赖关系
 */
interface RawTaskData {
  taskname?: string;
  id?: string;
  meta?: string;
  type?: string;
  docStatus?: string;
  output?: string;
  role?: string;
  important?: boolean;
  input?: string;
  content?: string;
  parsedAt?: string;
  sourcePath?: string;
  dependencies?: TaskDependencies;
  references?: string[];
  targets?: unknown[];
}

/**
 * 其他依赖类型集合
 */
interface OtherDependencies {
  specs: unknown[];
  sources: unknown[];
  external: unknown[];
}

/**
 * 图节点接口定义
 *
 * 设计考量：
 * - 包含完整的任务信息
 * - 图计算相关属性（层级、度数）
 * - 依赖关系数据
 * - 原始数据保留
 */
interface GraphNode {
  id: string;
  taskname?: string;
  meta?: string;
  type?: string;
  docStatus?: string;
  output?: string;
  role?: string;
  important?: boolean;
  input?: string;
  content: string;
  parsedAt?: string;
  sourcePath?: string;

  // 依赖信息
  dependencies?: TaskDependencies;
  references: string[];
  targets: unknown[];

  // 图计算属性
  level: number; // 拓扑层级
  inDegree: number; // 入度（被依赖数）
  outDegree: number; // 出度（依赖数）

  // 其他依赖类型
  otherDependencies?: OtherDependencies;

  // 原始数据保留
  rawData: RawTaskData;
}

/**
 * 图边接口定义
 *
 * 表示任务间的依赖关系
 */
interface GraphEdge {
  id: string;
  from: string;
  to: string;
  source: string;
  target: string;
  type: string;
  references: string[];
  label: string;
}

/**
 * 邻接表节点接口
 */
interface AdjacencyNode {
  incoming: string[]; // 依赖的任务列表
  outgoing: string[]; // 被依赖的任务列表
}

/**
 * 邻接表接口定义
 */
interface AdjacencyList {
  [nodeId: string]: AdjacencyNode;
}

/**
 * 依赖类型统计接口
 */
interface DependencyTypeStats {
  tasks: number;
  specs: number;
  sources: number;
  external: number;
}

/**
 * 图统计信息接口
 *
 * 包含图的各种统计指标和分析结果
 */
interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  maxLevel: number;
  rootNodes: GraphNode[]; // 根节点（无依赖）
  leafNodes: GraphNode[]; // 叶节点（不被依赖）
  cycles: string[][]; // 循环依赖路径
  hasCycles: boolean;
  nodesByType: Record<string, number>;
  nodesByStatus: Record<string, number>;
  avgDependencies: number;
  dependencyTypes: DependencyTypeStats;
}

/**
 * 图数据存储接口
 */
interface GraphData {
  tasks: RawTaskData[];
  total: number;
  timestamp: string;
}

/**
 * 任务依赖图结构接口
 *
 * 完整的图数据结构，包含所有节点、边和分析结果
 */
interface TaskDependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  adjacencyList: AdjacencyList;
  stats: GraphStats;
  data: GraphData;
}

/**
 * 空图返回结构接口
 */
interface EmptyGraph {
  nodes: never[];
  edges: never[];
  adjacencyList: Record<string, never>;
  stats: null;
  data: {
    tasks: never[];
    total: 0;
  };
}

/**
 * 构建任务依赖关系图
 *
 * 核心算法流程：
 * 1. 数据验证和初始化
 * 2. 节点创建和属性设置
 * 3. 依赖关系边构建
 * 4. 拓扑排序和层级计算
 * 5. 循环依赖检测
 * 6. 统计信息计算
 *
 * 性能特性：
 * - 时间复杂度：O(V + E)，其中 V 是节点数，E 是边数
 * - 空间复杂度：O(V + E)
 * - 支持大规模任务图的高效处理
 *
 * @param tasksData - 原始任务数据数组
 * @returns 完整的任务依赖关系图对象
 */
export const buildTaskDependencyGraph = (
  tasksData: RawTaskData[],
): TaskDependencyGraph | EmptyGraph => {
  // 输入验证 - 防御性编程的体现
  if (!tasksData || !Array.isArray(tasksData)) {
    return {
      nodes: [],
      edges: [],
      adjacencyList: {},
      stats: null,
      data: { tasks: [], total: 0 },
    };
  }

  // 数据结构初始化
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const adjacencyList: AdjacencyList = {};
  const taskMap = new Map<string, GraphNode>();

  // 存储原始数据 - 数据溯源和调试支持
  const data: GraphData = {
    tasks: tasksData,
    total: tasksData.length,
    timestamp: new Date().toISOString(),
  };

  /**
   * 第一步：创建所有任务节点
   *
   * 节点创建策略：
   * - 优先使用 taskname 作为唯一标识
   * - 降级使用 id 或 meta 的安全子串
   * - 确保节点 ID 的唯一性和可读性
   */
  tasksData.forEach((task: RawTaskData) => {
    // 智能 ID 生成 - 确保唯一性和可读性
    const nodeId =
      task.taskname ||
      task.id ||
      task.meta?.substring(0, 20).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-') ||
      `task-${Math.random().toString(36).substr(2, 9)}`;

    const node: GraphNode = {
      id: nodeId,
      taskname: task.taskname,
      meta: task.meta,
      type: task.type,
      docStatus: task.docStatus,
      output: task.output,
      role: task.role,
      important: task.important,
      input: task.input,
      content: task.content || '',
      parsedAt: task.parsedAt,
      sourcePath: task.sourcePath,

      // 依赖信息初始化
      dependencies: task.dependencies,
      references: task.references || [],
      targets: task.targets || [],

      // 图计算属性初始化
      level: 0,
      inDegree: 0,
      outDegree: 0,

      // 保留完整原始数据
      rawData: task,
    };

    nodes.push(node);
    taskMap.set(nodeId, node);

    // 初始化邻接表
    adjacencyList[nodeId] = {
      incoming: [],
      outgoing: [],
    };
  });

  /**
   * 第二步：构建任务依赖关系边
   *
   * 依赖关系处理策略：
   * - 重点处理 dependencies.tasks 中的任务依赖
   * - 创建有向边表示依赖关系
   * - 更新节点的入度和出度统计
   * - 维护邻接表用于图遍历
   */
  tasksData.forEach((task: RawTaskData) => {
    const currentTaskId =
      task.taskname ||
      task.id ||
      task.meta?.substring(0, 20).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-') ||
      `task-${Math.random().toString(36).substr(2, 9)}`;
    const currentNode = taskMap.get(currentTaskId);

    if (!currentNode) return;

    // 处理任务依赖关系 - 核心业务逻辑
    if (task.dependencies?.tasks && Array.isArray(task.dependencies.tasks)) {
      task.dependencies.tasks.forEach((depTask: TaskDependency) => {
        const depTaskId = depTask.taskname;
        const depNode = taskMap.get(depTaskId);

        if (depNode) {
          // 创建依赖边：从依赖任务指向当前任务
          const edge: GraphEdge = {
            id: `${depTaskId}->${currentTaskId}`,
            from: depTaskId,
            to: currentTaskId,
            source: depTaskId,
            target: currentTaskId,
            type: 'task_dependency',
            references: depTask.references || [],
            label: 'tasks',
          };

          edges.push(edge);

          // 更新邻接表 - 双向关系维护
          adjacencyList[depTaskId].outgoing.push(currentTaskId);
          adjacencyList[currentTaskId].incoming.push(depTaskId);

          // 更新度数统计
          depNode.outDegree++;
          currentNode.inDegree++;
        }
      });
    }

    // 处理其他类型依赖 - 存储但不影响主图结构
    const otherDependencies: OtherDependencies = {
      specs: task.dependencies?.specs || [],
      sources: task.dependencies?.sources || [],
      external: task.dependencies?.external || [],
    };

    currentNode.otherDependencies = otherDependencies;
  });

  /**
   * 第三步：计算任务层级（拓扑排序）
   *
   * 算法说明：
   * - 使用 Kahn 算法进行拓扑排序
   * - 计算每个节点在依赖图中的层级
   * - 层级表示任务的执行顺序优先级
   *
   * 时间复杂度：O(V + E)
   */
  const calculateLevels = (): void => {
    const queue: string[] = [];
    const inDegreeMap: Record<string, number> = {};

    // 初始化入度映射和根节点队列
    nodes.forEach((node: GraphNode) => {
      inDegreeMap[node.id] = node.inDegree;
      if (node.inDegree === 0) {
        node.level = 0;
        queue.push(node.id);
      }
    });

    // 拓扑排序 - 层级计算
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentNode = taskMap.get(currentId);

      if (!currentNode) continue;

      // 处理所有后继节点
      adjacencyList[currentId].outgoing.forEach((targetId: string) => {
        const targetNode = taskMap.get(targetId);
        if (!targetNode) return;

        inDegreeMap[targetId]--;

        // 更新目标节点层级 - 取最大值确保正确性
        targetNode.level = Math.max(targetNode.level, currentNode.level + 1);

        if (inDegreeMap[targetId] === 0) {
          queue.push(targetId);
        }
      });
    }
  };

  calculateLevels();

  /**
   * 第四步：检测循环依赖
   *
   * 算法说明：
   * - 使用深度优先搜索（DFS）检测图中的环
   * - 维护递归栈检测回边
   * - 记录完整的循环路径用于调试
   *
   * 循环依赖的危害：
   * - 导致任务执行死锁
   * - 影响拓扑排序结果
   * - 需要人工干预解决
   */
  const detectCycles = (): string[][] => {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // 发现循环 - 记录完整路径
        const cycleStart = path.indexOf(nodeId);
        cycles.push(path.slice(cycleStart).concat(nodeId));
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      // 递归访问所有后继节点
      adjacencyList[nodeId].outgoing.forEach((targetId: string) => {
        dfs(targetId, [...path]);
      });

      recursionStack.delete(nodeId);
    };

    // 对所有未访问节点执行 DFS
    nodes.forEach((node: GraphNode) => {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    });

    return cycles;
  };

  const cycles = detectCycles();

  /**
   * 第五步：计算图的统计信息
   *
   * 统计指标说明：
   * - 基础指标：节点数、边数、最大层级
   * - 特殊节点：根节点、叶节点
   * - 质量指标：循环依赖、平均依赖数
   * - 分类统计：按类型、状态分组
   * - 依赖类型：各种依赖关系的数量统计
   */
  const stats: GraphStats = {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    maxLevel:
      nodes.length > 0 ? Math.max(...nodes.map((n: GraphNode) => n.level)) : 0,
    rootNodes: nodes.filter((n: GraphNode) => n.inDegree === 0),
    leafNodes: nodes.filter((n: GraphNode) => n.outDegree === 0),
    cycles: cycles,
    hasCycles: cycles.length > 0,

    // 按任务类型分组统计
    nodesByType: nodes.reduce(
      (acc: Record<string, number>, node: GraphNode) => {
        const type = node.type || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {},
    ),

    // 按文档状态分组统计
    nodesByStatus: nodes.reduce(
      (acc: Record<string, number>, node: GraphNode) => {
        const status = node.docStatus || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {},
    ),

    // 平均依赖数计算
    avgDependencies:
      nodes.length > 0
        ? nodes.reduce(
            (sum: number, node: GraphNode) => sum + node.inDegree,
            0,
          ) / nodes.length
        : 0,

    // 依赖类型统计
    dependencyTypes: {
      tasks: edges.length,
      specs: nodes.reduce(
        (sum: number, node: GraphNode) =>
          sum + (node.otherDependencies?.specs?.length || 0),
        0,
      ),
      sources: nodes.reduce(
        (sum: number, node: GraphNode) =>
          sum + (node.otherDependencies?.sources?.length || 0),
        0,
      ),
      external: nodes.reduce(
        (sum: number, node: GraphNode) =>
          sum + (node.otherDependencies?.external?.length || 0),
        0,
      ),
    },
  };

  return {
    nodes,
    edges,
    adjacencyList,
    stats,
    data,
  };
};

/**
 * 导出默认对象 - 向后兼容性支持
 */
export default {
  buildTaskDependencyGraph,
};
