// main プロセス側の「素材として受け入れてよい形式」の判定を 1 箇所に集める。
//
// 切り出した理由: この判定を要る場所が 2 つに増えた。
//   - ダイアログで選ばれたファイルの検証(main.js)
//   - 設定から復元するパスの検証(settingsStore.js)
// 片方だけ緩いと、そこが「任意ローカルファイルにトークンを発行する口」になる。
//
// 拡張子リストの出所は renderer(config/media.js)と同じ JSON。二重管理をやめて
// あるのは、片方だけ増やすと「選べるのに <img> で描画されて壊れる」ズレが起きるため。

const path = require('node:path')
const mediaExtensions = require('../../config/media-extensions.json')

// Set は外へ出さない。「対応形式の唯一の出所」を主張しながら、
// 受け取った側が add() で足せる形にしておくのは筋が通らない。
const MEDIA_EXTENSIONS = new Set([...mediaExtensions.image, ...mediaExtensions.video])

/** ダイアログのフィルタは OS 依存で抜けうるので、選択後にも拡張子を検証する。 */
function isSupportedMedia(filePath) {
  if (typeof filePath !== 'string') return false
  return MEDIA_EXTENSIONS.has(path.extname(filePath).slice(1).toLowerCase())
}

/** ダイアログの filters 用。呼び出し側が触っても出所は汚れない複製を返す。 */
function supportedMediaExtensions() {
  return [...MEDIA_EXTENSIONS]
}

module.exports = { isSupportedMedia, supportedMediaExtensions }
