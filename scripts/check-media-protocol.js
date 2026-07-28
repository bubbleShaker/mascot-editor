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
const os = require('node:os')

const {
  HOST,
  issueMediaToken,
  tokenFromUrl,
  releaseMediaToken,
  releaseAllMediaTokens,
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

// 検証用の素材は自前で作る。assets/ の同梱サンプルに依存すると、
// 「サンプルを消しても動く」という PLAN の原則に反してテストが壊れる。
function makeSample() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mascot-check-'))
  const file = path.join(dir, 'サンプル 動画.webm')
  const body = Buffer.alloc(4096, 7) // 中身は何でもよい。長さの一致だけ見る
  fs.writeFileSync(file, body)
  return { dir, file, size: body.length }
}

app.whenReady().then(async () => {
  registerMediaProtocol()

  const sample = makeSample()
  const url = issueMediaToken(sample.file)

  // 1. 発行したトークンは中身をそのまま返す
  //    (空白・日本語入りのパスでも壊れないことを兼ねて確認する)
  const res = await net.fetch(url)
  const body = Buffer.from(await res.arrayBuffer())
  check('発行済みトークンが 200 を返す', res.status === 200, `status=${res.status}`)
  check('中身がファイルと同じ長さ', body.length === sample.size, `${body.length} / ${sample.size} bytes`)

  // 2. トークンは不透明(パスの痕跡を含まない)
  const token = url.slice(`mascot-media://${HOST}/`.length)
  check('トークンにパスの痕跡が無い', !url.includes('webm') && /^[0-9a-f-]{36}$/.test(token), url)

  // 3. Range は無視して常に全体を 200 で返す(部分応答で嘘をつかない)。
  //    Electron の file ローダーは Range を受けても 206 を返さないため、
  //    転送すると「200 なのに本文が切れている」応答になってしまう。
  const ranged = await net.fetch(url, { headers: { range: 'bytes=0-99' } })
  const rangedBody = Buffer.from(await ranged.arrayBuffer())
  check('Range 要求でも 200', ranged.status === 200, `status=${ranged.status}`)
  check(
    'Range 要求でも本文は全体',
    rangedBody.length === sample.size,
    `${rangedBody.length} / ${sample.size} bytes`
  )

  // 4. 未発行トークンは 404(パスを推測しても届かない)
  const bogus = await net.fetch(`mascot-media://${HOST}/00000000-0000-4000-8000-000000000000`)
  check('未発行トークンは 404', bogus.status === 404, `status=${bogus.status}`)

  // 5. パストラバーサル風の URL も、実パスを組み立てる経路が無いので 404
  for (const evil of [
    `mascot-media://${HOST}/..%2F..%2Fetc%2Fpasswd`,
    `mascot-media://${HOST}/../../../../etc/passwd`,
    `mascot-media://${HOST}/`,
  ]) {
    const r = await net.fetch(evil).catch((e) => ({ status: `error:${e.message}` }))
    check(`不正 URL が配信されない: ${evil}`, r.status === 404, `status=${r.status}`)
  }

  // 6. host が違えば届かない(オリジンを 1 つに固定している)
  const otherHost = await net.fetch(`mascot-media://evil/${token}`)
  check('別 host では配信されない', otherHost.status === 404, `status=${otherHost.status}`)

  // 7. release 後は同じ URL が届かなくなる
  releaseMediaToken(url)
  const afterRelease = await net.fetch(url)
  check('release 後は 404', afterRelease.status === 404, `status=${afterRelease.status}`)

  // 8. リロード相当の一括破棄で全トークンが無効になる
  const url2 = issueMediaToken(sample.file)
  releaseAllMediaTokens()
  const afterClear = await net.fetch(url2)
  check('一括破棄後は 404', afterClear.status === 404, `status=${afterClear.status}`)

  // 9. 実体が消えた素材は例外ではなく 404 になる
  const url3 = issueMediaToken(path.join(sample.dir, 'missing.webm'))
  const missing = await net.fetch(url3)
  check('存在しないファイルは 404', missing.status === 404, `status=${missing.status}`)

  // 10. tokenFromUrl は他スキームを受け付けない
  check('別スキームは token を返さない', tokenFromUrl('file:///etc/passwd') === null)

  fs.rmSync(sample.dir, { recursive: true, force: true })

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  app.exit(failed.length === 0 ? 0 : 1)
})
