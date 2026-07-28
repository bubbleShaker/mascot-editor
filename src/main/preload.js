const { contextBridge, ipcRenderer } = require('electron')

// renderer(React) からは window.mascotEditor 経由でのみ main の機能に触れる。
// file 操作は IPC を薄くラップして公開(生の ipcRenderer は渡さない)。
//
// 名前を api ではなくアプリ固有名にしているのは、ブラウザで動かす時に
// 第三者ライブラリの window.api と衝突して環境判定を誤らせないため。
contextBridge.exposeInMainWorld('mascotEditor', {
  // 「Electron で動いている」ことの明示マーカー。
  // renderer 側はメソッドの有無を推測せず、この旗だけを見て実装を選ぶ。
  isElectron: true,
  version: '0.1.0',
  platform: process.platform,
  file: {
    open: () => ipcRenderer.invoke('file:open'),
    save: (path, content) => ipcRenderer.invoke('file:save', { path, content }),
    saveAs: (content, suggestedName) =>
      ipcRenderer.invoke('file:saveAs', { content, suggestedName }),
  },
  // マスコット素材の選択。返るのは { url, name } で、url は mascot-media:// の
  // トークン URL。実パスは main に閉じたままで renderer へは渡らない。
  media: {
    pick: () => ipcRenderer.invoke('media:pick'),
    release: (url) => ipcRenderer.invoke('media:release', url),
  },
})
