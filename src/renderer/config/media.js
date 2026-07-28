// メディア種別の判定。「そのURLを <img> で出すか <video> で出すか」の
// 唯一の判断場所にする。ここを一箇所に集めておく理由は、判定材料が
// 供給元ごとに違うため:
//   - config/*.json 由来 … "assets/foo.webm" のようなパス(拡張子がある)
//   - ユーザー選択(M4以降) … blob:/custom protocol の URL には拡張子が無く、
//     File.type(MIME) から判定するしかない
// 呼び出し側は判定方法を知らず、{ url, kind } という同じ形だけを受け取る。

// 拡張子リストは config/media-extensions.json が唯一の出所。main プロセス(CJS)も
// 同じ JSON を読むので、対応形式を増やす時の変更点が 1 箇所で済む。
// 例外は loader.js の import.meta.glob パターンだけ(Vite がリテラルしか受け付けない)。
import mediaExtensions from '../../../config/media-extensions.json'

const VIDEO_EXTENSIONS = new Set(mediaExtensions.video)
const IMAGE_EXTENSIONS = new Set(mediaExtensions.image)

/** 'assets/a/b.webm' → 'webm' / 拡張子が無ければ null */
function extensionOf(filePath) {
  const base = String(filePath).split(/[\\/]/).pop() ?? ''
  // クエリ/フラグメントを先に落とす。'a.webm?v=2' の拡張子を 'webm?v=2' と
  // 誤認すると動画が <img> で描画されて壊れる(M4-2 のカスタムプロトコル URL で踏む)。
  const name = base.split(/[?#]/)[0]
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return null
  return name.slice(dot + 1).toLowerCase()
}

/** パス/ファイル名から 'video' | 'image' を返す。未知の拡張子は image 扱い。 */
export function mediaKindFromPath(filePath) {
  const ext = extensionOf(filePath)
  if (ext && VIDEO_EXTENSIONS.has(ext)) return 'video'
  return 'image'
}

/** MIME(File.type)から判定。空文字なら名前にフォールバックする。 */
export function mediaKindFromMime(mimeType, fallbackName = '') {
  if (typeof mimeType === 'string' && mimeType.startsWith('video/')) return 'video'
  if (typeof mimeType === 'string' && mimeType.startsWith('image/')) return 'image'
  return mediaKindFromPath(fallbackName)
}

/** ピッカーの accept 属性やダイアログのフィルタに使う対応拡張子。 */
export const SUPPORTED_MEDIA_EXTENSIONS = [
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
]
