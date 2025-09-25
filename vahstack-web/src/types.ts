export type TodoItem = {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
};

export type ToolResult = {
  llmContent: string;
  returnDisplay?: unknown;
  isError?: boolean;
};

export type ToolUse = {
  name: string;
  params: Record<string, unknown>;
  callId: string;
};
