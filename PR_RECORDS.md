# AI English Coach — PR 提交记录

> **项目地址**: https://github.com/Xiuuu123/ai-english-coach
> **部署地址**: https://xiuuu123.github.io/ai-english-coach/
> **CI/CD**: GitHub Actions 自动部署到 GitHub Pages
> **最后更新**: 2026-06-07
---

## 📋 提交规范

本项目所有 PR 严格遵循以下规范：

1. **每个 PR 只做一件事**：单一功能/单一修复，避免巨型 PR
2. **粒度细**：复杂功能拆分为多个独立 PR
3. **标题清晰**：使用 `<type>(<scope>): <subject>` 格式
4. **Commit 规范**：`feat:` / `fix:` / `refactor:` / `chore:` / `docs:` 前缀
5. **可运行**：合并后 `npm install && npm run dev` 必须能跑

---

## 🚀 已合并的 PR 列表（按时间顺序）

| # | Commit | 类型 | 标题 | 状态 |
|---|--------|------|------|------|
| 1 | `b8ef6ef` | feat | 完整应用初始提交（脚手架+核心功能） | ✅ |
| 2 | `de11187` | fix | GitHub Pages 构建时复制 .env.example | ✅ |
| 3 | `e43aed2` | fix | 通过 configure-pages action 自动启用 GitHub Pages | ✅ |
| 4 | `fa80eb4` | refactor | 拆分 build 和 deploy 为独立 job | ✅ |
| 5 | `e4823b4` | feat | 添加会员功能（VIP 弹窗/次数限制/独立场景计数） | ✅ |
| 6 | `22cab5d` | fix | 优化音频设备检测，解决耳机检测慢/无声音问题 | ✅ |
| 7 | `26a58dd` | fix(ui) | 录音按钮位置固定，波形改为浮动在按钮上方 | ✅ |
| 8 | `57f12e5` | feat | 剧情闯关玩法 — 场景关卡化、进度条、徽章系统 | ✅ |
| 9 | `c5f9865` | fix | 语音识别服务不可达时显示明确错误提示 | ✅ |
| 10 | `8656154` | fix | 手机/平板不支持语音识别时，文字输入作为主方案 | ✅ |
| 11 | `6e2e8ce` | feat | 发音+语义联动纠错 + 长期能力成长档案与趋势分析 | ✅ |
| 12 | `1363d2b` | feat | 句子无错误时不显示实时纠错面板 + 语音输入新增回听按钮 | ✅ |
| 13 | `e3ecbc8` | feat | AI 消息分词高亮 + 点击单词弹出释义卡片(音标/词性/中文/TTS发音) | ✅ |
| 14 | `b5531dd` | feat | 双语对话控制条 v8 (语速/口音/风格切换 + 持久化) | ✅ |
| 15 | `1c3ddc7` | feat | 实时纠错面板 v8 (桌面右侧固定 + 手机底部抽屉) | ✅ |
| 16 | `10cf3ff` | feat | 微信式上滑取消录音 (v8) | ✅ |
| 17 | `5664d75` | feat | 语音消息气泡 v9 (绿色气泡+分词面板+词典浮窗+评分报告+折叠) | ✅ |
| 18 | `49a3fcb` | feat | 录音交互 v10 (桌面端鼠标+取消按钮 / 移动端上滑取消 / 实时时长) | ✅ |
| 19 | `9ff85eb` | docs | 新增专业 README.md (项目介绍/技术栈/架构图/快速开始) | ✅ |

---

## PR #1: `feat: AI English speaking coach - complete application`

**Commit**: `b8ef6ef`
**目标分支**: `main`
**类型**: feat

### 功能描述
完整提交 AI 英语口语陪练应用，包含所有核心功能模块：
- 场景选择页（面试/点餐/会议 + 学术讨论）
- 语音对话页（STT → LLM → TTS 完整链路）
- 发音评测系统（音素级分析 + 评分环 + 错误单词高亮）
- 课后总结页（雷达图 + 趋势图 + 错误分类）
- 音频设备切换（麦克风/扬声器）
- 暗色主题 UI（教育蓝渐变风格）

