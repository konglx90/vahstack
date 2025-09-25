/**
 * 移除字符串中的 ANSI 转义序列
 * @param text 包含 ANSI 转义序列的字符串
 * @returns 移除 ANSI 转义序列后的纯文本字符串
 */
export function removeANSIEscape(text: string): string {
  // ANSI 转义序列的正则表达式
  // ESC[ 开头，后跟数字、分号、字母等字符
  const ansiRegex = new RegExp(
    String.fromCharCode(27) + '\\[[0-9;]*[a-zA-Z]',
    'g',
  );

  return text.replace(ansiRegex, '');
}

/**
 * 检查字符串是否包含 ANSI 转义序列
 * @param text 要检查的字符串
 * @returns 如果包含 ANSI 转义序列返回 true，否则返回 false
 */
export function hasANSIescape(text: string): boolean {
  const ansiRegex = new RegExp(
    String.fromCharCode(27) + '\\[[0-9;]*[a-zA-Z]',
    'g',
  );
  return ansiRegex.test(text);
}

/**
 * 获取移除 ANSI 转义序列后的字符串长度
 * @param text 包含 ANSI 转义序列的字符串
 * @returns 纯文本的实际长度
 */
export function getPlainTextLength(text: string): number {
  return removeANSIEscape(text).length;
}
