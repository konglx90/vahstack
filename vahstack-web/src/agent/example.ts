import { defaultAgent, createAgentWithTools } from './index';
import { fileSystemManager } from '../utils/fileSystem';

// Example 1: Using the default agent with the provided API key
export async function exampleUsage(
  prompt = 'console /welcome.txt file content',
) {
  try {
    // Initialize the file system first
    await fileSystemManager.initialize();

    // Create some test files and directories
    fileSystemManager.createDirectorySync('/home');
    fileSystemManager.createDirectorySync('/tmp');
    fileSystemManager.writeFileSync('/welcome.txt', 'Welcome to VahStack!');
    fileSystemManager.writeFileSync('/home/user.txt', 'User data');

    console.log('File system initialized with test data 22');

    // Use the agent to list files
    const agent = await defaultAgent;
    // const result = await agent.runLoop('Please list the files in the root directory, and console readme.md content');
    const result = await agent.runLoop(prompt);

    if (result.success) {
      console.log('Agent response:', result.data?.text);
    } else {
      console.error('Agent error:', result.error?.message);
    }

    return result;
  } catch (error) {
    console.error('Example failed:', error);
    throw error;
  }
}

// Example 2: Creating a custom agent with different API key
export async function customAgentExample(apiKey: string) {
  try {
    const customAgent = await createAgentWithTools(apiKey);

    // Initialize file system
    await fileSystemManager.initialize();

    const result = await customAgent.runLoop(
      'List the contents of the /home directory',
      {
        maxTurns: 5,
        onTextDelta: (text) => console.log('Streaming:', text),
        onToolUse: async (toolUse) => {
          console.log('Tool use requested:', toolUse.name, toolUse.params);
          return true; // Approve tool use
        },
      },
    );

    return result;
  } catch (error) {
    console.error('Custom agent example failed:', error);
    throw error;
  }
}

// Example 3: Direct tool usage without agent loop
export async function directToolExample() {
  try {
    await fileSystemManager.initialize();

    // Create test structure
    fileSystemManager.createDirectorySync('/projects');
    fileSystemManager.createDirectorySync('/projects/web');
    fileSystemManager.writeFileSync(
      '/projects/web/index.html',
      '<html></html>',
    );
    fileSystemManager.writeFileSync('/projects/readme.md', '# Projects');

    // Use ls tool directly
    const { lsTool } = await import('./tools/ls');

    const rootResult = await lsTool({ dir_path: '/' });
    console.log('Root directory:', rootResult.llmContent);

    const projectsResult = await lsTool({ dir_path: '/projects' });
    console.log('Projects directory:', projectsResult.llmContent);

    return { rootResult, projectsResult };
  } catch (error) {
    console.error('Direct tool example failed:', error);
    throw error;
  }
}

// Export for browser console testing
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).agentExamples = {
    exampleUsage,
    customAgentExample,
    directToolExample,
  };
}
