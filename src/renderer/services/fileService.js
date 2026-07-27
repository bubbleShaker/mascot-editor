// 依存性逆転の要: 本体(App)は「開ける/保存できる何か」にだけ依存する。
// 実体は実行環境で切り替わる:
//   - Electron … preload の window.api.file(IPC → main の fs)
//   - ブラウザ … <input type=file> で開く / Blob ダウンロードで保存
// これで Pages(素ブラウザ)でも open/save が動く。
//
// 各メソッドの返り値は { path, name, content? } または null(キャンセル)。

const isElectron = () => Boolean(window.api?.file)

const electronService = {
  open: () => window.api.file.open(),
  save: ({ path, content, suggestedName }) =>
    path
      ? window.api.file.save(path, content)
      : window.api.file.saveAs(content, suggestedName),
  saveAs: ({ content, suggestedName }) =>
    window.api.file.saveAs(content, suggestedName),
}

function downloadBlob(content, filename) {
  const name = filename || 'untitled.txt'
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return { path: null, name }
}

const webService = {
  open: () =>
    new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.txt,.md,.js,.jsx,.ts,.json,.html,.css,text/*'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return resolve(null)
        const content = await file.text()
        resolve({ path: null, name: file.name, content })
      }
      input.click()
    }),
  // ブラウザは既存パスへ上書き保存できないので、常にダウンロード扱い。
  save: ({ content, suggestedName, name }) =>
    downloadBlob(content, suggestedName || name),
  saveAs: ({ content, suggestedName }) => downloadBlob(content, suggestedName),
}

export const fileService = isElectron() ? electronService : webService
