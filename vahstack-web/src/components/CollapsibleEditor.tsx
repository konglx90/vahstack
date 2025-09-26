import React, { useState, useRef, useMemo } from 'react';
import { Editor, DiffEditor } from '@monaco-editor/react';
import { Drawer } from 'antd';
import { createCommentsWidget } from './widget';
import { dispatchCustomEvent, EVENT_TYPES } from '../hooks/useCustomEvent';

/**
 * 文件扩展名到语言的映射类型
 */
type FileExtension =
  | 'js'
  | 'jsx'
  | 'ts'
  | 'tsx'
  | 'json'
  | 'css'
  | 'html'
  | 'md';

/**
 * Monaco Editor 语言类型
 */
type MonacoLanguage =
  | 'javascript'
  | 'typescript'
  | 'json'
  | 'css'
  | 'html'
  | 'markdown'
  | 'plaintext';

/**
 * 工具名称类型定义
 *
 * 设计原则：类型安全的工具识别
 * - 'write' 模式需要特殊的行高亮处理
 * - 其他模式使用标准的只读编辑器
 */
type ToolName = 'write' | string;

/**
 * Monaco Editor 选择范围接口
 */
interface EditorSelection {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/**
 * 组件 Props 类型定义
 *
 * 设计哲学：灵活的编辑器配置
 * - fileName: 文件名，用于语言检测和图标显示
 * - content: 单文件内容，用于标准编辑器模式
 * - toolName: 工具类型，影响编辑器行为和样式
 * - original/modified: 差异对比模式的源文件和目标文件
 */
interface CollapsibleEditorProps {
  fileName?: string;
  content?: string;
  toolName?: ToolName;
  original?: string;
  modified?: string;
}

/**
 * 箭头图标组件 Props
 */
interface ArrowProps {
  open: boolean;
}

/**
 * 可折叠箭头图标组件
 *
 * 视觉设计：
 * - 使用 CSS 变换实现平滑的旋转动画
 * - 90度旋转表示展开状态，0度表示折叠状态
 * - 300ms 过渡动画提供流畅的用户体验
 */
const Arrow: React.FC<ArrowProps> = ({ open }) => (
  <span
    className={`inline-block transition-transform duration-300 ${open ? 'rotate-90' : 'rotate-0'}`}
  >
    <svg viewBox="0 0 1024 1024" width="14" height="14">
      <path d="M384 192l384 320-384 320V192z" fill="currentColor" />
    </svg>
  </span>
);

/**
 * Monaco Editor 默认配置
 *
 * 配置哲学：
 * - readOnly: 默认只读，保护代码不被意外修改
 * - automaticLayout: 自动布局适应容器大小变化
 * - folding: 支持代码折叠，提升大文件阅读体验
 * - lineNumbers: 显示行号，便于代码定位
 * - minimap: 禁用小地图，节省屏幕空间
 */
const defaultOpts = {
  readOnly: true,
  automaticLayout: true,
  folding: true,
  lineNumbers: 'on' as const,
  minimap: { enabled: false },
};

/**
 * 可折叠代码编辑器组件 - 多模式代码查看和编辑工具
 *
 * 核心职责：
 * 1. 代码展示：支持语法高亮的代码查看
 * 2. 差异对比：并排显示文件修改前后的差异
 * 3. 交互增强：支持代码选择、评论添加和聊天集成
 * 4. 空间管理：可折叠界面和全屏抽屉模式
 *
 * 设计模式：
 * - 适配器模式：统一不同编辑器模式的接口
 * - 策略模式：基于文件类型选择语言和图标
 * - 观察者模式：通过事件系统与其他组件通信
 * - 装饰器模式：为编辑器添加评论和高亮功能
 *
 * 技术特性：
 * - Monaco Editor 集成：提供 VS Code 级别的编辑体验
 * - 语言自动检测：基于文件扩展名智能识别语言
 * - 响应式设计：支持折叠和全屏两种显示模式
 * - 实时交互：选择文本即可添加评论或发送到聊天
 */
function CollapsibleEditor({
  fileName,
  content,
  toolName,
  original,
  modified,
}: CollapsibleEditorProps): React.ReactElement {
  /**
   * 组件状态管理
   *
   * 状态设计：
   * - open: 控制编辑器的折叠/展开状态
   * - drawerOpen: 控制全屏抽屉的显示状态
   * - decosRef: 存储 Monaco Editor 的装饰器引用
   */
  const [open, setOpen] = useState<boolean>(true);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decosRef = useRef<any[]>([]);

  /**
   * 语言类型推断器
   *
   * 算法逻辑：
   * 1. 从文件名提取扩展名
   * 2. 根据扩展名映射到 Monaco Editor 支持的语言
   * 3. 提供默认的 plaintext 类型作为后备
   *
   * 设计优势：
   * - 自动语法高亮，无需手动配置
   * - 支持主流前端开发语言
   * - 易于扩展新的语言类型
   */
  const language = useMemo<MonacoLanguage>(() => {
    const ext = fileName?.split('.').pop()?.toLowerCase() as FileExtension;
    const languageMap: Record<FileExtension, MonacoLanguage> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      json: 'json',
      css: 'css',
      html: 'html',
      md: 'markdown',
    };
    return languageMap[ext] || 'plaintext';
  }, [fileName]);

