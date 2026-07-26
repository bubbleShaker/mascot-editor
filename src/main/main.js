const { app, BrowserWindow } = require('electron')
const path = require('node:path')

// ZUNDA_DEV=1 のとき Vite dev server を読む。未設定/0 なら build 済み dist を読む。
const isDev = process.env.ZUNDA_DEV === '1'

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
