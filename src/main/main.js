const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')

// MASCOT_DEV=1 のとき Vite dev server を読む。未設定/0 なら build 済み dist を読む。
const isDev = process.env.MASCOT_DEV === '1'

// テキストファイルの絞り込み(開く/保存ダイアログ共通)
const TEXT_FILTERS = [
  { name: 'テキスト', extensions: ['txt', 'md', 'js', 'jsx', 'ts', 'json', 'html', 'css'] },
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
      throw new Error('保存が許可されていないパスなのだ(先に開くか名前を付けて保存するのだ)')
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
