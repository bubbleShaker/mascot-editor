const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
// require した時点で mascot-media スキームの特権登録が走る(whenReady より前に必要)。
const {
  issueMediaToken,
  releaseMediaToken,
  registerMediaProtocol,
} = require('./mediaProtocol.js')

// MASCOT_DEV=1 のとき Vite dev server を読む。未設定/0 なら build 済み dist を読む。
const isDev = process.env.MASCOT_DEV === '1'

// テキストファイルの絞り込み(開く/保存ダイアログ共通)
const TEXT_FILTERS = [
  { name: 'テキスト', extensions: ['txt', 'md', 'js', 'jsx', 'ts', 'json', 'html', 'css'] },
  { name: 'すべて', extensions: ['*'] },
]

// マスコット素材の絞り込み。
// 注意: この拡張子リストは renderer 側 config/media.js の VIDEO/IMAGE_EXTENSIONS と
// 対で維持する。main は CommonJS、media.js は ESM なので共有できない。
// 片方だけ増やすと「ダイアログで選べるのに <img> で描画されて壊れる」ことになる。
const MEDIA_FILTERS = [
  {
    name: '画像/動画',
    extensions: ['svg', 'png', 'gif', 'webp', 'jpg', 'jpeg', 'avif', 'mp4', 'webm', 'ogv', 'mov', 'm4v'],
  },
  { name: 'すべて', extensions: ['*'] },
]

// renderer からの file 操作要求を受ける。fs はここ(main)だけが触る。
//
// セキュリティ方針: renderer は敵対的入力源とみなす。file:save で任意パスへ
// 書き込めると、renderer 乗っ取り時に任意ファイル上書きの経路になる。そこで
// 「このセッションで dialog を通して開いた/保存したパス」だけを allowedPaths に
// 記録し、上書き保存(file:save)はその集合内のパスに限定する。
const allowedPaths = new Set()

function registerFileHandlers() {
  ipcMain.handle('file:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: TEXT_FILTERS,
    })
    if (canceled || !filePaths[0]) return null
    const filePath = filePaths[0]
    const content = await fs.readFile(filePath, 'utf8')
    allowedPaths.add(filePath)
    return { path: filePath, name: path.basename(filePath), content }
  })

  ipcMain.handle('file:save', async (_e, { path: filePath, content }) => {
    // 型と、ダイアログ由来の許可済みパスであることを検証してから書く。
    if (typeof filePath !== 'string' || typeof content !== 'string') return null
    if (!allowedPaths.has(filePath)) {
      throw new Error('保存が許可されていないパスです(先に開くか、名前を付けて保存してください)')
    }
    await fs.writeFile(filePath, content, 'utf8')
    return { path: filePath, name: path.basename(filePath) }
  })

  ipcMain.handle('file:saveAs', async (_e, { content, suggestedName }) => {
    if (typeof content !== 'string') return null
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: typeof suggestedName === 'string' ? suggestedName : 'untitled.txt',
      filters: TEXT_FILTERS,
    })
    if (canceled || !filePath) return null
    await fs.writeFile(filePath, content, 'utf8')
    allowedPaths.add(filePath)
    return { path: filePath, name: path.basename(filePath) }
  })
}

// 素材選択の IPC。実パスは mediaProtocol に閉じ、renderer へはトークン URL だけ返す。
function registerMediaHandlers() {
  ipcMain.handle('media:pick', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: MEDIA_FILTERS,
    })
    if (canceled || !filePaths[0]) return null
    const filePath = filePaths[0]
    return { url: issueMediaToken(filePath), name: path.basename(filePath) }
  })

  ipcMain.handle('media:release', (_e, url) => {
    if (typeof url === 'string') releaseMediaToken(url)
    return null
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    backgroundColor: '#16161e',
    webPreferences: {
      // セキュリティ既定: renderer から Node を直接触らせない。
      // 必要な機能は preload の contextBridge 経由でのみ公開する。
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
}

app.whenReady().then(() => {
  registerFileHandlers()
  registerMediaHandlers()
  registerMediaProtocol()
  createWindow()
  // macOS: dock から再アクティブ時に window が無ければ作り直す作法。
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // macOS 以外はウィンドウを閉じたらアプリ終了。
  if (process.platform !== 'darwin') app.quit()
})
