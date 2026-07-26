// 使い捨て: dist/ をレンダリングして PNG に保存する(スマホ確認用プレビュー)。
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-compositing')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.disableHardwareAcceleration()

console.error('[shot] start')

app.whenReady().then(async () => {
  console.error('[shot] ready')
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../src/main/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.webContents.on('did-finish-load', () => console.error('[shot] loaded'))
  win.webContents.on('render-process-gone', (_e, d) =>
    console.error('[shot] render-gone', JSON.stringify(d))
  )

  await win.loadFile(path.join(__dirname, '../dist/index.html'))
  await new Promise((r) => setTimeout(r, 1000))

  const image = await win.webContents.capturePage()
  fs.writeFileSync(path.join(__dirname, '../preview.png'), image.toPNG())
  console.error('[shot] saved')
  app.quit()
})
