import { runLoop } from '../loop';
import type { ToolResult } from '../../types';

// 示例工具函数
const tools = {
  getCurrentTime: async (): Promise<ToolResult> => {
    return {
      llmContent: `当前时间是: ${new Date().toLocaleString('zh-CN')}`,
    };
  },

  calculate: async (params: Record<string, unknown>): Promise<ToolResult> => {
    const { expression } = params;
    try {
      // 简单的数学表达式计算（仅支持基本运算）
      const result = eval(expression as string);
      return {
        llmContent: `计算结果: ${expression} = ${result}`,
      };
    } catch (error) {
      return {
        llmContent: `计算错误: ${error instanceof Error ? error.message : '未知错误'}`,
        isError: true,
      };
    }
  },
};

// 工具模式定义
const toolSchemas = [
  {
    type: 'function' as const,
    function: {
      name: 'getCurrentTime',
      description: '获取当前时间',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate',
      description: '计算数学表达式',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: '要计算的数学表达式，如 "2 + 3" 或 "10 * 5"',
          },
        },
        required: ['expression'],
      },
    },
  },
];

// 测试函数
export async function testAgentLoop() {
  console.log('开始测试 Agent Loop...');

  try {
    const result = await runLoop({
      input: '你好，请告诉我现在几点了，然后帮我计算 15 + 27 的结果',
      apiKey: 'sk-e01d55d672994105998e4a03fa545a9c',
      tools,
      toolSchemas,
      systemPrompt:
        '你是一个有用的AI助手，可以使用工具来帮助用户完成各种任务。',
      maxTurns: 10,
      onTextDelta: (text) => {
        process.stdout.write(text);
      },
      onText: (text) => {
        console.log('\n完整文本:', text);
      },
      onToolUse: async (toolUse) => {
        console.log('\n工具调用:', toolUse);
        return toolUse;
      },
      onToolResult: async (toolUse, toolResult, approved) => {
        console.log('\n工具结果:', {
          toolUse: toolUse.name,
          approved,
          result: toolResult,
        });
        return toolResult;
      },
      onTurn: async (turn) => {
        console.log('\n回合统计:', {
          usage: {
            promptTokens: turn.usage.promptTokens,
            completionTokens: turn.usage.completionTokens,
            totalTokens: turn.usage.totalTokens,
          },
          duration: turn.endTime.getTime() - turn.startTime.getTime(),
        });
      },
    });

    console.log('\n\n=== 测试结果 ===');
    if (result.success) {
      console.log('✅ 测试成功!');
      console.log('最终文本:', result.data?.text);
      console.log('使用统计:', {
        promptTokens: result.data?.usage.promptTokens,
        completionTokens: result.data?.usage.completionTokens,
        totalTokens: result.data?.usage.totalTokens,
      });
      console.log('元数据:', result.metadata);
    } else {
      console.log('❌ 测试失败:', result.error);
    }
  } catch (error) {
    console.error('测试异常:', error);
  }
}

window.testAgentLoop = testAgentLoop;
