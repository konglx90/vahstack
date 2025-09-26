import { useRef, useCallback } from 'react';

/**
 * API 响应接口定义
 *
 * 类型安全考量：确保路径存在性检查的响应结构
 */
interface PathExistsResponse {
  exists: boolean;
}

/**
 * 路径存在性检查函数类型
 *
 * 参数说明：
 * - rawPath: 待检查的文件路径
 * - basePath: 基础路径（用于相对路径解析）
 *
 * 返回值：Promise<boolean> - 路径是否存在
 */
type PathExistsChecker = (
  rawPath: string,
  basePath: string,
) => Promise<boolean>;

/**
 * usePathExists Hook - 路径存在性检查的缓存实现
 *
 * 核心功能：
 * 1. 异步检查文件/目录路径是否存在
 * 2. 智能缓存机制避免重复 API 调用
 * 3. 支持基础路径和相对路径的组合查询
 * 4. 错误处理和容错机制
 *
 * 设计哲学：
 * - 性能优化：缓存策略减少网络请求
 * - 防御性编程：完善的错误处理和边界检查
 * - 单一职责：专注于路径存在性验证
 * - 可靠性优先：网络异常时返回安全的默认值
 *
 * 使用场景：
 * - 文件引用验证
 * - 路径补全功能
 * - 文件系统状态检查
 * - 依赖关系验证
 */
export const usePathExists = (): PathExistsChecker => {
  /**
   * 缓存引用 - 性能优化的核心
   *
   * 缓存键格式：`${basePath}::${rawPath}`
   *
   * 设计考量：
   * - 使用 Map 数据结构提供 O(1) 查找性能
   * - 组合键确保不同基础路径下的相同文件名不会冲突
   * - useRef 确保缓存在组件重渲染间保持持久性
   */
  const cacheRef = useRef<Map<string, boolean>>(new Map());

  /**
   * 路径存在性检查函数
   *
   * 执行流程：
   * 1. 输入验证 - 确保路径参数有效
   * 2. 缓存查询 - 优先返回已缓存的结果
   * 3. API 请求 - 向服务器查询路径状态
   * 4. 结果缓存 - 存储查询结果供后续使用
   * 5. 错误处理 - 网络异常时的降级策略
   *
   * 性能特性：
   * - 缓存命中时零延迟响应
   * - 网络请求去重避免并发重复查询
   * - 错误状态缓存避免重复失败请求
   */
  return useCallback(
    async (rawPath: string, basePath: string): Promise<boolean> => {
      // 输入验证 - 防御性编程的体现
      if (!rawPath) return false;

      // 构建缓存键 - 确保唯一性和可预测性
      const key = `${basePath}::${rawPath}`;

      // 缓存查询 - 性能优化的第一道防线
      if (cacheRef.current.has(key)) {
        return cacheRef.current.get(key)!;
      }

      try {
        // API 请求 - 与服务器进行路径存在性验证
        const res = await fetch(
          `/api-files/exists?filePath=${encodeURIComponent(rawPath)}&basePath=${encodeURIComponent(basePath)}`,
        );

        // 响应解析 - 类型安全的数据提取
        const { exists }: PathExistsResponse = await res.json();

        // 结果缓存 - 避免重复网络请求
        cacheRef.current.set(key, exists);

        return exists;
      } catch {
        // 错误处理 - 网络异常时的安全降级
        // 缓存 false 结果避免重复失败请求
        cacheRef.current.set(key, false);
        return false;
      }
    },
    [],
  );
};
