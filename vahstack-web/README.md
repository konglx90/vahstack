# VahStack Next - 基于浏览器的终端模拟器

VahStack Next 是一个现代化的基于浏览器的终端模拟器，使用 React + TypeScript + Vite 构建，集成了 @zenfs/core 文件系统和 @xterm/xterm 终端组件。

## 🚀 特性

- **现代化终端体验**: 基于 @xterm/xterm 的高性能终端模拟器
- **浏览器文件系统**: 使用 @zenfs/core 提供完整的文件系统 API
- **多种存储后端**: 支持内存、IndexedDB 等多种存储方式
- **TypeScript 支持**: 完整的类型安全和开发体验
- **响应式设计**: 适配各种屏幕尺寸
- **实时命令执行**: 支持常用的 Unix 命令

## 🛠️ 技术栈

| 技术 | 版本 | 描述 |
|------|------|------|
| React | ^18.3.1 | 用户界面库 |
| TypeScript | ^5.6.2 | 类型安全的 JavaScript |
| Vite | ^7.1.7 | 现代化构建工具 |
| @zenfs/core | ^1.0.0 | 现代化浏览器文件系统库 |
| @xterm/xterm | ^5.5.0 | 终端模拟器组件 |
| ShellJS | ^0.8.5 | Shell 命令执行库 |

## 📦 快速开始

### 安装依赖

```bash
# 使用 tnpm (推荐)
tnpm install

# 或使用 npm
npm install
```

### 启动开发服务器

```bash
# 使用 tnpm
tnpm run dev

# 或使用 npm
npm run dev
```

访问 [http://localhost:5173](http://localhost:5173) 查看应用。

### 构建生产版本

```bash
# 使用 tnpm
tnpm run build

# 或使用 npm
npm run build
```

## 🎯 使用说明

### 支持的命令

- `help` - 显示帮助信息
- `ls` - 列出目录内容
- `pwd` - 显示当前工作目录
- `cd <目录>` - 切换目录
- `mkdir <目录名>` - 创建目录
- `touch <文件名>` - 创建文件
- `cat <文件名>` - 显示文件内容
- `echo <文本>` - 输出文本
- `clear` - 清空终端

### 文件系统配置

应用支持多种文件系统后端：

- **memory**: 内存文件系统（默认）
- **indexeddb**: 基于 IndexedDB 的持久化存储
- **localstorage**: 基于 LocalStorage 的存储

## 📁 项目结构

```
src/
├── components/          # React 组件
│   └── Terminal.tsx     # 终端组件
├── types/              # TypeScript 类型定义
│   └── index.ts        # 核心类型
├── utils/              # 工具函数
│   └── fileSystem.ts   # 文件系统管理器
├── App.tsx             # 主应用组件
├── App.css             # 应用样式
└── main.tsx            # 应用入口
```

## 🔧 开发指南

### 添加新命令

在 `src/components/Terminal.tsx` 的 `executeCommand` 函数中添加新的命令处理逻辑：

```typescript
case 'your-command':
  // 命令处理逻辑
  terminal.writeln('Command output');
  break;
```

### 扩展文件系统

在 `src/utils/fileSystem.ts` 中添加新的文件系统操作方法。

### 自定义主题

修改 `src/App.css` 或在终端配置中设置自定义主题。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
