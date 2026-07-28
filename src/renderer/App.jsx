import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadThemes, loadMascots } from './config/loader.js'
import { fileService } from './services/fileService.js'
import { mediaService } from './services/mediaService.js'
import {
  assignAll,
  entriesToRelease,
  statesOf,
  toDisplayMap,
  toNameMap,
} from './services/mediaAssignments.mjs'
import Toolbar from './components/Toolbar.jsx'
import Editor from './components/Editor.jsx'
import Mascot from './components/Mascot.jsx'
import MediaAssignPanel from './components/MediaAssignPanel.jsx'

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
  // 状態 → ユーザーが選んだ素材({ url, kind, name, release })。未割当は同梱サンプル。
  const [assignments, setAssignments] = useState({})
  // 割当パネルを指している間だけの一時表示。実際の mascotState は変えない。
  const [previewState, setPreviewState] = useState(null)

  const theme = themes.find((t) => t.id === themeId) ?? themes[0]
  const mascot = mascots[0]
  // 割り当て可能な状態は JSON 由来。states を増やせば UI の行も増える。
  const mascotStates = useMemo(() => statesOf(mascot), [mascot])

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

  // 選択済み素材の後始末を確実にするため、state と別に ref でも持つ。
  // release() は副作用なので setState の更新関数の中では呼べない
  // (React 18 の StrictMode は更新関数を二重に呼ぶため、生きている URL を
  //  解放してしまう)。差し替えは必ずこの applyAssignments を通す。
  //
  // 解放対象の判定は entriesToRelease に任せる: 同じエントリを複数状態が
  // 参照していることがあるので、「どこからも参照されなくなった分」だけを解放する。
  const assignmentsRef = useRef({})
  const applyAssignments = useCallback((next) => {
    for (const entry of entriesToRelease(assignmentsRef.current, next)) {
      // 1件の失敗で残りの解放と ref 更新を巻き添えにしない。
      try {
        entry.release?.()
      } catch (e) {
        console.error(e)
      }
    }
    assignmentsRef.current = next
    setAssignments(next)
  }, [])

  // アンマウント時に残り全部を解放する。
  // ここで applyAssignments を使わないのは、cleanup に setState まで巻き込むと
  // 後始末が「解放」以外の副作用を持つから。後始末は ref を見て release する
  // ことだけに限定する(解放そのものは cleanup が走れば当然起きる)。
  useEffect(
    () => () => {
      for (const entry of entriesToRelease(assignmentsRef.current, {})) {
        try {
          entry.release?.()
        } catch (e) {
          console.error(e)
        }
      }
      assignmentsRef.current = {}
    },
    []
  )

  // pick() の解決を待つ間にアンマウントされたら、選ばれた素材を捨てる。
  // 捨てないと、後始末が済んだ後に新しいエントリが ref に入り、
  // 誰も解放しないまま残る(Electron はトークン、ブラウザは blob URL が居座る)。
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  // 素材を選ばせて、出来上がった割当マップを作る関数を受け取り適用する。
  // 「1状態だけ」と「全部に適用」でダイアログ〜エラー処理が同じなので共通化する。
  // buildNext を await の後で評価するのが要点で、ダイアログ表示中に別の割当が
  // 変わっても、常に最新の割当マップの上に載る(後勝ちで一貫する)。
  const pickInto = useCallback(
    async (buildNext) => {
      try {
        const picked = await mediaService.pick()
        if (!picked) return // キャンセル
        if (!aliveRef.current) return picked.release?.()
        applyAssignments(buildNext(picked))
        flash('happy')
      } catch (e) {
        console.error(e)
        flash('error')
      }
    },
    [applyAssignments, flash]
  )

  const handlePickFor = useCallback(
    (state) =>
      pickInto((picked) => ({ ...assignmentsRef.current, [state]: picked })),
    [pickInto]
  )

  const handleApplyAll = useCallback(
    () => pickInto((picked) => assignAll(mascotStates, picked)),
    [pickInto, mascotStates]
  )

  const handleClearFor = useCallback(
    (state) => {
      // キーごと落とす(null を残すとマップに使わないキーが溜まる)。
      const { [state]: _removed, ...rest } = assignmentsRef.current
      applyAssignments(rest)
    },
    [applyAssignments]
  )

  // ウィンドウがフォーカスを失うとホバー解除が飛ばないことがあるので、
  // 保険としてここでもプレビューを畳む(張り付くと表情連動が見えなくなる)。
  useEffect(() => {
    const clear = () => setPreviewState(null)
    window.addEventListener('blur', clear)
    return () => window.removeEventListener('blur', clear)
  }, [])

  const displayAssignments = useMemo(() => toDisplayMap(assignments), [assignments])
  const assignedNames = useMemo(() => toNameMap(assignments), [assignments])

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
        {/* Mascot へ渡すのは表示に要る { url, kind } だけに絞る(toDisplayMap)。
            release はリソース管理の関心事で、表示コンポーネントが触るべきものではない。 */}
        <div className="sidebar">
          {/* プレビュー中はその状態を「今の状態」として渡す。Mascot は
              プレビューという UI 操作を知らずに済み、実際の mascotState も
              変わらないので表情連動はそのまま動く。 */}
          <Mascot
            mascot={mascot}
            state={previewState ?? mascotState}
            assignments={displayAssignments}
          />
          <MediaAssignPanel
            states={mascotStates}
            names={assignedNames}
            onPick={handlePickFor}
            onClear={handleClearFor}
            onApplyAll={handleApplyAll}
            onPreview={setPreviewState}
          />
        </div>
      </div>
    </div>
  )
}