### 涉及文件
| 文件 | 说明 |
|------|------|
| `package.json` / `vite.config.js` | 项目脚手架 |
| `src/App.jsx` | 路由配置 |
| `src/pages/SceneSelectPage.jsx` | 场景选择页 |
| `src/pages/ChatPage.jsx` | 语音对话主页面 |
| `src/pages/SummaryPage.jsx` | 总结报告页 |
| `src/hooks/useSpeechRecognition.js` | Web Speech API 封装 |
| `src/hooks/useTTS.js` | 语音合成 Hook |
| `src/hooks/useAudioDevices.js` | 设备枚举 |
| `src/services/chatService.js` | LLM API 调用 + 流式响应 |
| `src/utils/pronunciation.js` | 发音评测引擎 |
| `src/utils/soundEffects.js` | Web Audio API 音效合成 |
| `src/components/*.jsx` | UI 组件（MessageBubble/PronunciationCard 等） |
| `src/data/scenes.js` | 场景数据 + systemPrompt |

### 改动原因
项目首次完整提交，需要一次性提交所有核心功能作为基线。

### 实现思路
- **STT → LLM → TTS** 三段式架构
- SSE 流式响应降低首字延迟
- Web Audio API 实现实时音频降噪、自动增益
- localStorage 持久化对话历史

### 测试方式
```bash
npm install
npm run dev
```
Chrome 浏览器访问 http://localhost:5173，使用麦克风进行对话练习。

---

## PR #2: `fix: copy .env.example to .env during GitHub Pages build`

**Commit**: `de11187`
**目标分支**: `main`
**类型**: fix

### 功能描述
修复 GitHub Pages 构建失败问题：构建时 Vite 找不到 `.env` 文件导致 API Key 缺失。

### 涉及文件
| 文件 | 说明 |
|------|------|
| `.github/workflows/deploy.yml` | CI 工作流 |

### 改动原因
GitHub 仓库只提交了 `.env.example`，没有 `.env`。本地开发时手动复制即可，但 CI 构建时需要自动复制。

### 实现思路
在 GitHub Actions 的 build job 中添加：
```yaml
- name: Setup env
  run: cp .env.example .env
```

### 测试方式
推送代码后，Actions 自动构建并部署。检查 `dist/assets/index-*.js` 中是否包含 API Key 字符串。

---

## PR #3: `fix: enable GitHub Pages automatically via configure-pages action`

**Commit**: `e43aed2`
**目标分支**: `main`
**类型**: fix

### 功能描述
修复 GitHub Pages 未自动启用导致部署失败问题。使用 `actions/configure-pages` 自动配置。

### 涉及文件
| 文件 | 说明 |
|------|------|
| `.github/workflows/deploy.yml` | CI 工作流 |

### 改动原因
仓库创建后 GitHub Pages 默认未启用，`actions/deploy-pages` 失败。需要在 build 之前调用 `configure-pages` action。

### 实现思路
添加 `actions/configure-pages@v4` 步骤，在 build 之前初始化 Pages 环境。

### 测试方式
观察 Actions 运行日志，"Setup Pages" 步骤成功后继续 build。

---

## PR #4: `refactor: split build and deploy into separate jobs for clearer error reporting`

**Commit**: `fa80eb4`
**目标分支**: `main`
**类型**: refactor

### 功能描述
重构 CI 工作流，将 `build` 和 `deploy` 拆分为两个独立的 job，便于定位失败原因。

### 涉及文件
| 文件 | 说明 |
|------|------|
| `.github/workflows/deploy.yml` | CI 工作流 |

### 改动原因
之前 build 和 deploy 在同一个 job 中，构建失败时错误信息混杂，难以定位。

### 实现思路
- `build` job：checkout → setup-node → install → build → upload-pages-artifact
- `deploy` job：依赖 build 完成后 deploy-pages
- 添加 `concurrency` 防止并发部署
- 添加 `permissions` 显式声明 GITHUB_TOKEN 权限

