/**
 * Token 组件相关的常量、类型定义和工具函数
 *
 * 核心职责：
 * - 定义 Slate 编辑器中的特殊节点类型（Token、TaskCard、TaskText）
 * - 提供节点树解析和转换功能
 * - 实现任务模板构建逻辑
 * - 管理文件路径解析
 *
 * 设计模式：
 * - 函数式编程：纯函数处理数据转换
 * - 工厂模式：makeToken、createTaskCard 等工厂函数
 * - 递归遍历：深度优先搜索处理树形结构
 */

// ============ 类型定义 ============

/**
 * Slate 节点基础接口
 */
interface SlateNode {
  type?: string;
  text?: string;
  children?: SlateNode[];
  path?: string;
  id?: number;
  label?: string;
  content?: string | null;
  filePath?: string;
  ignoreCheck?: boolean;
  targets?: Target[];
  inline?: boolean;
  taskName?: string;
  relativePath?: string;
  deps?: {
    sources?: SourceDependency[];
    tasks?: TaskDependency[];
  };
}

/**
 * Token 节点接口
 */
interface TokenNode extends SlateNode {
  id: number;
  type: typeof TOKEN;
  label: string;
  content?: string | null;
  filePath?: string;
  ignoreCheck: boolean;
  targets: Target[];
  inline: boolean;
  children: [{ text: string }];
}

/**
 * 目标文件接口
 */
interface Target {
  path: string;
  content?: string;
  [key: string]: unknown;
}

/**
 * 任务依赖接口
 */
interface TaskDependency {
  taskname: string;
  [key: string]: unknown;
}

/**
 * 源文件依赖接口
 */
interface SourceDependency {
  path: string;
  content?: string;
  [key: string]: unknown;
}

/**
 * 任务依赖集合接口
 */
interface TaskDependencies {
  sources?: SourceDependency[];
  tasks?: TaskDependency[];
}

/**
 * 任务接口
 */
interface Task {
  id: string;
  taskname: string;
  meta?: string;
  relativePath?: string;
  dependencies: TaskDependencies;
  targets?: Target[];
  [key: string]: unknown;
}

/**
 * 任务文本节点接口
 */
interface TaskTextNode extends SlateNode {
  type: typeof TASK_TEXT;
  text: string;
}

/**
 * 任务卡片节点接口
 */
interface TaskCardNode extends SlateNode {
  type: typeof ELEMENT_TASK_CARD;
  id: number;
  label: string;
  taskName: string;
  targets?: Target[];
  relativePath?: string;
  deps: {
    sources?: SourceDependency[];
    tasks?: TaskDependency[];
  };
  children: [{ text: string }];
}

/**
 * makeToken 函数参数接口
 */
interface MakeTokenParams {
  label: string;
  filePath?: string;
  ignoreCheck?: boolean;
  targets?: Target[];
  content?: string | null;
}

// ============ 常量定义 ============

export const TOKEN = 'token';
export const ELEMENT_TASK_CARD = 'task-card';
export const TASK_TEXT = 'task-text';
export const BASE_DIR = 'ragdoll/develop';

// ============ 核心工具函数 ============

/**
 * 节点树内容摘要提取器
 *
 * 将 Slate 节点树转换成期望的字符串格式
 * 设计哲学：信息提取的优先级策略 - 特殊节点后的文本内容更重要
 *
 * @param nodes - editor.value / editor.children
 * @returns 提取的摘要字符串
 */
export const pickSummary = (nodes: SlateNode[]): string => {
  const specialTypes = new Set([TOKEN, ELEMENT_TASK_CARD, TASK_TEXT]);

  let prefix = '';
  let lastSpecialIndex = -1; // 最后出现的特殊节点在 flat 数组中的位置
  const flat: SlateNode[] = [];

  // 深度优先遍历，扁平化节点树
  const dfs = (arr: SlateNode[]): void => {
    for (const n of arr) {
      const idx = flat.length;
      flat.push(n);

      // 记录第一个 ignoreCheck token 作为前缀
      if (
        !prefix &&
        n.type === TOKEN &&
        n.ignoreCheck &&
        (n.filePath || n.label)
      ) {
        prefix = n.filePath || n.label || '';
      }

      // 记录最后一个特殊节点位置（用于确定文本提取起点）
      if (specialTypes.has(n.type as string)) lastSpecialIndex = idx;

      if (n.children) dfs(n.children);
    }
  };
  dfs(nodes);

  /* ---------- 收集最后一个特殊节点之后的文本 ---------- */
  const texts = flat
    .slice(lastSpecialIndex + 1) // 仅取特殊节点之后的内容
    .filter((n) => typeof n.text === 'string' && n.text.trim())
    .map((n) => (n.text || '').trim()) // 去前后空白
    .join(' ');

  return [prefix, texts].filter(Boolean).join(' ').trim();
};

