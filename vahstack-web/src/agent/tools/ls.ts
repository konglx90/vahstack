import { fileSystemManager } from '../../utils/fileSystem';
import { z } from 'zod';

// Browser-compatible path utilities
const pathUtils = {
  isAbsolute: (path: string) => {
    if (!path || typeof path !== 'string') return false;
    return path.startsWith('/') || /^[a-zA-Z]:/.test(path);
  },
  basename: (path: string) => {
    if (!path || typeof path !== 'string') path = '/';
    const parts = path.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart) return lastPart;
  },
  relative: (from: string, to: string) => {
    if (!from || typeof from !== 'string') from = '/';
    if (!to || typeof to !== 'string') to = '/';
    // Simple relative path calculation for browser compatibility
    if (to.startsWith(from)) {
      return to.slice(from.length).replace(/^\//, '') || '.';
    }
    return to;
  },
  resolve: (base: string, relative: string) => {
    if (!base || typeof base !== 'string') base = '/';
    if (!relative || typeof relative !== 'string') relative = '/';
    if (pathUtils.isAbsolute(relative)) {
      return relative;
    }
    return base.endsWith('/') ? base + relative : base + '/' + relative;
  },
  join: (...paths: string[]) => {
    const validPaths = paths.filter((p) => p && typeof p === 'string');
    if (validPaths.length === 0) return '/';
    return validPaths.join('/').replace(/\/+/g, '/');
  },
  sep: '/',
};

const MAX_FILES = 1000;
const TRUNCATED_MESSAGE = `There are more than ${MAX_FILES} files in the repository. Use the LS tool (passing a specific path), Bash tool, and other tools to explore nested directories. The first ${MAX_FILES} files and directories are included below:\n\n`;

type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
};

function skip(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false;

  const basename = pathUtils.basename(filePath);
  if (filePath !== '.' && basename && basename.startsWith('.')) {
    return true;
  }
  return false;
}

function isIgnored(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false;

  const basename = pathUtils.basename(filePath);
  // Basic ignore patterns
  const ignorePatterns = [
    'node_modules',
    '.git',
    '.DS_Store',
    '*.log',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'coverage',
    '.nyc_output',
    '.cache',
    'tmp',
    'temp',
  ];

  return ignorePatterns.some((pattern) => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      if (!basename) return false;
      return regex.test(basename);
    }
    return basename === pattern;
  });
}

function listDirectory(
  initialPath: string,
  cwd: string,
  maxFiles: number = MAX_FILES,
): string[] {
  const results: string[] = [];
  const queue: string[] = [initialPath];

  while (queue.length > 0 && results.length < maxFiles) {
    const currentPath = queue.shift()!;

    try {
      if (!fileSystemManager.existsSync(currentPath)) {
        continue;
      }

      const children = fileSystemManager.listDirectorySync(currentPath);

      for (const child of children) {
        if (results.length >= maxFiles) break;

        const childPath = pathUtils.join(currentPath, child);

        if (skip(childPath) || isIgnored(childPath)) {
          continue;
        }

        try {
          const isDirectory = fileSystemManager.isDirectorySync(childPath);

          if (isDirectory) {
            queue.push(childPath + pathUtils.sep);
          }

          // Add relative path to results
          results.push(pathUtils.relative(cwd, childPath));
        } catch {
          // Skip files that can't be accessed
          continue;
        }
      }
    } catch {
      // Skip directories that can't be read
      continue;
    }
  }

  return results;
}

function createFileTree(sortedPaths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  const pathMap = new Map<string, TreeNode>();

  for (const filePath of sortedPaths) {
    const parts = filePath.split(pathUtils.sep);
    let currentPath = '';
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      currentPath = currentPath
        ? `${currentPath}${pathUtils.sep}${part}`
        : part;

      let node = pathMap.get(currentPath);
      if (!node) {
        node = {
          name: part,
          path: currentPath,
          type: i === parts.length - 1 ? 'file' : 'directory',
          children: [],
        };
        pathMap.set(currentPath, node);
        currentLevel.push(node);
      }

      if (node.children) {
        currentLevel = node.children;
      }
    }
  }

  return root;
}

function printTree(
  cwd: string,
  tree: TreeNode[],
  level = 0,
  prefix = '',
): string {
  let result = '';

  if (level === 0) {
    result += `- ${cwd}${pathUtils.sep}\n`;
  }

  for (let i = 0; i < tree.length; i++) {
    const node = tree[i];
    result += `${prefix}${'-'} ${node.name}${node.type === 'directory' ? pathUtils.sep : ''}\n`;

    if (node.children && node.children.length > 0) {
      result += printTree(cwd, node.children, level + 1, prefix + '  ');
    }
  }

  return result;
}

export function createLSTool(opts: { cwd: string; productName: string }) {
  return {
    name: 'ls',
    description: 'Lists files and directories in a given path.',
    parameters: z.object({
      dir_path: z
        .string()
        .optional()
        .describe(
          'The directory path to list. Defaults to current directory if not provided.',
        ),
    }),
    getDescription: ({ params }: { params: { dir_path?: string } }) => {
      if (!params.dir_path || typeof params.dir_path !== 'string') {
        return '.';
      }
      return pathUtils.relative(opts.cwd, params.dir_path);
    },
    execute: async (params: { dir_path: string }) => {
      const { dir_path } = params;
      const fullFilePath = pathUtils.isAbsolute(dir_path)
        ? dir_path
        : pathUtils.resolve(opts.cwd, dir_path);

      const result = listDirectory(fullFilePath, opts.cwd).sort();
      console.log(pathUtils.isAbsolute(dir_path), fullFilePath);
      console.log(result);
      const tree = createFileTree(result);
      const userTree = printTree(opts.cwd, tree);

      if (result.length < MAX_FILES) {
        return {
          returnDisplay: `Listed ${result.length} files/directories`,
          llmContent: userTree,
        };
      } else {
        return {
          returnDisplay: `Listed first ${MAX_FILES} files/directories (truncated)`,
          llmContent: TRUNCATED_MESSAGE + userTree,
        };
      }
    },
  };
}
