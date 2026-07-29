// 設定の永続化(src/main/settingsStore.js)の防御線を、本物のコードを読み込んで検証する。
//
// なぜスクリプトが要るか: ここは M4-2 と同じ「renderer に見せてよいものの境界」で、
// 壊れても vite build は通り、画面上も普通に動いて見える(Issue #7)。
// 特に守りたいのは 3 方向:
//   保存時 … renderer が任意パスを設定へ注入できないこと(解決できるのは発行済みトークンだけ)
//   保存時 … 解決できなかった状態の設定を消してしまわないこと(取り外し中の素材を失わない)
//   復元時 … 設定ファイルが外から書き換えられても、任意ファイルへトークンを発行しないこと
//
// トークンの発行/解放/解決は本物の mediaProtocol を注入する(偽物で通っても意味がない)。
// 保存先だけは一時ディレクトリを渡す(実ユーザーの設定を汚さない)。
// electron 上で動かすのは、mediaProtocol が electron の API を要求するため。
//
// 実行: npm run check:settings  (終了コード 0 = 合格)

const { app } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

const {
  createSettingsStore,
  FILE_NAME,
  MAX_ASSIGNMENTS,
} = require('../src/main/settingsStore.js')
const {
  issueMediaToken,
  pathFromMediaUrl,
  releaseMediaToken,
  releaseAllMediaTokens,
} = require('../src/main/mediaProtocol.js')

app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu')
app.disableHardwareAcceleration()

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  ok' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

// 検証用の素材とワークディレクトリは自前で作る。
function makeWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mascot-settings-'))
  const media = path.join(dir, 'サンプル 動画.webm')
  fs.writeFileSync(media, Buffer.alloc(16, 1))
  const media2 = path.join(dir, 'もう一つ.png')
  fs.writeFileSync(media2, Buffer.alloc(8, 2))
  const secret = path.join(dir, 'secret.txt')
  fs.writeFileSync(secret, 'とても大事な情報')
  return { dir, media, media2, secret }
}

const newStore = (dir) =>
  createSettingsStore({
    dir,
    issueToken: issueMediaToken,
    releaseToken: releaseMediaToken,
    resolveUrl: pathFromMediaUrl,
  })

const settingsPath = (dir) => path.join(dir, FILE_NAME)
const readSettingsFile = (dir) => JSON.parse(fs.readFileSync(settingsPath(dir), 'utf8'))
const writeSettingsFile = (dir, obj) =>
  fs.writeFileSync(settingsPath(dir), JSON.stringify(obj))

