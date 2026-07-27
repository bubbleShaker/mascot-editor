const { contextBridge, ipcRenderer } = require('electron')

// renderer(React) からは window.api 経由でのみ main の機能に触れる。
// file 操作は IPC を薄くラップして公開(生の ipcRenderer は渡さない)。
contextBridge.exposeInMainWorld('api', {
  version: '0.1.0',
  platform: process.platform,
  file: {
    open: () => ipcRenderer.invoke('file:open'),
    save: (path, content) => ipcRenderer.invoke('file:save', { path, content }),
    saveAs: (content, suggestedName) =>
      ipcRenderer.invoke('file:saveAs', { content, suggestedName }),
  },
})
