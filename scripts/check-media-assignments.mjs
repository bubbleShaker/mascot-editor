// 割当の解放判定を、本物の src/renderer/services/mediaAssignments.mjs を
// 読み込んで検証する。
//
// なぜスクリプトが要るか: 「まだ他の状態が参照している素材を解放しない」は
// 壊れても vite build が通り、画面上も一見動いて見える(解放済み URL は
// しばらく表示され続けることがある)。ここを機械的に固定しておく(Issue #7)。
//
// 実行: npm run check:assign  (終了コード 0 = 合格)

import {
  assignAll,
  entriesToRelease,
  fromRestored,
  pickStates,
  statesOf,
  toDisplayMap,
  toNameMap,
  toUrlMap,
} from '../src/renderer/services/mediaAssignments.mjs'

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  ok' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

// 素材エントリの偽物。release が何回呼ばれたかだけ数える。
const makeEntry = (name) => ({
  url: `mascot-media://m/${name}`,
  kind: 'video',
  name,
  released: 0,
  release() {
    this.released += 1
  },
})

const STATES = ['idle', 'happy', 'error']

// 1. 割当を外したエントリは解放対象になる
{
  const e1 = makeEntry('a')
  const prev = { idle: e1, happy: null, error: null }
  const next = { idle: null, happy: null, error: null }
  const dropped = entriesToRelease(prev, next)
  check('外したエントリは解放対象', dropped.length === 1 && dropped[0] === e1)
}

// 2. 他の状態がまだ使っているエントリは解放しない(本題)
{
  const e1 = makeEntry('shared')
  const e2 = makeEntry('new')
  const prev = { idle: e1, happy: e1, error: null }
  const next = { idle: e2, happy: e1, error: null }
  const dropped = entriesToRelease(prev, next)
  check(
    '共有中のエントリは解放しない',
    dropped.length === 0,
    `dropped=${dropped.map((d) => d.name).join(',') || 'なし'}`
  )
}

// 3. 最後の参照が消えたら解放する
{
  const e1 = makeEntry('shared')
  const prev = { idle: e1, happy: e1, error: null }
  const next = { idle: null, happy: null, error: null }
  const dropped = entriesToRelease(prev, next)
  check('最後の参照が消えたら解放', dropped.length === 1 && dropped[0] === e1)
}

// 4. 同一エントリが複数状態に居ても、解放は 1 回だけ
{
  const e1 = makeEntry('shared')
  const prev = assignAll(STATES, e1)
  for (const entry of entriesToRelease(prev, {})) entry.release()
  check('二重解放しない', e1.released === 1, `released=${e1.released}`)
}

// 5. 全部に適用は全状態へ同じエントリを入れる
{
  const e1 = makeEntry('all')
  const map = assignAll(STATES, e1)
  check(
    '全部に適用で全状態が同じエントリ',
    STATES.every((s) => map[s] === e1)
  )
}

// 6. 未割当(null)は解放対象に混ざらない
{
  const dropped = entriesToRelease({ idle: null, happy: null }, {})
  check('null は解放対象に混ざらない', dropped.length === 0)
}

// 7. 表示用マップは release を漏らさない(表示層に副作用を渡さない)
{
  const e1 = makeEntry('a')
  const view = toDisplayMap({ idle: e1, happy: null })
  const keys = Object.keys(view.idle)
  check(
    '表示用は url/kind だけ',
    keys.length === 2 && keys.includes('url') && keys.includes('kind'),
    `keys=${keys.join(',')}`
  )
  check('未割当は表示用マップに載らない', !('happy' in view))
}

// 7b. 割当パネル用マップは名前だけ(url も release も渡さない)
{
  const e1 = makeEntry('a')
  const names = toNameMap({ idle: e1, happy: null })
  check(
    'パネル用は名前だけ',
    names.idle === 'a' && !('happy' in names) && typeof names.idle === 'string'
  )
}

