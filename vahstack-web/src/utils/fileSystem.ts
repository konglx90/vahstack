import { configure, fs, InMemory } from '@zenfs/core';
import { IndexedDB } from '@zenfs/dom';
import type { FileSystemConfig } from '../types';

/**
 * 文件系统管理器 - 统一抽象层
 *
 * 设计哲学：
 * - 适配器模式：为不同存储后端提供统一接口
 * - 单例初始化：防止重复配置导致的资源冲突
 * - 防御性编程：优雅处理初始化竞态条件
 */
export class FileSystemManager {
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private config: FileSystemConfig;

  constructor(config: FileSystemConfig) {
    this.config = config;
  }

  /**
   * 幂等初始化 - 确保文件系统只配置一次
   *
   * 为什么需要复杂的初始化逻辑：
   * 1. ZenFS不支持重复配置同一挂载点
   * 2. 多个组件可能同时尝试初始化
   * 3. 需要区分"已配置"和"配置失败"两种状态
   */
  async initialize(config?: FileSystemConfig): Promise<void> {
    const fsConfig = config || this.config;

    // 快速路径：已初始化则直接返回
    if (this.initialized) {
      console.log('FileSystemManager: Already initialized, skipping...');
      return;
    }

    // 防止并发初始化：如果正在初始化，等待完成
    if (this.initializationPromise) {
      console.log('FileSystemManager: Initialization in progress, waiting...');
      return this.initializationPromise;
    }

    console.log('FileSystemManager: Starting initialization...');
    this.initializationPromise = this._doInitialize(fsConfig);
    try {
      await this.initializationPromise;
    } finally {
      // 清理Promise引用，允许后续重试（如果失败）
      this.initializationPromise = null;
    }
  }

  /**
   * 强制重新初始化 - 主要用于测试场景
   *
   * 生产环境中应避免使用，因为会破坏文件系统状态
   */
  async forceReinitialize(config?: FileSystemConfig): Promise<void> {
    console.log('FileSystemManager: Force reinitializing...');
    this.initialized = false;
    this.initializationPromise = null;

    // 清理初始化标记，强制重新配置
    try {
      fs.unlinkSync('/.zenfs-initialized');
      console.log('Removed initialization marker file');
    } catch (error) {
      console.log('No marker file to remove or failed to remove:', error);
    }

    await this.initialize(config);
  }

  /**
   * 实际的初始化逻辑 - 处理ZenFS配置的复杂性
   *
   * 核心挑战：
   * - ZenFS挂载点冲突检测不够精确
   * - 需要区分"我们的配置"vs"其他配置"
   * - 错误恢复策略
   */
  private async _doInitialize(config: FileSystemConfig): Promise<void> {
    try {
      console.log(
        `Starting file system initialization with type: ${config.type}`,
      );

      // 智能检测：通过标记文件判断是否已由我们初始化
      // 避免误判其他代码的ZenFS配置
      try {
        fs.accessSync('/.zenfs-initialized');
        this.initialized = true;
        console.log(
          `File system already configured and available (type: ${config.type})`,
        );
        return;
      } catch {
        // 标记文件不存在，需要初始化文件系统
        console.log(`Initializing new file system with type: ${config.type}`);
      }

      // 策略模式：根据配置选择存储后端
      const mountConfig = this._getMountConfig(config);

      await configure({
        mounts: {
          '/': mountConfig,
        },
      });

      // 创建标记文件 - 包含类型和时间戳用于调试
      try {
        fs.writeFileSync('/.zenfs-initialized', `${config.type}-${Date.now()}`);
      } catch (error) {
        console.warn('Failed to create initialization marker file:', error);
      }

      this.initialized = true;
      console.log(`File system initialized with type: ${config.type}`);
    } catch (error) {
      // 优雅降级：如果是挂载点冲突，假设已正确配置
      // 这是对ZenFS API限制的务实妥协
      if (
        error instanceof Error &&
        (error.message.includes('Mount point is already in use') ||
          error.message.includes('already configured'))
      ) {
        this.initialized = true;
        console.log(
          `File system already initialized with type: ${config.type}`,
        );

        // 补充创建标记文件
        try {
          fs.writeFileSync(
            '/.zenfs-initialized',
            `${config.type}-${Date.now()}`,
          );
        } catch (markerError) {
          console.warn(
            'Failed to create initialization marker file:',
            markerError,
          );
        }

        return;
      }
      console.error('Failed to initialize file system:', error);
      throw error;
    }
  }

  /**
   * 存储后端配置映射
   *
   * 扩展点：新增存储类型时在此添加配置
   */
  private _getMountConfig(config: FileSystemConfig) {
    console.log(`_getMountConfig: ${config.type}`);
    switch (config.type) {
      case 'memory':
        return InMemory; // 开发/测试：快速但不持久
      case 'indexeddb':
        return IndexedDB; // 生产：持久化浏览器存储
      case 'localstorage':
        // TODO: LocalStorage后端需要额外配置
        return InMemory; // 临时回退到内存存储
      default:
        throw new Error(`Unsupported file system type: ${config.type}`);
    }
  }

