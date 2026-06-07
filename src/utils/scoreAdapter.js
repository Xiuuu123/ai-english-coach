/**
 * 模式感知评分转换器
 *
 * 核心功能：根据当前输入模式，转换 AI 返回的原始评分为对应模式的展示结构
 *
 * 语音模式 4 维：
 *   - pronunciation（发音分）
 *   - confidence  （自信度）
 *   - grammar     （语法）
 *   - vocabulary  （词汇）
 *
 * 文字模式 3 维（"发音分"改名为"表达地道分"，"自信度"固定100）：
 *   - expression  （表达地道分）
 *   - grammar     （语法）
 *   - vocabulary  （词汇）
 *
 * 转换规则：
 *   1. 文字模式下 expression = 原 pronunciation 字段（如果后端返回的是地道具而非发音）
 *   2. 文字模式下 confidence 固定 100，不做动态计算
 *   3. 总分 0-100，按模式加权（语音：发音40% + 自信度20% + 语法20% + 词汇20%；
 *                         文字：表达40% + 语法30% + 词汇30%）
 */

/**
 * 根据模式转换评分维度
 * @param {object} rawDimensions - 后端原始维度 { pronunciation, confidence, grammar, vocabulary, expression }
 * @param {'voice'|'text'} mode
 * @returns {object} 转换后的维度
 */
export function adaptDimensions(rawDimensions, mode) {
  if (!rawDimensions || typeof rawDimensions !== 'object') {
    return mode === 'voice'
      ? { pronunciation: null, confidence: null, grammar: null, vocabulary: null }
      : { expression: null, grammar: null, vocabulary: null }
  }

  if (mode === 'voice') {
    return {
      pronunciation: clamp(rawDimensions.pronunciation),
      confidence: clamp(rawDimensions.confidence),
      grammar: clamp(rawDimensions.grammar),
      vocabulary: clamp(rawDimensions.vocabulary),
    }
  }

  // 文字模式
  return {
    // 表达地道分：优先取 expression 字段；否则降级用 pronunciation
    expression: clamp(rawDimensions.expression ?? rawDimensions.pronunciation),
    grammar: clamp(rawDimensions.grammar),
    vocabulary: clamp(rawDimensions.vocabulary),
    // 自信度固定 100（不参与计算）
    confidence: 100,
  }
}

/**
 * 计算总分（0-100）
 * @param {object} dims - adaptDimensions 后的维度
 * @param {'voice'|'text'} mode
 * @returns {number}
 */
export function calculateOverallScore(dims, mode) {
  if (!dims) return 0

  if (mode === 'voice') {
    // 语音：发音40% + 自信度20% + 语法20% + 词汇20%
    const parts = [
      val(dims.pronunciation) * 0.4,
      val(dims.confidence) * 0.2,
      val(dims.grammar) * 0.2,
      val(dims.vocabulary) * 0.2,
    ]
    return Math.round(parts.reduce((a, b) => a + b, 0))
  }

  // 文字：表达40% + 语法30% + 词汇30%（自信度不参与）
  const parts = [
    val(dims.expression) * 0.4,
    val(dims.grammar) * 0.3,
    val(dims.vocabulary) * 0.3,
  ]
  return Math.round(parts.reduce((a, b) => a + b, 0))
}

/**
 * 模式感知的纠错过滤
 * @param {Array} corrections - 原始纠错数组 [{type, original, corrected, ...}]
 * @param {'voice'|'text'} mode
 * @returns {Array} 过滤后的纠错
 */
export function filterCorrectionsByMode(corrections, mode) {
  if (!Array.isArray(corrections)) return []

  if (mode === 'voice') {
    // 语音模式：全部保留
    return corrections
  }

  // 文字模式：剔除所有与发音/语调/连读相关的纠错
  const banned = new Set(['pronunciation', 'phoneme', 'intonation', 'liaison', 'stress', 'fluency', 'rhythm'])
  return corrections.filter(c => {
    const t = (c.type || '').toLowerCase()
    return !banned.has(t)
  })
}

/**
 * 模式感知的发音提示过滤
 * 文字模式不展示发音技巧
 */
export function filterPronunciationTipsByMode(tips, mode) {
  if (mode === 'voice') return tips
  return [] // 文字模式隐藏
}

/**
 * 模式感知的维度元数据（用于 ScoreVisualizer）
 * 返回每个维度的展示配置
 */
export function getDimensionMeta(mode) {
  if (mode === 'voice') {
    return [
      { key: 'pronunciation', label: '发音分', icon: '🎯', color: 'emerald' },
      { key: 'confidence', label: '自信度', icon: '💪', color: 'amber' },
      { key: 'grammar', label: '语法', icon: '📐', color: 'blue' },
      { key: 'vocabulary', label: '词汇', icon: '📚', color: 'purple' },
    ]
  }
  return [
    { key: 'expression', label: '表达地道分', icon: '✨', color: 'emerald' },
    { key: 'grammar', label: '语法', icon: '📐', color: 'blue' },
    { key: 'vocabulary', label: '词汇', icon: '📚', color: 'purple' },
  ]
}

/**
 * 模式说明文案
 */
export function getModeRuleText(mode) {
  return mode === 'voice'
    ? '基于发音 + 自信度 + 语法 + 词汇综合打分；优先纠正发音问题'
    : '基于表达地道度 + 语法 + 词汇综合打分；自信度固定 100；不评估发音'
}

// ===== 内部工具 =====
function clamp(v) {
  if (v == null || isNaN(v)) return null
  return Math.max(0, Math.min(100, Math.round(v)))
}
function val(v) {
  return clamp(v) ?? 0
}