// 8. 状態一覧は JSON(states)由来。増やせば UI の行も増える
{
  const mascot = { states: { idle: 'a.svg', happy: 'b.svg', sleepy: 'c.webm' } }
  check(
    '状態一覧は states のキー',
    statesOf(mascot).join(',') === 'idle,happy,sleepy'
  )
  check('states が無くても落ちない', statesOf(undefined).length === 0)
}

// 9. 永続化用マップは 状態 → url だけ(未割当は載らない)
{
  const e1 = makeEntry('a')
  const urls = toUrlMap({ idle: e1, happy: e1, error: null })
  check(
    '保存用は状態→url',
    urls.idle === e1.url && urls.happy === e1.url && !('error' in urls),
    JSON.stringify(urls)
  )
}

// 10. 復元: 同じ url は 1 エントリへ寄せる(ここが本題)。
//     別エントリに分かれると、片方を差し替えた時に entriesToRelease が
//     「もう誰も使っていない」と誤判定し、生きている URL を殺してしまう。
{
  let adopted = 0
  const adopt = (saved) => {
    adopted += 1
    return { url: saved.url, kind: 'image', name: saved.name, release() {} }
  }
  const map = fromRestored(
    {
      idle: { url: 'mascot-media://m/1', name: 'a.png' },
      happy: { url: 'mascot-media://m/1', name: 'a.png' },
      error: { url: 'mascot-media://m/2', name: 'b.webm' },
    },
    adopt
  )
  check('復元で同じ url は同一エントリ', map.idle === map.happy && map.idle !== map.error)
  check('仕立ては url ごとに 1 回だけ', adopted === 2, `adopted=${adopted}`)

  // 共有されているので、片方を差し替えても解放されない
  const other = makeEntry('new')
  check(
    '復元後も共有エントリは解放されない',
    entriesToRelease(map, { ...map, idle: other }).length === 0
  )
}

// 11. 復元できない素材(adopt が null)はその状態を落とす = 同梱素材へ戻る
{
  let calls = 0
  const adopt = () => {
    calls += 1
    return null
  }
  const map = fromRestored(
    {
      idle: { url: 'blob:dead', name: 'a.png' },
      happy: { url: 'blob:dead', name: 'a.png' },
    },
    adopt
  )
  check('復元できない素材は割当に載らない', Object.keys(map).length === 0)
  check('失敗した url も仕立て直さない', calls === 1, `calls=${calls}`)
  check('設定が空でも落ちない', Object.keys(fromRestored(undefined, adopt)).length === 0)
  check(
    'url の無いエントリは無視する',
    Object.keys(fromRestored({ idle: {}, happy: null }, adopt)).length === 0
  )
}

// 12. 復元マップは信頼できないキーで壊れない(設定ファイルは手で書ける)
{
  const adopt = (saved) => ({ url: saved.url, kind: 'image', name: saved.name, release() {} })
  const restored = JSON.parse('{"__proto__":{"url":"u1","name":"a.png"}}')
  const map = fromRestored(restored, adopt)
  check(
    '__proto__ キーでプロトタイプが汚れない',
    Object.getPrototypeOf(map) === null && Object.getPrototypeOf({}) === Object.prototype
  )
}

// 13. マスコットが知らない状態は復元から落とす。
//     落とした分は entriesToRelease に渡せば解放対象として求まる。
{
  const known = makeEntry('known')
  const unknown = makeEntry('unknown')
  const all = { idle: known, sleepy: unknown }
  const picked = pickStates(all, STATES)
  check('未知の状態は落ちる', Object.keys(picked).join(',') === 'idle')
  const dropped = entriesToRelease(all, picked)
  check('落とした分は解放対象になる', dropped.length === 1 && dropped[0] === unknown)
  check('残した分は解放されない', !dropped.includes(known))
  check('状態一覧が空なら全部落ちる', Object.keys(pickStates(all, [])).length === 0)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length === 0 ? 0 : 1)
