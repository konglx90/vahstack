const LINE_REG = /^([0-9a-zA-Z]+):(.*)$/s; // s 修饰符让 "." 跨行

function tryParseLine(line) {
  const m = line.match(LINE_REG);
  if (!m) return null;

  const [, prefix, jsonStr] = m;

  try {
    // 纯字符串行（如 0:"xxx"）同样可以直接 JSON.parse
    const data = JSON.parse(jsonStr);
    return { prefix, data };
  } catch {
    // JSON 还未完整，等待下一 chunk
    return null;
  }
}

// 处理流式响应
export const handleStreamResponse = async (
  response,
  { setMessages, scrollToBottom, handleToolCall, handleToolResult },
  signal,
) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let pending = '';

  /* 维护所有已解析的内容 */
  let contents = [];

  /* 用于合并连续 text_delta */
  let textBuffer = '';

  let textRecordIdx = -1;

  /* 临时消息 */
  const tempMessageId = `temp_${Date.now()}`;
  setMessages((prev) => [
    ...prev,
    {
      id: tempMessageId,
      contents: [],
      role: 'assistant',
      isStreaming: true,
      timestamp: Date.now(),
    },
  ]);
  scrollToBottom();

  /* 便利方法：把 textBuffer 刷新进 contents */
  const flushBuffer = () => {
    if (!textBuffer) return;

    if (textRecordIdx === -1) {
      contents.push({ type: 'text', text: textBuffer });
      textRecordIdx = contents.length - 1;
    } else {
      contents[textRecordIdx].text = textBuffer; // 覆盖而不是 push
    }
    textBuffer = '';
  };

  const consume = async (parsed) => {
    const { data } = parsed;
    if (!Array.isArray(data)) return;

    // 先处理工具类异步逻辑
    for (const item of data) {
      if (item.type === 'tool_call') await handleToolCall(item);
      else if (item.type === 'tool_result') await handleToolResult(item);
    }

    // 检查是否需要刷新缓冲区
    let shouldFlush = false;
    for (const it of data) {
      if (it.type !== 'text_delta') {
        shouldFlush = true;
        break;
      }
    }

    // 如果有非文本内容，先刷新缓冲区
    if (shouldFlush) {
      flushBuffer();
      textRecordIdx = -1;
    }

    // 再处理 UI 渲染内容
    for (const it of data) {
      switch (it.type) {
        case 'text_delta':
          if (it.text) {
            textBuffer += it.text;
            // 如果当前没有 text 记录，就新 push 并记录下标
            if (textRecordIdx === -1) {
              contents.push({ type: 'text', text: textBuffer });
              textRecordIdx = contents.length - 1;
            } else {
              // 否则直接修改已有记录
              contents[textRecordIdx].text = textBuffer;
            }
          }
          break;

        case 'tool_approval_request':
          contents.push(it);
          break;

        case 'tool_result':
          contents.push(it);
          break;

        case 'tool_approval_result': {
          const idx = contents.findIndex(
            (c) =>
              c.type === 'tool_approval_request' &&
              c.toolCallId === it.toolCallId,
          );
          if (idx !== -1) {
            contents[idx] = { ...contents[idx], approved: it.approved };
          }
          break;
        }

        default:
          break;
      }

      /* 更新临时消息并滚动到底部 */
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempMessageId ? { ...msg, contents: [...contents] } : msg,
        ),
      );
      scrollToBottom();
    }
  };

  try {
    /* === 读取流 === */
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (signal?.aborted) {
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      pending += decoder.decode(value, { stream: true });

      /* 尽可能多地解析完整行 */
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const nl = pending.indexOf('\n');
        if (nl === -1) {
          // 移除这里的 flushBuffer() 调用
          // flushBuffer(); // 删除这行
          break;
        }

        const rawLine = pending.slice(0, nl);
        pending = pending.slice(nl + 1);

        const parsed = tryParseLine(rawLine.trim());
        if (parsed) await consume(parsed);
        else {
          pending = rawLine + '\n' + pending; // JSON 被截断
          break;
        }
      }
    }

    /* 收尾：处理最后残留的一行 / buffer */
    const last = tryParseLine(pending.trim());
    if (last) await consume(last);
  } finally {
    reader.releaseLock();
    /* 流结束：标记 isStreaming = false */
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === tempMessageId ? { ...msg, isStreaming: false } : msg,
      ),
    );
  }

  return contents;
};
