import type {
  ShellCommand,
  ShellCommandContext,
  ShellCommandRegistry,
  ShellCommandResult,
} from './types';

export class CommandRegistry implements ShellCommandRegistry {
  private commands = new Map<string, ShellCommand>();

  register(command: ShellCommand): void {
    this.commands.set(command.name, command);
  }

  unregister(name: string): void {
    this.commands.delete(name);
  }

  get(name: string): ShellCommand | undefined {
    return this.commands.get(name);
  }

  getAll(): ShellCommand[] {
    return Array.from(this.commands.values());
  }

  async execute(
    commandName: string,
    context: ShellCommandContext,
  ): Promise<ShellCommandResult> {
    const command = this.get(commandName);

    if (!command) {
      return {
        success: false,
        error: `${commandName}: command not found\nType 'help' to see available commands`,
      };
    }

    try {
      return await command.execute(context.args, context);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Error executing command: ${errorMsg}`,
      };
    }
  }
}

export const shellRegistry = new CommandRegistry();
