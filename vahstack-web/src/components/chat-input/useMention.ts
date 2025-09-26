import { useState, useEffect, useCallback, useMemo } from 'react';
import { Editor, Range, Transforms, type BaseEditor } from 'slate';
import { ReactEditor } from 'slate-react';

const MAX_PANEL_ITEMS = 10; // 下拉面板最多展示条数
const TRIGGER = '@'; // 触发字符

/**
 * API 响应中的原始文件项
 *
 * 设计说明：表示从 API 获取的原始数据结构
 */
interface RawFileItem {
  path?: string;
  name?: string;
  [key: string]: unknown; // 允许其他未知属性
}

/**
 * 文件项接口定义
 *
 * 设计原则：明确的数据结构定义
 * - 支持文件和组件两种类型的统一表示
 * - 提供路径和名称的灵活访问
 */
interface FileItem extends RawFileItem {
  type: 'file' | 'component';
}

/**
 * 编辑器类型定义
 *
 * 类型安全考量：
 * - 结合 Slate 的 BaseEditor 和 ReactEditor
 * - 确保编辑器操作的类型安全
 */
type CustomEditor = BaseEditor & ReactEditor;

/**
 * 提及范围类型
 *
 * 功能说明：表示文本选择范围，用于 @ 提及功能
 */
type MentionRange = Range | null;

export const useMention = (editor: CustomEditor) => {
  /* -------- state -------- */
  const [target, setTarget] = useState<MentionRange>(null); // Range | null
  const [index, setIndex] = useState<number>(0); // 高亮行
  const [context, setContext] = useState<FileItem[]>([]); // 全量文件
  const [keyword, setKeyword] = useState<string>(''); // 当前关键字

  /* =========================================================
   * 1. 载入文件列表
   * ======================================================= */
  const loadContext = useCallback(async () => {
    const ctrl = new AbortController();
    try {
      const res = await fetch('/api-files/context', { signal: ctrl.signal });
      if (res.ok) {
        const { fileList, dirList } = (await res.json()) as {
          fileList: RawFileItem[];
          dirList: RawFileItem[];
        };

        // file: { path, name, ... , type:'file' }
        const files: FileItem[] = fileList.map((i: RawFileItem) => ({
          ...i,
          type: 'file' as const,
        }));
        // component: 合并两类
        const comps: FileItem[] = dirList.map((i: RawFileItem) => ({
          ...i,
          type: 'component' as const,
        }));

        setContext([...comps, ...files]);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError')
        console.warn('加载文件列表失败:', e);
    }
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  /* =========================================================
   * 2. 根据 keyword 过滤列表（memo）
   * ======================================================= */
  const files = useMemo(() => {
    if (!keyword) return context.slice(0, 100);

    const lower = keyword.toLowerCase();
    return context
      .filter((item: FileItem) =>
        (item.path || item.name || '').toLowerCase().includes(lower),
      )
      .slice(0, MAX_PANEL_ITEMS);
  }, [keyword, context]);

  /* =========================================================
   * 3. 在 selection 变化时捕获 "@xxx"
   * ======================================================= */
  const findMentionRange = useCallback((): MentionRange => {
    const { selection } = editor;
    if (!selection || !Range.isCollapsed(selection)) return null;

    let start = selection.anchor;

    // 向前逐字符扫描
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const before = Editor.before(editor, start, { unit: 'character' });
      if (!before) return null;

      const char = Editor.string(editor, { anchor: before, focus: start });
      if (char === TRIGGER) {
        return { anchor: before, focus: selection.anchor };
      }
      if (/\s/.test(char)) return null;

      start = before; // 继续向前
    }
  }, [editor]);

  /* 监听 selection */
  useEffect(() => {
    const mentionRange = findMentionRange();
    if (mentionRange) {
      const text = Editor.string(editor, mentionRange).slice(1); // 去掉 @
      setTarget(mentionRange);
      setKeyword(text);
      setIndex(0);
    } else {
      setTarget(null);
      setKeyword('');
    }
  }, [editor.selection, findMentionRange]);

  /* =========================================================
   * 4. 选中某文件 → 替换文本
   * ======================================================= */
  const onSelect = useCallback(
    (file: FileItem) => {
      if (!target) return;
      if (file.path) {
        Transforms.select(editor, target);
        Transforms.insertText(editor, `@${file.path} `); // 自动覆盖原文本
      }
      setTarget(null);
      setKeyword('');
    },
    [editor, target],
  );

  return { target, files, index, setIndex, onSelect };
};
