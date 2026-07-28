// fileService と同じ「環境で実装を切り替える」パターン。
// 本体(App)は「メディアを選べる何か」にだけ依存し、選び方も参照方法も知らない:
//   - Electron … ネイティブダイアログ → main が mascot-media:// のトークン URL を発行
//   - ブラウザ … <input type=file> → blob URL
//
// pick() の返り値は { url, kind, name, release } または null(キャンセル)。
// release() は「この URL をもう使わない」と伝える後始末。実体は環境で違う
// (Electron はトークン破棄、ブラウザは revokeObjectURL)が、呼ぶ側は区別しない。

import {
  mediaKindFromMime,
  mediaKindFromPath,
  SUPPORTED_MEDIA_EXTENSIONS,
} from '../config/media.js'

const isElectron = () => window.mascotEditor?.isElectron === true

const electronService = {
  async pick() {
    const res = await window.mascotEditor.media.pick()
    if (!res) return null
    // kind は元のファイル名から判定する。トークン URL は意味を持たない
    // 不透明な識別子(拡張子を含まない)なので、判断材料になるのは name だけ。
    return {
      url: res.url,
      kind: mediaKindFromPath(res.name),
      name: res.name,
      release: () => window.mascotEditor.media.release(res.url),
    }
  },
}

// <input type=file> の accept 属性。拡張子リストは media.js が唯一の出所。
const ACCEPT = SUPPORTED_MEDIA_EXTENSIONS.map((ext) => `.${ext}`).join(',')

const webService = {
  pick: () =>
    new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = `${ACCEPT},image/*,video/*`
      // キャンセルは onchange が発火しないので oncancel で拾う。
      // 拾わないと Promise が解決されず、呼び出し側が待ち続ける。
      input.oncancel = () => resolve(null)
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) return resolve(null)
        // blob URL はこのタブが生きている間だけ有効な、File への一時的な参照。
        // ファイルを丸ごとメモリに読み込む data URL と違い、大きな動画でも軽い。
        const url = URL.createObjectURL(file)
        resolve({
          url,
          kind: mediaKindFromMime(file.type, file.name),
          name: file.name,
          release: () => URL.revokeObjectURL(url),
        })
      }
      input.click()
    }),
}

export const mediaService = isElectron() ? electronService : webService
