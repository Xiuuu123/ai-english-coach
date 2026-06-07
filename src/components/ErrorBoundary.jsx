import { Component } from 'react'

/**
 * React 错误边界 — 捕获子组件渲染异常，防止白屏崩溃
 *
 * 用法: <ErrorBoundary fallback={<CustomFallback />}><App /></ErrorBoundary>
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    // 尝试重新加载页面
    window.location.reload()
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      // 使用自定义 fallback 或默认错误 UI
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6" role="alert">
          <div className="max-w-md w-full text-center space-y-5">
            {/* 错误图标 */}
            <div className="w-20 h-20 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">出了点问题</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                应用遇到了意外错误，但你的对话记录已安全保存在本地。
              </p>
            </div>

            {/* 错误详情（开发模式） */}
            {import.meta.env?.DEV && this.state.error && (
              <details className="text-left">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">
                  技术详情 (仅开发环境可见)
                </summary>
                <pre className="mt-2 p-3 bg-slate-900 rounded-xl text-[11px] text-red-300/80 overflow-auto max-h-40 border border-white/5">
                  {this.state.error.message}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={this.handleGoHome}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors active:scale-[0.98]"
              >
                返回首页
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 text-slate-300 text-sm font-medium hover:bg-white/5 transition-colors active:scale-[0.98]"
              >
                重新加载
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
