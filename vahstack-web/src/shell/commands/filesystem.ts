import type {
  ShellCommand,
  ShellCommandContext,
  ShellCommandResult,
} from '../types';

/**
 * 创建树形显示格式
 *
 * 设计理念：
 * - 清晰的层级结构：使用标准的树形字符
 * - 文件类型区分：目录和文件使用不同的视觉标识
 * - 颜色编码：提升可读性和用户体验
 */
/**
 * 创建文件列表显示格式
 *
 * 设计理念：
 * - 清晰的层级结构：使用标准的树形字符（仅在树形模式下）
 * - 文件类型区分：目录和文件使用不同的视觉标识
 * - 颜色编码：提升可读性和用户体验
 * - 简洁性：默认模式保持简洁，避免不必要的缩进
 */
function formatFileList(
  files: { name: string; isDirectory: boolean }[],
  showTree: boolean = false,
): string {
  if (files.length === 0) {
    return '\x1b[90m(empty directory)\x1b[0m';
  }

  // 排序：目录优先，然后按字母顺序
  const sortedFiles = [...files].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  if (!showTree) {
    // 简单列表格式 - 每行文件名前添加适当的缩进
    return sortedFiles
      .map((file) => {
        if (file.isDirectory) {
          return `\x1b[34m${file.name}/\x1b[0m  `; // 蓝色目录，前面加两个空格缩进
        } else {
          return `\x1b[37m${file.name}\x1b[0m  `; // 白色文件，前面加两个空格缩进
        }
      })
      .join('');
  }

  // 树形格式 - 使用标准的树形字符
  return sortedFiles
    .map((file, index) => {
      const isLast = index === sortedFiles.length - 1;
      const prefix = isLast ? '  └── ' : '  ├── '; // 前面加两个空格缩进

      if (file.isDirectory) {
        return `${prefix}\x1b[34m${file.name}/\x1b[0m`; // 蓝色目录
      } else {
        return `${prefix}\x1b[37m${file.name}\x1b[0m`; // 白色文件
      }
    })
    .join('\n');
}

export const lsCommand: ShellCommand = {
  name: 'ls',
  description: 'List directory contents',
  usage: 'ls [-l] [-t] [directory]',
  execute(args: string[], context: ShellCommandContext): ShellCommandResult {
    const { fileSystemManager, currentDirectory } = context;

    // 解析参数
    let targetDir = currentDirectory.current;
    let showTree = false;
    let longFormat = false;

    for (const arg of args) {
      if (arg === '-t' || arg === '--tree') {
        showTree = true;
      } else if (arg === '-l' || arg === '--long') {
        longFormat = true;
      } else if (!arg.startsWith('-')) {
        // 目录参数
        targetDir = arg.startsWith('/')
          ? arg
          : `${currentDirectory.current}/${arg}`;
      }
    }

    try {
      // 规范化路径
      const normalizedPath =
        targetDir.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

      // 检查目录是否存在
      if (!fileSystemManager.existsSync(normalizedPath)) {
        return {
          success: false,
          error: `ls: cannot access '${targetDir}': No such file or directory`,
        };
      }

      const files = fileSystemManager.listDirectorySync(normalizedPath);

      // 过滤隐藏文件（以.开头的文件，除非明确要求显示）
      const visibleFiles = files.filter(
        (file) => !file.startsWith('.') || file === '.zenfs-initialized',
      );

      // 获取文件类型信息
      const fileInfos = visibleFiles.map((file) => {
        const fullPath =
          normalizedPath === '/' ? `/${file}` : `${normalizedPath}/${file}`;
        let isDirectory = false;

        try {
          // 使用 statSync 来正确判断文件类型
          isDirectory = fileSystemManager.isDirectorySync(fullPath);
        } catch {
          // 如果失败，默认为普通文件
          isDirectory = false;
        }

        return { name: file, isDirectory };
      });

      if (longFormat) {
        // 长格式显示（未来可以添加文件大小、修改时间等信息）
        const output = fileInfos
          .map((file) => {
            const type = file.isDirectory ? 'd' : '-';
            const permissions = 'rwxr-xr-x'; // 简化的权限显示
            const size = file.isDirectory ? '4096' : '1024'; // 简化的大小显示
            const date = new Date().toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            });

            const displayName = file.isDirectory
              ? `\x1b[34m${file.name}/\x1b[0m`
              : `\x1b[37m${file.name}\x1b[0m`;

            return `${type}${permissions} 1 user user ${size.padStart(8)} ${date} ${displayName}`;
          })
          .join('\n');

        return { success: true, output };
      } else {
        // 标准格式
        const output = formatFileList(fileInfos, showTree);
        return { success: true, output };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `ls: ${errorMsg}` };
    }
  },
};