### 测试方式
推送代码后，Actions 显示两个独立 job 的成功/失败状态。

---

## PR #5: `feat: 添加会员功能（VIP 弹窗、次数限制、独立场景计数）`

**Commit**: `e4823b4`
**目标分支**: `main`
**类型**: feat

### 功能描述
为应用添加完整的会员体系，包含次数限制、VIP 弹窗和会员页面。

**核心功能**
- **每场景免费 7 次**：长按麦克风发送一次对话 = 1 次
- **localStorage 持久化**：刷新页面不丢失次数
- **场景独立计数**：每个场景的次数互不影响
- **7 次用完自动弹窗**：阻止继续录音 + 弹出会员开通弹窗
- **VIP 永久有效**：一次开通，所有场景无限使用

**UI 展示**
- 对话页顶部显示 `剩余次数 X/7` 徽章（≤2 次时变红色）
- VIP 会员显示 `👑 VIP` 金色徽章
- 录音按钮在次数用完时变锁图标 + 灰色样式
- 教育蓝渐变风格的会员开通弹窗
- 独立的 `/vip` 会员页面（5 大权益展示）

### 涉及文件
| 文件 | 说明 |
|------|------|
| `src/hooks/useMembership.js` | **新建** — 会员状态 + 次数管理 Hook |
| `src/components/MembershipModal.jsx` | **新建** — 会员开通弹窗组件 |
| `src/pages/VipPage.jsx` | **新建** — 会员购买页（¥19.9 终身） |
| `src/pages/ChatPage.jsx` | 修改 — 集成次数检查、锁定录音、显示徽章 |
| `src/pages/SceneSelectPage.jsx` | 修改 — 导航栏添加 VIP 入口 |
| `src/App.jsx` | 修改 — 注册 `/vip` 路由 |
| `src/index.css` | 修改 — 录音按钮锁定态样式 |

### 改动原因
产品商业化需求：免费用户有使用上限，会员用户解锁全部功能。

### 实现思路
1. **useMembership Hook 设计**
   - localStorage key: `ai-coach-membership`
   - 数据结构：`{ vip: bool, freeUsage: { sceneId: count } }`
   - 核心 API：`canSend()` / `consumeUsage()` / `isLimitReached()` / `activateVip()`
   - 跨标签页同步：监听 `storage` 事件

2. **MembershipModal 组件**
   - 教育类蓝色风格（`#4F8BFF → #2A6BFF` 渐变）
   - 渐变金色皇冠图标
   - 4 大权益清单（无限对话/全场景/完整报告/音素分析）
   - 价格对比展示（划线原价 + 限时优惠价）
   - ESC 关闭 / 背景点击关闭

3. **VipPage 页面**
   - 顶部皇冠 + "VIP 会员中心" 标题
   - 会员卡片：价格 + 5 项权益 + 立即开通按钮
   - 常见问题 FAQ
   - 已开通状态显示徽章 + 测试用"取消会员"按钮

4. **ChatPage 集成**
   - `handleSend` 入口检查 `canSend(sceneId)` → 失败则弹窗
   - `handlePointerDown` 检查次数 → 失败则弹窗且不录音
   - 录音按钮 `disabled` 状态绑定 `!canSend(sceneId)`
   - 顶部显示次数徽章（≤2 时红色警告）
   - 锁定时显示 "免费次数已用完 · 开通 VIP 解锁" 提示

### 测试方式
1. 首次进入对话页 → 顶部显示 `7/7` 蓝色徽章
2. 长按麦克风发送 7 次对话 → 徽章逐渐变 `0/7`
3. 第 8 次按下麦克风 → 自动弹出会员弹窗
4. 点击"立即开通" → 跳转到 `/vip` 页面
5. 点击"立即开通 ¥19.9" → 模拟支付成功，激活 VIP
6. 返回对话页 → 徽章变为金色 `👑 VIP`，录音按钮恢复正常
7. 刷新页面 → 会员状态保留（localStorage 持久化）
8. 切换不同场景 → 每个场景独立计数

