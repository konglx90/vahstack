// 导出类型
export type {
  ShellCommand,
  ShellCommandContext,
  ShellCommandResult,
  ShellCommandRegistry,
} from './types';

// 导出注册器
export { CommandRegistry, shellRegistry } from './registry';

// 导出所有命令
export { helpCommand, clearCommand, pwdCommand } from './commands/basic';
export {
  lsCommand,
  mkdirCommand,
  touchCommand,
  catCommand,
  echoCommand,
} from './commands/filesystem';
export {
  cdCommand,
  rmCommand,
  cpCommand,
  mvCommand,
} from './commands/navigation';
export {
  grepCommand,
  findCommand,
  wcCommand,
  headCommand,
  tailCommand,
} from './commands/analysis';

// 注册所有默认命令
import { shellRegistry } from './registry';
import { helpCommand, clearCommand, pwdCommand } from './commands/basic';
import {
  lsCommand,
  mkdirCommand,
  touchCommand,
  catCommand,
  echoCommand,
} from './commands/filesystem';
import {
  cdCommand,
  rmCommand,
  cpCommand,
  mvCommand,
} from './commands/navigation';
import {
  grepCommand,
  findCommand,
  wcCommand,
  headCommand,
  tailCommand,
} from './commands/analysis';
import type { ShellCommandResult } from './types';
import { Terminal } from '@xterm/xterm';
import { FileSystemManager } from '../utils/fileSystem';
import { removeANSIEscape } from '../utils/removeANSIescape';

// 自动注册所有命令
const defaultCommands = [
  // 基础命令
  helpCommand,
  clearCommand,
  pwdCommand,
  // 文件系统命令
  lsCommand,
  mkdirCommand,
  touchCommand,
  catCommand,
  echoCommand,
  // 导航命令
  cdCommand,
  rmCommand,
  cpCommand,
  mvCommand,
  // 分析命令
  grepCommand,
  findCommand,
  wcCommand,
  headCommand,
  tailCommand,
];

defaultCommands.forEach((command) => {
  shellRegistry.register(command);
});

// 将shell系统挂载到全局window.shx
declare global {
  interface Window {
    shx: {
      registry: typeof shellRegistry;
      commands: {
        basic: {
          helpCommand: typeof helpCommand;
          clearCommand: typeof clearCommand;
          pwdCommand: typeof pwdCommand;
        };
        filesystem: {
          lsCommand: typeof lsCommand;
          mkdirCommand: typeof mkdirCommand;
          touchCommand: typeof touchCommand;
          catCommand: typeof catCommand;
          echoCommand: typeof echoCommand;
        };
        navigation: {
          cdCommand: typeof cdCommand;
          rmCommand: typeof rmCommand;
          cpCommand: typeof cpCommand;
          mvCommand: typeof mvCommand;
        };
        analysis: {
          grepCommand: typeof grepCommand;
          findCommand: typeof findCommand;
          wcCommand: typeof wcCommand;
          headCommand: typeof headCommand;
          tailCommand: typeof tailCommand;
        };
      };
    };
    shxc: {
      // 基础命令别名
      help: (...args: string[]) => ShellCommandResult;
      clear: (...args: string[]) => ShellCommandResult;
      pwd: (...args: string[]) => ShellCommandResult;

      // 文件系统命令别名
      ls: (...args: string[]) => ShellCommandResult;
      mkdir: (...args: string[]) => ShellCommandResult;
      touch: (...args: string[]) => ShellCommandResult;
      cat: (...args: string[]) => ShellCommandResult;
      echo: (...args: string[]) => ShellCommandResult;

      // 导航命令别名
      cd: (...args: string[]) => ShellCommandResult;
      rm: (...args: string[]) => ShellCommandResult;
      cp: (...args: string[]) => ShellCommandResult;
      mv: (...args: string[]) => ShellCommandResult;

      // 分析命令别名
      grep: (...args: string[]) => ShellCommandResult;
      find: (...args: string[]) => ShellCommandResult;
      wc: (...args: string[]) => ShellCommandResult;
      head: (...args: string[]) => ShellCommandResult;
      tail: (...args: string[]) => ShellCommandResult;
    };
  }
}

if (typeof window !== 'undefined') {
  // 创建通用的同步命令执行器
  const createSyncExecutor = (commandName: string) => {
    return (...args: string[]): ShellCommandResult => {
      const command = shellRegistry.get(commandName);
      if (!command) {
        return {
          success: false,
          output: '',
          error: `Command '${commandName}' not found`,
          newDirectory: '/',
        };
      }

      try {
        const result = command.execute(args, {
          args,
          currentDirectory: { current: '/' },
          fileSystemManager: new FileSystemManager({ type: 'memory' }),
          terminal: new Terminal(),
        });

        return {
          ...result,
          output: removeANSIEscape(result.output || ''),
        };
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          output: '',
          error: errorMsg,
          newDirectory: '/',
        };
      }
    };
  };

  // 挂载shell系统到全局window对象
  window.shx = {
    registry: shellRegistry,
    commands: {
      basic: {
        helpCommand,
        clearCommand,
        pwdCommand,
      },
      filesystem: {
        lsCommand,
        mkdirCommand,
        touchCommand,
        catCommand,
        echoCommand,
      },
      navigation: {
        cdCommand,
        rmCommand,
        cpCommand,
        mvCommand,
      },
      analysis: {
        grepCommand,
        findCommand,
        wcCommand,
        headCommand,
        tailCommand,
      },
    },
  };

  // 创建简化的命令别名，直接返回结果
  window.shxc = {
    // 基础命令别名
    help: createSyncExecutor('help'),
    clear: createSyncExecutor('clear'),
    pwd: createSyncExecutor('pwd'),

    // 文件系统命令别名
    ls: createSyncExecutor('ls'),
    mkdir: createSyncExecutor('mkdir'),
    touch: createSyncExecutor('touch'),
    cat: createSyncExecutor('cat'),
    echo: createSyncExecutor('echo'),

    // 导航命令别名
    cd: createSyncExecutor('cd'),
    rm: createSyncExecutor('rm'),
    cp: createSyncExecutor('cp'),
    mv: createSyncExecutor('mv'),

    // 分析命令别名
    grep: createSyncExecutor('grep'),
    find: createSyncExecutor('find'),
    wc: createSyncExecutor('wc'),
    head: createSyncExecutor('head'),
    tail: createSyncExecutor('tail'),
  };
}
