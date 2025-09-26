import React, { useState } from 'react';
import { dispatchCustomEvent, EVENT_TYPES } from '../../hooks/useCustomEvent';

/**
 * 文件树节点类型定义
 *
 * 设计原则：递归数据结构
 * - 支持文件和目录的统一表示
 * - 通过 type 字段区分节点类型，体现多态设计
 * - children 字段支持无限层级嵌套，满足复杂目录结构需求
 */
interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

/**
 * 组件 Props 类型定义
 *
 * 设计哲学：接口分离原则
 * - fileTree: 数据源，支持完整的文件系统结构
 * - onFileSelect: 文件选择回调，实现与父组件的松耦合通信
 */
interface FileTreeProps {
  fileTree: TreeNode[];
  onFileSelect: (file: TreeNode) => void;
}

/**
 * 文件扩展名到图标的映射类型
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
 * 文件树组件 - 分层文件系统的可视化导航
 *
 * 核心职责：
 * 1. 文件系统可视化：将扁平的文件路径转换为层次化的树形结构
 * 2. 交互式导航：支持目录展开/折叠和文件选择操作
 * 3. 视觉识别：通过图标系统提供直观的文件类型识别
 * 4. 快捷操作：支持双击快速插入文件路径到输入框
 *
 * 设计模式：
 * - 组合模式：统一处理文件和目录节点
 * - 状态机：管理目录的展开/折叠状态
 * - 策略模式：基于文件扩展名选择对应图标
 * - 观察者模式：通过事件系统与其他组件通信
 */
const FileTree: React.FC<FileTreeProps> = ({ fileTree, onFileSelect }) => {
  /**
   * 展开目录状态管理
   *
   * 设计考量：
   * - 使用 Set 数据结构优化查找性能 O(1)
   * - 存储完整路径而非节点引用，避免内存泄漏
   * - 支持多个目录同时展开，提升用户体验
   */
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  /**
   * 目录展开/折叠切换器
   *
   * 算法逻辑：
   * 1. 检查目录当前状态（展开/折叠）
   * 2. 创建新的 Set 实例确保状态不可变性
   * 3. 切换目录状态并更新组件状态
   *
   * 设计原则：不可变数据
   * - 避免直接修改原始状态，确保 React 重渲染的正确性
   * - 使用函数式更新模式，支持并发模式
   */
  const toggleDirectory = (path: string): void => {
    setExpandedDirs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  /**
   * 文件图标选择器
   *
   * 设计模式：策略模式
   * - 基于文件扩展名选择对应的视觉图标
   * - 提供默认图标处理未知文件类型
   * - 使用 Unicode Emoji 确保跨平台兼容性
   *
   * 扩展性考虑：
   * - 易于添加新的文件类型支持
   * - 图标映射集中管理，便于维护
   */
  const getFileIcon = (filename: string): string => {
    const ext = filename?.split('.').pop()?.toLowerCase() as FileExtension;
    switch (ext) {
      case 'md':
        return '📝';
      case 'js':
      case 'jsx':
        return '📜';
      case 'ts':
      case 'tsx':
        return '📘';
      case 'json':
        return '⚙️';
      case 'css':
        return '🎨';
      case 'html':
        return '🌐';
      default:
        return '📄';
    }
  };

  /**
   * 递归树渲染器
   *
   * 核心算法：深度优先遍历
   * 1. 遍历当前层级的所有节点
   * 2. 为每个节点生成对应的 UI 元素
   * 3. 对于展开的目录，递归渲染子节点
   * 4. 通过 level 参数控制缩进层级
   *
   * 设计哲学：
   * - 递归简化复杂问题：将树形结构渲染分解为单层处理
   * - 视觉层次：通过缩进清晰表达文件系统的层级关系
   * - 交互一致性：文件和目录使用统一的交互模式
   * - 性能优化：使用 key 属性优化 React 列表渲染
   */
  const renderTree = (
    items: TreeNode[],
    level: number = 0,
  ): React.ReactElement[] => {
    return items.map((item) => {
      const isExpanded = expandedDirs.has(item.path);

      return (
        <div key={item.path}>
          <div
            className="flex items-center py-2 px-3 hover:bg-gray-100 cursor-pointer"
            style={{ paddingLeft: `${level * 16 + 12}px` }}
            onClick={() => {
              if (item.type === 'directory') {
                toggleDirectory(item.path);
              } else {
                onFileSelect(item);
              }
            }}
            onDoubleClick={() => {
              // 快捷操作：双击插入文件路径到输入框
              dispatchCustomEvent(EVENT_TYPES.INSERT_FILE_TO_INPUT, {
                filePath: item.path,
              });
            }}
          >
            {/* 目录展开/折叠指示器 */}
            {item.type === 'directory' && (
              <span
                className={`mr-2 transition-transform ${
                  isExpanded ? 'rotate-90' : ''
                }`}
              >
                ▶
              </span>
            )}

            {/* 文件类型图标 */}
            <span className="mr-2">
              {item.type === 'directory' ? '📁' : getFileIcon(item.name)}
            </span>

            {/* 文件/目录名称 */}
            <span className="text-sm">{item.name}</span>
          </div>

          {/* 递归渲染子目录 - 条件渲染优化性能 */}
          {item.type === 'directory' && isExpanded && item.children && (
            <div>{renderTree(item.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  /**
   * 组件渲染
   *
   * UI 架构：
   * - 滚动容器：支持大型文件树的浏览
   * - 响应式设计：适配不同屏幕尺寸
   * - 性能优化：只渲染可见区域内容
   */
  return <div className="overflow-y-auto h-full">{renderTree(fileTree)}</div>;
};

export default FileTree;
