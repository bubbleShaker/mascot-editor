// fileService と同じ「環境で実装を切り替える」パターン。
// 本体(App)は「メディアを選べる何か」にだけ依存し、選び方も参照方法も知らない:
//   - Electron … ネイティブダイアログ → main が mascot-media:// のトークン URL を発行
//   - ブラウザ … <input type=file> → blob URL
//
// pick() の返り値は { url, kind, name, release } または null(キャンセル)。
// release() は「この URL をもう使わない」と伝える後始末。実体は環境で違う
// (Electron はトークン破棄、ブラウザは revokeObjectURL)が、呼ぶ側は区別しない。
//
// adopt(saved) は「設定から復元された素材」を同じ形のエントリに仕立てる。
// 復元できるかどうかも環境差なので、ここで吸収して呼ぶ側に分岐を持ち込ませない
// (Electron は再発行されたトークン、ブラウザは復元不能で常に null)。

import {
  mediaKindFromMime,
  mediaKindFromPath,
  SUPPORTED_MEDIA_EXTENSIONS,
} from '../config/media.js'

const isElectron = () => window.mascotEditor?.isElectron === true

// main から来た { url, name } を素材エントリへ仕立てる。
// kind は元のファイル名から判定する。トークン URL は意味を持たない
// 不透明な識別子(拡張子を含まない)なので、判断材料になるのは name だけ。
// pick(選ぶ)と adopt(設定から復元する)で仕立て方は同じなので共通化する。
function toElectronEntry(res) {
  return {
    url: res.url,
    kind: mediaKindFromPath(res.name),
    name: res.name,
    // 解放は呼びっぱなしにされる(後始末なので待つ意味がない)。IPC の拒否を
    // ここで拾わないと unhandled rejection になるので、握って記録だけする。
    release: () => {
      window.mascotEditor.media.release(res.url).catch((e) => console.error(e))
    },
  }
}

const electronService = {
  async pick() {
    const res = await window.mascotEditor.media.pick()
    return res ? toElectronEntry(res) : null
  },
  adopt: (saved) => (saved?.url && saved?.name ? toElectronEntry(saved) : null),
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
  // ブラウザには復元できる素材が無い。blob URL はタブを閉じた時点で死んでおり、
  // File への参照も残らない(ユーザーが選び直すしかない)。復元できるふりを
  // しないよう常に null を返す ＝ その状態は同梱素材へフォールバックする。
  adopt: () => null,
}

export const mediaService = isElectron() ? electronService : webService
