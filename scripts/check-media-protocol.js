// mascot-media:// の防御線を、本物の src/main/mediaProtocol.js を読み込んで検証する。
//
// なぜスクリプトが要るか: ここは「renderer に見せてよいものの境界」で、壊れても
// vite build は通ってしまう(プロセス境界の契約はビルドで検査されない → Issue #7)。
// 発行済みトークンだけが 200 を返し、それ以外は 404 になることを機械的に確かめる。
//
// net.fetch は main プロセスからでも protocol.handle の登録を通るので、
// ウィンドウを開かずに検証できる。
//
// 実行: npm run check:media  (終了コード 0 = 合格)

const { app, net } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const {
  issueMediaToken,
  tokenFromUrl,
  releaseMediaToken,
  registerMediaProtocol,
} = require('../src/main/mediaProtocol.js')

app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu')
app.disableHardwareAcceleration()
// 注意: 画面の無い環境(WSL・CI)で必要な --ozone-platform=headless は
// ここでは付けられない。表示プラットフォームの選択は JS が動くより前に
// 決まるため、appendSwitch では間に合わず X に接続しに行って固まる。
// あの旗は package.json の check:media で electron の引数として渡している。

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  ok' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

app.whenReady().then(async () => {
  registerMediaProtocol()

  const sample = path.join(__dirname, '../assets/demo/pulse.webm')
  const size = fs.statSync(sample).size
  const url = issueMediaToken(sample)

  // 1. 発行したトークンは中身をそのまま返す
  const res = await net.fetch(url)
  const body = Buffer.from(await res.arrayBuffer())
  check('発行済みトークンが 200 を返す', res.status === 200, `status=${res.status}`)
  check('中身がファイルと同じ長さ', body.length === size, `${body.length} / ${size} bytes`)

  // 2. 拡張子が URL に残っている(renderer の <img>/<video> 判定に必要)
  check('URL に拡張子が残る', url.endsWith('.webm'), url)

  // 3. 未発行トークンは 404(パスを推測しても届かない)
  const bogus = await net.fetch('mascot-media://m/00000000-0000-4000-8000-000000000000.webm')
  check('未発行トークンは 404', bogus.status === 404, `status=${bogus.status}`)

  // 4. パストラバーサル風の URL も、実パスを組み立てる経路が無いので 404
  for (const evil of [
    'mascot-media://m/..%2F..%2Fetc%2Fpasswd',
    'mascot-media://m/../../../../etc/passwd',
    'mascot-media://m/',
  ]) {
    const r = await net.fetch(evil).catch((e) => ({ status: `error:${e.message}` }))
    check(`不正 URL が配信されない: ${evil}`, r.status === 404, `status=${r.status}`)
  }

  // 5. release 後は同じ URL が届かなくなる
  releaseMediaToken(url)
  const afterRelease = await net.fetch(url)
  check('release 後は 404', afterRelease.status === 404, `status=${afterRelease.status}`)

  // 6. tokenFromUrl は他スキームを受け付けない
  check('別スキームは token を返さない', tokenFromUrl('file:///etc/passwd') === null)

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  app.exit(failed.length === 0 ? 0 : 1)
})
