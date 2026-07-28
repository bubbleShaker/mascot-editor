// マスコット素材の配信を担う独立モジュール。
//
// main.js から切り出しているのは、ここが「renderer に見せてよいものの境界」
// そのものであり、window 生成やファイル編集とは別の関心事だから。
// 切り出したことで scripts/check-media-protocol.js が本物のこのコードを
// 読み込んで検証できる(コピーではなく実物を叩く回帰ガードになる)。
//
// セキュリティ方針(M1 の allowedPaths と同じ防御線を「読み出し」にも延長する):
// renderer に実パスを一切渡さず、dialog を通ったパスへ発行した使い捨てトークンだけを
// 渡す。URL は mascot-media://m/<uuid> の形になり、renderer 側でパスを組み立てる
// 余地が無い = パストラバーサル(../../ や C:\Windows\...)が構造的に入らない。
// Windows のドライブレターや日本語ファイル名を URL に埋める際のエンコード事故も避けられる。
//
// トークンに拡張子は付けない。renderer の kind 判定(<img>/<video>)は元のファイル名を
// 使っており(mediaService.js)、Content-Type は net.fetch が実パスから決めるので、
// トークンは意味を持たない不透明な識別子で足りる。

const { protocol, net } = require('electron')
const crypto = require('node:crypto')
const { pathToFileURL } = require('node:url')

const SCHEME = 'mascot-media'
// host は固定。standard scheme では host がオリジンを分けるので、
// 将来 CSP を mascot-media://m 単位で絞れるよう1つに寄せておく。
const HOST = 'm'

// カスタムプロトコルの特権登録。app.whenReady() より前(モジュール読込時)に
// 呼ぶ必要があるため、このモジュールを require した時点で走らせる。
//   standard … host/path を持つ通常の URL としてパースさせる
//   secure   … 安全なオリジン扱い(CSP や mixed content の扱いが file: より素直)
//   stream   … 応答をストリームで返せるようにする。大きな動画を全部メモリに
//              載せずに <video> へ流すために要る
// supportFetchAPI は付けない: 用途は <img>/<video> だけで、renderer からの
// fetch() を許す理由が無い(最小権限)。
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, stream: true },
  },
])

const mediaTokens = new Map() // token(uuid) → 絶対パス

/** 絶対パスへ使い捨てトークンを発行し、renderer へ渡せる URL を返す。 */
function issueMediaToken(filePath) {
  const token = crypto.randomUUID()
  mediaTokens.set(token, filePath)
  return `${SCHEME}://${HOST}/${token}`
}

/** mascot-media://m/<token> から token を取り出す。形が違えば null。 */
function tokenFromUrl(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== `${SCHEME}:` || parsed.host !== HOST) return null
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

/** 全トークンを破棄する。リロード/ウィンドウ破棄時の後始末に使う。 */
function releaseAllMediaTokens() {
  mediaTokens.clear()
}

/** app.whenReady() 後に一度だけ呼ぶ。 */
function registerMediaProtocol() {
  protocol.handle(SCHEME, async (request) => {
    const token = tokenFromUrl(request.url)
    const filePath = token && mediaTokens.get(token)
    // 未登録トークン = 発行していない素材への要求。パスを推測されても届かない。
    if (!filePath) return new Response('Not Found', { status: 404 })
    try {
      // net.fetch に file:// を渡すと Electron が読み出しを担う。
      // pathToFileURL を挟むのは、空白や日本語を含むパスを正しくエンコードするため。
      //
      // Range ヘッダは意図的に転送しない。Electron の file ローダーは Range を
      // 受けても 206 + Content-Range を返さず、200 のまま本文だけ切り詰めた
      // 応答になる(実測)。それは「全部返した」と嘘をつくことになり、
      // 途中で切れた動画として扱われかねない。Range を無視して常に全体を
      // 200 で返すのは HTTP 的に正しい振る舞いで、マスコット(自動再生ループ、
      // シークバー無し)には十分。シークが要る用途が出たら、ここで fs の
      // createReadStream を使って自前で 206 を組み立てること。
      return await net.fetch(pathToFileURL(filePath).toString())
    } catch (err) {
      // 選択後にファイルが移動/削除されると net.fetch は reject する。
      // ここで拾わないと main に unhandled error が出る。renderer 側は
      // 404 を onError として受け取り、フォールバック表示へ落ちる。
      console.error('[mascot-media] 配信に失敗:', err)
      return new Response('Not Found', { status: 404 })
    }
  })
}

module.exports = {
  SCHEME,
  HOST,
  issueMediaToken,
  tokenFromUrl,
  releaseMediaToken,
  releaseAllMediaTokens,
  registerMediaProtocol,
}
