import { Terminal } from '@xterm/xterm';
import { FileSystemManager } from '../utils/fileSystem';

export interface ShellCommandContext {
  terminal: Terminal;
  fileSystemManager: FileSystemManager;
  currentDirectory: { current: string };
  args: string[];
}

export interface ShellCommandResult {
  success: boolean;
  output?: string;
  error?: string;
  newDirectory?: string;
}

export interface ShellCommand {
  name: string;
  description: string;
  usage: string;
  execute: (args: string[], context: ShellCommandContext) => ShellCommandResult;
}

export interface ShellCommandRegistry {
  register: (command: ShellCommand) => void;
  unregister: (name: string) => void;
  get: (name: string) => ShellCommand | undefined;
  getAll: () => ShellCommand[];
  execute: (
    commandName: string,
    context: ShellCommandContext,
  ) => ShellCommandResult;
}
