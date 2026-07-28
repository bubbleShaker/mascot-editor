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
  statesOf,
  toDisplayMap,
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

// 8. 状態一覧は JSON(states)由来。増やせば UI の行も増える
{
  const mascot = { states: { idle: 'a.svg', happy: 'b.svg', sleepy: 'c.webm' } }
  check(
    '状態一覧は states のキー',
    statesOf(mascot).join(',') === 'idle,happy,sleepy'
  )
  check('states が無くても落ちない', statesOf(undefined).length === 0)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length === 0 ? 0 : 1)
