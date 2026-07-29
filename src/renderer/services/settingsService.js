// fileService / mediaService と同じ「環境で実装を切り替える」パターン。
// 本体(App)は「設定を読める/書ける何か」にだけ依存し、保存先を知らない:
//   - Electron … IPC → main が userData/settings.json へ読み書き
//   - ブラウザ … localStorage
//
// load() の返り値は { assignments: { state: { url, name } } }。
// save(settings) は { assignments: { state: url } } を受け取る(url は不透明な文字列)。
// save は渡したキーだけを差し替える部分更新で、設定全体の置き換えではない。
//
// 保存する値が「読む形」と違うのは意図的。保存時に渡すのは renderer が持っている
// 揮発性の URL で、復元時に返るのは新しく作り直された URL だから。この非対称が
// 「URL はそのまま持ち越せない」という事実をそのまま型に表している。

const isElectron = () => window.mascotEditor?.isElectron === true

const electronService = {
  load: () => window.mascotEditor.settings.load(),
  save: (settings) => window.mascotEditor.settings.save(settings),
}

const STORAGE_KEY = 'mascot-editor:settings'

const webService = {
  async load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      // 素材は保存していないので、復元しても割当は常に空。
      return { ...(parsed ?? {}), assignments: {} }
    } catch (e) {
      // プライベートモードや壊れた値。設定なしで起動する方がマシ。
      console.error(e)
      return { assignments: {} }
    }
  },
  async save(settings) {
    // 割当は捨てる。blob URL は次に開いた時にはもう無効で、保存しても
    // 「復元できる」と嘘をつくだけになる。
    const { assignments: _dropped, ...rest } = settings ?? {}
    try {
      // 既存の設定へ重ねる(部分更新)。丸ごと置き換えると、M5 で足すテーマ等が
      // 「割当を変えるたびに消える」ことになる。Electron 側(settingsStore)も
      // 同じく部分更新なので、環境で挙動が変わらない。
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? {}
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...rest }))
    } catch (e) {
      console.error(e)
    }
  },
}

export const settingsService = isElectron() ? electronService : webService
