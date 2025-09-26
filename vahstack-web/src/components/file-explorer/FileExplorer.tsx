import { useFile } from '../../TaskContext';
import FileTree from './FileTree';
import FileTabBar from './FileTabBar';
import FileEditor from './FileEditor';
import { findNodeByPathIter } from '../chat-input/token';
import { usePathExists } from './usePathExists';
import {
  useEventManager,
  EVENT_TYPES,
  dispatchCustomEvent,
} from '../../hooks/useCustomEvent';

const FileExplorer = ({ openFileTab }) => {
  const {
    fileTree,
    developTree, // 添加developTree数据
    loading,
    error,
    tabFiles,
    activeTabIndex,
    // newFile,
    addFileToTabs,
    removeFileFromTabs,
    switchTab,
    isFileModified,
    getCurrentFile,
    saveFile,
    fetchFileTree,
    updateFileContent, // 确保包含这个方法
  } = useFile();

  const checkPathExists = usePathExists();

  useEventManager(EVENT_TYPES.OPEN_FILE, async (detail) => {
    const REG_REFERENCE = /reference:\s*([^\s]+)/g;

    const { filePath } = detail ?? {};
    if (!filePath) return;

    openFileTab();

    const { developTree: latestDevelopTree } = await fetchFileTree(true);

    const normalized = filePath.replace(/^@/, '');

    let fileNode = findNodeByPathIter(latestDevelopTree, normalized);
    if (!fileNode) {
      // 若不存在则新建
      // fileNode = await createFile(normalized);
    } else {
      addFileToTabs(fileNode.path, fileNode.name, fileNode.content ?? '');
    }

    // 校验 reference 路径是否存在
    const text = fileNode.content;
    const matches = [];
    REG_REFERENCE.lastIndex = 0;

    for (const m of text.matchAll(REG_REFERENCE)) {
      matches.push({ raw: m[1], index: m.index });
    }
    if (!matches.length) {
      dispatchCustomEvent(EVENT_TYPES.UPDATE_TOKEN_CONTENT, {
        filePath: fileNode.path,
        content: fileNode.content,
      });
      return;
    }

    const markerPromises = matches.map(async ({ raw }) => {
      if (!raw || raw.startsWith('@')) return null; // 跳过 @
      const ok = await checkPathExists(raw, fileNode.path);
      return ok ? null : { message: `路径不存在: ${raw}` };
    });

    const markers = (await Promise.all(markerPromises)).filter(Boolean);

    dispatchCustomEvent(EVENT_TYPES.UPDATE_TOKEN_CONTENT, {
      filePath: fileNode.path,
      content: fileNode.content,
      markers,
    });
  });

  const handleFileSelect = async (file) => {
    // 添加文件到标签页
    addFileToTabs(file.path, file.name, file.content || '');
  };

  const handleTabSelect = (index) => {
    switchTab(index);
  };

  const handleTabClose = (index) => {
    removeFileFromTabs(index);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载文件树...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <h3 className="text-xl font-semibold mb-3 text-red-700">加载失败</h3>
          <p className="text-red-600 mb-6">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-gray-50">
      {/* 文件树面板 */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* 主文件树区域 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">文件浏览器</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <FileTree
              fileTree={fileTree}
              onFileSelect={handleFileSelect}
              activeFile={getCurrentFile()?.path}
            />
          </div>
        </div>

        {/* 开发文档区域 */}
        {developTree && developTree.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-md font-semibold text-gray-700">开发文档</h3>
            </div>
            <div className="h-80 overflow-y-auto">
              <FileTree
                fileTree={developTree.flatMap((item) =>
                  item.type === 'directory' && item.children
                    ? item.children
                    : [item],
                )}
                onFileSelect={handleFileSelect}
                activeFile={getCurrentFile()?.path}
              />
            </div>
          </div>
        )}
      </div>

      {/* 编辑器面板 */}
      <div className="flex-1 flex flex-col">
        {/* 标签页栏 */}
        <FileTabBar
          tabFiles={tabFiles}
          activeFileIndex={activeTabIndex}
          onTabSelect={handleTabSelect}
          onTabClose={handleTabClose}
          isFileModified={isFileModified}
        />

        {/* 编辑器 */}
        <FileEditor
          currentFile={getCurrentFile()}
          onSave={saveFile}
          updateFileContent={updateFileContent} // 传递updateFileContent方法
        />
      </div>
    </div>
  );
};

export default FileExplorer;
