import { z } from 'zod';
import { shellRegistry } from '../../shell';
import { FileSystemManager } from '../../utils/fileSystem';
import { Terminal } from '@xterm/xterm';
import type { ShellCommandContext } from '../../shell/types';

const DEFAULT_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_TIMEOUT = 10 * 60 * 1000; // 10 minutes

/**
 * Truncate output by line count, showing maximum 5 lines
 */
function truncateOutput(output: string, maxLines: number = 5): string {
  const lines = output.split('\n');

  if (lines.length <= maxLines) {
    return output;
  }

  const visibleLines = lines.slice(0, maxLines);
  const remainingCount = lines.length - maxLines;

  return visibleLines.join('\n') + `\n… +${remainingCount} lines`;
}

function getCommandRoot(command: string): string | undefined {
  return command
    .trim()
    .replace(/[{}()]/g, '')
    .split(/[\s;&|]+/)[0]
    ?.split(/[/\\]/)
    .pop();
}

function isAllowedCommand(command: string): boolean {
  const commandRoot = getCommandRoot(command);
  if (!commandRoot) {
    return false;
  }

  // 检查命令是否在 shell 注册表中
  const shellCommand = shellRegistry.get(commandRoot.toLowerCase());
  return shellCommand !== undefined;
}

function isHighRiskCommand(command: string): boolean {
  const highRiskPatterns = [
    /rm\s+.*(-rf|--recursive)/i,
    /sudo/i,
    /curl.*\|.*sh/i,
    /wget.*\|.*sh/i,
    /dd\s+if=/i,
    /mkfs/i,
    /fdisk/i,
    /format/i,
    /del\s+.*\/[qs]/i,
  ];

  // Check for command substitution
  if (command.includes('$(') || command.includes('`')) {
    return true;
  }

  return highRiskPatterns.some((pattern) => pattern.test(command));
}

function validateCommand(command: string): string | null {
  if (!command.trim()) {
    return 'Command cannot be empty.';
  }

  const commandRoot = getCommandRoot(command);
  if (!commandRoot) {
    return 'Could not identify command root.';
  }

  // Check for command substitution
  if (command.includes('$(') || command.includes('`')) {
    return 'Command substitution is not allowed for security reasons.';
  }

  // 检查命令是否在白名单中
  if (!isAllowedCommand(command)) {
    const availableCommands = shellRegistry
      .getAll()
      .map((cmd) => cmd.name)
      .join(', ');
    return `Command '${commandRoot}' is not allowed. Available commands: ${availableCommands}`;
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function executeCommand(
  command: string,
  _timeout: number,
): Promise<{
  llmContent: string;
  returnDisplay?: string;
  isError?: boolean;
}> {
  const validationError = validateCommand(command);
  if (validationError) {
    return {
      isError: true,
      llmContent: validationError,
    };
  }

  try {
    // Parse command and arguments
    const [commandName, ...args] = command.trim().split(/\s+/);

    // Create a mock terminal for command execution
    const mockTerminal = {
      writeln: () => {},
      write: () => {},
    } as unknown as Terminal;

    // Create a file system manager instance
    const fileSystemManager = new FileSystemManager({
      type: 'memory',
      name: 'bash-tool',
    });
    await fileSystemManager.initialize();

    // Set up basic directory structure
    try {
      await fileSystemManager.createDirectory('/home');
      await fileSystemManager.createDirectory('/tmp');
    } catch {
      // Directories might already exist, ignore errors
    }

    // Create shell command context with proper working directory
    const workingDirectory = '/';
    const context: ShellCommandContext = {
      terminal: mockTerminal,
      fileSystemManager,
      currentDirectory: { current: workingDirectory },
      args,
    };

    // Execute the command using shell registry
    const result = await shellRegistry.execute(commandName, context);

    if (result.success) {
      const output = result.output || 'Command executed successfully';
      return {
        llmContent: truncateOutput(output),
        returnDisplay: 'Command executed successfully.',
      };
    } else {
      return {
        isError: true,
        llmContent: result.error || 'Command execution failed',
      };
    }
  } catch (e) {
    return {
      isError: true,
      llmContent: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

export function createBashTool() {
  const availableCommands = shellRegistry
    .getAll()
    .map((cmd) => cmd.name)
    .join(', ');

  return {
    name: 'bash',
    description:
      `Run shell commands in the terminal, ensuring proper handling and security measures.

Before using this tool, please follow these steps:
- Verify that the command is one of the allowed commands: ${availableCommands}.
- Always quote file paths that contain spaces with double quotes (e.g., cd "path with spaces/file.txt")
- Capture the output of the command.

Notes:
- The command argument is required.
- You can specify an optional timeout in milliseconds (up to ${MAX_TIMEOUT}ms / 10 minutes). If not specified, commands will timeout after 30 minutes.
- VERY IMPORTANT: You MUST avoid using search commands like \`find\` and \`grep\`. Instead use grep and glob tool to search. You MUST avoid read tools like \`cat\`, \`head\`, \`tail\`, and \`ls\`, and use \`read\` and \`ls\` tool to read files.
- If you _still_ need to run \`grep\`, STOP. ALWAYS USE ripgrep at \`rg\` first, which all users have pre-installed.
- When issuing multiple commands, use the ';' or '&&' operator to separate them. DO NOT use newlines (newlines are ok in quoted strings).
- Try to maintain your current working directory throughout the session by using absolute paths and avoiding usage of \`cd\`. You may use \`cd\` if the User explicitly requests it.
- Don't add \`<command>\` wrapper to the command.

<good-example>
ls /foo/bar
</good-example>
<bad-example>
cd /foo/bar && ls
</bad-example>
<bad-example>
<command>ls /foo/bar</command>
</bad-example>
`.trim(),
    parameters: z.object({
      command: z.string().describe('The command to execute'),
      timeout: z
        .number()
        .optional()
        .nullable()
        .describe(`Optional timeout in milliseconds (max ${MAX_TIMEOUT})`),
    }),
    getDescription: (params: { command?: string }) => {
      if (!params.command || typeof params.command !== 'string') {
        return 'No command provided';
      }
      const command = params.command.trim();
      return command.length > 100 ? command.substring(0, 97) + '...' : command;
    },
    execute: async ({
      command,
      timeout = DEFAULT_TIMEOUT,
    }: {
      command: string;
      timeout?: number;
    }) => {
      try {
        if (!command) {
          return {
            llmContent: 'Error: Command cannot be empty.',
            isError: true,
          };
        }
        return await executeCommand(command, timeout || DEFAULT_TIMEOUT);
      } catch (e) {
        return {
          isError: true,
          llmContent:
            e instanceof Error
              ? `Command execution failed: ${e.message}`
              : 'Command execution failed.',
        };
      }
    },
    approval: {
      category: 'command',
      needsApproval: async (context: {
        params: { command?: string };
        approvalMode: string;
      }) => {
        const { params, approvalMode } = context;
        const command = params.command as string;
        if (!command) {
          return false;
        }
        // Always require approval for high-risk commands
        if (isHighRiskCommand(command)) {
          return true;
        }
        // Check if command is not allowed (these should never be approved)
        if (!isAllowedCommand(command)) {
          return true; // This will be denied by approval system
        }
        // For other commands, defer to approval mode settings
        return approvalMode !== 'yolo';
      },
    },
  };
}
