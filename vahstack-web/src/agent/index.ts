import { runLoop, type RunLoopOptions, type LoopResult } from './loop';
import { createBashTool } from './tools/bash';
// import { createFetchTool } from './tools/fetch';
import { createGlobTool } from './tools/glob';
import { createTodoTool } from './tools/todo';
import { createLSTool } from './tools/ls';
import { createReadTool } from './tools/read';
import type { ToolResult, TodoItem } from '../types';

// Export main functions
export { runLoop };
export type { RunLoopOptions, LoopResult, ToolResult };

// Create tool instances with default configuration
const cwd = '/';
const productName = 'vahstack-next';

const bashTool = createBashTool();
// const fetchTool = createFetchTool();
const globTool = createGlobTool();
const todoTools = createTodoTool({ filePath: `${cwd}/.todos.json` });
const lsToolNew = createLSTool({ cwd, productName });
const readTool = createReadTool();

// Available tools registry
export const availableTools = {
  bash: bashTool,
  // fetch: fetchTool,
  glob: globTool,
  todoWrite: todoTools.todoWriteTool,
  todoRead: todoTools.todoReadTool,
  ls: lsToolNew,
  read: readTool,
};

console.log('readTool.parameters', readTool.parameters);

// Tool schemas for DeepSeek API
export const toolSchemas = [
  {
    type: 'function' as const,
    function: {
      name: bashTool.name,
      description: bashTool.description,
      parameters: bashTool.parameters,
    },
  },
  // {
  //   type: 'function' as const,
  //   function: {
  //     name: fetchTool.name,
  //     description: fetchTool.description,
  //     parameters: fetchTool.parameters
  //   }
  // },
  {
    type: 'function' as const,
    function: {
      name: globTool.name,
      description: globTool.description,
      parameters: globTool.parameters,
    },
  },
  {
    type: 'function' as const,
    function: {
      name: todoTools.todoWriteTool.name,
      description: todoTools.todoWriteTool.description,
      parameters: todoTools.todoWriteTool.parameters,
    },
  },
  {
    type: 'function' as const,
    function: {
      name: todoTools.todoReadTool.name,
      description: todoTools.todoReadTool.description,
      parameters: todoTools.todoReadTool.parameters,
    },
  },
  {
    type: 'function' as const,
    function: {
      name: lsToolNew.name,
      description: lsToolNew.description,
      parameters: lsToolNew.parameters,
    },
  },
  {
    type: 'function' as const,
    function: {
      name: readTool.name,
      description: readTool.description,
      parameters: readTool.parameters,
    },
  },
];

// Example usage function
export async function createAgentWithTools(apiKey: string) {
  const tools = {
    bash: async (params: Record<string, unknown>): Promise<ToolResult> => {
      console.log('🔧 [BASH] 执行参数:', params);
      const result = await bashTool.execute(
        params as { command: string; timeout?: number },
      );
      console.log('✅ [BASH] 执行结果:', result);
      return result;
    },
    // fetch: async (params: Record<string, unknown>): Promise<ToolResult> => {
    //   console.log('🌐 [FETCH] 执行参数:', params);
    //   const result = await fetchTool.execute(params as { url: string; prompt: string });
    //   console.log('✅ [FETCH] 执行结果:', result);
    //   return result;
    // },
    glob: async (params: Record<string, unknown>): Promise<ToolResult> => {
      console.log('🔍 [GLOB] 执行参数:', params);
      const result = await globTool.execute(
        params as { pattern: string; path?: string },
      );
      console.log('✅ [GLOB] 执行结果:', result);
      return result;
    },
    todoWrite: async (params: Record<string, unknown>): Promise<ToolResult> => {
      console.log('📝 [TODO_WRITE] 执行参数:', params);
      const result = await todoTools.todoWriteTool.execute(
        params as { todos: TodoItem[] },
      );
      console.log('✅ [TODO_WRITE] 执行结果:', result);
      return result;
    },
    todoRead: async (): Promise<ToolResult> => {
      console.log('📖 [TODO_READ] 执行参数: 无参数');
      const result = await todoTools.todoReadTool.execute();
      console.log('✅ [TODO_READ] 执行结果:', result);
      return result;
    },
    ls: async (params: Record<string, unknown>): Promise<ToolResult> => {
      console.log('📁 [LS] 执行参数:', params);
      const result = await lsToolNew.execute(params as { dir_path: string });
      console.log('✅ [LS] 执行结果:', result);
      return result;
    },
    read: async (params: Record<string, unknown>): Promise<ToolResult> => {
      console.log('📖 [READ] 执行参数:', params);
      const result = await readTool.execute(
        params as {
          file_path: string;
          offset?: number | null;
          limit?: number | null;
        },
      );
      console.log('✅ [READ] 执行结果:', result);
      return result;
    },
  };

  return {
    runLoop: (input: string, options?: Partial<RunLoopOptions>) => {
      return runLoop({
        input,
        apiKey,
        tools,
        ...options,
      });
    },
    tools,
    schemas: toolSchemas,
  };
}

// Example usage with the provided API key
export const defaultAgent = createAgentWithTools(
  'sk-e01d55d672994105998e4a03fa545a9c',
);
