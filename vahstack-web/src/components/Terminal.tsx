import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { FileSystemManager } from '../utils/fileSystem';
import type { TerminalConfig } from '../types';
import { shellRegistry } from '../shell';

interface TerminalProps {
  config?: TerminalConfig;
  fileSystemManager: FileSystemManager;
  onCommand?: (command: string) => void;
}

export const Terminal: React.FC<TerminalProps> = ({
  config = {},
  fileSystemManager,
  onCommand,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const currentLine = useRef<string>('');
  const currentDirectory = useRef<string>('/');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    // 创建终端实例
    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      theme: {
        background: 'transparent',
        foreground: '#ffffff',
        cursor: '#00ff88',
        cursorAccent: '#00ff88',
        black: '#000000',
        red: '#ff6b6b',
        green: '#51cf66',
        yellow: '#ffd43b',
        blue: '#74c0fc',
        magenta: '#f06292',
        cyan: '#4dd0e1',
        white: '#ffffff',
        brightBlack: '#495057',
        brightRed: '#ff8a80',
        brightGreen: '#69f0ae',
        brightYellow: '#ffff8d',
        brightBlue: '#82b1ff',
        brightMagenta: '#ff80ab',
        brightCyan: '#84ffff',
        brightWhite: '#ffffff',
      },
      allowTransparency: true,
      ...config,
    });

    // 挂载到DOM
    terminal.open(terminalRef.current);
    xtermRef.current = terminal;

    // 显示欢迎信息
    terminal.writeln('Welcome to VahStack Terminal!');
    terminal.writeln('Type "help" for available commands.');
    writePrompt();

    // 可用命令列表，用于自动补全
    const availableCommands = [
      'help',
      'clear',
      'pwd',
      'ls',
      'cd',
      'mkdir',
      'touch',
      'cat',
      'echo',
      'rm',
      'cp',
      'mv',
      'grep',
      'find',
      'wc',
      'head',
      'tail',
    ];

    // 获取命令建议
    const getCommandSuggestions = (input: string) => {
      if (!input) return [];
      const [cmd] = input.split(' ');
      return availableCommands.filter((command) =>
        command.startsWith(cmd.toLowerCase()),
      );
    };

    // 处理用户输入
    terminal.onData((data) => {
      const char = data;

      if (char === '\r') {
        // 回车键 - 执行命令
        terminal.write('\r\n');
        const command = currentLine.current.trim();

        if (command) {
          // 添加到命令历史
          setCommandHistory((prev) => {
            const newHistory = [...prev, command];
            // 限制历史记录数量
            return newHistory.slice(-100);
          });
          setHistoryIndex(-1);

          executeCommand(command);
          onCommand?.(command);
        }

        currentLine.current = '';
        setShowSuggestions(false);
        writePrompt();
      } else if (char === '\u007f') {
        // 退格键
        if (currentLine.current.length > 0) {
          currentLine.current = currentLine.current.slice(0, -1);
          terminal.write('\b \b');

          // 更新自动补全建议
          const suggestions = getCommandSuggestions(currentLine.current);
          setSuggestions(suggestions);
          setShowSuggestions(
            suggestions.length > 0 && currentLine.current.length > 0,
          );
        }
      } else if (char === '\u001b[A') {
        // 上箭头 - 历史记录向上
        if (commandHistory.length > 0) {
          const newIndex =
            historyIndex === -1
              ? commandHistory.length - 1
              : Math.max(0, historyIndex - 1);
          setHistoryIndex(newIndex);

          // 清除当前行
          terminal.write('\r\u001b[K');
          writePrompt();

          // 显示历史命令
          const historyCommand = commandHistory[newIndex];
          currentLine.current = historyCommand;
          terminal.write(historyCommand);
        }
      } else if (char === '\u001b[B') {
        // 下箭头 - 历史记录向下
        if (commandHistory.length > 0 && historyIndex >= 0) {
          const newIndex = historyIndex + 1;

          // 清除当前行
          terminal.write('\r\u001b[K');
          writePrompt();

          if (newIndex >= commandHistory.length) {
            setHistoryIndex(-1);
            currentLine.current = '';
          } else {
            setHistoryIndex(newIndex);
            const historyCommand = commandHistory[newIndex];
            currentLine.current = historyCommand;
            terminal.write(historyCommand);
          }
        }
      } else if (char === '\t') {
        // Tab键 - 自动补全
        const suggestions = getCommandSuggestions(currentLine.current);
        if (suggestions.length === 1) {
          // 只有一个建议，直接补全
          const suggestion = suggestions[0];
          const [currentCmd] = currentLine.current.split(' ');
          const remaining = suggestion.slice(currentCmd.length);

          currentLine.current = currentLine.current.replace(
            currentCmd,
            suggestion,
          );
          terminal.write(remaining + ' ');
          currentLine.current += ' ';
          setShowSuggestions(false);
        } else if (suggestions.length > 1) {
          // 多个建议，显示所有选项
          terminal.write('\r\n');
          terminal.writeln('Available commands:');
          suggestions.forEach((cmd) => {
            terminal.writeln(`  ${cmd}`);
          });
          writePrompt();
          terminal.write(currentLine.current);
        }
      } else if (char >= ' ') {
        // 可打印字符
        currentLine.current += char;
        terminal.write(char);

        // 更新自动补全建议
        const suggestions = getCommandSuggestions(currentLine.current);
        setSuggestions(suggestions);
        setShowSuggestions(
          suggestions.length > 0 && currentLine.current.length > 0,
        );
      }
    });

    function writePrompt() {
      const currentDir =
        currentDirectory.current === '/'
          ? '~'
          : currentDirectory.current.split('/').pop() || '~';
      terminal.write(`\r\n\x1b[32m${currentDir}\x1b[0m $ `);
    }

    const executeCommand = async (command: string) => {
      const trimmedCommand = command.trim();
      if (!trimmedCommand) return;

      // 记录命令到历史
      if (onCommand) {
        onCommand(trimmedCommand);
      }

      // 支持 && 命令连接符
      if (trimmedCommand.includes(' && ')) {
        const commands = trimmedCommand.split(' && ').map((cmd) => cmd.trim());
        for (const cmd of commands) {
          if (cmd) {
            await executeSingleCommand(cmd);
          }
        }
        return;
      }

      // 执行单个命令
      await executeSingleCommand(trimmedCommand);
    };

    const executeSingleCommand = async (command: string) => {
      const [cmd, ...args] = command.split(' ').filter(Boolean);

      try {
        // 使用新的shell命令系统
        const context = {
          args,
          currentDirectory: { current: currentDirectory.current },
          fileSystemManager,
          terminal,
        };

        const result = await shellRegistry.execute(cmd, context);

        if (result.success) {
          if (result.output) {
            terminal.writeln(result.output);
          }
          // 更新当前目录（如果命令改变了目录）
          if (result.newDirectory) {
            currentDirectory.current = result.newDirectory;
          }
        } else {
          terminal.writeln(
            `\x1b[31m${result.error || 'Command execution failed'}\x1b[0m`,
          );
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        terminal.writeln(`\x1b[31mError executing command: ${errorMsg}\x1b[0m`);
      }
    };

    return () => {
      terminal.dispose();
    };
  }, [config, fileSystemManager, onCommand]);

  return (
    <div className="terminal-container">
      <div
        ref={terminalRef}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: config.theme?.background || '#1e1e1e',
        }}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="suggestions-popup">
          {suggestions.map((suggestion, index) => (
            <div key={index} className="suggestion-item">
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
