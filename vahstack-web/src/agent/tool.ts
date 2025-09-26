import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ToolResult } from '../types';

// 导入浏览器端工具
import { createReadTool } from './tools/read';
import { createWriteTool } from './tools/write';
import { createEditTool } from './tools/edit';
import { createLSTool } from './tools/ls';
import { createGlobTool } from './tools/glob';
import { createGrepTool } from './tools/grep';
import { createBashTool } from './tools/bash';
import { createFetchTool } from './tools/fetch';
import { createTodoTool } from './tools/todo';

// 浏览器端上下文类型
export interface BrowserContext {
  cwd: string;
  productName: string;
  enableWrite?: boolean;
  enableTodo?: boolean;
  sessionId?: string;
}

// 工具选项类型
type ResolveToolsOpts = {
  context: BrowserContext;
  sessionId?: string;
  write?: boolean;
  todo?: boolean;
};

// 工具使用类型
export type ToolUse = {
  name: string;
  params: Record<string, unknown>;
  callId: string;
};

export type ToolUseResult = {
  toolUse: ToolUse;
  result: unknown;
  approved: boolean;
};

// 审批相关类型
type ApprovalContext = {
  toolName: string;
  params: Record<string, unknown>;
  approvalMode: string;
  context: unknown;
};

export type ApprovalCategory = 'read' | 'write' | 'command' | 'network';

type ToolApprovalInfo = {
  needsApproval?: (context: ApprovalContext) => Promise<boolean> | boolean;
  category?: ApprovalCategory;
};

// 工具接口
export interface Tool<T = unknown> {
  name: string;
  description: string;
  getDescription?: ({ params, cwd }: { params: T; cwd: string }) => string;
  displayName?: string;
  execute: (params: T) => Promise<ToolResult> | ToolResult;
  approval?: ToolApprovalInfo;
  parameters: z.ZodSchema<T>;
}

// 解析工具函数
export async function resolveTools(opts: ResolveToolsOpts): Promise<Tool[]> {
  const { context } = opts;

  // 只读工具
  const readonlyTools = [
    createReadTool(),
    createLSTool({ cwd: context.cwd, productName: context.productName }),
    createGlobTool(),
    createGrepTool(),
    createFetchTool(),
  ];

  // 写入工具（如果启用）
  const writeTools = opts.write
    ? [createWriteTool(), createEditTool(), createBashTool()]
    : [];

  // Todo 工具（如果启用）
  const todoTools = (() => {
    if (!opts.todo || !opts.sessionId) return [];
    const { todoWriteTool, todoReadTool } = createTodoTool({
      filePath: `/todos/${opts.sessionId}.json`,
    });
    return [todoReadTool, todoWriteTool];
  })();

  return [...readonlyTools, ...writeTools, ...todoTools] as Tool[];
}

// 工具管理类
export class Tools {
  tools: Record<string, Tool>;

  constructor(tools: Tool[]) {
    this.tools = tools.reduce(
      (acc, tool) => {
        acc[tool.name] = tool;
        return acc;
      },
      {} as Record<string, Tool>,
    );
  }

  get(toolName: string): Tool | undefined {
    return this.tools[toolName];
  }

  length(): number {
    return Object.keys(this.tools).length;
  }

  async invoke(toolName: string, args: string): Promise<ToolResult> {
    const tool = this.tools[toolName];
    if (!tool) {
      return {
        llmContent: `Tool ${toolName} not found`,
        isError: true,
      };
    }

    // 验证工具参数
    const result = validateToolParams(tool.parameters, args);
    if (!result.success) {
      return {
        llmContent: `Invalid tool parameters: ${result.error}`,
        isError: true,
      };
    }

    let argsObj: unknown;
    try {
      argsObj = JSON.parse(args);
    } catch (error) {
      return {
        llmContent: `Invalid tool parameters: ${error}`,
        isError: true,
      };
    }

    return await tool.execute(argsObj);
  }

  getToolsPrompt(): string {
    const availableTools = `
  ${Object.entries(this.tools)
    .map(([key, tool]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schema = zodToJsonSchema(tool.parameters as any);
      return `
<tool>
<name>${key}</name>
<description>${tool.description}</description>
<input_json_schema>${JSON.stringify(schema)}</input_json_schema>
</tool>
  `.trim();
    })
    .join('\n')}
  `;

    return `
# TOOLS

You only have access to the tools provided below. You can only use one tool per message, and will receive the result of that tool use in the user's response. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.

## Tool Use Formatting

**CRITICAL: Always close all XML tags properly.**
**CRITICAL: Ensure valid JSON in arguments with proper escaping.**

Tool use is formatted using XML-style tags. The tool use is enclosed in <use_tool></use_tool> and Parameters are enclosed within <arguments></arguments> tags as valid JSON.

Description: Tools have defined input schemas that specify required and optional parameters.

Parameters:
- tool_name: (required) The name of the tool to execute
- arguments: (required) A JSON object containing the tool's input parameters, following the tool's input schema, quotes within string must be properly escaped, ensure it's valid JSON

Usage:
<use_tool>
  <tool_name>tool name here</tool_name>
  <arguments>
    {"param1": "value1","param2": "value2 \\"escaped string\\""}
  </arguments>
</use_tool>

When using tools, the tool use must be placed at the end of your response, top level, and not nested within other tags. Do not call tools when you don't have enough information.

Always adhere to this format for the tool use to ensure proper parsing and execution.

**Before submitting: Double-check that every < has a matching > and every <tag> has a </tag>**

## Available Tools

${availableTools}
    `;
  }
}

// 参数验证函数
function validateToolParams(schema: z.ZodSchema<unknown>, params: string) {
  try {
    const parsedParams = JSON.parse(params);
    const result = schema.safeParse(parsedParams);
    if (!result.success) {
      return {
        success: false,
        error: `Parameter validation failed: ${result.error.message}`,
      };
    }
    return {
      success: true,
      message: 'Tool parameters validated successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error,
    };
  }
}

// 创建工具的辅助函数
export function createTool<TSchema extends z.ZodTypeAny>(config: {
  name: string;
  description: string;
  parameters: TSchema;
  execute: (params: z.infer<TSchema>) => Promise<ToolResult> | ToolResult;
  approval?: ToolApprovalInfo;
  getDescription?: ({
    params,
    cwd,
  }: {
    params: z.infer<TSchema>;
    cwd: string;
  }) => string;
}): Tool<z.infer<TSchema>> {
  return {
    name: config.name,
    description: config.description,
    getDescription: config.getDescription,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parameters: config.parameters as any,
    execute: config.execute,
    approval: config.approval,
  };
}
