# 🤝 贡献指南

感谢你考虑为 **AI English Coach** 做出贡献！本文档将帮助你快速上手。

> 任何形式的贡献都被欢迎：报告 Bug、提交 PR、改进文档、分享使用体验...

---

## 📑 目录

- [行为准则](#行为准则)
- [我能做什么贡献？](#我能做什么贡献)
- [提交流程](#提交流程)
- [开发环境搭建](#开发环境搭建)
- [代码规范](#代码规范)
- [Commit 规范](#commit-规范)
- [Pull Request 流程](#pull-request-流程)
- [测试规范](#测试规范)
- [问题反馈](#问题反馈)

---

## 🌟 行为准则

### 我们的承诺
为了营造一个开放、友好的环境，我们承诺：
- 使用友好包容的语言
- 尊重不同观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情

### 不可接受的行为
- 使用性别歧视、种族歧视等不当语言
- 公开他人隐私信息
- 其他不专业或不恰当的行为

---

## 🎁 我能做什么贡献？

### 🐛 报告 Bug
在 [Issues](https://github.com/Xiuuu123/ai-english-coach/issues) 提交 Bug，请包含：
- **复现步骤**：清晰的步骤描述
- **期望行为**：你期望发生什么
- **实际行为**：实际发生了什么
- **环境信息**：浏览器、操作系统、设备类型
- **截图/录屏**：必要时附上

### ✨ 提议新功能
提交 Feature Request，请说明：
- 解决的问题
- 期望的交互方式
- 是否有替代方案

### 🔧 提交代码
- 修复 Bug
- 实现新功能（先在 Issue 中讨论）
- 性能优化
- 重构代码

### 📝 改进文档
- 修正错别字
- 补充使用说明
- 翻译为其他语言

### 🌍 翻译
- 我们尤其欢迎多语言翻译（i18n 尚未实现，欢迎 PR）

---

## 🔄 提交流程

```
1. Fork 本仓库
         ↓
2. Clone 你的 Fork
         ↓
3. 创建特性分支 (feat/xxx / fix/xxx)
         ↓
4. 编写代码 + 提交 (遵循 Commit 规范)
         ↓
5. 推送到你的 Fork
         ↓
6. 创建 Pull Request
         ↓
7. CI 自动构建 + 维护者 Review
         ↓
8. 合并到 main → 自动部署到 GitHub Pages
```

---

## 💻 开发环境搭建

### 前置要求
- **Node.js** ≥ 18.x（推荐 20.x）
- **npm** ≥ 9.x（或 yarn / pnpm）
- **Git**
- **Chrome / Edge** 浏览器（用于 Web Speech API 测试）

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/<your-name>/ai-english-coach.git
cd ai-english-coach

# 2. 安装依赖
npm install

# 3. 复制环境变量
cp .env.example .env
# 编辑 .env，填入你的 LLM API Key

# 4. 启动开发服务器
npm run dev
# 打开 http://localhost:5173

# 5. 构建生产版本（可选）
npm run build
npm run preview
```

### 推荐 IDE
- **VS Code** + 插件：
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - ES7+ React/Redux Snippets

---

## 📐 代码规范

### JavaScript / JSX
- 使用 **ES6+** 语法
- 优先使用**函数组件 + Hooks**，避免类组件
- 组件文件名：`PascalCase.jsx`（如 `MessageBubble.jsx`）
- Hooks 文件名：`useXxx.js`（如 `useSpeechRecognition.js`）
- 工具函数：`camelCase.js`（如 `audioProcessor.js`）
- 缩进：**2 空格**
- 字符串：优先使用**单引号**
- 语句结尾：**分号必加**

### React 组件模板
```jsx
import { useState, useEffect, useCallback } from 'react'

/**
 * 组件简短说明
 * @param {Object} props
 * @param {string} props.title - 标题
 * @param {Function} props.onAction - 操作回调
 */
export default function MyComponent({ title, onAction }) {
  const [state, setState] = useState(null)

  useEffect(() => {
    // 副作用
    return () => { /* 清理 */ }
  }, [])

  const handleClick = useCallback(() => {
    onAction?.(state)
  }, [state, onAction])

  return <div>{title}</div>
}
```

### TailwindCSS
- **避免内联 style**，优先使用 Tailwind 类
- 自定义颜色：在 `tailwind.config.js` 中扩展
- 响应式：移动端优先，使用 `sm:` `md:` `lg:` 断点

```jsx
// ✅ 推荐
<div className="text-sm sm:text-base bg-slate-800 rounded-lg p-4">

// ❌ 不推荐
<div style={{ fontSize: 14, backgroundColor: '#1e293b', ... }}>
```

### 文件组织
```
src/
├── components/      # 通用 UI 组件
├── hooks/           # 自定义 Hooks
├── pages/           # 路由页面
├── services/        # 外部 API 封装
├── utils/           # 纯工具函数
├── data/            # 静态数据
└── App.jsx
```

---

## 📝 Commit 规范

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/)。

### 格式
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型
| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(chat): 添加消息搜索功能` |
| `fix` | Bug 修复 | `fix(tts): 修复 Safari 下无声音问题` |
| `refactor` | 重构（无功能变更） | `refactor(hooks): 拆分 useSpeechRecognition` |
| `docs` | 文档变更 | `docs: 更新 README 安装步骤` |
| `style` | 代码格式（无逻辑变更） | `style: 统一缩进为 2 空格` |
| `test` | 测试相关 | `test: 添加 MessageBubble 单元测试` |
| `chore` | 杂项（构建/依赖） | `chore: 升级 vite 到 5.4` |
| `perf` | 性能优化 | `perf: useMemo 缓存场景列表` |

### Scope 范围（可选）
- `chat` - 对话相关
- `tts` - 语音合成
- `stt` / `speech` - 语音识别
- `ui` - 界面
- `hooks` - 自定义 Hooks
- `components` - 组件
- `build` - 构建配置
- `deps` - 依赖

### Subject 主题
- 使用**中文**或英文均可（建议中文）
- **不超过 50 字**
- **动词开头**：添加 / 修复 / 优化 / 重构
- **不加句号**

### 示例
```
feat(chat): 添加语音消息气泡 (绿色主题 + 分词高亮 + 评分报告)
fix(tts): 修复 Chrome 取消合成后残余音频问题
docs: 完善 README 技术栈表格
refactor(hooks): 提取 useAudioDevices 通用设备管理逻辑
```

---

## 🔀 Pull Request 流程

### 1. 创建分支
```bash
git checkout -b feat/your-feature
# 或
git checkout -b fix/your-bug
```

### 2. 提交前自查
- [ ] 代码可在本地 `npm run dev` 正常运行
- [ ] `npm run build` 构建无错误
- [ ] 新功能已在 Chrome / Edge 浏览器测试
- [ ] 移动端（手机模式）布局正常
- [ ] 敏感信息（API Key）未提交
- [ ] 代码风格与项目一致
- [ ] 复杂逻辑添加了注释

### 3. 推送并创建 PR
```bash
git push origin feat/your-feature
```
然后在 GitHub 上点击 **"Compare & pull request"**。

### 4. PR 标题与描述

**标题**：`feat(scope): 简洁描述`（同 Commit 标题）

**描述模板**：
```markdown
## 功能描述
简要说明这个 PR 做了什么

## 改动原因
为什么需要这个改动

## 涉及文件
- file1.jsx
- file2.js

## 截图/录屏（如有 UI 变更）

## 测试方式
1. 步骤 1
2. 步骤 2

## 检查清单
- [ ] 本地运行无错误
- [ ] 已在 Chrome 浏览器测试
- [ ] 已在移动端测试
- [ ] 更新了相关文档
```

### 5. 等待 Review
- 维护者会在 1-3 天内 Review
- 根据反馈修改后 force-push 即可
- 合并后会自动部署到 GitHub Pages

---

## 🧪 测试规范

### 手动测试清单
- [ ] 场景选择 → 选场景 → 进入对话
- [ ] 长按麦克风 → 录音 → 识别 → 发送
- [ ] 取消录音（桌面/移动端两种方式）
- [ ] 文字输入 → 发送
- [ ] 单词点击 → 浮窗显示音标+释义
- [ ] AI 回复 → 自动播放语音
- [ ] 语速/口音切换 → 持久化
- [ ] VIP 流程 → 次数限制 → 弹窗
- [ ] 刷新页面 → 状态恢复
- [ ] 移动端（DevTools 设备模式）布局

### 单元测试（未来 Roadmap）
- 工具：`Vitest` + `@testing-library/react`
- 目标覆盖率：核心 hooks 和工具函数 > 80%

---

## 💬 问题反馈

### 提交 Issue 前
1. 搜索现有 Issue 避免重复
2. 确认使用最新版本
3. 收集必要信息（环境/日志/截图）

### 联系方式
- **GitHub Issues**: [提交问题](https://github.com/Xiuuu123/ai-english-coach/issues)
- **Discussions**: [讨论区](https://github.com/Xiuuu123/ai-english-coach/discussions)
- **Email**: xiuxiu@yourdomain.com（占位）

---

## 📜 开源协议

提交代码即表示你同意以 [MIT License](./LICENSE) 协议开源你的贡献。

---

<div align="center">
  <sub>感谢每一位贡献者 ❤️</sub>
  <br>
  <sub>Made with React + Vite + TailwindCSS</sub>
</div>
