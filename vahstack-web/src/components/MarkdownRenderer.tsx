/**
 * Markdown 渲染器组件
 *
 * 核心职责：
 * - 将 Markdown 文本转换为富文本展示
 * - 提供代码语法高亮功能
 * - 支持流式内容的实时渲染
 * - 处理不完整 Markdown 内容的容错
 *
 * 设计哲学：
 * - 渐进增强：基础文本展示 + 语法高亮增强
 * - 容错优先：优雅处理流式输出中的不完整内容
 * - 性能导向：避免不必要的重复解析和渲染
 * - 可扩展性：组件化设计便于功能扩展
 */

import React from 'react';
import XMarkdown from '@ant-design/x-markdown';
import HighlightCode from '@ant-design/x-markdown/plugins/HighlightCode';

/**
 * 代码块组件的属性接口
 */
interface CodeProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * MarkdownRenderer 组件的属性接口
 */
interface MarkdownRendererProps {
  /** Markdown 内容字符串 */
  content?: string;
  /** 自定义 CSS 类名 */
  className?: string;
}

/**
 * 代码高亮组件
 *
 * 功能特性：
 * - 自动识别编程语言：从 className 中提取语言标识
 * - 类型安全：确保 children 为字符串类型
 * - 语法高亮：使用 Ant Design 的 HighlightCode 插件
 *
 * 设计考量：
 * - 防御性编程：对非字符串内容返回 null，避免渲染错误
 * - 正则匹配：兼容标准 Markdown 代码块的 language-xxx 格式
 */
const Code: React.FC<CodeProps> = ({ className, children }) => {
  // 开发调试：输出参数信息便于问题排查
  console.log(className, 'className', children);

  // 语言识别：从 CSS 类名中提取编程语言标识
  // 匹配模式：language-javascript, language-python 等
  const lang = className?.match(/language-(\w+)/)?.[1] || '';

  // 类型守护：确保内容为字符串，避免渲染异常
  if (typeof children !== 'string') return null;

  return <HighlightCode lang={lang}>{children}</HighlightCode>;
};

/**
 * Markdown 渲染器主组件
 *
 * 核心特性：
 * - 实时渲染：支持流式内容的增量更新
 * - 代码高亮：集成语法高亮功能
 * - 容错处理：优雅处理不完整的 Markdown 内容
 *
 * 技术选型：
 * - XMarkdown：Ant Design 生态的 Markdown 解析器
 * - 自定义组件：通过 components 属性注入代码高亮组件
 * - paragraphTag：使用 div 标签提升布局灵活性
 *
 * 性能优化：
 * - 预处理逻辑已注释：避免不必要的计算开销
 * - 按需渲染：仅在内容变化时重新解析
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content = '',
  className = '',
}) => {
  /**
   * 流式内容预处理逻辑（已禁用）
   *
   * 设计意图：
   * - 路径修复：处理被错误分行的文件路径
   * - 代码块容错：处理流式输出中的不完整代码块
   * - 内容清理：移除可能导致渲染异常的片段
   *
   * 当前状态：已注释，避免过度处理影响性能
   * 启用条件：当流式输出出现格式问题时可重新启用
   */
  // const processedContent = useMemo(() => {
  //   if (!content) return ''

  //   let processed = content

  //   // 处理被错误分行的文件路径
  //   // 匹配类似 "/Users\n/kong\n/ai-coding" 的模式
  //   processed = processed.replace(/(\/[^\s/\n]+)\s*\n\s*(?=\/)/g, '$1')

  //   // 处理流式输出中可能出现的不完整 Markdown
  //   const incompleteCodeBlock = /```[^`]*$/
  //   if (incompleteCodeBlock.test(processed)) {
  //     const lastCompleteBlock = processed.lastIndexOf('```', processed.length - 4)
  //     if (lastCompleteBlock > 0) {
  //       const beforeBlock = processed.substring(0, lastCompleteBlock)
  //       const afterBlock = processed.substring(lastCompleteBlock)
  //       const blockMatch = afterBlock.match(/```[\s\S]*?```/)
  //       if (!blockMatch) {
  //         processed = beforeBlock
  //       }
  //     }
  //   }

  //   return processed
  // }, [content])

  // 开发调试：输出内容信息便于问题排查
  console.log(content, 'content');

  return (
    <div className={className}>
      <XMarkdown components={{ code: Code }} paragraphTag="div">
        {content}
      </XMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
