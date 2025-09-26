import { useEffect, useCallback, useRef } from 'react';
import { useSetState } from 'ahooks';

/**
 * 文件树节点接口定义
 *
 * 设计原则：递归数据结构的类型安全
 * - path: 文件/目录的完整路径
 * - name: 文件/目录名称
 * - content: 文件内容（仅文件类型有效）
 * - children: 子节点（仅目录类型有效）
 */
interface FileTreeNode {
  path: string;
  name: string;
  content?: string;
  children?: FileTreeNode[];
}

/**
 * 标签页文件接口定义
 *
 * 设计哲学：文件状态管理的核心数据结构
 * - path: 文件路径（唯一标识符）
 * - name: 文件名（用于显示）
 * - content: 当前编辑内容
 * - oldContent: 原始内容（用于检测修改状态）
 */
interface TabFile {
  path: string;
  name: string;
  content: string;
  oldContent: string;
}

/**
 * API 响应接口定义
 *
 * 类型安全考量：确保 API 响应的结构化处理
 */
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  ragdollData?: Array<{
    children?: FileTreeNode[];
  }>;
}

/**
 * 文件变更消息接口
 *
 * WebSocket 消息的标准化结构
 * - type: 变更类型（文件添加、修改、删除等）
 * - path: 文件路径
 * - content: 文件内容（可选）
 * - isDirectory: 是否为目录
 */
interface FileChangeMessage {
  type: 'file-changed' | 'file-added' | 'file-deleted' | 'directory-changed';
  path: string;
  content?: string;
  isDirectory?: boolean;
}

/**
 * Hook 状态接口定义
 *
 * 设计哲学：集中式状态管理
 * - 文件树数据管理
 * - 标签页状态管理
 * - WebSocket 连接状态
 * - 错误和加载状态
 */
interface UseFileState {
  fileTree: FileTreeNode[];
  developTree: FileTreeNode[];
  loading: boolean;
  error: string | null;
  tabFiles: TabFile[];
  activeTabIndex: number;
  wsConnected: boolean;
  newFile: unknown | null;
}

/**
 * 保存文件请求体接口
 */
interface SaveFileRequest {
  files: Array<{
    path: string;
    content: string;
  }>;
}

/**
 * useFile Hook - 文件管理的核心逻辑
 *
 * 核心功能：
 * 1. 文件树数据获取和管理
 * 2. 标签页文件的打开、编辑、保存
 * 3. WebSocket 实时文件变更监听
 * 4. 文件状态同步和冲突处理
 *
 * 设计哲学：
 * - 单一数据源：所有文件状态集中管理
 * - 响应式更新：实时同步文件变更
 * - 防御性编程：完善的错误处理和边界检查
 * - 性能优化：智能的重连机制和状态更新
 */
