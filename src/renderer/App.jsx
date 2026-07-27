import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadThemes, loadMascots } from './config/loader.js'
import { fileService } from './services/fileService.js'
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

const INITIAL_TEXT = '// mascot-editor\n// ここに書く\n'

export default function App() {
  const themes = useMemo(() => loadThemes(), [])
  const mascots = useMemo(() => loadMascots(), [])

  const [themeId, setThemeId] = useState(themes[0]?.id)
  const [text, setText] = useState(INITIAL_TEXT)
  const [filePath, setFilePath] = useState(null)
  const [fileName, setFileName] = useState('untitled.txt')
  const [dirty, setDirty] = useState(false)
  const [mascotState, setMascotState] = useState('idle')

  const theme = themes.find((t) => t.id === themeId) ?? themes[0]
  const mascot = mascots[0]

  // happy 表示を数秒で idle に戻すためのタイマー管理。
  const happyTimer = useRef(null)
  const flash = useCallback((state, revert = 'idle', ms = 1800) => {
    setMascotState(state)
    clearTimeout(happyTimer.current)
    if (revert) happyTimer.current = setTimeout(() => setMascotState(revert), ms)
  }, [])

  useEffect(() => () => clearTimeout(happyTimer.current), [])

  useEffect(() => {
    if (theme) applyTheme(theme)
  }, [theme])

  // タイトルに 未保存(*) と ファイル名 を反映。
  useEffect(() => {
    document.title = `${dirty ? '● ' : ''}${fileName} — mascot-editor`
  }, [dirty, fileName])

  // 未保存のまま閉じ/リロードしようとしたら確認する(データ消失防止)。
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const handleOpen = useCallback(async () => {
    try {
      const res = await fileService.open()
      if (!res) return // キャンセル
      setText(res.content)
      setFilePath(res.path)
      setFileName(res.name)
      setDirty(false)
      flash('happy')
    } catch (e) {
      console.error(e)
      flash('error')
    }
  }, [flash])

  const handleSave = useCallback(
    async (asNew = false) => {
      try {
        const res = asNew
          ? await fileService.saveAs({ content: text, suggestedName: fileName })
          : await fileService.save({ path: filePath, content: text, suggestedName: fileName, name: fileName })
        if (!res) return // キャンセル
        setFilePath(res.path)
        setFileName(res.name)
        setDirty(false)
        flash('happy')
      } catch (e) {
        console.error(e)
        flash('error')
      }
    },
    [text, filePath, fileName, flash]
  )

  // ショートカット: Ctrl/Cmd+S 保存 / Shift 付きで名前を付けて保存 / Ctrl+O 開く。
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === 's') {
        e.preventDefault()
        handleSave(e.shiftKey)
      } else if (key === 'o') {
        e.preventDefault()
        handleOpen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave, handleOpen])

  return (
    <div className="app">
      <Toolbar
        themes={themes}
        themeId={themeId}
        onThemeChange={setThemeId}
        mascotLabel={mascot?.label}
        fileName={fileName}
        dirty={dirty}
        onOpen={handleOpen}
        onSave={() => handleSave(false)}
      />
      <div className="workspace">
        <Editor
          value={text}
          onChange={(v) => {
            setText(v)
            setDirty(true)
          }}
        />
        <Mascot mascot={mascot} state={mascotState} />
      </div>
    </div>
  )
}