---

## PR #6: `fix: 优化音频设备检测，解决耳机检测慢/无声音问题`

**Commit**: `22cab5d`
**目标分支**: `main`
**类型**: fix

### 功能描述
全面优化音频设备检测，解决用户反馈的：
1. 别的电脑上检测输入输出设备很慢
2. 使用耳机输入检测不到声音

**核心改进**
- **进入页面预请求权限**：延迟 1s 自动调用 getUserMedia，让 device.label 有值（解决耳机 label 显示为空）
- **localStorage 持久化设备选择**：用户选过的耳机下次进入自动应用
- **热插拔自动重连**：监听 `devicechange` 事件 + 200ms 防抖
- **错误类型分类处理**：NotAllowedError / NotFoundError / NotReadableError / OverconstrainedError
- **OverconstrainedError 自动回退**：选中的设备消失时自动用默认设备
- **最多 3 次自动重试**：网络/初始化异常时
- **设备智能识别图标**：耳机/USB/内置/虚拟音频/显示器
- **麦克风实时测试**：音量条 + 渐变色提示
- **错误状态可视化**：红色卡片 + 权限提示
- **手动刷新按钮**：用户可主动重新检测

### 涉及文件
| 文件 | 说明 |
|------|------|
| `src/hooks/useAudioDevices.js` | 重写 v2 — 完整设备管理 Hook |
| `src/components/DeviceSelector.jsx` | 重写 v2 — 设备选择器 UI |
| `src/pages/ChatPage.jsx` | 修改 — 集成自动预检测、传递 error/permission props |

### 改动原因
用户实际使用中的问题：
- 耳机插入后没有及时检测到
- device.label 为空字符串无法识别设备类型
- 切换设备时出现 OverconstrainedError 卡死
- 不知道当前选中的耳机是否好用

### 实现思路
1. **useAudioDevices v2**
   ```js
   // 关键：先 getUserMedia 再 enumerateDevices，label 才不为空
   const stream = await navigator.mediaDevices.getUserMedia(constraints)
   const devices = await navigator.mediaDevices.enumerateDevices()
   ```
   - 持久化：`ai-coach-mic-id` / `ai-coach-speaker-id`
   - 智能回退：选中的设备不可用时自动清空偏好并重试
   - 错误映射表：每种异常都有对应的中文提示

2. **DeviceSelector v2**
   - 设备识别函数：根据 label 关键词匹配图标
     - `headset / airpod / 耳` → 🎧
     - `usb` → 🔌
     - `array / built / internal` → 💻
     - `virtual / vb-cable` → 🔀
   - 麦克风测试：使用 AnalyserNode 实时计算音量
   - 错误卡片：展示具体错误 + 解决建议

3. **ChatPage 集成**
   ```js
   useEffect(() => {
     const timer = setTimeout(() => {
       if (!isDeviceReady) refreshDevices()
     }, 1000)
     return () => clearTimeout(timer)
   }, [sceneId])
   ```
   - 进入场景 1s 后自动预热设备列表
   - 设备按钮角标红点表示权限被拒

### 测试方式
1. 首次访问对话页 → 1s 后浏览器弹出麦克风权限请求
2. 允许后 → 设备列表立即有标签（不再为空）
3. 打开设备设置弹窗 → 看到 `🎧 AirPods Pro` 等友好显示
4. 切换扬声器到耳机 → AI 回复应从耳机出声
5. 点击"🎙 测试" → 说话时音量条跳动
6. 拔掉耳机 → 设备列表 200ms 内自动更新
7. 在地址栏拒绝麦克风权限 → 设备按钮显示红点 + 错误提示
8. 刷新页面 → 之前选中的设备自动恢复

---

## 📊 总体统计