  /**
   * 获取底层文件系统实例
   *
   * 防御性检查：确保在初始化后才能访问
   */
  getFileSystem() {
    if (!this.initialized) {
      throw new Error('File system not initialized');
    }
    return fs;
  }

  // ========== 同步API：直接暴露底层能力 ==========
  //
  // 设计决策：提供同步版本是因为：
  // 1. ZenFS底层操作本质上是同步的（内存/IndexedDB同步API）
  // 2. Shell命令需要同步执行以保持REPL语义
  // 3. 避免async/await开销和复杂性

  createDirectorySync(path: string): void {
    try {
      fs.mkdirSync(path, { recursive: true });
    } catch (error) {
      console.error(`Failed to create directory ${path}:`, error);
      throw error;
    }
  }

  writeFileSync(path: string, content: string): void {
    try {
      // 自动创建父目录 - 用户友好的默认行为
      const dir = path.substring(0, path.lastIndexOf('/'));
      if (dir && dir !== '/') {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(path, content, 'utf8');
    } catch (error) {
      console.error(`Failed to write file ${path}:`, error);
      throw error;
    }
  }

  readFileSync(path: string): string {
    try {
      const content = fs.readFileSync(path, 'utf8');
      return content;
    } catch (error) {
      console.error(`Failed to read file ${path}:`, error);
      throw error;
    }
  }

  readFileBinarySync(path: string): Buffer {
    try {
      const content = fs.readFileSync(path);
      return content;
    } catch (error) {
      console.error(`Failed to read binary file ${path}:`, error);
      throw error;
    }
  }

  listDirectorySync(path: string): string[] {
    try {
      const files = fs.readdirSync(path);
      return files;
    } catch (error) {
      console.error(`Failed to list directory ${path}:`, error);
      throw error;
    }
  }

  deleteFileSync(path: string): void {
    try {
      fs.unlinkSync(path);
    } catch (error) {
      console.error(`Failed to delete file ${path}:`, error);
      throw error;
    }
  }

  existsSync(path: string): boolean {
    try {
      fs.accessSync(path);
      return true;
    } catch {
      return false; // 不存在或无权限都视为false
    }
  }

  /**
   * 获取文件状态信息
   * @param path 文件路径
   * @returns 文件状态对象，包含 isDirectory() 方法
   */
  statSync(path: string) {
    try {
      return fs.statSync(path);
    } catch (error) {
      console.error(`Failed to stat file ${path}:`, error);
      throw error;
    }
  }

  /**
   * 检查路径是否为目录
   * @param path 文件路径
   * @returns 如果是目录返回 true，否则返回 false
   */
  isDirectorySync(path: string): boolean {
    try {
      const stat = fs.statSync(path);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  // ========== 异步API：向后兼容层 ==========
  //
  // 保留原因：
  // 1. 向后兼容现有调用代码
  // 2. 未来可能需要真正的异步操作
  // 3. 提供一致的Promise接口
  //
  // 实现策略：内部调用同步方法，避免ArrayBuffer detached问题

  async createDirectory(path: string): Promise<void> {
    try {
      // 委托给同步实现 - 避免ZenFS异步API的已知问题
      fs.mkdirSync(path, { recursive: true });
    } catch (error) {
      console.error(`Failed to create directory ${path}:`, error);
      throw error;
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    try {
      // 确保目录存在 - 用户友好的默认行为
      const dir = path.substring(0, path.lastIndexOf('/'));
      if (dir && dir !== '/') {
        fs.mkdirSync(dir, { recursive: true });
      }
      // 使用同步方法避免 ArrayBuffer detached 问题
      fs.writeFileSync(path, content, 'utf8');
    } catch (error) {
      console.error(`Failed to write file ${path}:`, error);
      throw error;
    }
  }

  async readFile(path: string): Promise<string> {
    try {
      // 使用同步方法避免 ArrayBuffer detached 问题
      const content = fs.readFileSync(path, 'utf8');
      return content;
    } catch (error) {
      console.error(`Failed to read file ${path}:`, error);
      throw error;
    }
  }

  async listDirectory(path: string): Promise<string[]> {
    try {
      // 使用同步方法避免 ArrayBuffer detached 问题
      const files = fs.readdirSync(path);
      return files;
    } catch (error) {
      console.error(`Failed to list directory ${path}:`, error);
      throw error;
    }
  }

  async deleteFile(path: string): Promise<void> {
    try {
      // 使用同步方法避免 ArrayBuffer detached 问题
      fs.unlinkSync(path);
    } catch (error) {
      console.error(`Failed to delete file ${path}:`, error);
      throw error;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      // 使用同步方法避免 ArrayBuffer detached 问题
      fs.accessSync(path);
      return true;
    } catch {
      return false;
    }
  }
}

// Create and export a default instance
export const fileSystemManager = new FileSystemManager({
  type: 'memory',
  name: 'default',
});
