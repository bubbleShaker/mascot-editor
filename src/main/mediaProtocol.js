// マスコット素材の配信を担う独立モジュール。
//
// main.js から切り出しているのは、ここが「renderer に見せてよいものの境界」
// そのものであり、window 生成やファイル編集とは別の関心事だから。
// 切り出したことで scripts/check-media-protocol.js が本物のこのコードを
// 読み込んで検証できる(コピーではなく実物を叩く回帰ガードになる)。
//
// セキュリティ方針(M1 の allowedPaths と同じ防御線を「読み出し」にも延長する):
// renderer に実パスを一切渡さず、dialog を通ったパスへ発行した使い捨てトークンだけを
// 渡す。URL は mascot-media://m/<uuid>.<ext> の形になり、renderer 側でパスを
// 組み立てる余地が無い = パストラバーサル(../../ や C:\Windows\...)が構造的に入らない。
// Windows のドライブレターや日本語ファイル名を URL に埋める際のエンコード事故も避けられる。

const { protocol, net } = require('electron')
const path = require('node:path')
const crypto = require('node:crypto')
const { pathToFileURL } = require('node:url')

const SCHEME = 'mascot-media'

// カスタムプロトコルの特権登録。app.whenReady() より前(モジュール読込時)に
// 呼ぶ必要があるため、このモジュールを require した時点で走らせる。
//   standard        … host/path を持つ通常の URL としてパースさせる
//   secure          … 安全なオリジン扱い(CSP や mixed content の扱いが file: より素直)
//   stream          … Range リクエストを通す。動画のシークに必要
//   supportFetchAPI … renderer からの fetch() を許可
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true },
  },
])

const mediaTokens = new Map() // token(uuid.ext) → 絶対パス

/**
 * 絶対パスへ使い捨てトークンを発行し、renderer へ渡せる URL を返す。
 * 拡張子をトークンに残すのは、renderer の media.js が拡張子で <img>/<video> を
 * 判定するため(URL に拡張子が無いと動画が <img> で描画されて壊れる)。
 */
function issueMediaToken(filePath) {
  const token = `${crypto.randomUUID()}${path.extname(filePath).toLowerCase()}`
  mediaTokens.set(token, filePath)
  return `${SCHEME}://m/${token}`
}

/** mascot-media://m/<token> から token を取り出す。形が違えば null。 */
function tokenFromUrl(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== `${SCHEME}:`) return null
    return decodeURIComponent(parsed.pathname.replace(/^\//, '')) || null
  } catch {
    return null
  }
}

/**
 * トークンを破棄する。差し替え/終了時に呼ばないと、使わない素材への参照が
 * main のメモリに溜まり続ける(古い URL がいつまでも生きてしまう)。
 */
function releaseMediaToken(url) {
  const token = tokenFromUrl(url)
  if (token) mediaTokens.delete(token)
}

/** app.whenReady() 後に一度だけ呼ぶ。 */
function registerMediaProtocol() {
  protocol.handle(SCHEME, async (request) => {
    const token = tokenFromUrl(request.url)
    const filePath = token && mediaTokens.get(token)
    // 未登録トークン = 発行していない素材への要求。パスを推測されても届かない。
    if (!filePath) return new Response('Not Found', { status: 404 })
    // net.fetch に file:// を渡すと Electron が読み出しとレンジ処理を担う。
    // pathToFileURL を挟むのは、空白や日本語を含むパスを正しくエンコードするため。
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

module.exports = {
  SCHEME,
  issueMediaToken,
  tokenFromUrl,
  releaseMediaToken,
  registerMediaProtocol,
}
