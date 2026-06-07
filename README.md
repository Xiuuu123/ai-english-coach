# 🎙️ AI English Coach · AI 英语口语陪练

> 一款基于 Web 的 **实时 AI 英语口语对话与训练工具**。
> 支持场景化对话、逐句纠错、发音评测、单词学习，移动端/桌面端同源同构。

<p align="left">
  <img alt="React" src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/TailwindCSS-3.x-38B2AC?logo=tailwind-css&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-success">
  <img alt="Deploy" src="https://img.shields.io/badge/Deploy-GitHub%20Pages-222?logo=github">
  <img alt="Status" src="https://img.shields.io/badge/Status-Active-brightgreen">
</p>

🔗 **在线体验**: [xiuuu123.github.io/ai-english-coach](https://xiuuu123.github.io/ai-english-coach/)
📦 **仓库地址**: [github.com/Xiuuu123/ai-english-coach](https://github.com/Xiuuu123/ai-english-coach)

---

## ✨ 项目亮点

| 🚀 **本地优先** | ⚡ **低延迟** | 🎯 **场景化** | 🧩 **可扩展** |
|:---:|:---:|:---:|:---:|
| 会话/会员/进度数据全部 `localStorage` 持久化，零后端部署 | Web Speech + 流式 LLM + TTS，端到端 < 1s | 内置面试/点餐/会议/旅行等 10+ 场景 | 组件 + Hooks 高度解耦，新增场景/模型只需配置 |

> 💡 **核心理念**：不依赖复杂后端，不上传隐私语音，会话全程在浏览器内完成。

---

## 🧱 技术栈

### 1️⃣ 前端框架与样式

| 模块 | 技术 / 工具 | 特点 |
|------|-------------|------|
| 框架 | **React 18.3** | 函数组件 + Hooks，零类组件 |
| 路由 | **react-router-dom 6.26** | 场景选择 → 对话 → 总结 三段式 |
| 构建 | **Vite 5.4** | 毫秒级 HMR，1.6s 完成 production build |
| 样式 | **TailwindCSS 3.x** | 响应式 + 深色科技风，霓虹发光/半透明卡片 |
| 图标 | **Emoji + 内联 SVG** | 零图标库依赖，首屏轻量 |

### 2️⃣ 业务逻辑层

| 模块 | 技术 / 工具 | 特点 |
|------|-------------|------|
| 状态管理 | **React Hooks** | `useState` / `useRef` / `useEffect`，无 Redux 依赖 |
| 持久化 | **localStorage + 自定义 Hook** | 会话、会员、进度 3 套独立命名空间 |
| 音效 | **WebAudio API + 自研 soundEffects** | 录音开始/结束/发送 3 段轻提示音 |
| 模块化 | **Components / Hooks / Services / Utils** | 4 层目录清晰分层 |

### 3️⃣ 语音处理

| 模块 | 技术 / 工具 | 特点 |
|------|-------------|------|
| ASR | **Web Speech API** | 浏览器原生，低延迟识别 |
| TTS | **Web Speech Synthesis** | 语速/口音/风格可切换 |
| 录音 | **MediaRecorder + AudioContext** | 实时音量波形可视化 (Canvas) |
| 双口音 | **SpeechSynthesisVoice** | 美式 `en-US` / 英式 `en-GB` 切换 |

### 4️⃣ 评测与纠错

| 模块 | 技术 / 工具 | 特点 |
|------|-------------|------|
| 对话生成 | **DeepSeek / OpenAI 兼容 API** | 流式 `stream: true`，首字 < 300ms |
| 语法纠错 | **大模型结构化输出** | JSON Schema 强约束，零解析失败 |
| 发音评分 | **综合分 + 4 维度** | 流利度/语法/词汇/发音 进度条可视化 |
| 单词高亮 | **tokenizeForRender** | 单词级 click 绑定 + hover 词典预览 |

### 5️⃣ 存储与会员

| 模块 | 技术 / 工具 | 特点 |
|------|-------------|------|
| 进度 | `localStorage["aiec.progress"]` | 跨场景累计时长/轮次 |
| 会员 | `localStorage["aiec.vip"]` | VIP 到期时间 + 等级 |
| 次数 | `localStorage["aiec.scene_<id>"]` | 每个场景独立计数 |
| 对话历史 | `localStorage["aiec.conv_<sceneId>"]` | 支持断点续聊 |

### 6️⃣ 部署与 CI/CD

| 模块 | 技术 / 工具 | 特点 |
|------|-------------|------|
| 托管 | **GitHub Pages** | 静态站点免费托管 |
| CI/CD | **GitHub Actions** | `push to main` → 自动 build + deploy |
| 环境变量 | `.env.example` 模板 | Vite 注入 `VITE_*` 前缀 |
| 工作流 | `.github/workflows/deploy.yml` | build job + deploy job 分离 |

---

## 🎯 核心功能

### ✅ 场景化对话练习
- 10+ 内置场景：**面试** / **点餐** / **会议** / **旅行问路** / **商务谈判** 等
- 每个场景独立提示词、独立次数配额
- 难度分级：CEFR A2 / B1 / B2 可选

### ✅ 实时语音对话，低延迟端到端交互
- 按住麦克风 → ASR → LLM → TTS → 自动播放
- 实时音量波形 (`VoiceWaveform`)，用户清晰感知录音状态

### ✅ 逐句即时纠错（语法 / 发音 / 表达）
- 鼠标 hover 单词查看建议
- **桌面端**: 右侧固定 360px 评估面板
- **移动端**: 底部抽屉式弹出

### ✅ 单词分词解析 + 点击查词
- ASR 转写文本自动按单词拆分
- 点击单词 → 弹出浮窗：**音标 + 词性 + 中文释义 + 🔊 播放**

### ✅ 场景次数限制与会员体系
- 免费用户：每场景 3 次/天
- VIP 用户：无限次数 + 高级场景
- 弹窗引导升级，付款流程占位

### ✅ 深色科技风界面，PC/移动响应式
- 主色：`#0f172a` (slate-900) + `emerald-500` + `indigo-500`
- 霓虹发光边框：`box-shadow: 0 0 20px rgba(99,102,241,0.15)`
- 移动端麦克风按钮自适应 (72px → 安全区兼容)

### ✅ 微信式长按录音（双端体验）
- **桌面端**: 鼠标按下录音，悬浮「✕ 取消」按钮，鼠标移动不触发取消
- **移动端**: 长按录音，上滑 > 50px 进入取消模式
- 录音中显示实时秒数 + 声波动画

### ✅ 语音消息气泡 + 评分报告
- 绿色用户气泡：`ME` 标识 + 时长 + 发音评分
- 蓝色/紫色 AI 气泡：回复文本 + 重播按钮 + 纠错标记
- 评分可点击展开：4 维度雷达图 + 综合分环

---

## 🚀 快速开始

### 方式一：在线体验（推荐）

直接访问 👉 [xiuuu123.github.io/ai-english-coach](https://xiuuu123.github.io/ai-english-coach/)

> 首次使用请使用 **Chrome / Edge** 浏览器，支持 Web Speech API。

### 方式二：本地运行

#### 1. 克隆仓库
```bash
git clone https://github.com/Xiuuu123/ai-english-coach.git
cd ai-english-coach
```

#### 2. 安装依赖
```bash
npm install
# 或使用国内镜像
npm install --registry=https://registry.npmmirror.com
```

#### 3. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env，填入你的 LLM API Key（默认已带 DeepSeek 演示 Key）
```

#### 4. 启动开发服务器
```bash
npm run dev
# 默认端口 http://localhost:5173
```

#### 5. 构建生产版本
```bash
npm run build      # 输出到 dist/
npm run preview    # 本地预览 dist/
```

#### 6. Windows 一键启动
```bash
# 直接双击 start.bat 即可启动开发服务器
```

---

## 🏛️ 系统架构

### 数据流图

```
┌──────────────────────────────────────────────────────────┐
│                         浏览器                           │
│                                                          │
│  ┌────────┐   ┌──────────┐   ┌──────────┐   ┌────────┐  │
│  │ 🎤 用户 │──▶│ Web      │──▶│ DeepSeek │──▶│ TTS    │  │
│  │ 语音输入│   │ Speech   │   │ LLM API  │   │ Speech │  │
│  │        │   │ API      │   │ (流式)   │   │ Synthesis│ │
│  └────────┘   └────┬─────┘   └────┬─────┘   └────┬───┘  │
│       ▲           │ ASR转写      │ 结构化JSON   │ 语音  │
│       │           ▼              ▼              ▼       │
│  ┌──────────────────────────────────────────────────┐   │
│  │  React 前端                                      │   │
│  │  • 绿色用户气泡 (VoiceMessageBubble)            │   │
│  │  • 蓝色 AI 气泡 (MessageBubble)                 │   │
│  │  • 分词文本面板 (可点击查词)                    │   │
│  │  • 右侧纠错面板 (RealTimeCorrectionPanel)       │   │
│  │  • 评分可视化 (ScoreVisualizer)                 │   │
│  └──────────────────────────────────────────────────┘   │
│       ▲                                                  │
│       │                                                  │
│  ┌────┴─────┐                                            │
│  │localStorage│  会话 / 会员 / 进度 (本地持久化)         │
│  └──────────┘                                            │
└──────────────────────────────────────────────────────────┘
```

### 核心流程

1. **用户按住麦克风** → MediaRecorder 启动
2. **Web Speech API** 实时识别，临时文本流式渲染
3. **松开麦克风** → 停止识别，提取最终文本
4. **fetch LLM API** (流式) → 首字 < 300ms
5. **AI 响应** 同时执行：TTS 播放 + 渲染气泡 + 高亮纠错
6. **用户点击单词** → 弹出词典浮窗（音标+释义+播放）

### 隐私与本地优先

> 🔒 **零数据上传**：用户语音/对话全程不离开浏览器，**仅 LLM 调用时将文本发送至 API**。
> 所有会话记录、会员状态、练习进度均存储在浏览器 `localStorage`。

---

## 📁 项目结构

```
ai-english-coach/
├── .github/workflows/        # GitHub Actions 自动部署
│   └── deploy.yml
├── public/                   # 静态资源
├── src/
│   ├── components/           # UI 组件 (12 个)
│   │   ├── VoiceMessageBubble.jsx    # 语音气泡 v9
│   │   ├── WordPopup.jsx              # 词典浮窗
│   │   ├── RealTimeCorrectionPanel.jsx # 纠错面板
│   │   ├── ScoreVisualizer.jsx        # 评分可视化
│   │   ├── VoiceWaveform.jsx          # 声波
│   │   ├── TTSControlBar.jsx          # 语速/口音切换
│   │   └── ...                        # 其他 6 个
│   ├── hooks/                # 自定义 Hooks (7 个)
│   │   ├── useSpeechRecognition.js    # ASR + 录音时长
│   │   ├── useTTS.js                  # TTS 引擎
│   │   ├── useMembership.js           # 会员状态
│   │   └── ...
│   ├── pages/                # 页面 (4 个)
│   │   ├── SceneSelectPage.jsx        # 场景选择
│   │   ├── ChatPage.jsx               # 核心对话页
│   │   ├── SummaryPage.jsx            # 练习总结
│   │   └── VipPage.jsx                # VIP 会员
│   ├── services/
│   │   └── chatService.js             # LLM API 封装
│   ├── data/
│   │   └── scenes.js                  # 10+ 场景配置
│   ├── utils/                # 工具函数
│   │   ├── pronunciation.js           # 发音评分
│   │   ├── audioProcessor.js          # 音频处理
│   │   └── soundEffects.js            # 音效
│   ├── App.jsx               # 路由根
│   ├── main.jsx              # 入口
│   └── index.css             # 全局样式 + 动画
├── .env.example              # 环境变量模板
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── start.bat                 # Windows 一键启动
```

---

## 🛠️ 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器（HMR 热更新） |
| `npm run build` | 构建生产版本到 `dist/` |
| `npm run preview` | 本地预览生产构建 |

---

## 🤝 贡献指南

欢迎提交 Issue / Pull Request 改进本项目！

### 提交流程

1. **Fork** 本仓库
2. 创建特性分支 (`git checkout -b feat/your-feature`)
3. 提交代码 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feat/your-feature`)
5. 提交 **Pull Request**

### Commit 规范

本项目遵循 Conventional Commits 规范：

```
feat(scope): 新功能
fix(scope):  修复 Bug
refactor(scope): 重构
docs(scope): 文档变更
chore(scope): 杂项
```

### 行为准则

- 保持代码风格一致（参考现有 Tailwind + 函数组件模式）
- 重要改动请同步更新 `PR_RECORDS.md`
- 涉及 API Key 等敏感信息请勿提交

---

## 📜 开源协议

本项目基于 **MIT License** 开源 — 详情见 [LICENSE](./LICENSE) 文件。

```
MIT License

Copyright (c) 2026 AI English Coach Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

## 🌟 Star History

如果这个项目对你有帮助，欢迎点 ⭐ 支持一下！

<p align="left">
  <a href="https://github.com/Xiuuu123/ai-english-coach">
    <img alt="GitHub stars" src="https://img.shields.io/github/stars/Xiuuu123/ai-english-coach?style=social">
  </a>
  <a href="https://github.com/Xiuuu123/ai-english-coach/fork">
    <img alt="GitHub forks" src="https://img.shields.io/github/forks/Xiuuu123/ai-english-coach?style=social">
  </a>
</p>

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/Xiuuu123">@Xiuuu123</a></sub>
  <br>
  <sub>Powered by React + Vite + TailwindCSS · Deployed on GitHub Pages</sub>
</div>