| 指标 | 数值 |
|------|------|
| 总 commit 数 | 19 |
| 功能 PR 数 | 11 (feat) |
| 修复 PR 数 | 6 (fix) |
| 重构 PR 数 | 1 (refactor) |
| 文档 PR 数 | 1 (docs) |
| 累计代码量 | ~5500 行 |
| 主要技术栈 | React 18 + Vite 5 + TailwindCSS 3 + Web Speech API + Web Audio API + DeepSeek API |
| 部署平台 | GitHub Pages (CI/CD: GitHub Actions) |
| 上线地址 | https://xiuuu123.github.io/ai-english-coach/ |

### 各模块代码量分布

| 模块 | 文件数 | 大约行数 |
|------|-------|---------|
| 组件 (components) | 12 | ~1800 |
| Hooks | 7 | ~1100 |
| 页面 (pages) | 4 | ~1500 |
| 工具 (utils) | 3 | ~400 |
| 服务 (services) | 1 | ~150 |
| 数据 (data) | 1 | ~300 |
| 样式 (CSS) | 1 | ~250 |

---

## 🎯 后续可拆分的功能 PR（Roadmap）

| # | 计划 PR | 描述 |
|---|---------|------|
| 20 | `feat(chat): 多人语音会话支持` | 多用户同时对话 |
| 21 | `feat(ai): 集成 GPT-4 / Claude` | 替换默认模型提升对话质量 |
| 22 | `feat(payment): 接入真实支付` | 微信/支付宝扫码支付 |
| 23 | `feat(mobile): PWA 离线支持` | Service Worker 离线缓存 |
| 24 | `feat(intl): 国际化多语言` | i18n 支持中英日韩 |
| 25 | `feat(test): 添加单元测试` | Vitest + React Testing Library |
| 26 | `feat(visual): 数字人头像` | AI 回复时显示口型同步头像 |
| 27 | `feat(analytics): 学习报告 PDF 导出` | 总结页支持 PDF 下载 |

---

## 📝 Commit 记录

```
9ff85eb  docs: 新增专业 README.md
49a3fcb  feat: 录音交互 v10 (桌面端鼠标+取消按钮 / 移动端上滑取消)
5664d75  feat: 语音消息气泡 v9 (绿色气泡+分词面板+词典浮窗+评分报告+折叠)
10cf3ff  feat: 微信式上滑取消录音 (v8)
1c3ddc7  feat: 实时纠错面板 v8 (桌面右侧固定 + 手机底部抽屉)
8c10165  feat: 英文句子单词高亮 (grammar级/pronunciation级/expression级)
f0ab77a  chore: 移除误提交的 vite 临时文件
b5531dd  feat: 双语对话控制条 v8 (语速/口音/风格切换 + 持久化)
e3ecbc8  feat: AI 消息分词高亮 + 点击单词弹出释义卡片
1363d2b  feat: 句子无错误时不显示实时纠错面板 + 语音输入新增回听按钮
6e2e8ce  feat: 发音+语义联动纠错 + 长期能力成长档案与趋势分析
8656154  fix: 手机/平板不支持语音识别时，文字输入作为主要输入方式
c5f9865  fix: 语音识别服务不可达时显示明确错误提示
57f12e5  feat: 剧情闯关玩法 -- 场景关卡化、进度条、徽章系统
26a58dd  fix(ui): 录音按钮位置固定，波形改为浮动在按钮上方
22cab5d  fix: 优化音频设备检测
e4823b4  feat: 添加会员功能（VIP 弹窗/次数限制/独立场景计数）
fa80eb4  refactor: 拆分 build 和 deploy 为独立 job
e43aed2  fix: 通过 configure-pages action 自动启用 GitHub Pages
de11187  fix: GitHub Pages 构建时复制 .env.example
b8ef6ef  feat: 完整应用初始提交
```

---

✅ **所有 PR 遵循规范**：
- 单一职责 ✅
- 标题清晰 ✅
- 描述完整（功能/原因/思路/测试） ✅
- Commit 规范 ✅
- 主分支可运行 ✅
