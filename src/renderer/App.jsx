import { useEffect, useMemo, useState } from 'react'
import { loadThemes, loadMascots } from './config/loader.js'
import Toolbar from './components/Toolbar.jsx'
import Editor from './components/Editor.jsx'
import Mascot from './components/Mascot.jsx'

// テーマの colors を CSS カスタムプロパティ(--color-*)へ流し込む。
// これで本体の CSS は具体的な色を知らず、変数だけを参照できる。
function applyTheme(theme) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--color-${key}`, value)
  }
}

export default function App() {
  const themes = useMemo(() => loadThemes(), [])
  const mascots = useMemo(() => loadMascots(), [])

  const [themeId, setThemeId] = useState(themes[0]?.id)
  const [text, setText] = useState('// ずんだエディタなのだ\n// ここに書くのだ\n')
  // マスコットの状態。M1 で保存/エラーに連動させる。M0 は入力有無で happy/idle。
  const [mascotState, setMascotState] = useState('idle')

  const theme = themes.find((t) => t.id === themeId) ?? themes[0]
  const mascot = mascots[0]

  useEffect(() => {
    if (theme) applyTheme(theme)
  }, [theme])

  return (
    <div className="app">
      <Toolbar
        themes={themes}
        themeId={themeId}
        onThemeChange={setThemeId}
        mascotLabel={mascot?.label}
      />
      <div className="workspace">
        <Editor
          value={text}
          onChange={(v) => {
            setText(v)
            setMascotState(v.trim().length > 0 ? 'happy' : 'idle')
          }}
        />
        <Mascot mascot={mascot} state={mascotState} />
      </div>
    </div>
  )
}
