// 项目核心类型定义

export interface FileSystemConfig {
  type: 'memory' | 'indexeddb' | 'localstorage';
  name?: string;
}

export interface TerminalConfig {
  theme?: {
    background?: string;
    foreground?: string;
    cursor?: string;
  };
  fontSize?: number;
  fontFamily?: string;
  rows?: number;
  cols?: number;
}

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
}

export interface ShellCommand {
  command: string;
  args: string[];
  cwd: string;
}

export interface VahStackConfig {
  fileSystem: FileSystemConfig;
  terminal: TerminalConfig;
  enableShellJS: boolean;
  enableFileOperations: boolean;
}

export interface ToolResult {
  llmContent?: string;
  returnDisplay?: string | unknown;
  isError?: boolean;
}

export interface ToolUse {
  id: string;
  name: string;
  params: Record<string, unknown>;
}

export type TodoItem = {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
};
