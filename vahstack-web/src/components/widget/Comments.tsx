/**
 * 评论组件
 *
 * 核心功能：
 * 1. 提供代码行级别的评论输入界面
 * 2. 支持动态高度调整和视图区域更新
 * 3. 表单验证和提交处理
 * 4. 响应式布局和用户交互
 *
 * 设计哲学：
 * - 用户体验优先：自动聚焦、实时验证、动态调整
 * - 组件化设计：独立的评论输入组件，可复用
 * - 响应式架构：支持动态高度变化和视图同步
 * - 类型安全：完整的 TypeScript 类型保护
 */

import { Form, Input, Button, Space } from 'antd';
import { useRef, useState, useEffect } from 'react';

/**
 * 表单提交数据接口
 */
interface CommentFormData {
  comment: string;
}

/**
 * 评论组件属性接口
 *
 * 设计考量：
 * - lineNumber: 关联的代码行号，用于标识评论位置
 * - onSubmit: 评论提交回调，处理用户输入的评论内容
 * - dispose: 组件销毁回调，用于清理资源和关闭评论框
 * - update: 视图区域更新回调，同步组件高度变化
 */
interface CommentBoxProps {
  lineNumber: number;
  onSubmit: (values: CommentFormData) => void;
  dispose: () => void;
  update: (height: number) => void;
}

/**
 * ResizeObserver 条目接口
 */
interface ResizeObserverEntry {
  contentRect: {
    height: number;
    width: number;
  };
}

/**
 * 评论输入组件
 *
 * 核心特性：
 * 1. 自适应高度：根据内容动态调整文本域高度
 * 2. 实时验证：表单字段验证和提交状态管理
 * 3. 视图同步：通过 ResizeObserver 监听高度变化
 * 4. 用户体验：自动聚焦、清除按钮、字符计数
 *
 * 生命周期管理：
 * - 组件挂载时设置客户端就绪状态
 * - 监听容器尺寸变化并同步到父组件
 * - 组件卸载时清理 ResizeObserver 资源
 *
 * 性能优化：
 * - 使用 useRef 避免不必要的重渲染
 * - ResizeObserver 的正确清理防止内存泄漏
 * - 表单验证的防抖处理
 *
 * @param props - 组件属性
 * @returns JSX 元素
 */
export default function CommentBox({
  lineNumber,
  onSubmit,
  dispose,
  update: updateViewZone,
}: CommentBoxProps) {
  // 客户端就绪状态 - 防止服务端渲染问题
  const [clientReady, setClientReady] = useState<boolean>(false);

  // 评论容器引用 - 用于高度监听和DOM操作
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  // Ant Design 表单实例 - 提供表单控制和验证功能
  const [form] = Form.useForm<CommentFormData>();

  /**
   * 高度变化监听效果
   *
   * 功能说明：
   * - 使用 ResizeObserver API 监听容器尺寸变化
   * - 实时同步高度变化到父组件的视图区域
   * - 确保编辑器视图与评论组件高度保持一致
   *
   * 性能考量：
   * - ResizeObserver 比传统的 resize 事件更高效
   * - 正确的清理函数防止内存泄漏
   * - 条件检查避免空引用错误
   */
  useEffect(() => {
    if (commentsContainerRef.current) {
      const resizeObserver = new ResizeObserver(
        (entries: ResizeObserverEntry[]) => {
          for (const entry of entries) {
            const newHeight = entry.contentRect.height;
            // 同步高度变化到父组件 - 保持视图一致性
            if (updateViewZone) updateViewZone(newHeight);
          }
        },
      );

      resizeObserver.observe(commentsContainerRef.current);

      // 清理函数 - 防止内存泄漏
      return () => resizeObserver.disconnect();
    }
  }, [updateViewZone]);

  /**
   * 客户端就绪状态设置
   *
   * 目的：
   * - 解决服务端渲染和客户端渲染的差异
   * - 确保组件在客户端环境下正常工作
   * - 防止提交按钮在初始化时可用
   */
  useEffect(() => {
    setClientReady(true);
  }, []);

  /**
   * 表单提交处理函数
   *
   * 验证逻辑：
   * - 客户端就绪检查
   * - 表单字段触摸状态验证
   * - 表单错误状态检查
   *
   * 用户体验：
   * - 只有在所有条件满足时才允许提交
   * - 实时反馈表单验证状态
   */
  const isSubmitDisabled = (): boolean => {
    return (
      !clientReady ||
      !form.isFieldsTouched(true) ||
      !!form.getFieldsError().filter(({ errors }) => errors.length).length
    );
  };

  return (
    <div ref={commentsContainerRef} className="w-full relative box-border">
      <div
        className="
          flex flex-col justify-between
          bg-white border border-[#ccc]
          px-3
          relative
        "
      >
        {/* 评论输入表单区域 */}
        <div className="flex flex-col justify-center py-3">
          <Form
            name={`operation_comment_${lineNumber}`}
            className="w-full"
            form={form}
            onFinish={onSubmit}
          >
            {/* 评论内容输入框 */}
            <Form.Item
              name="comment"
              className="mb-3"
              rules={[{ required: true, message: '请输入评论内容' }]}
            >
              <Input.TextArea
                placeholder="请输入描述信息!"
                allowClear
                showCount
                autoSize={{ minRows: 2, maxRows: 6 }}
                autoFocus // 自动聚焦提升用户体验
              />
            </Form.Item>

            {/* 操作按钮区域 - 动态更新提交状态 */}
            <Form.Item shouldUpdate className="mb-0">
              {() => (
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    disabled={isSubmitDisabled()}
                  >
                    添加评论
                  </Button>
                  <Button type="default" onClick={dispose}>
                    取消
                  </Button>
                </Space>
              )}
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
}
