import { defaultAgent, createAgentWithTools } from '../index';
import { fileSystemManager } from '../../utils/fileSystem';

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

    // Use the agent to run the prompt
    const agentInstance = await defaultAgent;
    const result = await agentInstance.runLoop(prompt);

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
    const customAgentInstance = await createAgentWithTools(apiKey);

    // Initialize file system
    await fileSystemManager.initialize();

    const result = await customAgentInstance.runLoop(
      'List the contents of the /home directory',
      { maxTurns: 5 },
    );

    return result;
  } catch (error) {
    console.error('Custom agent example failed:', error);
    throw error;
  }
}

// Export for browser console testing
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).agentExamples = {
    exampleUsage,
    customAgentExample,
  };
}

// Export for browser console testing
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).agentExamples = {
    exampleUsage,
    customAgentExample,
  };
}
