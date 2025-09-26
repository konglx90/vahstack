import React, { useEffect } from 'react';
import { Editor } from '@monaco-editor/react';
import { usePathExists } from './usePathExists';

/**
 * Monaco Editor 实例类型定义
 *
 * 类型安全考量：使用 @monaco-editor/react 提供的类型
 */
type MonacoEditorInstance = Parameters<
  NonNullable<React.ComponentProps<typeof Editor>['onMount']>
>[0];
type MonacoInstance = Parameters<
  NonNullable<React.ComponentProps<typeof Editor>['onMount']>
>[1];

/**
 * 文件对象接口定义
 *
 * 设计原则：明确的文件数据结构
 * - path: 文件路径（必需）
 * - name: 文件名（必需）
 * - content: 文件内容（可选，用于编辑器显示）
 */
interface FileObject {
  path: string;
  name: string;
  content?: string;
}

/**
 * FileEditor 组件属性接口
 *
 * 设计哲学：单一职责原则
 * - currentFile: 当前编辑的文件对象
 * - onSave: 保存操作回调
 * - updateFileContent: 文件内容更新回调
 */
interface FileEditorProps {
  currentFile: FileObject | null;
  onSave: () => void;
  updateFileContent: (path: string, content: string) => void;
}

/**
 * 语言映射表类型定义
 *
 * 类型安全考量：确保文件扩展名到语言的映射准确性
 */
type LanguageMap = {
  [key: string]: string;
};

/**
 * 引用匹配结果接口
 *
 * 功能说明：表示在文件中找到的引用信息
 * - raw: 原始引用字符串
 * - index: 在文件中的位置索引
 */
interface ReferenceMatch {
  raw: string;
  index: number;
}

/**
 * Monaco Editor 标记数据接口
 *
 * 错误标记的数据结构定义
 */