/**
 * 节点目标文件提取器
 *
 * 从节点树中提取所有 Token 节点的目标文件信息
 * 设计哲学：递归遍历 + 路径解析的组合策略
 *
 * @param nodes - 节点数组
 * @returns 目标文件数组
 */
export const getNodeTargets = (nodes: SlateNode[]): Target[] => {
  return nodes.reduce((acc: Target[], node) => {
    // 检查当前节点是否符合条件（Token 类型且有目标文件）
    if (node.type === TOKEN && node.ignoreCheck && node.targets?.length) {
      const targets = node.targets.map((target: Target) => ({
        ...target,
        path: resolvePath(target.path),
      }));
      acc.push(...targets);
    }

    // 递归处理子节点
    if (node.children) {
      acc.push(...getNodeTargets(node.children));
    }

    return acc;
  }, []);
};

/**
 * Token 节点工厂函数
 *
 * 创建标准化的 Token 节点对象
 * 设计哲学：工厂模式确保对象结构一致性
 *
 * @param params - Token 创建参数
 * @returns Token 节点对象
 */
export const makeToken = ({
  label,
  filePath,
  ignoreCheck = false,
  targets = [],
  content = null,
}: MakeTokenParams): TokenNode => ({
  id: Date.now() + Math.random(), // 简单的唯一 ID 生成策略
  type: TOKEN,
  label,
  content,
  filePath,
  ignoreCheck,
  targets,
  inline: true,
  children: [{ text: '' }], // Slate 要求的子节点结构
});

/**
 * Token 存在性检查器
 *
 * 检查节点值中是否包含 Token 或 TaskCard 类型的节点
 * 设计哲学：防御性编程 - 多层级的空值检查
 *
 * @param value - 节点值数组
 * @returns 是否包含特殊节点
 */
export const hasToken = (
  value: SlateNode[] | string | undefined | null,
): boolean => {
  if (value === '' || value === undefined || value === null) return false;
  if (!Array.isArray(value)) return false;

  return value.some((node) =>
    node.children?.some((child) =>
      [TOKEN, ELEMENT_TASK_CARD].includes(child.type as string),
    ),
  );
};

/**
 * 路径节点查找器
 *
 * 在树形结构中通过路径查找特定节点
 * 设计哲学：迭代式深度优先搜索，避免递归栈溢出
 *
 * @param tree - 节点树
 * @param path - 目标路径
 * @returns 匹配的节点或 null
 */
export function findNodeByPathIter(
  tree: SlateNode[],
  path: string,
): SlateNode | null {
  const stack = [...tree];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.path === path) return node;
    if (node.children) stack.push(...node.children);
  }
  return null;
}

/**
 * 任务文本节点工厂函数
 *
 * 创建任务文本类型的节点
 *
 * @param task - 包含文本的任务对象
 * @returns 任务文本节点
 */
export const makeTaskText = (task: { text: string }): TaskTextNode => {
  return {
    type: TASK_TEXT,
    text: task.text,
  };
};

/**
 * 任务卡片节点工厂函数
 *
 * 创建任务卡片类型的节点
 * 设计哲学：结构化数据提取 + 默认值处理
 *
 * @param task - 任务对象
 * @returns 任务卡片节点
 */
export const createTaskCard = (task: Task): TaskCardNode => {
  const { id, taskname, dependencies, targets, relativePath } = task || {};
  return {
    type: ELEMENT_TASK_CARD,
    id: Date.now() + Math.random(),
    label: id,
    taskName: taskname,
    targets,
    relativePath,
    deps: {
      sources: dependencies?.sources,
      tasks: dependencies?.tasks,
    },
    children: [{ text: '' }],
  };
};

/**
 * 任务模板构建器
 *
 * 根据主任务和所有任务构建完整的编辑器模板
 * 设计哲学：
 * - 依赖关系的递归解析
 * - 重复依赖的去重策略
 * - 循环依赖的防护机制
 *
 * @param task - 主任务
 * @param allTasks - 所有可用任务
 * @returns 模板节点数组
 */
