/**
 * 终端模拟器组件
 *
 * 核心职责：
 * - 提供完整的终端交互体验
 * - 集成自定义 Shell 命令系统
 * - 支持命令历史和自动补全
 * - 维护文件系统状态同步
 *
 * 设计哲学：
 * - 渐进增强：基于 XTerm.js 构建，逐步添加高级功能
 * - 状态分离：终端显示与命令执行逻辑分离
 * - 用户体验优先：提供现代终端的所有交互特性
 * - 扩展性设计：支持自定义命令和主题配置
 *
 * 架构原理：
 * - 事件驱动：基于键盘事件构建交互逻辑
 * - 命令注册：通过 shellRegistry 实现可扩展的命令系统
 * - 状态管理：使用 useRef 管理瞬时状态，useState 管理持久状态
 * - 生命周期管理：正确处理组件挂载和卸载
 */

import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { FileSystemManager } from '../utils/fileSystem';
import type { TerminalConfig } from '../types/index';
import { shellRegistry } from '../shell';

/**
 * Terminal 组件的属性接口
 *
 * 设计原则：
 * - 配置可选：提供合理的默认值
 * - 依赖注入：通过 props 传入外部依赖
 * - 回调机制：支持命令执行的外部监听
 */
interface TerminalProps {
  /** 终端配置选项，支持主题、字体等自定义 */
  config?: TerminalConfig;
  /** 文件系统管理器，用于命令执行时的文件操作 */
  fileSystemManager: FileSystemManager;
  /** 命令执行回调，用于外部监听和日志记录 */
  onCommand?: (command: string) => void;
}

/**
 * 键盘输入字符常量
 *
 * 设计意图：提高代码可读性和维护性
 * - 使用语义化常量替代魔法数字
 * - 集中管理特殊字符编码
 */
const KEYBOARD_CHARS = {
  /** 回车键 */
  ENTER: '\r',
  /** 退格键 */
  BACKSPACE: '\u007f',
  /** 上箭头键 */
  ARROW_UP: '\u001b[A',
  /** 下箭头键 */
  ARROW_DOWN: '\u001b[B',
  /** Tab 键 */
  TAB: '\t',
  /** 空格字符（可打印字符的最小值） */
  SPACE: ' ',
} as const;

/**
 * ANSI 转义序列常量
 *
 * 用途：终端文本样式和光标控制
 * - 颜色控制：绿色提示符、红色错误信息
 * - 光标控制：清除行、移动光标
 */
const ANSI_CODES = {
  /** 绿色文本 */
  GREEN: '\x1b[32m',
  /** 红色文本 */
  RED: '\x1b[31m',
  /** 重置样式 */
  RESET: '\x1b[0m',
  /** 清除当前行 */
  CLEAR_LINE: '\r\u001b[K',
} as const;

/**
 * 终端模拟器组件
 *
 * 实现策略：
 * - 组合模式：将 XTerm.js 作为底层渲染引擎
 * - 装饰器模式：在基础终端上添加命令系统和交互功能
 * - 观察者模式：通过事件监听实现键盘交互
 *
 * 性能优化：
 * - useRef 管理不触发重渲染的状态
 * - 命令历史限制防止内存泄漏
 * - 组件卸载时正确清理资源
 *
 * 用户体验设计：
 * - 命令历史导航（上下箭头）
 * - Tab 自动补全
 * - 实时命令建议
 * - 视觉反馈和错误提示
 */
