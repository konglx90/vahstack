import { fileSystemManager } from '../../utils/fileSystem';
import { z } from 'zod';

// Browser-compatible path utilities
const pathUtils = {
  dirname(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') return '/';
    const normalizedPath = filePath.replace(/\\/g, '/');
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    if (lastSlashIndex === -1) return '/';
    if (lastSlashIndex === 0) return '/';
    return normalizedPath.substring(0, lastSlashIndex);
  },
};

const TODO_WRITE_PROMPT = `
Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.
It also helps the user understand the progress of the task and overall progress of their requests.

## When to Use This Tool
Use this tool proactively in these scenarios:

1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests todo list - When the user directly asks you to use the todo list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as todos
6. When you start working on a task - Mark it as in_progress BEFORE beginning work. Ideally you should only have one todo as in_progress at a time
7. After completing a task - Mark it as completed and add any new follow-up tasks discovered during implementation

## When NOT to Use This Tool

Skip using this tool when:
1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no organizational benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

NOTE that you should not use this tool if there is only one trivial task to do. In this case you are better off just doing the task directly.

## Task States and Management

1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully

2. **Task Management**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Only have ONE task in_progress at any time
   - Complete current tasks before starting new ones
   - Remove tasks that are no longer relevant from the list entirely

3. **Task Completion Requirements**:
   - ONLY mark a task as completed when you have FULLY accomplished it
   - If you encounter errors, blockers, or cannot finish, keep the task as in_progress
   - When blocked, create a new task describing what needs to be resolved
   - Never mark a task as completed if:
     - Tests are failing
     - Implementation is partial
     - You encountered unresolved errors
     - You couldn't find necessary files or dependencies

4. **Task Breakdown**:
   - Create specific, actionable items
   - Break complex tasks into smaller, manageable steps
   - Use clear, descriptive task names

When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.
`;

const TODO_READ_PROMPT = `Use this tool to read your todo list`;

const TodoItemSchema = z.object({
  id: z.string(),
  content: z.string().min(1, 'Content cannot be empty'),
  status: z.enum(['pending', 'in_progress', 'completed']),
  priority: z.enum(['low', 'medium', 'high']),
});

const TodoListSchema = z.array(TodoItemSchema);

type TodoList = z.infer<typeof TodoListSchema>;

export type TodoItem = z.infer<typeof TodoItemSchema>;

async function loadTodosFromFile(filePath: string): Promise<TodoList> {
  if (!(await fileSystemManager.exists(filePath))) return [];

  try {
    const fileContent = await fileSystemManager.readFile(filePath);
    const parsedData = JSON.parse(fileContent);
    return TodoListSchema.parse(parsedData);
  } catch (error) {
    console.error(error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

async function saveTodos(todos: TodoList, filePath: string): Promise<void> {
  await fileSystemManager.writeFile(filePath, JSON.stringify(todos, null, 2));
}

export function createTodoTool(opts: { filePath: string }) {
  async function ensureTodoDirectory(): Promise<string> {
    const todoDir = pathUtils.dirname(opts.filePath);
    if (!(await fileSystemManager.exists(todoDir))) {
      await fileSystemManager.createDirectory(todoDir);
    }
    return todoDir;
  }

  async function getTodoFilePath(): Promise<string> {
    await ensureTodoDirectory();
    return opts.filePath;
  }

  async function readTodos(): Promise<TodoList> {
    return await loadTodosFromFile(await getTodoFilePath());
  }

  const todoWriteTool = {
    name: 'todo_write',
    description: TODO_WRITE_PROMPT,
    parameters: z.object({
      todos: TodoListSchema.describe('The updated todo list'),
      explanation: z
        .string()
        .optional()
        .describe(
          'One sentence explanation as to why this tool is being used, and how it contributes to the goal.',
        ),
    }),
    async execute({ todos }: { todos: TodoList }) {
      try {
        const oldTodos = await readTodos();
        const newTodos = todos;
        await saveTodos(newTodos, await getTodoFilePath());

        return {
          llmContent:
            'Todos have been modified successfully. Ensure that you continue to use the todo list to track your progress. Please proceed with the current tasks if applicable',
          returnDisplay: { type: 'todo_write', oldTodos, newTodos },
        };
      } catch (error) {
        return {
          isError: true,
          llmContent:
            error instanceof Error
              ? `Failed to write todos: ${error.message}`
              : 'Unknown error',
        };
      }
    },
    approval: {
      category: 'read' as const,
    },
  };

  const todoReadTool = {
    name: 'todo_read',
    description: TODO_READ_PROMPT,
    parameters: z.object({
      explanation: z
        .string()
        .optional()
        .describe(
          'One sentence explanation as to why this tool is being used, and how it contributes to the goal.',
        ),
    }),
    async execute() {
      try {
        const todos = await readTodos();
        return {
          llmContent:
            todos.length === 0
              ? 'Todo list is empty'
              : `Found ${todos.length} todos`,
          returnDisplay: { type: 'todo_read', todos },
        };
      } catch (error) {
        return {
          isError: true,
          llmContent:
            error instanceof Error
              ? `Failed to read todos: ${error.message}`
              : 'Unknown error',
        };
      }
    },
    approval: {
      category: 'read' as const,
    },
  };

  return {
    todoWriteTool,
    todoReadTool,
  };
}
