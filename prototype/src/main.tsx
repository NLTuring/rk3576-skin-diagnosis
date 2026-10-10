import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <div className="boot-screen"><h1>这一页暂时没有打开。</h1><p>已保存的本地记录不会因此被清空。请重新打开页面。</p><button className="button primary" onClick={() => location.reload()}>重新打开</button></div>
    return this.props.children
  }
}
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>)
