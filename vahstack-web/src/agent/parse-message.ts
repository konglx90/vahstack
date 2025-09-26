interface TextContent {
  type: 'text';
  content: string;
  partial: boolean;
}

interface ToolUse {
  type: 'tool_use';
  name: string;
  params: Record<string, unknown>;
  callId?: string;
  partial: boolean;
}

export type ParsedContent = TextContent | ToolUse;

const TOOL_USE_OPEN = '<use_tool>';
const TOOL_USE_CLOSE = '</use_tool>';
const TOOL_NAME_OPEN = '<tool_name>';
const TOOL_NAME_CLOSE = '</tool_name>';
const ARGUMENTS_OPEN = '<arguments>';
const ARGUMENTS_CLOSE = '</arguments>';

export function parseMessage(text: string): ParsedContent[] {
  const contentBlocks: ParsedContent[] = [];

  let currentTextContentStart = 0;
  let currentTextContent: TextContent | undefined;
  let currentToolUse: ToolUse | undefined;
  let currentParamName: string | undefined;
  let currentParamValueStart = 0;

  for (let i = 0; i < text.length; i++) {
    // 状态1: 正在解析工具参数
    if (currentToolUse && currentParamName) {
      // 检查参数结束标签
      if (
        currentParamName === 'tool_name' &&
        i >= TOOL_NAME_CLOSE.length - 1 &&
        text.startsWith(TOOL_NAME_CLOSE, i - TOOL_NAME_CLOSE.length + 1)
      ) {
        const value = text.slice(
          currentParamValueStart,
          i - TOOL_NAME_CLOSE.length + 1,
        );
        currentToolUse.name = value.trim();
        currentParamName = undefined;
        continue;
      }

      if (
        currentParamName === 'arguments' &&
        i >= ARGUMENTS_CLOSE.length - 1 &&
        text.startsWith(ARGUMENTS_CLOSE, i - ARGUMENTS_CLOSE.length + 1)
      ) {
        const value = text.slice(
          currentParamValueStart,
          i - ARGUMENTS_CLOSE.length + 1,
        );
        try {
          currentToolUse.params = value.trim() ? JSON.parse(value.trim()) : {};
        } catch {
          // 尝试修复JSON
          try {
            const repairedJson = repairJson(value.trim());
            currentToolUse.params = JSON.parse(repairedJson);
          } catch {
            currentToolUse.params = {
              _error: 'Invalid JSON',
              _raw: value.trim(),
            };
          }
        }
        currentParamName = undefined;
        continue;
      }
    }

    // 状态2: 正在工具内部，但不在具体参数内
    if (currentToolUse && !currentParamName) {
      // 检查工具名称开始
      if (
        i >= TOOL_NAME_OPEN.length - 1 &&
        text.startsWith(TOOL_NAME_OPEN, i - TOOL_NAME_OPEN.length + 1)
      ) {
        currentParamName = 'tool_name';
        currentParamValueStart = i + 1;
        continue;
      }

      // 检查参数开始
      if (
        i >= ARGUMENTS_OPEN.length - 1 &&
        text.startsWith(ARGUMENTS_OPEN, i - ARGUMENTS_OPEN.length + 1)
      ) {
        currentParamName = 'arguments';
        currentParamValueStart = i + 1;
        continue;
      }

      // 检查工具结束
      if (
        i >= TOOL_USE_CLOSE.length - 1 &&
        text.startsWith(TOOL_USE_CLOSE, i - TOOL_USE_CLOSE.length + 1)
      ) {
        currentToolUse.partial = false;
        contentBlocks.push(currentToolUse);
        currentToolUse = undefined;
        currentTextContentStart = i + 1;
        continue;
      }
      continue;
    }

    // 状态3: 正在解析普通文本，或寻找工具的开始
    if (!currentToolUse) {
      // 检查工具开始
      if (
        i >= TOOL_USE_OPEN.length - 1 &&
        text.startsWith(TOOL_USE_OPEN, i - TOOL_USE_OPEN.length + 1)
      ) {
        // 结束当前文本块
        const content = text
          .slice(currentTextContentStart, i - TOOL_USE_OPEN.length + 1)
          .trim();
        if (content.length > 0) {
          contentBlocks.push({
            type: 'text',
            content: content,
            partial: false,
          });
        }
        currentTextContent = undefined;

        // 开始新的工具使用块
        currentToolUse = {
          type: 'tool_use',
          name: '',
          params: {},
          partial: true,
        };
        continue;
      }

      // 普通文本处理
      if (!currentTextContent) {
        currentTextContent = {
          type: 'text',
          content: '',
          partial: true,
        };
      }
    }
  }

  // 处理流式场景下的不完整块
  if (currentToolUse) {
    if (currentParamName) {
      const value = text.slice(currentParamValueStart);
      if (currentParamName === 'tool_name') {
        currentToolUse.name = value.trim();
      } else if (currentParamName === 'arguments') {
        try {
          currentToolUse.params = value.trim() ? JSON.parse(value.trim()) : {};
        } catch {
          try {
            const repairedJson = repairJson(value.trim());
            currentToolUse.params = JSON.parse(repairedJson);
          } catch {
            currentToolUse.params = {
              _error: 'Incomplete JSON',
              _raw: value.trim(),
            };
          }
        }
      }
    }
    contentBlocks.push(currentToolUse);
  } else if (currentTextContent) {
    const content = text.slice(currentTextContentStart).trim();
    if (content.length > 0) {
      currentTextContent.content = content;
      currentTextContent.partial = true;
      contentBlocks.push(currentTextContent);
    }
  }

  return contentBlocks;
}

// 简单的JSON修复函数
function repairJson(jsonString: string): string {
  // 移除末尾的不完整部分
  let cleaned = jsonString.trim();

  // 如果字符串不以{开始，添加{
  if (!cleaned.startsWith('{')) {
    cleaned = '{' + cleaned;
  }

  // 如果字符串不以}结束，添加}
  if (!cleaned.endsWith('}')) {
    // 检查是否有未闭合的引号
    const quoteCount = (cleaned.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      cleaned += '"';
    }
    cleaned += '}';
  }

  return cleaned;
}
