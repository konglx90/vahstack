import { useState, useEffect } from 'react';
import { Terminal } from './components/Terminal';
import { FileSystemManager } from './utils/fileSystem';
import type { VahStackConfig } from './types';
import './App.css';
import './agent/example';

const defaultConfig: VahStackConfig = {
  fileSystem: {
    type: 'indexeddb',
  },
  terminal: {
    theme: {
      background: '#1e1e1e',
      foreground: '#ffffff',
      cursor: '#ffffff',
    },
    fontSize: 14,
    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
    rows: 24,
    cols: 80,
  },
  enableShellJS: true,
  enableFileOperations: true,
};

function App() {
  const [fileSystemManager] = useState(
    () => new FileSystemManager(defaultConfig.fileSystem),
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeFileSystem = async () => {
      try {
        // 为了测试，可以取消注释下面这行来强制重新初始化
        // await fileSystemManager.forceReinitialize();

        await fileSystemManager.initialize();

        // 创建一些示例文件和目录
        await fileSystemManager.createDirectory('/home');
        await fileSystemManager.createDirectory('/tmp');
        await fileSystemManager.writeFile(
          '/welcome.txt',
          'Welcome to VahStack!\nThis is a virtual terminal environment.\nYou can use commands like ls, cd, cat, mkdir, etc.\n\nTry: cd home && cat readme.md',
        );
        await fileSystemManager.writeFile(
          '/home/welcome.txt',
          'Welcome to VahStack!\nThis is a demo file in the virtual file system.',
        );
        await fileSystemManager.writeFile(
          '/home/readme.md',
          '# VahStack\n\nA web-based file system with terminal interface.\n\n## Features\n- Virtual file system\n- Terminal emulation\n- File operations',
        );

        setIsInitialized(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to initialize file system',
        );
      }
    };

    initializeFileSystem();
  }, [fileSystemManager]);

  const handleCommand = (command: string) => {
    console.log('Command executed:', command);
  };

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Initializing VahStack...</h2>
        <p>Setting up virtual file system...</p>
      </div>
    );
  }

  return (
    <div className="App">
      <header
        style={{
          padding: '10px 20px',
          backgroundColor: '#2d2d2d',
          color: 'white',
          borderBottom: '1px solid #444',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '18px' }}>🎯 VahStack Terminal</h1>
        <p style={{ margin: '5px 0 0 0', fontSize: '12px', opacity: 0.7 }}>
          Web-based file system with terminal interface
        </p>
      </header>

      <main
        style={{
          height: 'calc(100vh - 80px)',
          backgroundColor: '#1e1e1e',
        }}
      >
        <Terminal
          config={defaultConfig.terminal}
          fileSystemManager={fileSystemManager}
          onCommand={handleCommand}
        />
      </main>
    </div>
  );
}

export default App;