export function buildTaskTemplate(task: Task, allTasks: Task[]): SlateNode[] {
  // 主任务开始添加task.meta的token和基于的text
  const template: SlateNode[] = [
    makeToken({
      label: task.meta || task.taskname,
      filePath: task.relativePath,
      ignoreCheck: true,
      targets: task.targets || [],
    }),
    makeTaskText({ text: ': ' }),
    makeTaskText({ text: '\n基于 \n' }),
  ];

  // 用于跟踪已添加的源文件依赖，避免重复添加
  const addedSources = new Set<string>();
  // 用于跟踪已处理的任务，避免循环依赖和重复添加
  const processedTasks = new Set<string>();
  // 用于跟踪已添加到taskCard的任务依赖
  const addedTaskDependencies = new Set<string>();

  // 处理主任务的sources依赖，按顺序添加为token模版
  if (
    Array.isArray(task.dependencies?.sources) &&
    task.dependencies.sources.length > 0
  ) {
    task.dependencies.sources.forEach(({ path, content }) => {
      if (!addedSources.has(path)) {
        template.push(
          makeToken({
            label: `源文件依赖：${path}`,
            filePath: path,
            content,
          }),
        );
        addedSources.add(path);
      }
    });
  }

  /**
   * 依赖收集器（递归函数）
   *
   * 递归收集任务的所有依赖关系
   * 设计哲学：深度优先遍历 + 环路检测
   *
   * @param t - 当前处理的任务
   */
  function collectDependencies(t: Task): void {
    // 如果任务已处理过，直接返回（防止循环依赖）
    if (processedTasks.has(t.taskname)) {
      return;
    }

    processedTasks.add(t.taskname);

    // 1. 先创建当前任务的卡片模板
    const taskCard = createTaskCard(t);

    // 2. 收集当前任务的sources依赖并添加到taskCard的deps下
    if (Array.isArray(t.dependencies?.sources)) {
      t.dependencies.sources.forEach(({ path }) => {
        if (!addedSources.has(path)) {
          addedSources.add(path);
        }
      });
    }

    // 3. 处理当前任务的tasks依赖，只添加未添加过的依赖
    if (Array.isArray(t.dependencies?.tasks)) {
      // 过滤出未添加过的任务依赖
      const newTaskDependencies = t.dependencies.tasks.filter(
        (ref) => !addedTaskDependencies.has(ref.taskname),
      );

      // 更新taskCard的deps.tasks为仅包含新的依赖
      taskCard.deps = {
        // 保留已处理过的sources
        sources: taskCard.deps.sources,
        // 更新tasks为新的依赖
        tasks: newTaskDependencies,
      };

      // 记录新添加的任务依赖
      newTaskDependencies.forEach((ref) => {
        addedTaskDependencies.add(ref.taskname);
      });
    }

    // 判断是否有sources或tasks依赖，只有有依赖时才添加卡片
    const hasSourcesDependencies =
      Array.isArray(taskCard.deps?.sources) && taskCard.deps.sources.length > 0;
    const hasTasksDependencies =
      Array.isArray(taskCard.deps?.tasks) && taskCard.deps.tasks.length > 0;

    if (hasSourcesDependencies || hasTasksDependencies) {
      // 将当前任务卡片添加到模板中
      template.push(taskCard);
    }

    // 4. 继续处理当前任务的tasks依赖（包括已添加和未添加的，以确保依赖链完整性）
    if (Array.isArray(t.dependencies?.tasks)) {
      t.dependencies.tasks.forEach((ref) => {
        const name = ref.taskname;
        // 在allTasks中查找依赖任务
        const targetTask = allTasks.find((x) => x.taskname === name);

        if (targetTask) {
          // 递归处理依赖任务
          collectDependencies(targetTask);
        }
      });
    }
  }

  // 从主任务的tasks依赖开始收集
  if (Array.isArray(task.dependencies?.tasks)) {
    task.dependencies.tasks.forEach((ref) => {
      const name = ref.taskname;
      // 在allTasks中查找依赖任务
      const targetTask = allTasks.find((x) => x.taskname === name);

      if (targetTask) {
        // 处理依赖任务
        collectDependencies(targetTask);
      }
    });
  }

  // 最后才处理主任务本身，避免循环依赖
  processedTasks.add(task.taskname);

  // 在最后添加完成任务的文本节点
  template.push({ text: '\n完成任务' });

  return template;
}

/**
 * 路径解析器
 *
 * 解析相对路径为绝对路径
 * 注意：当前实现直接返回相对路径，保留了原有的 URL 解析逻辑作为注释
 *
 * @param relativePath - 相对路径
 * @returns 解析后的路径
 */
export function resolvePath(relativePath: string): string {
  return relativePath;
  // const url = new URL(
  //   relativePath,
  //   "http://x/" + baseDir.replace(/^\//, "") + "/"
  // );
  // // 去掉虚拟域名，只保留 pathname
  // return url.pathname.replace(/^\/+/, "");
}
