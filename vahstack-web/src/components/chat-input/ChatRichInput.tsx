/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react';
import { Slate, Editable, withReact, ReactEditor } from 'slate-react';
import { createEditor, Transforms, Node, Editor, type BaseEditor } from 'slate';
import { withHistory } from 'slate-history';
import { Tooltip, Popover } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import {
  hasToken,
  TOKEN,
  ELEMENT_TASK_CARD,
  pickSummary,
  resolvePath,
  getNodeTargets,
} from './token';
import { useEventManager, EVENT_TYPES } from '../../hooks/useCustomEvent';
import FileList from './FileList';
import { useMention } from './useMention';
import TaskList from '../tasks/TaskList';

/**
 * Slate.js 类型扩展声明
 *
 * 设计目的：扩展 Slate 的基础类型系统以支持自定义属性
 * - 确保编辑器实例具备正确的类型推断
 * - 支持自定义元素和文本节点的类型安全操作
 */
declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

/**
 * 自定义文本节点类型
 *
 * 设计原则：最小化接口，专注文本样式
 * - text: 文本内容（必需）
 * - bold/italic: 可选的文本样式属性
 */
interface CustomText {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

/**
 * 段落元素类型
 *
 * 设计意图：作为其他元素的容器
 * - 支持混合内容：文本、Token、任务卡片
 */
interface ParagraphElement {
  type: 'paragraph';
  children: (CustomText | TokenElement | TaskCardElement)[];
}

/**
 * 自定义元素联合类型
 *
 * 类型系统设计：
 * - 涵盖编辑器中所有可能的元素类型
 * - 为类型安全的元素操作提供基础
 */
type CustomElement = ParagraphElement | TokenElement | TaskCardElement;
import type { DOMEditor } from 'slate-dom';

// TypeScript 接口定义 - 替代 PropTypes
interface ElementProps {
  attributes: any;
  children: React.ReactNode;
  element: any;
  onSend?: (message: string, targets?: any[], value?: any) => void;
  usedValue?: any[];
}

interface TokenElement {
  type: string;
  label: string;
  content?: string;
  filePath?: string;
  ignoreCheck?: boolean;
}

interface TaskCardElement {
  type: string;
  label: string;
  taskName?: string;
  relativePath?: string;
  deps?: {
    tasks?: Array<{
      taskname: string;
      references: Array<{ path: string; content?: string }>;
    }>;
    sources?: Array<{ path: string; content?: string }>;
  };
  targets?: Array<{ path: string; content?: string }>;
}

interface ChatRichInputProps {
  onSend: (message: string, targets?: any[], value?: any) => void;
  isLoading?: boolean;
  onChange?: (value: any, text: string) => void;
  onKeyPress?: (e: React.KeyboardEvent) => void;
  initialValue?: any;
  onlyCheckEmpty?: boolean;
  onCancel?: () => void;
  selectTask?: any;
  placeholder?: string;
}

interface Command {
  name: string;
  description: string;
}

/* -------------- Token 组件 - 文件路径标记渲染器 -------------- */
// 职责：渲染可点击的文件路径标记，体现"约定优于配置"原则
function Token({ attributes, children, element }: ElementProps) {
  const { label, content, filePath, ignoreCheck } = element as TokenElement;
  const { emit: emitOpenFile } = useEventManager(EVENT_TYPES.OPEN_FILE);

  // 防御性编程：确保文件路径存在才执行打开操作
  const handleClick = () => {
    if (filePath) {
      emitOpenFile({ filePath: resolvePath(filePath) });
    }
  };

  // 视觉反馈设计：通过颜色编码传达文件状态（绿色=已加载，红色=缺失）
  return (
    <span
      {...attributes}
      contentEditable={false}
      onClick={handleClick}
      className={`inline-flex items-center px-1 mx-1 rounded border cursor-pointer text-xs
${content || ignoreCheck ? 'bg-green-100 border-green-400' : 'bg-red-100 border-red-400'}`}
    >
      {label}
      {children}
    </span>
  );
}

/* -------------- 任务卡片组件 - 复杂任务状态管理 -------------- */
// 职责：管理任务依赖关系和执行状态，体现"单一职责原则"
function TaskCardView({
  attributes,
  element,
  children,
  onSend,
  usedValue,
}: ElementProps) {
  const { emit: emitOpenFile } = useEventManager(EVENT_TYPES.OPEN_FILE);

  // 统一的依赖项点击处理 - 体现"DRY原则"
  const handleClick = (dep: any, type: string) => {
    if (!dep) return;

    // 根据依赖类型提取路径 - 策略模式的简化应用
    const paths =
      type === 'task'
        ? dep.references?.map((ref: any) => ref.path)?.filter(Boolean)
        : [dep.path].filter(Boolean);

    // 批量打开相关文件
    paths.forEach((path: string) => {
      emitOpenFile({ filePath: resolvePath(path) });
    });
  };

  // 任务就绪状态检查 - 防御性编程确保数据完整性
  const showRunTask = (): boolean => {
    const { deps } = (element as TaskCardElement) || {};

    // 检查任务依赖完成状态
    const tasksDone =
      deps?.tasks?.length === 0 ||
      deps?.tasks?.every((task: any) =>
        task.references.every((ref: any) => ref.content),
      );

    // 检查源文件依赖完成状态
    const sourcesDone =
      deps?.sources?.length === 0 ||
      deps?.sources?.every((source: any) => source.content);

    return tasksDone && sourcesDone ? true : false;
  };

  // 任务完成状态 - 所有目标文件都已生成
  const taskDone =
    (element as TaskCardElement).targets?.every(
      (target: any) => target.content,
    ) || false;

  // 任务执行处理 - 错误边界保护
  const handleRunTask = () => {
    console.log('执行任务:', usedValue);
    try {
      const taskElement = element as TaskCardElement;
      const targets = taskElement.targets?.map((target: any) => ({
        ...target,
        path: resolvePath(target.path),
      }));

      if (taskElement.relativePath && onSend) {
        onSend(taskElement.relativePath, targets, usedValue);
      }
    } catch (error) {
      console.error('任务执行失败:', error);
    }
  };

  const taskElement = element as TaskCardElement;

  return (
    <div
      {...attributes}
      contentEditable={false}
      className={`inline-block flex-1 p-2 rounded-lg border-2 transition-all duration-200 relative mr-2 mb-1 min-w-[200px]
${taskDone ? 'border-green-400' : 'border-red-400'}`}
    >
      <div className="w-full">
        {/* 任务标题和执行按钮 */}
        <div className="mb-2">
          <div className="flex-1 min-w-0 flex items-center">
            <span className="font-semibold text-gray-800 text-sm leading-tight">
              {taskElement.label}
            </span>
            {/* 条件渲染执行按钮 - 只有依赖满足时才显示 */}
            {showRunTask() && (
              <span
                onClick={() => handleRunTask()}
                className="text-xs px-2 py-1 bg-white rounded border text-gray-600 flex-shrink-0 ml-4 cursor-pointer hover:bg-gray-50"
              >
                执行任务
              </span>
            )}
          </div>
          {taskElement.taskName && (
            <p className="text-xs text-gray-500 mt-1">{taskElement.taskName}</p>
          )}
        </div>

        {/* 依赖关系可视化 - 通过颜色编码显示状态 */}
        <div className="text-xs text-gray-600 mb-1">
          {taskElement.deps?.tasks?.map((task: any, index: number) => (
            <span
              key={index}
              onClick={() => handleClick(task, 'task')}
              className={`inline-flex items-center px-1 mx-1 rounded border cursor-pointer text-xs mb-1 break-all whitespace-normal ${
                task.references[0]?.content
                  ? 'bg-green-100 border-green-400'
                  : 'bg-red-100 border-red-400'
              }`}
            >
              任务依赖: {task.taskname}
            </span>
          ))}
          {taskElement.deps?.sources?.map((source: any, index: number) => (
            <span
              key={index}
              onClick={() => handleClick(source, 'source')}
              className={`inline-flex items-center px-1 mx-1 rounded border cursor-pointer text-xs mb-1 break-all whitespace-normal ${
                source.content
                  ? 'bg-green-100 border-green-400'
                  : 'bg-red-100 border-red-400'
              }`}
            >
              源文件依赖: {source.path}
            </span>
          ))}
        </div>

        {/* 目标文件显示 - 只显示已生成的文件 */}
        {taskElement.targets && taskElement.targets.length > 0 && (
          <div className="text-xs text-gray-600 mb-1">
            {taskElement.targets?.map(
              (target: any, index: number) =>
                target.content && (
                  <span
                    key={index}
                    onClick={() => handleClick(target, 'target')}
                    className={`inline-flex items-center px-1 mx-1 rounded border cursor-pointer text-xs mb-1 break-all whitespace-normal ${
                      target.content
                        ? 'bg-green-100 border-green-400'
                        : 'bg-red-100 border-red-400'
                    }`}
                  >
                    生成文件: {target.path}
                  </span>
                ),
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/* -------------- 元素渲染器 - 统一的组件分发逻辑 -------------- */
// 职责：根据元素类型分发到对应的渲染组件，体现"开闭原则"
const Element = (props: ElementProps) => {
  // 类型安全的组件选择 - 避免运行时错误
  if (props.element.type === TOKEN) {
    return <Token {...props} />;
  } else if (props.element.type === ELEMENT_TASK_CARD) {
    return <TaskCardView {...props} />;
  }

  // 默认段落渲染 - 保证向后兼容性
  return (
    <div {...props.attributes} className="">
      {props.children}
    </div>
  );
};

// 编辑器内容设置工具函数 - 原子操作确保数据一致性
function setEditorContent(editor: Editor, newNodes?: any) {
  Editor.withoutNormalizing(editor, () => {
    // 清空整个文档 - 防止内容冲突
    const whole = {
      anchor: Editor.start(editor, []),
      focus: Editor.end(editor, []),
    };
    Transforms.delete(editor, { at: whole });

    // 插入新内容或默认空段落 - 确保编辑器始终有有效内容
    const nodes = newNodes || [{ type: 'paragraph', children: [{ text: '' }] }];
    Transforms.insertNodes(editor, nodes, { at: [0] });

    // 设置光标位置并聚焦 - 提升用户体验
    Transforms.select(editor, Editor.end(editor, [0]));
    ReactEditor.focus(editor as DOMEditor);
  });
}

/* -------------- 主组件 - 富文本聊天输入框 -------------- */
// 设计哲学：组合优于继承，通过多个小组件组合实现复杂功能
export default function ChatRichInput({
  onSend,
  isLoading = false,
  onChange,
  onKeyPress,
  initialValue,
  onlyCheckEmpty = false,
  onCancel,
  placeholder = '输入您的消息...（输入@可选择文件、/可选择指令）',
}: ChatRichInputProps) {
  // 默认编辑器状态 - 确保始终有有效的初始状态
  const defaultValue = [{ type: 'paragraph', children: [{ text: '' }] }];

  // 状态管理 - 单一数据源原则
  const [usedValue, setUsedValue] = useState(initialValue || defaultValue);
  const [isComposing, setIsComposing] = useState(false); // 输入法组合状态
  const [targets, setTargets] = useState<any[]>([]); // 目标文件列表
  const [commandIndex, setCommandIndex] = useState(0); // 指令选择索引
  const [showCommandList, setShowCommandList] = useState(false); // 指令列表显示状态

  // 指令配置 - 可扩展的命令系统
  const commands: Command[] = [{ name: 'clear', description: '清除聊天记录' }];

  // 编辑器初始化 - 自定义行为扩展
  const editor = useMemo(() => {
    const e = withHistory(withReact(createEditor()));
    const { isInline, isVoid } = e;

    // 扩展编辑器行为 - 定义内联和空元素类型
    e.isInline = (el: any) =>
      el.type === TOKEN || el.type === ELEMENT_TASK_CARD ? true : isInline(el);
    e.isVoid = (el: any) => (el.type === ELEMENT_TASK_CARD ? true : isVoid(el));

    return e;
  }, []);

  // 文件提及功能 - 智能文件选择
  const mention = useMention(editor);

  // 输入法状态管理 - 避免中文输入冲突
  const handleCompositionStart = () => setIsComposing(true);
  const handleCompositionEnd = () => setIsComposing(false);

  // 文件插入事件监听 - 外部文件拖拽支持
  useEventManager(EVENT_TYPES.INSERT_FILE_TO_INPUT, (detail: any) => {
    const { filePath, payload, targets } = detail || {};

    if (targets) setTargets(targets);

    if (filePath) {
      setEditorContent(editor, {
        type: 'paragraph',
        children: [{ text: filePath }],
      });
    } else if (payload) {
      // 代码选择插入 - 保留上下文信息
      const { comment, selectWord, selection } = payload;
      const { startColumn, startLineNumber, endColumn, endLineNumber } =
        selection || {};
      const text = `${startLineNumber}:${startColumn}-${endLineNumber}:${endColumn} ${selectWord} ${comment}`;
      setEditorContent(editor, {
        type: 'paragraph',
        children: [{ text }],
      });
    }
  });

  // 模板插入事件监听 - 任务模板快速应用
  useEventManager(EVENT_TYPES.INSERT_TEMPLATE, (detail: any) => {
    const { taskname, template } = detail || {};

    if (template) {
      // 为模板节点添加任务名称 - 保持数据关联性
      const nodes = template.map((node: any) => {
        if (node.type === TOKEN || node.type === ELEMENT_TASK_CARD) {
          return { ...node, taskname };
        }
        return node;
      });

      if (nodes) {
        setEditorContent(editor, {
          type: 'paragraph',
          children: nodes,
        });
      }
    }
  });

  // Token 内容更新事件监听 - 实时同步文件状态
  useEventManager(EVENT_TYPES.UPDATE_TOKEN_CONTENT, (detail: any) => {
    const { filePath, content, markers } = detail as {
      filePath: string;
      content: string;
      markers?: any[];
    };
    if (!filePath) return;

    // 根据标记决定内容状态 - 错误标记时内容为空
    const needContent = (markers?.length ?? 0) === 0 ? content : null;
    const isSamePath = (p: string) => p && resolvePath(p) === filePath;

    Editor.withoutNormalizing(editor, () => {
      // 批量更新任务卡片中的依赖状态
      const taskCardEntries = Array.from(
        Editor.nodes(editor, {
          at: [],
          match: (n: any) => n.type === ELEMENT_TASK_CARD,
        }),
      );

      taskCardEntries.forEach(([node, path]: [any, any]) => {
        if (!node.deps) return;

        let changed = false;

        // 更新源文件依赖状态
        const newSources = (node.deps.sources ?? []).map((s: any) => {
          if (isSamePath(s.path)) {
            changed = true;
            return { ...s, content: needContent };
          }
          return s;
        });

        // 更新任务依赖状态
        const newTasks = (node.deps.tasks ?? []).map((t: any) => ({
          ...t,
          references: t.references.map((r: any) => {
            if (isSamePath(r.path)) {
              changed = true;
              return { ...r, content: needContent };
            }
            return r;
          }),
        }));

        // 更新目标文件状态
        const newTargets = (node.targets ?? []).map((t: any) => {
          if (isSamePath(t.path)) {
            changed = true;
            return { ...t, content: needContent };
          }
          return t;
        });

        // 只有发生变化时才更新节点 - 性能优化
        if (changed) {
          Transforms.setNodes(
            editor,
            {
              deps: { ...node.deps, sources: newSources, tasks: newTasks },
              targets: newTargets,
            },
            { at: path },
          );
        }
      });

      // 更新独立的 token 节点
      Transforms.setNodes(
        editor,
        { content: (markers || [])?.length === 0 ? content : undefined },
        {
          at: [],
          match: (n: any) => !!(n.type === TOKEN && isSamePath(n.filePath)),
        },
      );
    });
  });

  // 表单验证逻辑 - 确保所有必需信息完整
  const allFilled = useMemo(() => {
    if (!Node.string(editor).trim()) return false;

    // 简单模式只检查非空
    if (onlyCheckEmpty) {
      return true;
    }

    // 验证所有 token 节点的内容完整性
    for (const [n] of Editor.nodes(editor, {
      at: [],
      match: (node: any) => node.type === TOKEN && !node.ignoreCheck,
    })) {
      if (!(n as any).content) return false;
    }

    // 验证所有任务卡片的依赖完整性
    for (const [n] of Editor.nodes(editor, {
      at: [],
      match: (node: any) => node.type === ELEMENT_TASK_CARD,
    })) {
      const node = n as any;
      const deps = node.deps ?? {};

      // 检查源文件依赖
      const allSrcOk = (deps.sources ?? []).every((s: any) => !!s.content);
      // 检查任务依赖
      const allTaskOk = (deps.tasks ?? []).every((t: any) =>
        t.references.every((r: any) => !!r.content),
      );
      // 检查目标文件
      const allTargetOk = (node.targets ?? []).every((t: any) => !!t.content);

      if (!allSrcOk || !allTaskOk || !allTargetOk) return false;
    }

    return true;
  }, [editor, onlyCheckEmpty]);

  // 提交状态计算 - 综合考虑各种条件
  const needOperation = !allFilled && hasToken(usedValue);
  const canSubmit =
    !needOperation && !isLoading && pickSummary(usedValue || editor.children);

  // 键盘事件处理 - 复杂的交互逻辑统一管理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 输入法组合期间跳过处理 - 避免中文输入问题
    if (isComposing || (e.nativeEvent as any).isComposing) return;

    // 指令列表导航处理
    if (showCommandList) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCommandIndex((commandIndex + 1) % commands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCommandIndex((commandIndex - 1 + commands.length) % commands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedCommand = commands[commandIndex];
        handleCommandSelect(selectedCommand);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommandList(false);
      }
      return;
    }

    // 指令触发检测 - 智能显示指令列表
    if (e.key === '/' && !mention.target) {
      setTimeout(() => {
        const currentText = Node.string(editor);
        if (currentText.includes('/')) {
          setShowCommandList(true);
          setCommandIndex(0);
        }
      }, 0);
    }

    // 文件提及功能导航
    if (mention.target) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        mention.setIndex((mention.index + 1) % mention.files.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        mention.setIndex(
          (mention.index - 1 + mention.files.length) % mention.files.length,
        );
      } else if (e.key === 'Enter' && mention.files.length > 0) {
        e.preventDefault();
        mention.onSelect(mention.files[mention.index]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        mention.onSelect({
          type: 'file',
        });
      }
      return;
    }

    // 回车提交处理 - 区分换行和提交
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      if (canSubmit) {
        handleSend();
        // 透传键盘事件给父组件
        if (onKeyPress) {
          onKeyPress(e);
        }
      } else {
        console.log('不能提交');
      }
      return;
    }
  };

  // 内容变化处理 - 状态同步和事件透传
  const handleChange = (value: any) => {
    console.log('handleChange', value);
    setUsedValue(value);

    // 透传变化事件给父组件
    if (onChange) {
      onChange(value, Node.string(editor));
    }

    // 指令列表显示状态管理
    if (showCommandList) {
      const text = pickSummary(value || editor.children) || '';
      if (!text.includes('/')) {
        setShowCommandList(false);
      }
    }
  };

  // 指令选择处理 - 插入选中的指令
  const handleCommandSelect = (command: Command) => {
    const commandText = command.name;
    Transforms.insertText(editor, commandText);
    setShowCommandList(false);
  };

  // 消息发送处理 - 数据收集和清理
  const handleSend = () => {
    const customString = pickSummary(usedValue || editor.children);
    console.log('handleSend', usedValue);
    console.log('customString', customString);

    // 优先使用节点中的目标，回退到状态中的目标
    const tryTargets = getNodeTargets(usedValue || editor.children);
    const finalTargets =
      Array.isArray(tryTargets) && tryTargets.length > 0 ? tryTargets : targets;

    onSend(customString, finalTargets, usedValue);
    setEditorContent(editor); // 清空编辑器
  };

  // 按钮点击处理 - 发送或取消操作
  const handleClick = () => {
    if (isLoading && onCancel) {
      onCancel();
    } else {
      handleSend();
    }
  };

  // 任务继续处理 - 从历史任务恢复
  const handleContinueTask = (_task: any, template: any) => {
    const nextValue = template?.length ? template : defaultValue;
    setEditorContent(editor, nextValue);
  };

  return (
    <div className="relative">
      {/* 文件选择下拉列表 - 智能文件提及功能 */}
      <FileList
        files={mention.files as any}
        target={mention.target}
        activeIndex={mention.index}
        onHover={mention.setIndex}
        onSelect={(file: any) => mention.onSelect(file)}
      />

      {/* 指令列表 - 快捷命令选择 */}
      {showCommandList && (
        <div className="bottom-full mb-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto z-50 fade-in">
          {commands.map((command, index) => (
            <div
              key={command.name}
              className={`px-4 py-2 text-sm cursor-pointer ${
                index === commandIndex
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => handleCommandSelect(command)}
              onMouseEnter={() => setCommandIndex(index)}
            >
              <div className="font-medium">/{command.name}</div>
              <div className="text-xs text-gray-500">{command.description}</div>
            </div>
          ))}
        </div>
      )}

      <div className="p-6 bg-white border-t border-gray-200 shadow-lg relative">
        {/* 任务历史功能 - 快速访问历史任务 */}
        {!onlyCheckEmpty && (
          <Popover
            content={
              <div className="w-80 h-96 overflow-y-auto">
                <TaskList onContinueTask={handleContinueTask} />
              </div>
            }
            title="任务历史列表"
            trigger="hover"
          >
            <button
              className="absolute right-8 top-5 flex items-center gap-1 text-gray-500 hover:text-blue-500 text-sm"
              type="button"
            >
              <HistoryOutlined />
              任务列表
            </button>
          </Popover>
        )}

        <div className="flex gap-4 items-end">
          <div className="flex-1 relative">
            {/* 富文本编辑区域 - 核心编辑功能 */}
            <div className="border rounded p-3 min-h-[150px] max-h-[1000px] overflow-y-auto">
              <Slate
                editor={editor}
                initialValue={usedValue}
                onChange={handleChange}
              >
                <Editable
                  renderElement={(props) => (
                    <Element {...props} onSend={onSend} usedValue={usedValue} />
                  )}
                  placeholder={placeholder}
                  onKeyDown={handleKeyDown}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                />
              </Slate>
            </div>

            {/* 字符计数显示 - 用户反馈 */}
            <div className="absolute bottom-2 right-3 text-xs text-gray-400">
              {pickSummary(usedValue || editor.children)?.length || 0}/2000
            </div>
          </div>

          {/* 提交按钮 - 带状态反馈的操作按钮 */}
          <Tooltip
            title={
              needOperation
                ? '缺少必要的参数信息，Agent 将无法执行任务，请补充后再试'
                : ''
            }
          >
            <span className="inline-block">
              <button
                className="btn btn-primary px-6 py-3 text-base font-medium min-h-[48px] transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                onClick={handleClick}
                disabled={!canSubmit && !isLoading && !onlyCheckEmpty}
              >
                {isLoading ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    停止对话
                  </>
                ) : (
                  '发送消息'
                )}
              </button>
            </span>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