export const mkdirCommand: ShellCommand = {
  name: 'mkdir',
  description: 'Create directory',
  usage: 'mkdir <directory_name>',
  execute(args: string[], context: ShellCommandContext): ShellCommandResult {
    const { fileSystemManager, currentDirectory } = context;

    if (args.length === 0) {
      return {
        success: false,
        error: 'mkdir: missing directory name\nUsage: mkdir <directory_name>',
      };
    }

    const dirName = args[0];
    const fullPath = dirName.startsWith('/')
      ? dirName
      : currentDirectory.current === '/'
        ? `/${dirName}`
        : `${currentDirectory.current}/${dirName}`;

    try {
      fileSystemManager.createDirectorySync(fullPath);
      return { success: true, output: `Directory '${dirName}' created` };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `mkdir: ${errorMsg}` };
    }
  },
};

export const touchCommand: ShellCommand = {
  name: 'touch',
  description: 'Create empty file',
  usage: 'touch <file_name>',
  execute(args: string[], context: ShellCommandContext): ShellCommandResult {
    const { fileSystemManager, currentDirectory } = context;

    if (args.length === 0) {
      return {
        success: false,
        error: 'touch: missing file name\nUsage: touch <file_name>',
      };
    }

    const fileName = args[0];
    const fullPath = fileName.startsWith('/')
      ? fileName
      : currentDirectory.current === '/'
        ? `/${fileName}`
        : `${currentDirectory.current}/${fileName}`;

    try {
      fileSystemManager.writeFileSync(fullPath, '');
      return { success: true, output: `File '${fileName}' created` };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `touch: ${errorMsg}` };
    }
  },
};

export const catCommand: ShellCommand = {
  name: 'cat',
  description: 'Display file contents',
  usage: 'cat <file_name>',
  execute(args: string[], context: ShellCommandContext): ShellCommandResult {
    const { fileSystemManager, currentDirectory } = context;

    if (args.length === 0) {
      return {
        success: false,
        error: 'cat: missing file name\nUsage: cat <file_name>',
      };
    }

    const fileName = args[0];
    const fullPath = fileName.startsWith('/')
      ? fileName
      : currentDirectory.current === '/'
        ? `/${fileName}`
        : `${currentDirectory.current}/${fileName}`;

    try {
      const content = fileSystemManager.readFileSync(fullPath);
      return { success: true, output: content };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `cat: ${errorMsg}` };
    }
  },
};

export const echoCommand: ShellCommand = {
  name: 'echo',
  description: 'Display text',
  usage: 'echo <text> [> file]',
  execute(args: string[], context: ShellCommandContext): ShellCommandResult {
    const { fileSystemManager, currentDirectory } = context;

    if (args.length === 0) {
      return { success: true, output: '' };
    }

    // 检查是否有重定向
    const redirectIndex = args.indexOf('>');
    if (redirectIndex !== -1 && redirectIndex < args.length - 1) {
      const text = args.slice(0, redirectIndex).join(' ');
      const fileName = args[redirectIndex + 1];
      const fullPath = fileName.startsWith('/')
        ? fileName
        : currentDirectory.current === '/'
          ? `/${fileName}`
          : `${currentDirectory.current}/${fileName}`;

      try {
        fileSystemManager.writeFileSync(fullPath, text + '\n');
        return { success: true, output: `Text written to '${fileName}'` };
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: `echo: ${errorMsg}` };
      }
    } else {
      // 普通输出
      const text = args.join(' ');
      return { success: true, output: text };
    }
  },
};
