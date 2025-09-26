import React from 'react';

/**
 * 文件对象接口定义
 *
 * 设计原则：明确的文件数据结构
 * - path: 文件路径（必需，用于唯一标识）
 * - name: 文件名（必需，用于显示和图标识别）
 */
interface FileObject {
  path: string;
  name: string;
}

/**
 * 文件扩展名类型定义
 *
 * 类型安全考量：限制支持的文件类型
 */
type FileExtension =
  | 'md'
  | 'js'
  | 'jsx'
  | 'ts'
  | 'tsx'
  | 'json'
  | 'css'
  | 'html';

/**
 * FileTabBar 组件属性接口
 *
 * 设计哲学：单一职责原则 - 专注于标签页管理
 * - tabFiles: 打开的文件列表
 * - activeFileIndex: 当前激活的文件索引
 * - onTabSelect: 标签页选择回调
 * - onTabClose: 标签页关闭回调
 * - isFileModified: 文件修改状态检查函数
 */
interface FileTabBarProps {
  tabFiles: FileObject[];
  activeFileIndex: number;
  onTabSelect: (index: number) => void;
  onTabClose: (index: number) => void;
  isFileModified: (filePath: string) => boolean;
}

/**
 * FileTabBar 组件 - 文件标签页管理器
 *
 * 核心功能：
 * 1. 显示已打开文件的标签页
 * 2. 支持标签页切换和关闭
 * 3. 文件类型图标识别
 * 4. 文件修改状态指示
 * 5. 响应式水平滚动
 *
 * 设计哲学：
 * - 用户体验优先：直观的视觉反馈和交互
 * - 信息密度平衡：在有限空间内展示关键信息
 * - 约定优于配置：通过文件扩展名自动识别类型
 */
const FileTabBar: React.FC<FileTabBarProps> = ({
  tabFiles,
  activeFileIndex,
  onTabSelect,
  onTabClose,
  isFileModified,
}) => {
  /**
   * 根据文件名获取对应的图标
   *
   * 设计原则：约定优于配置
   * - 通过文件扩展名自动推断文件类型
   * - 提供直观的视觉识别
   * - 支持常见的前端开发文件类型
   *
   * @param filename 文件名（可选）
   * @returns 对应的 emoji 图标字符串
   */
  const getFileIcon = (filename: string | undefined): string => {
    if (!filename) return '📄';

    const ext = filename.split('.').pop()?.toLowerCase() as FileExtension;

    // 文件类型到图标的映射 - 体现文件特性的视觉化
    switch (ext) {
      case 'md':
        return '📝'; // Markdown - 文档编写
      case 'js':
      case 'jsx':
        return '📜'; // JavaScript - 脚本文件
      case 'ts':
      case 'tsx':
        return '📘'; // TypeScript - 类型安全的蓝色
      case 'json':
        return '⚙️'; // JSON - 配置文件
      case 'css':
        return '🎨'; // CSS - 样式设计
      case 'html':
        return '🌐'; // HTML - 网页结构
      default:
        return '📄'; // 默认文档图标
    }
  };

  // 空状态处理 - 无文件时不渲染组件
  if (tabFiles.length === 0) {
    return null;
  }

  return (
    <div className="flex border-b border-gray-200 bg-white overflow-x-auto">
      {tabFiles.map((file: FileObject, index: number) => {
        // 检查文件修改状态 - 用于显示未保存提示
        const isModified = isFileModified(file.path);

        return (
          <div
            key={file.path} // 使用文件路径作为唯一键值
            className={`px-4 py-2 cursor-pointer border-r border-gray-200 flex items-center gap-2 relative ${
              index === activeFileIndex
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500' // 激活状态样式
                : 'hover:bg-gray-50' // 悬停状态样式
            }`}
            onClick={() => onTabSelect(index)}
          >
            {/* 文件类型图标 - 提供视觉识别 */}
            <span>{getFileIcon(file.name)}</span>

            {/* 文件名显示 */}
            <span className="text-sm">{file.name}</span>

            {/* 修改状态指示器 - 红点表示未保存的更改 */}
            {isModified && (
              <span
                className="w-2 h-2 bg-red-500 rounded-full"
                title="文件已修改，未保存"
              ></span>
            )}

            {/* 关闭按钮 - 支持单独关闭标签页 */}
            <button
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation(); // 阻止事件冒泡，避免触发标签页选择
                onTabClose(index);
              }}
              className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="关闭标签页"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default FileTabBar;