  /**
   * 文件图标选择器
   *
   * 视觉识别系统：
   * - 基于文件扩展名提供直观的图标
   * - 使用 Unicode Emoji 确保跨平台兼容性
   * - 提供默认图标处理未知文件类型
   */
  const fileIcon = useMemo<string>(() => {
    const ext = fileName?.split('.').pop()?.toLowerCase() as FileExtension;
    const iconMap: Record<FileExtension, string> = {
      md: '📝',
      js: '📜',
      jsx: '📜',
      ts: '📘',
      tsx: '📘',
      json: '⚙️',
      css: '🎨',
      html: '🌐',
    };
    return iconMap[ext] || '📄';
  }, [fileName]);

  /**
   * Monaco Editor 挂载处理器
   *
   * 特殊功能：为 'write' 模式添加行高亮
   * 1. 检查工具类型，只对写入模式生效
   * 2. 获取编辑器模型和内容
   * 3. 为每一行创建高亮装饰器
   * 4. 应用装饰器并保存引用
   *
   * 设计考量：
   * - 条件性功能，避免不必要的性能开销
   * - 使用装饰器 API 实现非侵入式高亮
   * - 保存装饰器引用便于后续清理
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMount = (editor: any, monaco: any): void => {
    if (toolName !== 'write') return;

    const model = editor.getModel();
    if (!model) return;

    const decos = model.getLinesContent().map((_: string, i: number) => ({
      range: new monaco.Range(i + 1, 1, i + 1, 1),
      options: { isWholeLine: true, className: 'my-line-added' },
    }));
    decosRef.current = editor.deltaDecorations([], decos);
  };

  /**
   * 展开按钮点击处理器
   *
   * 交互逻辑：
   * 1. 阻止事件冒泡，避免触发标题栏点击
   * 2. 打开全屏抽屉模式
   *
   * 用户体验：
   * - 提供更大的代码查看空间
   * - 保持原有的折叠状态不变
   */
  const handleExpandClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setDrawerOpen(true);
  };

  /**
   * 评论小部件添加器
   *
   * 交互增强功能：
   * 1. 监听编辑器选择变化事件
   * 2. 当有文本被选中时显示"添加评论"按钮
   * 3. 点击按钮创建评论小部件
   * 4. 将评论和选中文本发送到聊天输入框
   *
   * 设计模式：
   * - 观察者模式：监听选择变化事件
   * - 工厂模式：动态创建评论小部件
   * - 命令模式：封装评论创建和发送逻辑
   *
   * 用户工作流：
   * 选择代码 → 显示评论按钮 → 添加评论 → 发送到聊天
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addCommentWidget = async (editor: any, monaco: any): Promise<void> => {
    if (editor) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let currentWidget: any = null;

      editor.onDidChangeCursorSelection(() => {
        const selection: EditorSelection = editor.getSelection();
        const selectWord: string = editor.getModel().getValueInRange(selection);

        // 清理之前的小部件
        if (currentWidget) {
          editor.removeContentWidget(currentWidget);
          currentWidget = null;
        }

        // 如果有选中文本，创建评论按钮
        if (selectWord) {
          currentWidget = {
            getId: () => 'add-to-chat-content-widget',
            getDomNode: () => {
              const node = document.createElement('div');
              node.innerHTML = `
<button class="add-to-chat-btn">
  <div style="width: 24px;line-height: 0;margin-right: 6px;">
    <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="robot" class="svg-inline--fa fa-robot " role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path fill="currentColor" d="M320 0c17.7 0 32 14.3 32 32l0 64 120 0c39.8 0 72 32.2 72 72l0 272c0 39.8-32.2 72-72 72l-304 0c-39.8 0-72-32.2-72-72l0-272c0-39.8 32.2-72 72-72l120 0 0-64c0-17.7 14.3-32 32-32zM208 384c-8.8 0-16 7.2-16 16s7.2 16 16 16l32 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-32 0zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16l32 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-32 0zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16l32 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-32 0zM264 256a40 40 0 1 0 -80 0 40 40 0 1 0 80 0zm152 40a40 40 0 1 0 0-80 40 40 0 1 0 0 80zM48 224l16 0 0 192-16 0c-26.5 0-48-21.5-48-48l0-96c0-26.5 21.5-48 48-48zm544 0c26.5 0 48 21.5 48 48l0 96c0 26.5-21.5 48-48 48l-16 0 0-192 16 0z"></path>
    </svg>
  </div>
  添加评论
</button>`;
              node.onclick = (e: Event) => {
                e.stopPropagation();

                createCommentsWidget(
                  editor,
                  Number(selection.endLineNumber),
                  ({ comment }: { comment: string }) => {
                    dispatchCustomEvent(EVENT_TYPES.INSERT_FILE_TO_INPUT, {
                      payload: {
                        comment,
                        selectWord,
                        selection,
                      },
                    });
                    setDrawerOpen(false);
                  },
                );
                editor.removeContentWidget(currentWidget);
                currentWidget = null;
              };
              return node;
            },
            getPosition: () => ({
              position: {
                lineNumber: selection.endLineNumber,
                column: selection.endColumn + 1,
              },
              preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
            }),
          };
          editor.addContentWidget(currentWidget);
        }
      });
    }
  };

  /**
   * 渲染逻辑 - 双模式界面设计
   *
   * 界面架构：
   * 1. 主界面：可折叠的紧凑视图，适合快速浏览
   * 2. 抽屉界面：全屏模式，提供完整的编辑体验
   *
   * 交互设计：
   * - 点击标题栏：切换折叠/展开状态
   * - 点击展开按钮：打开全屏抽屉
   * - 支持键盘导航和无障碍访问
   *
   * 响应式策略：
   * - 主界面固定高度，避免布局跳动
   * - 抽屉宽度50%，平衡内容展示和上下文保持
   * - 平滑的CSS过渡动画提升用户体验
   */
  return (
    <>
      {/* 主界面容器 - 紧凑模式 */}
      <div className="w-full bg-gray-100 rounded-lg shadow-sm my-2">
        {/* 标题栏 - 文件信息和控制按钮 */}
        <div
          className="flex items-center justify-between p-0.5 border border-gray-300 rounded cursor-pointer"
          onClick={() => setOpen((o) => !o)}
        >
          {/* 左侧：文件信息区域 */}
          <div className="flex items-center space-x-2 ml-2 min-w-0 flex-1">
            <Arrow open={open} />
            <span>{fileIcon}</span>
            {/* 文件名显示 - 支持长文件名的省略显示 */}
            <span className="text-gray-800 overflow-hidden text-ellipsis whitespace-nowrap max-w-[320px]">
              {fileName}
            </span>
          </div>

          {/* 右侧：操作按钮区域 */}
          <div
            className="flex justify-center items-center gap-3 mx-2"
            onClick={handleExpandClick}
          >
            {/* 全屏展开按钮 - Ant Design 风格 */}
            <button
              type="button"
              className="ant-btn css-36gkoj ant-btn-circle ant-btn-text ant-btn-color-default ant-btn-variant-text ant-btn-icon-only acss-1kvbi5e"
            >
              <span className="ant-btn-icon">
                <span
                  role="img"
                  aria-label="expand-alt"
                  className="anticon anticon-expand-alt"
                >
                  <svg
                    viewBox="64 64 896 896"
                    focusable="false"
                    data-icon="expand-alt"
                    width="1em"
                    height="1em"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M855 160.1l-189.2 23.5c-6.6.8-9.3 8.8-4.7 13.5l54.7 54.7-153.5 153.5a8.03 8.03 0 000 11.3l45.1 45.1c3.1 3.1 8.2 3.1 11.3 0l153.6-153.6 54.7 54.7a7.94 7.94 0 0013.5-4.7L863.9 169a7.9 7.9 0 00-8.9-8.9zM416.6 562.3a8.03 8.03 0 00-11.3 0L251.8 715.9l-54.7-54.7a7.94 7.94 0 00-13.5 4.7L160.1 855c-.6 5.2 3.7 9.5 8.9 8.9l189.2-23.5c6.6-.8 9.3-8.8 4.7-13.5l-54.7-54.7 153.6-153.6c3.1-3.1 3.1-8.2 0-11.3l-45.2-45z"></path>
                  </svg>
                </span>
              </span>
            </button>
          </div>
        </div>

        {/* 可折叠内容区域 - 使用 CSS 过渡动画 */}
        <div
          className={`overflow-hidden transition-[max-height] duration-500 ${open ? 'max-h-[500px]' : 'max-h-0'}`}
        >
          <div className="w-full rounded-lg p-1 bg-gray-50">
            {/* 编辑器模式选择 - 策略模式的体现 */}
            {toolName === 'write' ? (
              // 单文件编辑模式 - 支持语法高亮和行高亮
              <Editor
                height={300}
                language={language}
                theme="vs-light"
                value={content}
                options={defaultOpts}
                onMount={handleMount}
              />
            ) : (
              // 差异对比模式 - 并排显示文件变更
              <DiffEditor
                height={200}
                language={language}
                theme="vs-light"
                original={original}
                modified={modified}
                options={defaultOpts}
              />
            )}
          </div>
        </div>
      </div>

      {/* 全屏抽屉 - 完整编辑体验 */}
      <Drawer
        title={`${fileIcon} ${fileName}`}
        placement="right"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width="50%"
        destroyOnClose={true}
      >
        <div className="h-full">
          {/* 抽屉内的编辑器 - 增强交互功能 */}
          {toolName === 'write' ? (
            // 单文件模式 - 支持评论小部件
            <Editor
              height="100%"
              language={language}
              theme="vs-light"
              value={content}
              options={{ ...defaultOpts }}
              onMount={(editor, monaco) => {
                addCommentWidget(editor, monaco);
              }}
            />
          ) : (
            // 差异对比模式 - 在修改后的编辑器上支持评论
            <DiffEditor
              height="100%"
              language={language}
              theme="vs-light"
              original={original}
              modified={modified}
              options={defaultOpts}
              onMount={(editor, monaco) => {
                // 注意：差异编辑器需要获取修改后的编辑器实例
                addCommentWidget(editor.getModifiedEditor(), monaco);
              }}
            />
          )}
        </div>
      </Drawer>
    </>
  );
}

export default CollapsibleEditor;
