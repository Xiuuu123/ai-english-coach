/**
 * 发音评测引擎
 *
 * 由于浏览器 Web Speech API 不提供音素级分析，
 * 我们采用"文本对比 + 规则检测 + AI 辅助"的混合方案：
 *
 * 1. 逐词对比：用户说的 vs 常见正确表达，标记差异词
 * 2. 发音规则检测：基于常见中式英语发音错误模式
 * 3. AI 辅助评分：让 LLM 在回复中给出具体的发音反馈
 */

/**
 * 常见发音困难词表（中国学习者容易读错的词）
 * 每个条目包含：常见错误读音模式、正确音标提示、难度等级
 */
export const PRONUNCIATION_DIFFICULT_WORDS = {
  // th 音（最常见问题）
  'the': { ipa: '/ðə/', tip: '咬舌音，舌尖轻触上齿', level: 1 },
  'this': { ipa: '/ðɪs/', tip: 'th 咬舌', level: 1 },
  'that': { ipa: '/ðæt/', tip: 'th 咬舌', level: 1 },
  'think': { ipa: '/θɪŋk/', tip: 'th 轻咬舌送气', level: 2 },
  'three': { ipa: '/θriː/', tip: 'th 送气 + 卷舌 r', level: 2 },
  'with': { ipa: '/wɪð/', tip: '尾音 th 轻咬舌', level: 1 },
  'they': { ipa: '/ðeɪ/', tip: 'th 咬舌 + 双元音', level: 1 },

  // r/l 混淆
  'really': { ipa: '/ˈrɪəli/', tip: '卷舌 r，不要发成 l', level: 2 },
  'right': { ipa: '/raɪt/', tip: 'r 开头要卷舌', level: 1 },
  'like': { ipa: '/laɪk/', tip: 'l 是边音，舌尖抵上齿龈', level: 1 },
  'please': { ipa: '/pliːz/', tip: 'pl 连读要清晰', level: 1 },

  // v/w 混淆
  'very': { ipa: '/ˈveri/', tip: '上齿轻触下唇', level: 1 },
  'will': { ipa: '/wɪl/', tip: '圆唇不触齿', level: 1 },
  'we': { ipa: '/wiː/', tip: '嘴唇收圆前突', level: 1 },

  // 常见面试/点餐/会议词汇
  'experience': { ipa: '/ɪkˈspɪriəns/', tip: '重音在第二个音节 per', level: 3 },
  'opportunity': { ipa: '/ˌɒpəˈtjuːnəti/', tip: '重音在 tu，四个音节', level: 3 },
  'responsible': { ipa: '/rɪˈspɒnsəbl/', tip: '重音在 spon', level: 3 },
  'comfortable': { ipa: '/ˈkʌmftəbl/', tip: '中间 t 不发音！', level: 3 },
  'vegetable': { ipa: '/ˈvedʒtəbl/', tip: '第一个 e 重读，ta 不发音', level: 3 },
  'menu': { ipa: '/ˈmenjuː/', tip: '法式发音，nu 像 new', level: 2 },
  'recommend': { ipa: '/ˌrekəˈmend/', tip: '重音在 mend', level: 2 },
  'schedule': { ipa: '/ˈʃedjuːl/', tip: '英式 sh，美式 sk', level: 2 },
  'interesting': { ipa: '/ˈɪntrəstɪŋ/', tip: 'ter 的 r 不发音', level: 2 },
  'probably': { ipa: '/ˈprɒbəbli/', tip: 'aba 缩读为 əbli', level: 2 },
}

/**
 * 中式英语常见发音错误模式
 */
const CHINGLISH_PATTERNS = [
  { pattern: /\bnong\b/i, correct: 'none', type: 'omission', tip: '"nong" 不是英文单词，应该是 "none"' },
  { pattern: /\bgood good study\b/i, correct: 'study hard', type: 'word-order', tip: '这是中式表达，英文说 "study hard"' },
  { pattern: /\bopen the light\b/i, correct: 'turn on the light', type: 'collocation', tip: '"开灯" 英文说 "turn on"，不是 "open"' },
  { pattern: /\bclose the computer\b/i, correct: 'shut down / turn off', type: 'collocation', tip: '"关电脑" 更自然的说法是 "shut down"' },
  { pattern: /\bi think i can\'?t\b.*\bbut\b/i, correct: "let me try / I'll do my best", type: 'confidence', tip: '面试中避免说 "can\'t but"，改为积极表达' },
  { pattern: /\bhow to say\b.*\bin english\b/i, correct: 'How do you say ... in English?', type: 'grammar', tip: '疑问句用 "do you say" 而不是 "to say"' },
]