const useFile = () => {
  // 初始状态定义 - 明确的类型约束
  const [state, setState] = useSetState<UseFileState>({
    fileTree: [],
    developTree: [],
    loading: true,
    error: null,
    tabFiles: [], // 标签页文件列表
    activeTabIndex: 0, // 当前激活的标签页索引
    wsConnected: false, // WebSocket 连接状态
    newFile: null, // 新增文件信息
  });

  // WebSocket 相关引用
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 5;

  /**
   * 获取文件树数据
   *
   * 功能说明：
   * 1. 从 API 获取完整文件树结构
   * 2. 筛选出 develop 目录的特殊处理
   * 3. 支持静默刷新（不显示加载状态）
   *
   * 设计考量：
   * - 错误处理：网络异常和 API 错误的分别处理
   * - 性能优化：可选的加载状态控制
   * - 数据转换：API 响应到内部状态的映射
   */
  const fetchFileTree = useCallback(
    async (
      noLoading = false,
    ): Promise<{
      fileTree: FileTreeNode[];
      developTree: FileTreeNode[];
      error: string | null;
    } | null> => {
      console.log('开始获取文件树');
      try {
        if (!noLoading) setState({ loading: true });
        const response = await fetch('/api-files');
        const data: ApiResponse<FileTreeNode[]> = await response.json();

        if (data.success) {
          // 从 ragdollData 中筛选出 develop 目录
          const developTree =
            data.ragdollData?.[0]?.children?.filter(
              (item: FileTreeNode) =>
                item.name === 'develop' || item.path.includes('develop'),
            ) || [];

          setState({ fileTree: data.data || [], developTree, error: null });
          return { fileTree: data.data || [], developTree, error: null };
        } else {
          const errorMsg = data.error || '获取文件树失败';
          setState({ error: errorMsg });
          return null;
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? `网络请求失败: ${err.message}`
            : '网络请求失败';
        setState({ error: errorMsg });
        return null;
      } finally {
        if (!noLoading) setState({ loading: false });
      }
    },
    [setState],
  );

  /**
   * 创建新文件
   *
   * 职责：通过 API 创建文件并更新状态
   * - 发送文件创建请求
   * - 更新 newFile 状态用于 UI 反馈
   */
  const createFile = useCallback(
    async (filePath: string, content: string): Promise<void> => {
      try {
        const response = await fetch('/api-create-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath,
            content,
          }),
        });
        const result: ApiResponse = await response.json();
        if (result.success) {
          setState({
            newFile: result.data,
          });
        }
      } catch (err) {
        console.log('🚀 ~ createFile ~ err:', err);
      }
    },
    [setState],
  );

  /**
   * 处理文件变更消息
   *
   * 核心功能：
   * 1. 解析 WebSocket 文件变更消息
   * 2. 同步更新已打开文件的内容
   * 3. 处理文件删除时的标签页清理
   * 4. 触发文件树的重新获取
   *
   * 设计考量：
   * - 冲突处理：区分用户修改和外部变更
   * - 状态一致性：确保 UI 状态与文件系统同步
   * - 用户体验：智能的内容更新策略
   */
  const handleFileChangeMessage = useCallback(
    (message: FileChangeMessage): void => {
      const { type, path: filePath, content, isDirectory } = message;

      // 忽略连接确认消息
      if (filePath === 'connected') {
        return;
      }

      console.log(`收到文件变更: ${type} - ${filePath}`);

      switch (type) {
        case 'file-changed':
        case 'file-added':
          if (!isDirectory && content !== undefined) {
            // 更新已打开文件的内容
            setState((prevState) => {
              const tabIndex = prevState.tabFiles.findIndex(
                (tab) => tab.path === filePath,
              );
              if (tabIndex !== -1) {
                const currentTab = prevState.tabFiles[tabIndex];

                // 只有当文件内容确实不同时才更新
                if (currentTab.oldContent !== content) {
                  const newTabFiles = [...prevState.tabFiles];
                  newTabFiles[tabIndex] = {
                    ...currentTab,
                    oldContent: content,
                    // 如果用户没有修改过文件，也更新当前内容
                    content:
                      currentTab.content === currentTab.oldContent
                        ? content
                        : currentTab.content,
                  };

                  console.log(`更新文件内容: ${filePath}`);
                  return { ...prevState, tabFiles: newTabFiles };
                }
              }
              return prevState;
            });
          }

          // 刷新文件树
          fetchFileTree(true);
          break;

        case 'file-deleted':
          // 关闭已删除的文件标签页
          setState((prevState) => {
            const tabIndex = prevState.tabFiles.findIndex(
              (tab) => tab.path === filePath,
            );
            if (tabIndex !== -1) {
              console.log(`关闭已删除的文件标签页: ${filePath}`);
              const newTabFiles = prevState.tabFiles.filter(
                (_, i) => i !== tabIndex,
              );
              let newActiveIndex = prevState.activeTabIndex;

              if (newTabFiles.length === 0) {
                newActiveIndex = 0;
              } else if (tabIndex <= prevState.activeTabIndex) {
                newActiveIndex = Math.max(0, prevState.activeTabIndex - 1);
              }

              return {
                ...prevState,
                tabFiles: newTabFiles,
                activeTabIndex: Math.min(
                  newActiveIndex,
                  newTabFiles.length - 1,
                ),
              };
            }
            return prevState;
          });

          // 刷新文件树
          fetchFileTree(true);
          break;

        case 'directory-changed':
          // 目录变更时刷新文件树
          fetchFileTree(true);
          break;

        default:
          console.warn('未知的文件变更类型:', type);
      }
    },
    [setState, fetchFileTree],
  );

  /**
   * WebSocket 连接管理
   *
   * 功能说明：
   * 1. 建立 WebSocket 连接
   * 2. 处理连接状态变化
   * 3. 实现智能重连机制
   * 4. 订阅文件变更事件
   *
   * 设计哲学：
   * - 弹性设计：网络异常时的自动恢复
   * - 指数退避：避免频繁重连造成的资源浪费
   * - 状态透明：向用户展示连接状态
   */
  const connectWebSocket = useCallback((): void => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // 根据当前协议选择 WebSocket 协议
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket 连接已建立');
        setState({ wsConnected: true, error: null });
        reconnectAttemptsRef.current = 0;

        // 发送订阅消息
        wsRef.current?.send(JSON.stringify({ type: 'subscribe' }));
      };

      wsRef.current.onmessage = (event: MessageEvent) => {
        try {
          const message: FileChangeMessage = JSON.parse(event.data);
          handleFileChangeMessage(message);
        } catch (error) {
          console.error('解析 WebSocket 消息失败:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket 连接已关闭');
        setState({ wsConnected: false });

        // 自动重连 - 指数退避策略
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttemptsRef.current),
            30000,
          );
          console.log(
            `${delay}ms 后尝试重连 (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        }
      };

      wsRef.current.onerror = (error: Event) => {
        console.error('WebSocket 错误:', error);
        setState({ error: 'WebSocket 连接错误' });
      };
    } catch (error) {
      console.error('创建 WebSocket 连接失败:', error);
      setState({ error: 'WebSocket 连接失败' });
    }
  }, [setState, handleFileChangeMessage]);

  /**
   * 断开 WebSocket 连接
   *
   * 职责：清理 WebSocket 相关资源
   * - 清除重连定时器
   * - 关闭 WebSocket 连接
   * - 更新连接状态
   */
  const disconnectWebSocket = useCallback((): void => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState({ wsConnected: false });
  }, [setState]);

  /**
   * 保存文件
   *
   * 核心功能：
   * 1. 检查当前文件是否有未保存的修改
   * 2. 发送保存请求到服务器
   * 3. 更新文件的原始内容状态
   * 4. 处理保存过程中的错误
   *
   * 设计考量：
   * - 异步处理：使用 Promise 确保调用者能获取保存结果
   * - 状态一致性：保存成功后同步更新 oldContent
   * - 错误处理：网络错误和服务器错误的分别处理
   */
  const saveFile = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve) => {
      // 使用函数式更新获取最新状态
      setState((prevState) => {
        const currentFile = prevState.tabFiles[prevState.activeTabIndex];
        if (!currentFile) {
          resolve(true);
          return prevState;
        }

        // 检查是否有修改
        if (currentFile.content === currentFile.oldContent) {
          resolve(true);
          return prevState;
        }

        // 异步执行保存操作
        const performSave = async (): Promise<void> => {
          try {
            const requestBody: SaveFileRequest = {
              files: [
                {
                  path: currentFile.path,
                  content: currentFile.content,
                },
              ],
            };

            const response = await fetch('/api-save-files', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            });

            const result: ApiResponse = await response.json();
            if (result.success) {
              // 保存成功后，更新 oldContent
              setState((currentState) => {
                const newTabFiles = [...currentState.tabFiles];
                const index = newTabFiles.findIndex(
                  (tab) => tab.path === currentFile.path,
                );
                if (index !== -1) {
                  newTabFiles[index] = {
                    ...newTabFiles[index],
                    oldContent: currentFile.content,
                  };
                }
                return { tabFiles: newTabFiles };
              });
              resolve(true);
            } else {
              setState((currentState) => ({
                ...currentState,
                error: result.error || '保存失败',
              }));
              resolve(false);
            }
          } catch (err) {
            const errorMsg =
              err instanceof Error ? `保存失败: ${err.message}` : '保存失败';
            setState((currentState) => ({
              ...currentState,
              error: errorMsg,
            }));
            resolve(false);
          }
        };

        // 异步执行保存操作
        performSave();
        return prevState;
      });
    });
  }, [setState]);

  /**
   * 更新文件内容
   *
   * 职责：实时更新指定文件的编辑内容
   * - 根据文件路径定位标签页
   * - 更新文件的当前编辑内容
   * - 触发 UI 重新渲染
   */
  const updateFileContent = useCallback(
    (filePath: string, newContent: string): void => {
      setState((prevState) => {
        const tabIndex = prevState.tabFiles.findIndex(
          (tab) => tab.path === filePath,
        );
        if (tabIndex !== -1) {
          const newTabFiles = [...prevState.tabFiles];
          newTabFiles[tabIndex] = {
            ...newTabFiles[tabIndex],
            content: newContent,
          };
          return { ...prevState, tabFiles: newTabFiles };
        }
        return prevState;
      });
    },
    [setState],
  );

  /**
   * 添加文件到标签页
   *
   * 功能说明：
   * 1. 检查文件是否已经打开
   * 2. 如果已打开，切换到对应标签页
   * 3. 如果未打开，创建新标签页并激活
   *
   * 设计原则：避免重复打开相同文件
   */
  const addFileToTabs = useCallback(
    (filePath: string, fileName: string, content = ''): void => {
      setState((prevState) => {
        // 检查文件是否已经打开
        const existingIndex = prevState.tabFiles.findIndex(
          (tab) => tab.path === filePath,
        );
        if (existingIndex !== -1) {
          // 如果已经打开，切换到该标签页
          return { ...prevState, activeTabIndex: existingIndex };
        }

        // 添加新标签页
        const newTab: TabFile = {
          path: filePath,
          name: fileName,
          content: content,
          oldContent: content,
        };

        const newTabFiles = [...prevState.tabFiles, newTab];
        return {
          ...prevState,
          tabFiles: newTabFiles,
          activeTabIndex: newTabFiles.length - 1,
        };
      });
    },
    [setState],
  );

  /**
   * 从标签页移除文件
   *
   * 功能说明：
   * 1. 移除指定索引的标签页
   * 2. 智能调整激活标签页索引
   * 3. 处理最后一个标签页被关闭的情况
   *
   * 设计考量：
   * - 边界检查：防止无效索引操作
   * - 用户体验：关闭标签页后的合理焦点转移
   */
  const removeFileFromTabs = useCallback(
    (index: number): void => {
      setState((prevState) => {
        if (index < 0 || index >= prevState.tabFiles.length) return prevState;

        const newTabFiles = prevState.tabFiles.filter((_, i) => i !== index);
        let newActiveIndex = prevState.activeTabIndex;

        if (newTabFiles.length === 0) {
          newActiveIndex = 0;
        } else if (index <= prevState.activeTabIndex) {
          newActiveIndex = Math.max(0, prevState.activeTabIndex - 1);
        }

        return {
          ...prevState,
          tabFiles: newTabFiles,
          activeTabIndex: Math.min(newActiveIndex, newTabFiles.length - 1),
        };
      });
    },
    [setState],
  );

  /**
   * 切换标签页
   *
   * 职责：激活指定索引的标签页
   * - 边界检查确保索引有效
   * - 更新激活标签页状态
   */
  const switchTab = useCallback(
    (index: number): void => {
      if (index >= 0 && index < state.tabFiles.length) {
        setState({ activeTabIndex: index });
      }
    },
    [state.tabFiles.length, setState],
  );

  /**
   * 检查文件是否被修改
   *
   * 功能说明：比较文件的当前内容与原始内容
   * - 用于显示未保存状态指示器
   * - 支持保存前的确认提示
   */
  const isFileModified = useCallback(
    (filePath: string): boolean => {
      const tabFile = state.tabFiles.find((tab) => tab.path === filePath);
      return tabFile ? tabFile.content !== tabFile.oldContent : false;
    },
    [state.tabFiles],
  );

  /**
   * 获取当前激活的文件
   *
   * 职责：返回当前正在编辑的文件对象
   */
  const getCurrentFile = useCallback((): TabFile | null => {
    return state.tabFiles[state.activeTabIndex] || null;
  }, [state.tabFiles, state.activeTabIndex]);

  /**
   * 获取所有打开的文件
   *
   * 职责：返回所有已打开的标签页文件列表
   */
  const getOpenFiles = useCallback((): TabFile[] => {
    return state.tabFiles;
  }, [state.tabFiles]);

  /**
   * 文件树变更监听效果
   *
   * 功能说明：
   * 1. 监听 developTree 和 fileTree 的变化
   * 2. 同步更新已打开文件的内容
   * 3. 清理已删除文件的标签页
   * 4. 调整激活标签页索引
   *
   * 设计哲学：响应式数据同步
   * - 确保 UI 状态与文件系统状态一致
   * - 智能处理文件删除和内容变更
   */
  useEffect(() => {
    const { developTree, fileTree } = state;
    if (!developTree?.length) return;

    // 构建文件路径到节点的映射 - 性能优化
    const buildMap = (tree: FileTreeNode[]): Map<string, FileTreeNode> => {
      const map = new Map<string, FileTreeNode>();
      const stack = [...(tree ?? [])];
      while (stack.length) {
        const node = stack.pop()!;
        map.set(node.path, node);
        if (node.children?.length) stack.push(...node.children);
      }
      return map;
    };

    const devMap = buildMap(developTree);
    const fileMap = buildMap(fileTree);

    setState((prevState) => {
      let newActiveIndex = prevState.activeTabIndex;
      const newTabFiles: TabFile[] = [];

      prevState.tabFiles.forEach((tab, idx) => {
        const devNode = devMap.get(tab.path);
        const fileNode = fileMap.get(tab.path);

        // 文件已被删除
        if (!devNode && !fileNode) {
          if (idx < newActiveIndex) newActiveIndex -= 1;
          return;
        }

        // 文件内容变更
        let updatedTab = tab;
        if (
          devNode &&
          devNode.content !== undefined &&
          devNode.content !== tab.oldContent
        ) {
          updatedTab = {
            ...tab,
            content: devNode.content,
            oldContent: devNode.content,
          };
        }
        newTabFiles.push(updatedTab);
      });

      // 处理空标签页情况
      if (newTabFiles.length === 0) {
        newActiveIndex = 0;
      }

      return {
        tabFiles: newTabFiles,
        activeTabIndex: Math.min(newActiveIndex, newTabFiles.length - 1),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.developTree, state.fileTree, setState]);

  /**
   * 初始化效果
   *
   * 职责：
   * 1. 获取初始文件树数据
   * 2. 建立 WebSocket 连接
   * 3. 注册清理函数
   */
  useEffect(() => {
    fetchFileTree();
    connectWebSocket();

    // 清理函数 - 组件卸载时断开连接
    return () => {
      disconnectWebSocket();
    };
  }, [fetchFileTree, connectWebSocket, disconnectWebSocket]);

  /**
   * 页面可见性监听效果
   *
   * 功能说明：
   * - 页面重新可见时检查 WebSocket 连接状态
   * - 如果连接断开，自动重新连接
   *
   * 用户体验考量：处理浏览器标签页切换场景
   */
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible' && !state.wsConnected) {
        connectWebSocket();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.wsConnected, connectWebSocket]);

  // 返回 Hook 的公共接口
  return {
    // 状态数据
    fileTree: state.fileTree,
    newFile: state.newFile,
    developTree: state.developTree,
    loading: state.loading,
    error: state.error,
    tabFiles: state.tabFiles,
    activeTabIndex: state.activeTabIndex,
    wsConnected: state.wsConnected,

    // 操作方法
    fetchFileTree,
    saveFile,
    createFile,
    updateFileContent,
    addFileToTabs,
    removeFileFromTabs,
    switchTab,
    isFileModified,
    getCurrentFile,
    getOpenFiles,
    connectWebSocket,
    disconnectWebSocket,
  };
};

export default useFile;
