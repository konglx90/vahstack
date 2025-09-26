/**
 * 工具消息组件
 *
 * 核心职责：
 * - 展示工具调用的状态和结果
 * - 提供可折叠的详细信息视图
 * - 区分不同工具类型的展示方式
 * - 实时反映工具执行状态
 *
 * 设计哲学：
 * - 状态驱动UI：根据工具状态动态调整视觉样式
 * - 渐进式信息披露：通过折叠/展开控制信息密度
 * - 类型特化：针对不同工具类型提供定制化展示
 * - 实时反馈：通过动画和颜色变化提供即时状态反馈
 */

import React from 'react';

// ============ 类型定义 ============

/**
 * 工具执行状态枚举
 */
type ToolStatus = 'running' | 'completed' | 'failed';

/**
 * 工具参数接口
 * 支持不同工具类型的参数结构
 */
interface ToolParams {
  file_path?: string;
  content?: string;
  [key: string]: unknown;
}

/**
 * 工具执行结果接口
 */
interface ToolResult {
  result?: string | object | null;
  error?: string;
  [key: string]: unknown;
}

/**
 * 工具对象接口
 *
 * 设计原则：完整性和可扩展性
 * - id: 唯一标识符，用于状态管理和UI更新
 * - name: 工具名称，决定展示逻辑
 * - status: 执行状态，驱动UI样式变化
 * - params: 输入参数，支持不同工具的参数结构
 * - result: 执行结果，可能包含多种数据类型
 */
interface Tool {
  id: string;
  name: string;
  status: ToolStatus;
  params?: ToolParams;
  result?: ToolResult;
}

/**
 * ToolMessage 组件 Props 接口
 */
interface ToolMessageProps {
  tool: Tool;
  isExpanded: boolean;
  onToggle: (toolId: string) => void;
}

/**
 * 工具消息展示组件
 *
 * 交互设计：
 * - 点击头部区域切换展开/折叠状态
 * - 运行中状态显示脉冲动画提供视觉反馈
 * - 不同状态使用不同颜色主题区分
 *
 * 信息架构：
 * - 头部：状态指示器 + 工具名称 + 简短状态描述 + ID后缀
 * - 详情：根据工具类型和状态展示参数或结果
 *
 * @param tool - 工具对象
 * @param isExpanded - 是否展开详情
 * @param onToggle - 切换展开状态的回调函数
 */
const ToolMessage: React.FC<ToolMessageProps> = ({
  tool,
  isExpanded,
  onToggle,
}) => {
  // 状态计算：基于工具状态确定UI表现
  const isRunning = tool.status === 'running';
  const isCompleted = tool.status === 'completed';

  return (
    <div
      className={`mb-2 rounded-lg p-2 text-xs border-2 transition-all duration-200 ${
        isRunning
          ? 'bg-orange-50 border-orange-200 shadow-sm'
          : 'bg-green-50 border-green-200 shadow-sm'
      }`}
    >
      {/* 可点击的头部区域 */}
      <div
        className={`flex items-center justify-between cursor-pointer p-1 rounded transition-colors ${
          isRunning ? 'hover:bg-orange-100' : 'hover:bg-green-100'
        }`}
        onClick={() => onToggle(tool.id)}
      >
        <div className="flex items-center gap-1.5">
          {/* 状态指示器：运行中显示脉冲动画，完成显示静态圆点 */}
          {isRunning && (
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
          )}
          {isCompleted && (
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
          )}

          {/* 展开/折叠指示器 */}
          <span
            className={`font-medium ${isExpanded ? '▼' : '▶'} ${
              isRunning ? 'text-orange-600' : 'text-green-600'
            }`}
          >
            {isExpanded ? '▼' : '▶'}
          </span>

          {/* 工具名称和状态描述 */}
          <span
            className={`font-medium flex-1 text-sm ${
              isRunning ? 'text-orange-700' : 'text-green-700'
            }`}
          >
            {isRunning ? '🔧' : '✅'} {tool.name}
            {isRunning && (
              <span className="ml-1.5 text-xs text-orange-500">(运行中)</span>
            )}
            {isCompleted && (
              <span className="ml-1.5 text-xs text-green-500">(已完成)</span>
            )}
          </span>
        </div>

        {/* 工具ID后缀：便于调试和追踪 */}
        <small
          className={`text-xs font-mono ${
            isRunning ? 'text-orange-500' : 'text-green-500'
          }`}
        >
          #{tool.id.slice(-4)}
        </small>
      </div>

      {/* 可折叠的详细信息区域 */}
      {isExpanded && (
        <div
          className={`mt-2 p-2 bg-white rounded-lg border shadow-sm ${
            isRunning ? 'border-orange-200' : 'border-green-200'
          }`}
        >
          {/* 特殊处理：文件写入工具的简化展示 */}
          {tool.name === 'write' && tool.params?.file_path ? (
            <>
              <div className="flex items-center gap-1.5 mb-1.5">
                <strong className="text-gray-700 text-xs">文件:</strong>
                <span className="text-gray-600 text-xs break-all bg-gray-50 px-1.5 py-0.5 rounded font-mono">
                  {(tool.params.file_path as string).split('/').pop()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <strong className="text-gray-700 text-xs">操作:</strong>
                <span className="text-gray-600 text-xs">
                  {isCompleted ? '文件写入成功' : '写入文件'}
                </span>
              </div>
              {isCompleted && (
                <div className="mt-1.5">
                  <span className="text-green-600 text-xs font-medium">
                    ✅ 执行成功
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              {/* 通用工具展示：运行中显示参数，完成后显示结果 */}
              {isRunning ? (
                <>
                  <strong className="text-gray-700 text-xs">参数:</strong>
                  <pre className="mt-1.5 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg border overflow-auto max-h-24 break-words whitespace-pre-wrap font-mono">
                    {tool.params && Object.keys(tool.params).length > 0
                      ? JSON.stringify(tool.params, null, 2)
                      : '无参数'}
                  </pre>
                </>
              ) : (
                <>
                  <strong className="text-gray-700 text-xs">结果:</strong>
                  <pre className="mt-1.5 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg border overflow-auto max-h-24 break-words whitespace-pre-wrap font-mono">
                    {tool.result?.result !== undefined &&
                    tool.result?.result !== null
                      ? typeof tool.result.result === 'string'
                        ? tool.result.result
                        : JSON.stringify(tool.result.result, null, 2)
                      : '执行完成'}
                  </pre>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolMessage;