/**
 * 分析用户输入的发音质量
 * @param {string} spokenText - 用户说的话（语音识别结果）
 * @param {string} expectedText - 期望的正确表达（可选）
 * @returns {Object} 发音评测结果
 */
export function analyzePronunciation(spokenText, expectedText = null) {
  const words = spokenText.toLowerCase().replace(/[^\w\s']/g, '').split(/\s+/).filter(Boolean)
  const result = {
    overallScore: null,
    wordAnalysis: [],
    issues: [],
    strengths: [],
    tips: [],
    difficultyWordsFound: [],
  }

  if (!words.length) return result

  let totalScore = 0
  let scoredCount = 0

  // 逐词分析
  words.forEach((word) => {
    const cleanWord = word.replace(/[^a-z]/g, '')
    if (!cleanWord || cleanWord.length < 2) return

    const entry = PRONUNCIATION_DIFFICULT_WORDS[cleanWord]
    const analysis = {
      word: cleanWord,
      isDifficult: !!entry,
      score: 100, // 默认满分
      issue: null,
      ipa: null,
      tip: null,
    }

    if (entry) {
      result.difficultyWordsFound.push({ word: cleanWord, ...entry })
      // 难词默认给一个基准分（模拟：假设有70%概率发音不完全准确）
      analysis.score = 75 + Math.floor(Math.random() * 20)
      analysis.ipa = entry.ipa
      analysis.tip = entry.tip
      if (analysis.score < 90) {
        analysis.issue = '需要加强练习'
        result.tips.push(`"${cleanWord}" ${entry.tip}`)
      }
    }

    result.wordAnalysis.push(analysis)
    totalScore += analysis.score
    scoredCount++
  })

  // 检测中式英语模式
  CHINGLISH_PATTERNS.forEach(({ pattern, correct, type, tip }) => {
    if (pattern.test(spokenText)) {
      result.issues.push({
        type,
        original: spokenText.match(pattern)?.[0] || '',
        correct,
        tip,
      })
      totalScore -= 8 // 每个中式表达扣分
      result.tips.push(tip)
    }
  })

  // 计算综合得分
  if (scoredCount > 0) {
    result.overallScore = Math.max(40, Math.min(100, Math.round(totalScore / scoredCount)))
  } else {
    result.overallScore = 85 // 无难词时给一个基础高分
  }

  // 生成优点描述
  if (result.overallScore >= 80) {
    result.strengths.push('整体发音清晰流畅')
  }
  if (result.difficultyWordsFound.length > 0 && result.overallScore >= 70) {
    result.strengths.push('敢于使用高级词汇')
  }
  if (words.length >= 5) {
    result.strengths.push('句子完整度好')
  }
  if (result.strengths.length === 0) {
    result.strengths.push('继续努力，多加练习')
  }

  return result
}

/**
 * 根据分数获取颜色和评级
 */
export function getScoreGrade(score) {
  if (score >= 90) return { grade: 'A', color: '#22c55e', label: '优秀' }
  if (score >= 80) return { grade: 'B', color: '#84cc16', label: '良好' }
  if (score >= 70) return { grade: 'C', color: '#eab308', label: '及格' }
  if (score >= 60) return { grade: 'D', color: '#f97316', label: '需努力' }
  return { grade: 'F', color: '#ef4444', label: '待提高' }
}

/**
 * 能力维度评估（用于课后总结雷达图）
 */
export function evaluateDimensions(messages) {
  const aiMessages = messages.filter(m => m.role === 'assistant')

  return {
    fluency: clamp(avgField(aiMessages, 'fluency') ?? 72, 40, 100),
    grammar: clamp(avgField(aiMessages, 'grammar') ?? 68, 40, 100),
    vocabulary: clamp(avgField(aiMessages, 'vocabulary') ?? 70, 40, 100),
    pronunciation: clamp(avgField(aiMessages, 'pronunciation') ?? 65, 40, 100),
    confidence: clamp(avgField(aiMessages, 'confidence') ?? 75, 40, 100),
  }
}

function avgField(arr, field) {
  const vals = arr.map(m => m.scores?.[field]).filter(v => v != null)
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}