app.whenReady().then(async () => {
  const ws = makeWorkspace()
  const store = newStore(ws.dir)

  // 1. 保存 → 復元のラウンドトリップ。設定にはパスが、renderer へはトークンが渡る
  {
    const url = issueMediaToken(ws.media)
    await store.save({ assignments: { idle: url, happy: url } })

    const saved = readSettingsFile(ws.dir)
    check(
      '設定にはパスで保存される',
      saved.assignments.idle === ws.media,
      `saved=${saved.assignments.idle}`
    )
    check('version が付く', saved.version === 1, `version=${saved.version}`)

    // リロード相当。古いトークンは全部無効になる
    releaseAllMediaTokens()

    const loaded = await store.load()
    const entry = loaded.assignments.idle
    check(
      '復元で新しいトークンが発行される',
      /^mascot-media:\/\/m\/[0-9a-f-]{36}$/.test(entry?.url ?? ''),
      entry?.url
    )
    check('復元 URL は保存前と別物', entry?.url !== url)
    check('表示名は元のファイル名', entry?.name === 'サンプル 動画.webm', entry?.name)
    check(
      '復元結果に実パスが混ざらない',
      Object.keys(entry).sort().join(',') === 'name,url',
      `keys=${Object.keys(entry).join(',')}`
    )
    check(
      '同じパスの複数状態は 1 トークンへ寄せる',
      loaded.assignments.idle.url === loaded.assignments.happy.url,
      `${loaded.assignments.idle.url} / ${loaded.assignments.happy.url}`
    )
  }

  // 2. 未発行/偽装 URL では設定を書き換えられない(任意パス注入が効かない)。
  //    かつ、既に保存されている設定を消してもいけない。
  {
    releaseAllMediaTokens()
    await store.save({
      assignments: {
        idle: `file://${ws.secret}`,
        happy: ws.secret,
        error: 'mascot-media://m/00000000-0000-4000-8000-000000000000',
        sleepy: 'mascot-media://evil/token',
      },
    })
    const saved = readSettingsFile(ws.dir)
    check(
      '偽装 URL のパスは保存されない',
      !JSON.stringify(saved).includes('secret.txt'),
      JSON.stringify(saved.assignments)
    )
    check(
      '解決できなくても既存の設定は消えない',
      saved.assignments.idle === ws.media && saved.assignments.happy === ws.media,
      JSON.stringify(saved.assignments)
    )
    check(
      '既存に無い状態は増えない',
      !('error' in saved.assignments) && !('sleepy' in saved.assignments)
    )
  }

  // 3. キーごと来なければ「割当を解除した」として消える(解除が効く)
  {
    releaseAllMediaTokens()
    const url = issueMediaToken(ws.media)
    await store.save({ assignments: { idle: url } })
    const saved = readSettingsFile(ws.dir)
    check(
      '送られてこない状態は解除される',
      saved.assignments.idle === ws.media && !('happy' in saved.assignments),
      JSON.stringify(saved.assignments)
    )
  }

  // 4. release 済みトークンでも既存設定は保たれる(トークン破棄との競合で消さない)
  {
    const url = issueMediaToken(ws.media2)
    releaseMediaToken(url)
    await store.save({ assignments: { idle: url } })
    const saved = readSettingsFile(ws.dir)
    check('release 済みトークンで既存を上書きしない', saved.assignments.idle === ws.media)
  }

  // 5. 割当以外のキーは保存で失われない(M5 でテーマを足した時に効く)
  {
    releaseAllMediaTokens()
    const before = readSettingsFile(ws.dir)
    writeSettingsFile(ws.dir, { ...before, themeId: 'zunda-dark' })
    const url = issueMediaToken(ws.media2)
    await store.save({ assignments: { idle: url } })
    const saved = readSettingsFile(ws.dir)
    check('割当以外のキーは残る', saved.themeId === 'zunda-dark', JSON.stringify(saved))
    check('割当は差し替わる', saved.assignments.idle === ws.media2)
  }

  // 6. 設定ファイルを外から書き換えても、対応外の形式は復元しない
  //    (ここが素通しだと「任意ローカルファイルを読み出す口」になる)
  {
    const dirTrap = path.join(ws.dir, 'trap.webm') // 拡張子だけ合ったディレクトリ
    fs.mkdirSync(dirTrap, { recursive: true })
    const link = path.join(ws.dir, 'link.webm')
    try {
      fs.symlinkSync(ws.secret, link) // 対応形式のふりをしたリンク
    } catch {
      /* Windows など symlink を作れない環境では飛ばす */
    }
    writeSettingsFile(ws.dir, {
      version: 1,
      assignments: {
        idle: ws.secret, // .txt = 対応外
        happy: path.join(ws.dir, 'missing.webm'), // 実体が無い
        error: 'relative/path.webm', // 相対パス
        angry: dirTrap, // ディレクトリ
        shy: link, // 実体は .txt のリンク
        sleepy: ws.media, // これだけ正当
      },
    })
    const loaded = await store.load()
    check('対応外の拡張子は復元しない', !loaded.assignments.idle)
    check('実体が無いパスは復元しない', !loaded.assignments.happy)
    check('相対パスは復元しない', !loaded.assignments.error)
    check('ディレクトリは復元しない', !loaded.assignments.angry)
    check(
      'リンク先が対応外なら復元しない',
      !fs.existsSync(link) || !loaded.assignments.shy
    )
    check('正当な素材だけが復元される', Boolean(loaded.assignments.sleepy))
  }

  // 7. 危険なキー名でもプロトタイプを壊さない(設定ファイルは誰でも書ける)
  {
    // オブジェクトリテラルの `__proto__:` はプロトタイプ指定として解釈され
    // JSON に載らないので、危険なキーは生の文字列で書く。
    const p = JSON.stringify(ws.media)
    fs.writeFileSync(
      settingsPath(ws.dir),
      `{"version":1,"assignments":{"__proto__":${p},"idle":${p}}}`
    )
    const loaded = await store.load()
    check(
      '__proto__ はただのキーとして扱われる',
      Object.getPrototypeOf(loaded.assignments) === null &&
        Object.prototype.hasOwnProperty.call(loaded.assignments, '__proto__')
    )
    check('素の Object のプロトタイプは無傷', Object.getPrototypeOf({}) === Object.prototype)
    check('正当なキーは普通に復元される', Boolean(loaded.assignments.idle))
  }

  // 8. 復元する割当には上限がある(手書きの設定でトークンを無限に発行させない)
  {
    const many = { version: 1, assignments: {} }
    for (let i = 0; i < MAX_ASSIGNMENTS + 20; i += 1) many.assignments[`s${i}`] = ws.media
    writeSettingsFile(ws.dir, many)
    const loaded = await store.load()
    check(
      `復元は ${MAX_ASSIGNMENTS} 件までに制限される`,
      Object.keys(loaded.assignments).length === MAX_ASSIGNMENTS,
      `count=${Object.keys(loaded.assignments).length}`
    )
  }

  // 9. load を繰り返しても、前回の復元トークンは無効化される(表が太り続けない)
  {
    writeSettingsFile(ws.dir, { version: 1, assignments: { idle: ws.media } })
    const first = await store.load()
    const second = await store.load()
    check('load のたびに新しいトークン', first.assignments.idle.url !== second.assignments.idle.url)
    check('前回の復元トークンは無効化される', pathFromMediaUrl(first.assignments.idle.url) === null)
    check('最新の復元トークンは生きている', pathFromMediaUrl(second.assignments.idle.url) === ws.media)

    // 同時に呼ばれても(StrictMode の二重マウント)追跡が交錯しない。
    // 直列化していないと、先に発行したトークンが誰にも解放されないまま残る。
    const [a, b] = await Promise.all([store.load(), store.load()])
    const alive = [a, b].filter((r) => pathFromMediaUrl(r.assignments.idle.url) !== null)
    check('同時 load でも生きたトークンは 1 つだけ', alive.length === 1, `alive=${alive.length}`)
  }

  // 10. 壊れた設定/未知の version/変な型でも落ちず、既定値で起動できる
  {
    fs.writeFileSync(settingsPath(ws.dir), '{ これは JSON では')
    const broken = await store.load()
    check('壊れた JSON でも落ちない', Object.keys(broken.assignments).length === 0)

    writeSettingsFile(ws.dir, { version: 999, assignments: { idle: ws.media } })
    const future = await store.load()
    check('未知の version は復元しない', Object.keys(future.assignments).length === 0)

    writeSettingsFile(ws.dir, { version: 1, assignments: [1, 2, 3] })
    const wrongType = await store.load()
    check('assignments が配列でも落ちない', Object.keys(wrongType.assignments).length === 0)

    fs.rmSync(settingsPath(ws.dir))
    const missing = await store.load()
    check('設定ファイルが無くても落ちない', Object.keys(missing.assignments).length === 0)

    await store.save(undefined)
    await store.save({ assignments: 'not an object' })
    check('壊れた save 要求でも書ける', Object.keys(readSettingsFile(ws.dir).assignments).length === 0)
  }

  // 11. 連続保存しても壊れず、最後の内容になる。一時ファイルも残さない
  {
    releaseAllMediaTokens()
    const url = issueMediaToken(ws.media)
    const url2 = issueMediaToken(ws.media2)
    await Promise.all([
      store.save({ assignments: {} }),
      store.save({ assignments: { idle: url } }),
      store.save({ assignments: { idle: url, happy: url2 } }),
    ])
    const saved = readSettingsFile(ws.dir)
    check(
      '連続保存でも壊れた JSON にならない',
      saved.assignments.idle === ws.media && saved.assignments.happy === ws.media2,
      JSON.stringify(saved.assignments)
    )
    check(
      '一時ファイルを残さない',
      fs.readdirSync(ws.dir).every((f) => !f.endsWith('.tmp')),
      fs.readdirSync(ws.dir).join(',')
    )
  }

  // 12. 保存先ディレクトリが無くても作る(初回起動)
  {
    const fresh = path.join(ws.dir, 'nested', 'userData')
    const url = issueMediaToken(ws.media)
    await newStore(fresh).save({ assignments: { idle: url } })
    check('保存先が無ければ作る', fs.existsSync(settingsPath(fresh)))
  }

  fs.rmSync(ws.dir, { recursive: true, force: true })

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  app.exit(failed.length === 0 ? 0 : 1)
})
