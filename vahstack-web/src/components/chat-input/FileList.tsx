import React, { useRef, useEffect } from 'react';
import { Range } from 'slate';

/**
 * 文件对象类型定义
 *
 * 设计哲学：类型即文档
 * - 明确区分文件类型，为不同类型的文件提供差异化处理能力
 * - 统一的数据结构确保组件的可预测性和可维护性
 */
interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'component'; // 区分普通文件和组件，支持不同的视觉呈现
}

/**
 * FileList 组件的 props 类型定义
 *
 * 设计原则：接口隔离
 * - 每个回调函数职责单一，便于测试和复用
 * - target 为 null 时组件不渲染，体现防御性编程思想
 */
interface FileListProps {
  files: FileItem[];
  target: Range | null; // Slate Range 对象，null 时表示未激活状态
  activeIndex: number;
  onHover: (index: number) => void; // 键盘导航支持
  onSelect: (file: FileItem) => void; // 文件选择回调
}

/**
 * 文件选择下拉列表组件
 *
 * 核心职责：
 * 1. 展示可选文件列表，支持键盘和鼠标交互
 * 2. 提供视觉反馈（高亮、图标区分）
 * 3. 自动滚动到激活项，提升用户体验
 *
 * 设计哲学：
 * - 条件渲染：无内容时不渲染，避免空状态干扰
 * - 可访问性优先：支持键盘导航和屏幕阅读器
 * - 视觉层次：通过颜色、图标、字体大小建立信息层次
 */
const FileList: React.FC<FileListProps> = ({
  files,
  target,
  activeIndex,
  onHover,
  onSelect,
}) => {
  // 用于滚动控制的 DOM 引用
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * 自动滚动到激活项
   *
   * 设计意图：确保用户始终能看到当前选中的项
   * - 使用 "nearest" 策略，最小化滚动距离
   * - 依赖 data-index 属性进行精确定位
   */
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // 防御性编程：无有效状态时不渲染
  if (!target || !files.length) return null;

  return (
    <div
      ref={listRef}
      className="bottom-full mb-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto z-50 fade-in"
    >
      <div className="p-2">
        {/* 列表头部：提供上下文信息 */}
        <div className="text-xs text-gray-500 px-3 py-2 border-b border-gray-100 font-medium">
          选择文件 ({files.length})
        </div>
        {files.map((item, i) => {
          // 视觉区分：不同文件类型使用不同图标
          const emoji = item.type === 'component' ? '🧩' : '📄';
          return (
            <div
              key={i}
              data-index={i} // 用于滚动定位的标识符
              className={`p-3 cursor-pointer transition-all duration-200 flex items-center gap-3 hover:bg-gray-50 rounded-lg mx-1 my-1 group
${activeIndex === i ? 'bg-blue-100' : ''}`}
              onMouseEnter={() => onHover(i)} // 鼠标悬停更新激活状态
              onMouseDown={(e) => {
                e.preventDefault(); // 防止焦点丢失，保持编辑器状态
                onSelect(item);
              }}
            >
              {/* 文件类型图标：提供即时的视觉识别 */}
              <span className="text-lg group-hover:scale-110 transition-transform duration-200">
                {emoji}
              </span>
              {/* 文件信息：名称和路径的层次化展示 */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 truncate">
                  {item.name}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {item.path}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FileList;
