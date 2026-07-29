// 状態(idle/happy/error…)→ 素材エントリ の割当マップを扱う純粋関数群。
//
// ここに切り出しているのは、「どのエントリを解放してよいか」の判断が
// このアプリで一番間違えやすい所だから。React の state 更新や release() の
// 呼び出し(副作用)は App が持ち、判断だけをここで純粋に行う。
// 純粋なので scripts/check-media-assignments.mjs から直接叩いて検証できる。
// 拡張子が .mjs なのはそのため: package.json に "type": "module" が無い
// (main プロセスが CJS)ので、.js だと Node が ESM として読み込めない。
// Vite 側は .mjs をそのまま扱えるので、renderer からの import はこれで足りる。
//
// エントリは mediaService.pick() の返り値 { url, kind, name, release }。
// 同じエントリを複数の状態が参照しうる(「全部に適用」直後など)ため、
// 割当を差し替える時は「どこからも参照されなくなったエントリ」だけを解放する。

/** マスコット定義から、割り当て可能な状態名の一覧を得る。 */
export function statesOf(mascot) {
  return Object.keys(mascot?.states ?? {})
}

/**
 * 旧割当から新割当へ移る時に release() すべきエントリを返す。
 *
 * 判定は「値の集合の差」。旧に居て新に居ないエントリだけが対象で、
 * 別の状態がまだ参照しているエントリは残る(誤って生きた URL を殺さない)。
 * 同一エントリが複数状態に入っていても、返るのは 1 回だけ。
 */
export function entriesToRelease(prev, next) {
  const kept = new Set(Object.values(next ?? {}).filter(Boolean))
  const dropped = new Set()
  for (const entry of Object.values(prev ?? {})) {
    if (entry && !kept.has(entry)) dropped.add(entry)
  }
  return [...dropped]
}

/** 全状態へ同じエントリを割り当てたマップを作る(「全部に適用」用)。 */
export function assignAll(states, entry) {
  return Object.fromEntries(states.map((s) => [s, entry]))
}

/**
 * 表示層へ渡す用に、割当マップを { url, kind } だけへ絞る。
 * release はリソース管理の関心事で、表示コンポーネントに触らせない。
 */
export function toDisplayMap(assignments) {
  const out = {}
  for (const [state, entry] of Object.entries(assignments ?? {})) {
    if (entry) out[state] = { url: entry.url, kind: entry.kind }
  }
  return out
}

/**
 * 永続化層へ渡す用に、割当マップを 状態 → url だけへ絞る。
 * url が何を指すか(トークン URL か blob URL か)は呼び出し側の関心事ではない。
 */
export function toUrlMap(assignments) {
  const out = {}
  for (const [state, entry] of Object.entries(assignments ?? {})) {
    if (entry?.url) out[state] = entry.url
  }
  return out
}

/**
 * 永続化層から復元された { state: { url, name } } を、割当マップへ組み直す。
 *
 * 要点は「同じ url は 1 エントリに寄せる」こと(dedupe)。復元後も複数状態が
 * 同一エントリを共有していないと、entriesToRelease の集合差分が同じ素材を
 * 別物と見なし、まだ他の状態が使っている URL を解放してしまう。
 *
 * adopt(saved) は復元された素材をエントリへ仕立てる関数(mediaService が渡す)。
 * 復元できない環境/素材では null を返すので、その状態は割当なし = 同梱素材になる。
 */
export function fromRestored(restored, adopt) {
  const byUrl = new Map()
  // 設定ファイルは手で書けるので、キーも信頼できない入力として扱う。
  // プロトタイプ無しの辞書なら `__proto__` というキーが来ても
  // プロトタイプ差し替えにならず、ただのキーとして扱われる。
  const out = Object.create(null)
  for (const [state, saved] of Object.entries(restored ?? {})) {
    const url = saved?.url
    if (!url) continue
    // 仕立ては url ごとに一度だけ(失敗した null も覚えて呼び直さない)。
    if (!byUrl.has(url)) byUrl.set(url, adopt(saved) ?? null)
    const entry = byUrl.get(url)
    if (entry) out[state] = entry
  }
  return out
}

/**
 * 割当マップを、指定した状態だけに絞る。
 *
 * 復元の入口で使う。設定ファイルは手で書けるので、マスコットが持たない状態
 * (`sleepy` など)がいくらでも混ざりうる。そのままだと UI から見えないのに
 * 素材を掴み続け、保存のたびに書き戻されて増え続ける。
 * 落とした分は呼び出し側が解放する(entriesToRelease に渡せば求まる)。
 */
export function pickStates(assignments, states) {
  const allowed = new Set(states ?? [])
  const out = {}
  for (const [state, entry] of Object.entries(assignments ?? {})) {
    if (entry && allowed.has(state)) out[state] = entry
  }
  return out
}

/**
 * 割当パネル用に、状態 → 表示名 だけへ絞る。
 * パネルが要るのは名前だけなので、url も release も渡さない(最小の情報)。
 */
export function toNameMap(assignments) {
  const out = {}
  for (const [state, entry] of Object.entries(assignments ?? {})) {
    if (entry) out[state] = entry.name
  }
  return out
}
