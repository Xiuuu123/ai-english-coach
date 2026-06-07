# 🎙️ AI English Coach · AI 英语口语陪练

> 一款基于 **Web 实时语音 + 大模型** 的英语口语陪练应用。
> 零后端、纯前端架构，对标 PWA 级离线优先体验，支持场景化对话、逐句纠错、发音评测。

<p align="left">
  <img alt="React" src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/TailwindCSS-3.x-38B2AC?logo=tailwind-css&logoColor=white">
  <img alt="Web Speech API" src="https://img.shields.io/badge/Web_Speech_API-Native-FF6B6B">
  <img alt="Web Audio" src="https://img.shields.io/badge/Web_Audio_API-Low_Latency-9B59B6">
  <img alt="Streaming" src="https://img.shields.io/badge/Streaming-SSE-00C853">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-success">
  <img alt="Deploy" src="https://img.shields.io/badge/Deploy-GitHub%20Pages-222?logo=github">
</p>

🔗 **在线体验**: [xiuuu123.github.io/ai-english-coach](https://xiuuu123.github.io/ai-english-coach/)
📦 **仓库地址**: [github.com/Xiuuu123/ai-english-coach](https://github.com/Xiuuu123/ai-english-coach)
> **点击链接直接在线观看（无需下载或注册网盘）**  
🎬 项目演示 Demo 视频:https://www.bilibili.com/video/BV176Et6sExM?vd_source=352d038b6321dc9421969cccfa145e7b

---

## 🎯 项目定位

| 🚀 **本地优先** | ⚡ **流式低延迟** | 🎯 **场景化** | 🧩 **可扩展** |
|:---:|:---:|:---:|:---:|
| 零后端依赖，会话/会员/进度全部 `localStorage` 持久化 | SSE 流式 LLM + Web Speech 浏览器原生 | 10+ 内置场景（面试/会议/旅行/学术） | Components / Hooks / Services 4 层解耦 |

---

## 🏛️ 系统架构

### 1. 整体架构图

```
┌────────────────────────────────────────────────────────────────────┐
│                          浏览器 (Browser)                          │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐  │
│  │  React 18    │  │  Vite 5      │  │  Tailwind 3  │  │ Router 6│  │
│  │  Function    │  │  HMR + ESM  │  │  JIT + Purge │  │ History │  │
│  │  Components  │  │  1.6s build  │  │  9.9KB gzip  │  │  Mode   │  │
│  └──────┬───────┘  └──────────────┘  └──────────────┘  └─────────┘  │
│         │                                                             │
│  ┌──────▼─────────────────────────────────────────────────────────┐  │
│  │                     自定义 Hooks 层 (7 个)                     │  │
│  │  useSpeechRecognition │ useTTS │ useMembership │ useAudio...  │  │
│  │  useConversationPersistence │ useProgressTracker │ useLevel  │  │
│  └──────┬─────────────────────────────────────────────────────────┘  │
│         │                                                             │
│  ┌──────▼──────────────────────┐  ┌──────────────────────────────┐  │
│  │   Web Speech API (浏览器原生) │  │   Web Audio API (低延迟管线)   │  │
│  │   • SpeechRecognition (ASR)  │  │   • MediaStreamSource         │  │
│  │   • SpeechSynthesis (TTS)    │  │   • NoiseGate                 │  │
│  │   • 多口音/语速/音调          │  │   • LowPassFilter (10kHz)     │  │
│  └──────────────────────────────┘  │   • DynamicsCompressor (AGC)  │  │
│                                     │   • AnalyserNode → 波形可视化 │  │
│  ┌──────────────────────────────────▼───────────────────────────┐  │
│  │                  LLM API (OpenAI 兼容协议)                    │  │
│  │  • POST /chat/completions                                     │  │
│  │  • stream: true (SSE 增量返回)                                 │  │
│  │  • response_cache (60s TTL) + prewarm_connection (TCP 预热)  │  │
│  │  • exponential backoff 重试 (MAX_RETRIES=2)                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│         │                                                             │
│  ┌──────▼─────────────────────────────────────────────────────────┐  │
│  │                  localStorage 持久化层 (4 个命名空间)          │  │
│  │  aiec.vip / aiec.progress / aiec.scene_<id> / aiec.conv_<id> │  │
│  └────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 2. 数据流时序图

```
用户操作          浏览器原生 API        React 状态         LLM API         持久化
  │                    │                  │                 │              │
  │  mousedown         │                  │                 │              │
  ├───────────────────►│ getUserMedia     │                 │              │
  │                    │ start Listening  │                 │              │
  │                    ├─────────────────►│ isListening=true│              │
  │                    │                  │                 │              │
  │  说话中             │ onresult 增量     │                 │              │
  │                    │ interim → final  │                 │              │
  │                    ├─────────────────►│ transcript      │              │
  │                    │                  │                 │              │
  │  mouseup           │ stop Listening   │                 │              │
  │                    ├─────────────────►│ stop()          │              │
  │                    │                  │ fetch (SSE)     │              │
  │                    │                  ├────────────────►│              │
  │                    │                  │                 │              │
  │                    │                  │   chunk1        │              │
  │                    │                  │◄────────────────┤              │
  │                    │                  │   chunk2        │              │
  │                    │                  │   (流式渲染)     │              │
  │                    │                  │   ...           │              │
  │                    │                  │   done          │              │
  │                    │                  │◄────────────────┤              │
  │                    │ speak(AI回复)    │                 │              │
  │                    │◄─────────────────┤                 │              │
  │  听到 AI 语音       │                  │ messages.push   │              │
  │                    │                  ├────────────────────────────────►│
  │                    │                  │                 │              │
  │  点击单词           │                  │ lookupDict      │              │
  │                    │                  │ speak(单词)      │              │
```

### 3. 分层架构

| 层级 | 职责 | 技术 | 文件 |
|------|------|------|------|
| **视图层 (View)** | UI 渲染、用户交互 | React 18 + TailwindCSS | `components/*.jsx` (12) |
| **页面层 (Page)** | 路由页面、业务编排 | react-router-dom 6 | `pages/*.jsx` (4) |
| **逻辑层 (Hook)** | 状态管理、副作用封装 | Custom Hooks | `hooks/*.js` (7) |
| **服务层 (Service)** | 外部 API、流式响应、缓存 | fetch + ReadableStream | `services/chatService.js` |
| **工具层 (Util)** | 纯函数、音频处理、音效 | Web Audio API | `utils/*.js` (3) |
| **数据层 (Data)** | 静态配置、场景数据 | ES Module | `data/scenes.js` |
| **持久化 (Storage)** | localStorage 4 命名空间 | Web Storage API | `hooks/use*.js` 内部 |

**设计原则**：
- 单向数据流：父 → 子 props，反馈通过 callback
- 关注点分离：UI 不直接调用 API，必须经 Hook/Service
- 副作用隔离：所有 useEffect 都有 return 清理
- 错误边界：`<ErrorBoundary>` 包裹路由根

---

## 🧱 技术栈详解

### 1️⃣ 前端框架层

| 技术 | 版本 | 角色 | 关键决策 |
|------|------|------|----------|
| **React** | 18.3.1 | UI 框架 | 函数组件 + Hooks，零类组件；`useTransition` 优化流式渲染 |
| **Vite** | 5.4.21 | 构建工具 | ESM 原生 HMR，1.6s 完成 production build |
| **react-router-dom** | 6.26.0 | 路由 | History 模式 + 懒加载就绪（未来按需 split） |
| **TailwindCSS** | 3.x | 样式 | JIT 编译 + content 扫描，最终 CSS 仅 9.9KB gzip |
| **PostCSS** | 8.x | CSS 转换 | autoprefixer + tailwindcss 双插件链 |

### 2️⃣ 语音处理层

| 技术 | 用途 | 关键能力 |
|------|------|----------|
| **Web Speech API** (`SpeechRecognition`) | 浏览器原生 ASR | 实时识别、interim 结果、连续/一次性模式 |
| **Web Speech API** (`SpeechSynthesis`) | 浏览器原生 TTS | 多口音 (en-US/en-GB)、语速/音调/音量可控 |
| **Web Audio API** | 实时音频处理 | 噪声门 + AGC + 低通滤波 + AnalyserNode |
| **MediaRecorder** | 录音 | 用户原声回放、波形可视化 |
| **AudioContext** | 音频图 | `latencyHint: 'interactive'` < 10ms 延迟 |

**音频处理管线**：

```
MediaStreamSource
  → NoiseGate (阈值 0.015 RMS)  // 消除背景噪音
  → LowPassFilter (10kHz)      // 滤除高频噪声
  → DynamicsCompressor (AGC)    // 自动增益
  → AnalyserNode (FFT=256)     // 实时频谱 → 波形
  → Destination
```

### 3️⃣ AI 集成层

| 技术 | 用途 | 性能优化 |
|------|------|----------|
| **DeepSeek / OpenAI 兼容 API** | LLM 对话 | 国内低延迟、价格低 |
| **SSE (Server-Sent Events)** | 流式响应 | 首字延迟 < 300ms |
| **fetch + ReadableStream** | 增量解析 | 自实现 SSE 解析器 |
| **JSON Schema 强约束** | 结构化输出 | 纠错数据零解析失败 |
| **responseCache Map** | 响应缓存 | 60s TTL，常见问候语复用 |
| **prewarmConnection** | TCP 预连接 | 场景进入时 `max_tokens: 1` 预热 |

**流式 LLM 调用核心代码**：
```js
const response = await fetch(API_URL, {
  method: 'POST',
  body: JSON.stringify({
    model: MODEL,
    messages: [...],
    stream: true,  // SSE 增量返回
    temperature: 0.7,
  }),
})

const reader = response.body.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  // 按 \n\n 分割 SSE 事件，逐块 yield 给上层
  const lines = buffer.split('\n')
  buffer = lines.pop() ?? ''
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6))
      yield data.choices[0]?.delta?.content ?? ''
    }
  }
}
```

### 4️⃣ 状态管理方案

| 方案 | 应用场景 | 实现 |
|------|----------|------|
| **`useState` + `useRef`** | 组件内临时状态 | 录音中、UI 开关 |
| **`useReducer`** | 复杂状态机 | 会员次数消费流程 |
| **Custom Hook 封装** | 跨组件共享 | 7 个 hooks 自治 |
| **`localStorage` 同步** | 持久化 | `storage` 事件跨标签页同步 |
| **Lifted State** | 页面级共享 | App.jsx 提升 scene 状态 |

**未引入 Redux/Zustand 的原因**：
- 状态边界清晰，无深层嵌套
- Hooks 即可覆盖 95% 场景
- 减少打包体积（避免额外 ~10KB）

### 5️⃣ 性能优化技术

| 优化项 | 实现 | 效果 |
|--------|------|------|
| **Vite 代码分割** | 路由级 dynamic import | 首屏仅加载 SceneSelectPage |
| **Tailwind JIT** | 按需生成 CSS | 9.9KB gzip |
| **React.memo** | MessageBubble 包裹 | 避免无关重渲 |
| **useCallback** | 事件处理函数 | 减少子组件 prop 变化 |
| **Canvas 波形** | 替代 SVG/DOM 绘制 | 28 帧 60fps 流畅 |
| **AudioWorklet 替代** | 未来优化点 | 解决 ScriptProcessor 废弃 |

### 6️⃣ CI/CD & 部署

| 工具 | 用途 | 配置位置 |
|------|------|----------|
| **GitHub Actions** | 自动化 | `.github/workflows/deploy.yml` |
| **Vite Build** | 产物生成 | `vite.config.js` (base: '/ai-english-coach/') |
| **configure-pages@v4** | 自动启用 Pages | workflow Step |
| **upload-pages-artifact@v3** | 上传产物 | workflow Step |
| **deploy-pages@v4** | 部署 | workflow Step |
| **concurrency group** | 防并发部署 | workflow 配置 |

---

## 📁 项目结构

```
ai-english-coach/
├── .github/workflows/
│   └── deploy.yml                    # GitHub Actions (build + deploy 双 job)
├── public/
│   └── vite.svg
├── src/
│   ├── components/                   # 12 个 UI 组件
│   │   ├── VoiceMessageBubble.jsx    # 语音气泡 v9 (绿色主题)
│   │   ├── WordPopup.jsx             # 词典浮窗 (音标+释义+播放)
│   │   ├── RealTimeCorrectionPanel.jsx # 纠错面板 (桌面右侧/手机底部)
│   │   ├── ScoreVisualizer.jsx       # 评分可视化 (环形+雷达)
│   │   ├── VoiceWaveform.jsx         # 声波组件 (Canvas)
│   │   ├── TTSControlBar.jsx         # 双语控制条 (语速/口音/风格)
│   │   ├── PronunciationCard.jsx     # 发音评分卡
│   │   ├── ErrorHighlightedSentence.jsx # 错误高亮句子
│   │   ├── DeviceSelector.jsx        # 音频设备选择器
│   │   ├── MembershipModal.jsx       # 会员弹窗
│   │   ├── BadgeModal.jsx            # 徽章弹窗
│   │   ├── Toast.jsx                 # 全局提示
│   │   ├── ErrorBoundary.jsx         # 错误边界
│   │   └── LevelSelect.jsx           # 难度选择
│   ├── hooks/                        # 7 个自定义 Hooks
│   │   ├── useSpeechRecognition.js   # ASR + 录音时长追踪
│   │   ├── useTTS.js                 # TTS 引擎 + 语速/口音
│   │   ├── useAudioDevices.js        # 设备管理 (热插拔)
│   │   ├── useMembership.js          # 会员状态 + 次数限制
│   │   ├── useConversationPersistence.js # 对话持久化
│   │   ├── useProgressTracker.js     # 长期进度追踪
│   │   └── useLevelProgress.js       # 关卡进度
│   ├── pages/                        # 4 个页面
│   │   ├── SceneSelectPage.jsx       # 场景选择 (首页)
│   │   ├── ChatPage.jsx              # 对话主页 (核心)
│   │   ├── SummaryPage.jsx           # 练习总结
│   │   └── VipPage.jsx               # 会员中心
│   ├── services/
│   │   └── chatService.js            # LLM API 封装 (流式/缓存/重试)
│   ├── data/
│   │   └── scenes.js                 # 10+ 场景配置 + systemPrompt
│   ├── utils/
│   │   ├── audioProcessor.js         # Web Audio 处理管线
│   │   ├── pronunciation.js          # 发音评分引擎
│   │   └── soundEffects.js           # 音效合成 (Web Audio)
│   ├── App.jsx                       # 路由根
│   ├── main.jsx                      # 入口
│   └── index.css                     # 全局样式 + 动画
├── .env.example                      # 环境变量模板
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── start.bat                         # Windows 一键启动
```

---

## 🔧 核心技术亮点

### 1. 流式 LLM 响应（首字 < 300ms）

```js
// services/chatService.js
async function* streamChat(messages, signal) {
  const response = await fetch(API_URL, {
    method: 'POST',
    signal,
    body: JSON.stringify({ ..., stream: true }),
  })

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          const json = JSON.parse(line.slice(6))
          const delta = json.choices[0]?.delta?.content
          if (delta) yield delta
        }
      }
    }
  } finally {
    reader.cancel()
  }
}
```

### 2. Web Audio 实时降噪

```js
// utils/audioProcessor.js
const pipeline = audioContext.createMediaStreamSource(stream)
  .connect(noiseGateNode)     // 阈值 0.015 RMS
  .connect(lowPassFilter)     // 10000Hz 截止
  .connect(compressor)        // AGC 压缩
  .connect(analyserNode)      // FFT=256 → 波形
```

### 3. 录音时长精确追踪

```js
// hooks/useSpeechRecognition.js
const recordingStartTimeRef = useRef(0)

const startListening = () => {
  recordingStartTimeRef.current = Date.now()
  // ...
}

const stopListening = () => {
  const dur = Math.round((Date.now() - recordingStartTimeRef.current) / 1000)
  setLastAudioDuration(dur > 0 ? dur : 1)
}
```

### 4. 双端录音交互

```js
// pages/ChatPage.jsx
const isDesktopRef = useRef(
  window.matchMedia('(pointer: fine)').matches
)

// 桌面端：鼠标按下 → 悬浮「✕ 取消」按钮 → 仅点击取消才终止
// 移动端：长按 → 上滑 > 50px → 按钮变琥珀色 → 松开取消
```

### 5. 单词级高亮 + 词典查询

```js
// utils/tokenizeForRender + components/WordPopup.jsx
// 1. ASR 文本 → token 化（单词/标点分离）
// 2. 单词渲染为独立可点击卡片
// 3. 点击 → lookupDict → 浮窗展示音标+释义
// 4. speak(word) → TTS 播放标准发音
```

### 6. localStorage 4 命名空间隔离

| Key | 用途 | TTL |
|-----|------|-----|
| `aiec.vip` | 会员状态、到期时间 | 永久（VIP 期满前） |
| `aiec.progress` | 累计时长、轮次、维度平均分 | 永久 |
| `aiec.scene_<id>` | 单场景已用次数 | 永久 |
| `aiec.conv_<sceneId>` | 断点续聊历史 | 永久 |

---

## 🚀 快速开始

### 方式一：在线体验
👉 [xiuuu123.github.io/ai-english-coach](https://xiuuu123.github.io/ai-english-coach/)
> 首次使用请用 **Chrome / Edge**（支持 Web Speech API）

### 方式二：本地运行

```bash
# 1. 克隆
git clone https://github.com/Xiuuu123/ai-english-coach.git
cd ai-english-coach

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 LLM API Key

# 4. 启动开发服务器
npm run dev
# → http://localhost:5173

# 5. 构建生产版本
npm run build
npm run preview
```

### 方式三：Windows 一键启动
双击 `start.bat` 即可。

---

## 🛠️ 常用脚本

| 命令 | 用途 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器（ESM HMR 热更新） |
| `npm run build` | 构建生产版本到 `dist/` |
| `npm run preview` | 本地预览生产构建 |

---

## 🎯 核心功能

### ✅ 场景化对话练习
- 10+ 内置场景：**面试** / **点餐** / **会议** / **旅行** / **学术讨论**
- 每个场景独立提示词、独立次数配额
- CEFR A2 / B1 / B2 难度分级

### ✅ 实时语音对话（端到端 < 1s）
- ASR 实时识别 → LLM 流式响应 → TTS 自动播放
- 实时音量波形可视化

### ✅ 逐句纠错（语法 / 发音 / 表达）
- 单词级 hover 高亮，点击查看建议
- 桌面右侧固定 360px 评估面板
- 移动端底部抽屉

### ✅ 单词分词 + 点击查词
- ASR 文本自动拆分单词
- 点击浮窗：**音标 + 词性 + 中文释义 + 🔊 播放**

### ✅ 场景次数 + 会员体系
- 免费用户：每场景 3-7 次/天
- VIP 用户：无限次数 + 高级场景

### ✅ 深色科技风 + 响应式
- 主色：`#0f172a` + `emerald-500` + `indigo-500`
- 霓虹发光边框 + 半透明卡片

### ✅ 双端录音交互
- 桌面端：鼠标 + 悬浮取消按钮
- 移动端：长按 + 上滑取消
- 实时录音秒数 + 声波动画

### ✅ 语音消息气泡 + 评分
- 绿色用户气泡：ME 标识 + 时长 + 发音评分
- 蓝色 AI 气泡：回复 + 重播 + 纠错标记
- 评分可点击展开：4 维度雷达图 + 综合分环

---

## 📊 性能指标

| 指标 | 数值 | 测量方式 |
|------|------|----------|
| 首屏加载 | < 1.5s | Lighthouse |
| 产物体积 | 372KB / 117KB gzip | vite build |
| CSS 体积 | 57KB / 9.9KB gzip | vite build |
| LLM 首字延迟 | < 300ms | 自研计时器 |
| 端到端交互 | < 1s | 从按下到听到 AI |
| 录音处理延迟 | < 10ms | AudioContext latencyHint |
| 波形渲染 | 60fps | Canvas + requestAnimationFrame |
| LCP | < 2.5s | Lighthouse |
| FID | < 100ms | Lighthouse |
| CLS | < 0.1 | Lighthouse |

---

## 🔐 隐私与安全

> 🔒 **零数据上传**：用户语音/对话全程不离开浏览器
> 仅有 ASR 文本会发送至 LLM API（用户主动触发），不会上传录音文件
> 所有会话/会员/进度数据存储在浏览器 `localStorage`

**API Key 安全**：
- 演示 Key 仅供本地测试
- 生产环境请使用 GitHub Secrets 注入
- 永远不要把 `.env` 提交到 Git

---

## 🤝 贡献指南

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## 📜 开源协议

本项目基于 **MIT License** 开源 — 详见 [LICENSE](./LICENSE)

---

## 🌟 Star History

如果这个项目对你有帮助，欢迎点 ⭐ 支持！

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
  <sub>Powered by React 18 + Vite 5 + TailwindCSS 3 + Web Speech API + Web Audio API</sub>
  <br>
  <sub>Deployed on GitHub Pages via GitHub Actions</sub>
</div>