export const Terminal: React.FC<TerminalProps> = ({
  config = {},
  fileSystemManager,
  onCommand,
}) => {
  // DOM 引用管理
  /** 终端容器 DOM 引用 */
  const terminalRef = useRef<HTMLDivElement>(null);
  /** XTerm 实例引用 */
  const xtermRef = useRef<XTerm | null>(null);

  // 瞬时状态管理（使用 useRef 避免重渲染）
  /** 当前输入行内容 */
  const currentLine = useRef<string>('');
  /** 当前工作目录 */
  const currentDirectory = useRef<string>('/');

  // 持久状态管理（需要触发重渲染的状态）
  /** 命令历史记录 */
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  /** 历史记录导航索引 */
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  /** 自动补全建议列表 */
  const [suggestions, setSuggestions] = useState<string[]>([]);
  /** 是否显示建议弹窗 */
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  /**
   * 终端初始化和事件绑定效果
   *
   * 生命周期管理：
   * - 组件挂载：创建终端实例，绑定事件监听器
   * - 组件卸载：清理终端实例，防止内存泄漏
   *
   * 依赖数组设计：
   * - config: 配置变化时重新初始化终端
   * - fileSystemManager: 文件系统变化时更新命令上下文
   * - onCommand: 回调函数变化时更新事件处理器
   */
  useEffect(() => {
    if (!terminalRef.current) return;

    /**
     * 创建终端实例
     *
     * 配置策略：
     * - 默认配置：提供现代终端的标准体验
     * - 主题定制：支持透明背景和自定义颜色方案
     * - 字体优化：使用等宽字体确保对齐
     * - 用户配置：通过 config 参数支持个性化定制
     */
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
      ...config, // 用户配置覆盖默认配置
    });

    // 挂载终端到 DOM
    terminal.open(terminalRef.current);
    xtermRef.current = terminal;

    // 显示欢迎信息
    terminal.writeln('Welcome to VahStack Terminal!');
    terminal.writeln('Type "help" for available commands.');
    writePrompt();

    /**
     * 可用命令列表
     *
     * 设计考量：
     * - 命令发现：用户可以通过 Tab 补全发现可用命令
     * - 扩展性：新命令需要在此处注册以支持自动补全
     * - 分类组织：按功能分组便于理解和维护
     */
    const availableCommands: readonly string[] = [
      // 基础命令
      'help',
      'clear',
      'pwd',
      // 文件系统命令
      'ls',
      'cd',
      'mkdir',
      'touch',
      'cat',
      'echo',
      'rm',
      'cp',
      'mv',
      // 文本处理命令
      'grep',
      'find',
      'wc',
      'head',
      'tail',
    ] as const;

    /**
     * 获取命令自动补全建议
     *
     * 算法：前缀匹配
     * - 提取用户输入的命令部分（第一个单词）
     * - 在可用命令中查找匹配的前缀
     * - 返回匹配结果供 Tab 补全使用
     *
     * 性能优化：
     * - 空输入直接返回，避免不必要的计算
     * - 使用 filter 和 startsWith 进行高效匹配
     */
    const getCommandSuggestions = (input: string): string[] => {
      if (!input) return [];
      const [cmd] = input.split(' ');
      return availableCommands.filter((command) =>
        command.startsWith(cmd.toLowerCase()),
      );
    };

    /**
     * 键盘输入事件处理器
     *
     * 设计模式：命令模式
     * - 将不同的键盘输入映射到具体的处理函数
     * - 每种输入类型有独立的处理逻辑
     * - 便于扩展新的键盘快捷键
     *
     * 用户体验：
     * - 回车执行命令
     * - 退格删除字符
     * - 箭头键导航历史
     * - Tab 键自动补全
     * - 实时显示输入内容
     */
    terminal.onData((data: string) => {
      const char = data;

      if (char === KEYBOARD_CHARS.ENTER) {
        handleEnterKey(terminal);
      } else if (char === KEYBOARD_CHARS.BACKSPACE) {
        handleBackspaceKey(terminal);
      } else if (char === KEYBOARD_CHARS.ARROW_UP) {
        handleArrowUpKey(terminal);
      } else if (char === KEYBOARD_CHARS.ARROW_DOWN) {
        handleArrowDownKey(terminal);
      } else if (char === KEYBOARD_CHARS.TAB) {
        handleTabKey(terminal);
      } else if (char >= KEYBOARD_CHARS.SPACE) {
        handlePrintableChar(terminal, char);
      }
    });

    /**
     * 回车键处理：执行命令
     *
     * 执行流程：
     * 1. 获取当前输入的命令
     * 2. 添加到命令历史
     * 3. 执行命令
     * 4. 重置输入状态
     * 5. 显示新的提示符
     */
    function handleEnterKey(terminal: XTerm): void {
      terminal.write('\r\n');
      const command = currentLine.current.trim();

      if (command) {
        // 添加到命令历史（限制历史记录数量防止内存泄漏）
        setCommandHistory((prev) => {
          const newHistory = [...prev, command];
          return newHistory.slice(-100); // 保留最近 100 条命令
        });
        setHistoryIndex(-1);

        executeCommand(command);
        onCommand?.(command);
      }

      currentLine.current = '';
      setShowSuggestions(false);
      writePrompt();
    }

    /**
     * 退格键处理：删除字符
     *
     * 功能：
     * - 删除当前行的最后一个字符
     * - 更新终端显示
     * - 刷新自动补全建议
     */
    function handleBackspaceKey(terminal: XTerm): void {
      if (currentLine.current.length > 0) {
        currentLine.current = currentLine.current.slice(0, -1);
        terminal.write('\b \b'); // 退格、空格、退格（清除字符）

        // 更新自动补全建议
        const suggestions = getCommandSuggestions(currentLine.current);
        setSuggestions(suggestions);
        setShowSuggestions(
          suggestions.length > 0 && currentLine.current.length > 0,
        );
      }
    }

    /**
     * 上箭头键处理：历史记录向上导航
     *
     * 导航逻辑：
     * - 从历史记录末尾开始向前遍历
     * - 更新当前输入行为历史命令
     * - 在终端中显示历史命令
     */
    function handleArrowUpKey(terminal: XTerm): void {
      if (commandHistory.length > 0) {
        const newIndex =
          historyIndex === -1
            ? commandHistory.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);

        // 清除当前行并显示历史命令
        terminal.write(ANSI_CODES.CLEAR_LINE);
        writePrompt();

        const historyCommand = commandHistory[newIndex];
        currentLine.current = historyCommand;
        terminal.write(historyCommand);
      }
    }

    /**
     * 下箭头键处理：历史记录向下导航
     *
     * 导航逻辑：
     * - 向历史记录末尾方向移动
     * - 到达末尾时清空输入行
     * - 支持从历史记录返回到当前输入
     */
    function handleArrowDownKey(terminal: XTerm): void {
      if (commandHistory.length > 0 && historyIndex >= 0) {
        const newIndex = historyIndex + 1;

        // 清除当前行
        terminal.write(ANSI_CODES.CLEAR_LINE);
        writePrompt();

        if (newIndex >= commandHistory.length) {
          // 到达历史记录末尾，清空输入
          setHistoryIndex(-1);
          currentLine.current = '';
        } else {
          // 显示下一条历史命令
          setHistoryIndex(newIndex);
          const historyCommand = commandHistory[newIndex];
          currentLine.current = historyCommand;
          terminal.write(historyCommand);
        }
      }
    }

    /**
     * Tab 键处理：自动补全
     *
     * 补全策略：
     * - 单一匹配：直接补全命令
     * - 多重匹配：显示所有可能的选项
     * - 无匹配：无操作
     *
     * 用户体验：
     * - 自动添加空格便于输入参数
     * - 显示所有选项帮助用户选择
     */
    function handleTabKey(terminal: XTerm): void {
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
    }

    /**
     * 可打印字符处理：正常输入
     *
     * 功能：
     * - 添加字符到当前输入行
     * - 在终端中显示字符
     * - 更新自动补全建议
     */
    function handlePrintableChar(terminal: XTerm, char: string): void {
      currentLine.current += char;
      terminal.write(char);

      // 更新自动补全建议
      const suggestions = getCommandSuggestions(currentLine.current);
      setSuggestions(suggestions);
      setShowSuggestions(
        suggestions.length > 0 && currentLine.current.length > 0,
      );
    }

    /**
     * 显示命令提示符
     *
     * 设计：
     * - 显示当前目录名称（简化路径显示）
     * - 使用绿色突出提示符
     * - 根目录显示为 ~ 符号
     */
    function writePrompt(): void {
      const currentDir =
        currentDirectory.current === '/'
          ? '~'
          : currentDirectory.current.split('/').pop() || '~';
      terminal.write(
        `\r\n${ANSI_CODES.GREEN}${currentDir}${ANSI_CODES.RESET} $ `,
      );
    }

    /**
     * 命令执行入口
     *
     * 功能：
     * - 支持命令链（&& 连接符）
     * - 记录命令到历史
     * - 委托给单命令执行器
     *
     * 扩展性：支持更多命令连接符（||, ;, |）
     */
    const executeCommand = async (command: string): Promise<void> => {
      const trimmedCommand = command.trim();
      if (!trimmedCommand) return;

      // 记录命令到历史（外部监听）
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

    /**
     * 单命令执行器
     *
     * 执行流程：
     * 1. 解析命令和参数
     * 2. 构建执行上下文
     * 3. 调用 shell 注册表执行命令
     * 4. 处理执行结果
     * 5. 更新终端显示和目录状态
     *
     * 错误处理：
     * - 捕获执行异常
     * - 显示友好的错误信息
     * - 使用红色文本突出错误
     */
    const executeSingleCommand = async (command: string): Promise<void> => {
      const [cmd, ...args] = command.split(' ').filter(Boolean);

      try {
        // 构建命令执行上下文
        const context = {
          args,
          currentDirectory: { current: currentDirectory.current },
          fileSystemManager,
          terminal,
        };

        // 使用 shell 注册表执行命令
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
          // 显示错误信息（红色文本）
          terminal.writeln(
            `${ANSI_CODES.RED}${result.error || 'Command execution failed'}${ANSI_CODES.RESET}`,
          );
        }
      } catch (error) {
        // 异常处理：显示详细错误信息
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        terminal.writeln(
          `${ANSI_CODES.RED}Error executing command: ${errorMsg}${ANSI_CODES.RESET}`,
        );
      }
    };

    /**
     * 组件清理函数
     *
     * 资源管理：
     * - 释放 XTerm 实例
     * - 清理事件监听器
     * - 防止内存泄漏
     */
    return () => {
      terminal.dispose();
    };
  }, [config, fileSystemManager, onCommand]);

  /**
   * 组件渲染
   *
   * 结构设计：
   * - 终端容器：承载 XTerm 实例
   * - 建议弹窗：显示自动补全选项
   * - 样式继承：支持主题配置
   *
   * 可访问性：
   * - 语义化的 CSS 类名
   * - 支持键盘导航
   * - 合理的颜色对比度
   */
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