interface MarkerData {
  severity: number;
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/**
 * FileEditor 组件 - 基于 Monaco 的代码编辑器
 *
 * 核心功能：
 * 1. 代码编辑和语法高亮
 * 2. 文件引用检查和错误标记
 * 3. 快捷键支持（Ctrl+S 保存）
 * 4. 实时内容同步
 *
 * 设计哲学：
 * - 防御性编程：处理各种边界情况
 * - 用户体验优先：提供直观的错误反馈
 * - 性能优化：并发检查文件引用
 */
const FileEditor: React.FC<FileEditorProps> = ({
  currentFile,
  onSave,
  updateFileContent,
}) => {
  // 编辑器实例引用 - 用于直接操作编辑器
  const editorRef = React.useRef<MonacoEditorInstance | null>(null);
  // Monaco 实例引用 - 用于访问 Monaco API
  const monacoRef = React.useRef<MonacoInstance | null>(null);
  // 路径存在性检查 Hook
  const checkPathExists = usePathExists();

  /**
   * 根据文件名获取编程语言类型
   *
   * 设计原则：约定优于配置
   * - 通过文件扩展名自动推断语言类型
   * - 提供合理的默认值（plaintext）
   * - 支持常见的前端开发语言
   */
  const getLanguageFromFilename = (filename: string | undefined): string => {
    if (!filename) return 'plaintext';

    const ext = filename.split('.').pop()?.toLowerCase();
    if (!ext) return 'plaintext';

    const languageMap: LanguageMap = {
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
  };

  /**
   * 编辑器内容变化处理
   *
   * 职责：同步编辑器内容到父组件状态
   * - 实时更新文件内容
   * - 触发父组件的状态更新
   */
  const handleEditorChange = (value: string | undefined): void => {
    if (currentFile && updateFileContent && value !== undefined) {
      updateFileContent(currentFile.path, value);
    }
  };

  // 监听当前文件变化，触发引用检查
  useEffect(() => {
    if (
      currentFile &&
      currentFile.path.includes('task-') &&
      editorRef.current &&
      monacoRef.current
    ) {
      checkReferences();
    }
  }, [checkReferences, currentFile, editorRef, monacoRef]);

  /**
   * 检查文件中的引用路径有效性
   *
   * 核心功能：
   * 1. 解析文件中的 reference: 语法
   * 2. 并发检查引用路径是否存在
   * 3. 在编辑器中标记无效引用
   * 4. 发送更新事件给其他组件
   *
   * 设计考量：
   * - 性能优化：使用 Promise.all 并发检查
   * - 用户体验：提供清晰的错误标记
   * - 扩展性：支持特殊引用类型（@ 开头）
   */
  async function checkReferences(): Promise<void> {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // 防御性编程：确保编辑器和 Monaco 实例存在
    if (!editor || !monaco || !currentFile) return;

    const model = editor.getModel();
    if (!model) return;

    const text = currentFile.content || '';

    // 正则表达式匹配 reference: 语法
    const reg = /reference:\s*([^\s]+)/g;
    const matches: ReferenceMatch[] = [];

    // 收集所有匹配的引用
    for (const m of text.matchAll(reg)) {
      if (m[1] && m.index !== undefined) {
        matches.push({ raw: m[1], index: m.index });
      }
    }

    // 如果没有引用，清除所有标记
    if (!matches.length) {
      monaco.editor.setModelMarkers(model, 'reference-check', []);
      return;
    }

    // 并发检查所有引用路径的有效性
    const markerPromises = matches.map(
      async ({ raw, index }): Promise<MarkerData | null> => {
        // 跳过特殊引用（@ 开头的引用通常是特殊标记）
        if (!raw || raw.startsWith('@')) return null;

        const ok = await checkPathExists(raw, currentFile.path);
        if (ok) return null; // 路径存在，无需标记

        // 计算错误标记的位置
        const start = model.getPositionAt(index);
        const end = model.getPositionAt(index + `reference: ${raw}`.length);

        return {
          severity: monaco.MarkerSeverity.Error,
          message: `路径不存在: ${raw}`,
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column,
        };
      },
    );

    // 等待所有检查完成，过滤掉空值
    const markers = (await Promise.all(markerPromises)).filter(
      (marker): marker is MarkerData => marker !== null,
    );

    // 设置错误标记
    monaco.editor.setModelMarkers(model, 'reference-check', markers);

    // 发送内容更新事件 - 通知其他组件文件状态变化
    const contentEvent = new CustomEvent('updateTokenContent', {
      detail: {
        filePath: currentFile.path,
        content: text,
        markers,
      },
    });
    window.dispatchEvent(contentEvent);
  }

  // 空状态渲染 - 用户友好的提示界面
  if (!currentFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-6xl mb-4">📁</div>
          <h3 className="text-xl font-semibold mb-2">选择一个文件查看内容</h3>
          <p className="text-gray-400">在左侧文件树中点击文件名来查看其内容</p>
        </div>
      </div>
    );
  }

  // 主编辑器渲染
  return (
    <div className="flex-1">
      <Editor
        height="100%"
        theme="vs-light"
        value={currentFile.content || ''}
        language={getLanguageFromFilename(currentFile.name)}
        options={{
          automaticLayout: true, // 自动调整布局
          folding: true, // 启用代码折叠
          lineNumbers: 'on', // 显示行号
          wordWrap: 'off', // 禁用自动换行
          fontSize: 14, // 字体大小
          tabSize: 2, // Tab 缩进大小
          minimap: { enabled: false }, // 禁用小地图
        }}
        onChange={handleEditorChange}
        onMount={(editor, monaco) => {
          // 保存编辑器和 Monaco 实例引用
          editorRef.current = editor;
          monacoRef.current = monaco;

          // 注册快捷键：Ctrl+S / Cmd+S 保存文件
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            onSave();
          });
        }}
      />
    </div>
  );
};

export default FileEditor;
