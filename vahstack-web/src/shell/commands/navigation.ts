import type {
  ShellCommand,
  ShellCommandContext,
  ShellCommandResult,
} from '../types';

export const cdCommand: ShellCommand = {
  name: 'cd',
  description: 'Change directory',
  usage: 'cd <directory>',
  execute(args: string[], context: ShellCommandContext): ShellCommandResult {
    const { fileSystemManager, currentDirectory } = context;

    const targetDir = args[0] || '/';

    // 处理特殊目录
    let resolvedDir: string;
    if (targetDir === '~' || targetDir === '') {
      resolvedDir = '/';
    } else if (targetDir === '..') {
      const parts = currentDirectory.current.split('/').filter(Boolean);
      parts.pop();
      resolvedDir = '/' + parts.join('/');
    } else if (targetDir === '.') {
      resolvedDir = currentDirectory.current;
    } else {
      resolvedDir = targetDir.startsWith('/')
        ? targetDir
        : `${currentDirectory.current}/${targetDir}`;
    }

    try {
      // 路径规范化
      const normalizedPath =
        resolvedDir.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

      // 检查目录是否存在
      if (fileSystemManager.existsSync(normalizedPath)) {
        return {
          success: true,
          newDirectory: normalizedPath,
          output: `Changed to directory: ${normalizedPath}`,
        };
      } else {
        return {
          success: false,
          error: `cd: '${targetDir}': No such file or directory`,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `cd: ${errorMsg}` };
    }
  },
};

export const rmCommand: ShellCommand = {
  name: 'rm',
  description: 'Remove files or directories',
  usage: 'rm <file_name> or rm -r <directory_name>',
  execute(args: string[], context: ShellCommandContext): ShellCommandResult {
    const { fileSystemManager, currentDirectory } = context;

    if (args.length === 0) {
      return {
        success: false,
        error:
          'rm: missing file or directory name\nUsage: rm <file_name> or rm -r <directory_name>',
      };
    }

    const isRecursive = args[0] === '-r';
    const targetName = isRecursive ? args[1] : args[0];

    if (!targetName) {
      return {
        success: false,
        error: 'rm: missing file or directory name',
      };
    }

    const fullPath = targetName.startsWith('/')
      ? targetName
      : currentDirectory.current === '/'
        ? `/${targetName}`
        : `${currentDirectory.current}/${targetName}`;

    try {
      if (isRecursive) {
        // 对于目录，需要递归删除（简化实现）
        fileSystemManager.deleteFileSync(fullPath);
        return { success: true, output: `Directory '${targetName}' removed` };
      } else {
        fileSystemManager.deleteFileSync(fullPath);
        return { success: true, output: `File '${targetName}' removed` };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `rm: ${errorMsg}` };
    }
  },
};

export const cpCommand: ShellCommand = {
  name: 'cp',
  description: 'Copy files or directories',
  usage: 'cp <source> <destination>',
  execute(args: string[], context: ShellCommandContext): ShellCommandResult {
    const { fileSystemManager, currentDirectory } = context;

    if (args.length < 2) {
      return {
        success: false,
        error:
          'cp: missing source or destination\nUsage: cp <source> <destination>',
      };
    }

    const [source, destination] = args;
    const sourcePath = source.startsWith('/')
      ? source
      : currentDirectory.current === '/'
        ? `/${source}`
        : `${currentDirectory.current}/${source}`;

    const destPath = destination.startsWith('/')
      ? destination
      : currentDirectory.current === '/'
        ? `/${destination}`
        : `${currentDirectory.current}/${destination}`;

    try {
      const content = fileSystemManager.readFileSync(sourcePath);
      fileSystemManager.writeFileSync(destPath, content);
      return {
        success: true,
        output: `Copied '${source}' to '${destination}'`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `cp: ${errorMsg}` };
    }
  },
};

export const mvCommand: ShellCommand = {
  name: 'mv',
  description: 'Move/rename files or directories',
  usage: 'mv <source> <destination>',
  execute(args: string[], context: ShellCommandContext): ShellCommandResult {
    const { fileSystemManager, currentDirectory } = context;

    if (args.length < 2) {
      return {
        success: false,
        error:
          'mv: missing source or destination\nUsage: mv <source> <destination>',
      };
    }

    const [source, destination] = args;
    const sourcePath = source.startsWith('/')
      ? source
      : currentDirectory.current === '/'
        ? `/${source}`
        : `${currentDirectory.current}/${source}`;

    const destPath = destination.startsWith('/')
      ? destination
      : currentDirectory.current === '/'
        ? `/${destination}`
        : `${currentDirectory.current}/${destination}`;

    try {
      // 读取源文件内容
      const content = fileSystemManager.readFileSync(sourcePath);
      // 写入目标位置
      fileSystemManager.writeFileSync(destPath, content);
      // 删除源文件
      fileSystemManager.deleteFileSync(sourcePath);
      return { success: true, output: `Moved '${source}' to '${destination}'` };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `mv: ${errorMsg}` };
    }
  },
};
