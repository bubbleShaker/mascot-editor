const { contextBridge } = require('electron')

// renderer(React) からは window.zunda 経由でのみ main の機能に触れる。
// M0 では最小。M1 でファイル open/save の IPC をここに足していく。
contextBridge.exposeInMainWorld('zunda', {
  version: '0.1.0',
  platform: process.platform,
})
