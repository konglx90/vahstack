import type {
  ShellCommand,
  ShellCommandContext,
  ShellCommandResult,
} from '../types';

export const grepCommand: ShellCommand = {
  name: 'grep',
  description: 'Search text in files',
  usage: 'grep <pattern> <file>',
  execute(args: string[], context: ShellCommandContext): ShellCommandResult {
    const { fileSystemManager, currentDirectory } = context;

    if (args.length < 2) {
      return {
        success: false,
        error: 'grep: missing pattern or file\nUsage: grep <pattern> <file>',
      };
    }

    const pattern = args[0];
    const fileName = args[1];

    try {
      const filePath = fileName.startsWith('/')
        ? fileName
        : `${currentDirectory.current}/${fileName}`;

      const content = fileSystemManager.readFileSync(filePath);
      const lines = content.split('\n');
      const matches = lines.filter((line) => line.includes(pattern));

      if (matches.length === 0) {
        return { success: true, output: `No matches found for '${pattern}'` };
      } else {
        const output =
          matches
            .map((match) => {
              const highlighted = match.replace(
                new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                `\x1b[31m${pattern}\x1b[0m`,
              );
              return highlighted;
            })
            .join('\n') + `\n\x1b[32mFound ${matches.length} match(es)\x1b[0m`;

        return { success: true, output };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `grep: ${errorMsg}` };
    }
  },
};

export const findCommand: ShellCommand = {
  name: 'find',
  description: 'Find files and directories',
  usage: 'find <path> [-name pattern]',
  execute(args: string[], context: ShellCommandContext): ShellCommandResult {
    const { fileSystemManager, currentDirectory } = context;

    if (args.length === 0) {
      return {
        success: false,
        error: 'find: missing path\nUsage: find <path> [-name pattern]',
      };
    }

    const searchPath = args[0] === '.' ? currentDirectory.current : args[0];
    let pattern = '*';

    // 解析 -name 参数
    const nameIndex = args.indexOf('-name');
    if (nameIndex !== -1 && nameIndex < args.length - 1) {
      pattern = args[nameIndex + 1];
    }

    try {
      const findFiles = (dir: string, depth = 0): string[] => {
        if (depth > 10) return []; // 防止无限递归

        const results: string[] = [];
        try {
          const files = fileSystemManager.listDirectorySync(dir);

          for (const file of files) {
            const fullPath = `${dir}/${file}`.replace(/\/+/g, '/');

            // 简单的模式匹配
            if (pattern === '*' || file.includes(pattern.replace(/\*/g, ''))) {
              results.push(fullPath);
            }

            // 如果是目录，递归搜索
            if (file.endsWith('/')) {
              const subResults = findFiles(fullPath.slice(0, -1), depth + 1);
              results.push(...subResults);
            }
          }
        } catch {
          // 忽略无法访问的目录
        }

        return results;
      };

      const results = findFiles(searchPath);

      if (results.length === 0) {
        return { success: true, output: 'No files found' };
      } else {
        return { success: true, output: results.join('\n') };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `find: ${errorMsg}` };
    }
  },
};

export const wcCommand: ShellCommand = {
  name: 'wc',
  description: 'Count lines, words, characters',
  usage: 'wc [-l|-w|-c] <file>',
  execute(args: string[], context: ShellCommandContext): ShellCommandResult {
    const { fileSystemManager, currentDirectory } = context;

    if (args.length === 0) {
      return {
        success: false,
        error: 'wc: missing file\nUsage: wc [-l|-w|-c] <file>',
      };
    }

    let option = '';
    let fileName = args[0];

    // 检查选项
    if (args[0].startsWith('-')) {
      option = args[0];
      fileName = args[1];
      if (!fileName) {
        return {
          success: false,
          error: 'wc: missing file name',
        };
      }
    }

    try {
      const filePath = fileName.startsWith('/')
        ? fileName
        : `${currentDirectory.current}/${fileName}`;
      const content = fileSystemManager.readFileSync(filePath);

      const lines =
        content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
      const words = content
        .split(/\s+/)
        .filter((word) => word.length > 0).length;
      const chars = content.length;

      let output = '';
      switch (option) {
        case '-l':
          output = `${lines} ${fileName}`;
          break;
        case '-w':
          output = `${words} ${fileName}`;
          break;
        case '-c':
          output = `${chars} ${fileName}`;
          break;
        default:
          output = `${lines} ${words} ${chars} ${fileName}`;
      }

      return { success: true, output };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `wc: ${errorMsg}` };
    }
  },
};

export const headCommand: ShellCommand = {
  name: 'head',
  description: 'Display first lines of file',
  usage: 'head [-n number] <file>',
  execute(args: string[], context: ShellCommandContext): ShellCommandResult {
    const { fileSystemManager, currentDirectory } = context;

    if (args.length === 0) {
      return {
        success: false,
        error: 'head: missing file\nUsage: head [-n number] <file>',
      };
    }

    let numLines = 10; // 默认显示前10行
    let fileName = args[0];

    // 检查 -n 选项
    if (args[0] === '-n' && args.length >= 3) {
      numLines = parseInt(args[1], 10);
      fileName = args[2];
      if (isNaN(numLines) || numLines < 0) {
        return {
          success: false,
          error: 'head: invalid number of lines',
        };
      }
    }

    try {
      const filePath = fileName.startsWith('/')
        ? fileName
        : `${currentDirectory.current}/${fileName}`;
      const content = fileSystemManager.readFileSync(filePath);
      const lines = content.split('\n');
      const output = lines.slice(0, numLines).join('\n');

      return { success: true, output };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `head: ${errorMsg}` };
    }
  },
};

export const tailCommand: ShellCommand = {
  name: 'tail',
  description: 'Display last lines of file',
  usage: 'tail [-n number] <file>',
  execute(args: string[], context: ShellCommandContext): ShellCommandResult {
    const { fileSystemManager, currentDirectory } = context;

    if (args.length === 0) {
      return {
        success: false,
        error: 'tail: missing file\nUsage: tail [-n number] <file>',
      };
    }

    let numLines = 10; // 默认显示最后10行
    let fileName = args[0];

    // 检查 -n 选项
    if (args[0] === '-n' && args.length >= 3) {
      numLines = parseInt(args[1], 10);
      fileName = args[2];
      if (isNaN(numLines) || numLines < 0) {
        return {
          success: false,
          error: 'tail: invalid number of lines',
        };
      }
    }

    try {
      const filePath = fileName.startsWith('/')
        ? fileName
        : `${currentDirectory.current}/${fileName}`;
      const content = fileSystemManager.readFileSync(filePath);
      const lines = content.split('\n');
      const output = lines.slice(-numLines).join('\n');

      return { success: true, output };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `tail: ${errorMsg}` };
    }
  },
};
