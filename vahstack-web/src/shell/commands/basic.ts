import type {
  ShellCommand,
  ShellCommandContext,
  ShellCommandResult,
} from '../types';

export const helpCommand: ShellCommand = {
  name: 'help',
  description: 'Show available commands',
  usage: 'help',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute(_args: string[], _context: ShellCommandContext): ShellCommandResult {
    const output = [
      'Available commands:',
      '  help     - Show this help message',
      '  clear    - Clear the terminal',
      '  pwd      - Print working directory',
      '  ls       - List directory contents',
      '  mkdir    - Create directory',
      '  touch    - Create empty file',
      '  cat      - Display file contents',
      '  echo     - Display text',
      '  cd       - Change directory',
      '  rm       - Remove files or directories',
      '  cp       - Copy files or directories',
      '  mv       - Move/rename files or directories',
      '  grep     - Search text in files',
      '  find     - Find files and directories',
      '  wc       - Count lines, words, characters',
      '  head     - Display first lines of file',
      '  tail     - Display last lines of file',
      '',
      'Usage examples:',
      '  mkdir mydir',
      '  touch myfile.txt',
      '  echo "Hello World" > myfile.txt',
      '  cat myfile.txt',
      '  cp myfile.txt backup.txt',
      '  mv backup.txt mydir/',
      '  grep "Hello" myfile.txt',
      '  find . -name "*.txt"',
      '  wc -l myfile.txt',
      '  head -n 5 myfile.txt',
      '  rm myfile.txt',
      '  rm -r mydir',
    ].join('\n');

    return { success: true, output };
  },
};

export const clearCommand: ShellCommand = {
  name: 'clear',
  description: 'Clear the terminal',
  usage: 'clear',
  execute(_args: string[], context: ShellCommandContext): ShellCommandResult {
    context.terminal.clear();
    return { success: true };
  },
};

export const pwdCommand: ShellCommand = {
  name: 'pwd',
  description: 'Print working directory',
  usage: 'pwd',
  execute(_args: string[], context: ShellCommandContext): ShellCommandResult {
    return {
      success: true,
      output: context.currentDirectory.current,
    };
  },
};
