// 設定(いまは素材割当のみ)の永続化。読み書きは main だけが行う。
//
// なぜ renderer 側(localStorage)ではなく main なのか:
// 復元できる素材の同一性は「実ファイルパス」しかない。しかし M4-2 の防御線で
// 実パスは main に閉じており、renderer が持つのは使い捨てトークン URL だけ。
// renderer にパスを渡して保存させると、その防御線を自分で壊すことになる。
// そこで renderer からはトークン URL を受け取り、パスへの変換と保存を main で行う。
//
// 保存できるのは resolveUrl が解決できた URL = 一度 dialog を通ったパスだけ。
// 乗っ取られた renderer が任意パスを設定へ書き込む経路が構造的に存在しない。
//
// 逆向き(読み出し)の危険もある: settings.json は userData 配下のただのファイルで、
// アプリ外から書き換えうる。無検証で復元すると「任意ローカルファイルへトークンを
// 発行する口」に化けるので、復元時にも拡張子と実体の存在を検証する。
//
// トークンの発行/解放/解決は注入する(mediaProtocol への直接依存を持たない)。
// このモジュールの責務は「設定ファイルの読み書き」だけで、素材の参照方式は
// 呼び出し側の決めごとにしておく。保存先(dir)も注入なので、
// scripts/check-settings-store.js が一時ディレクトリで本物のコードを検証できる。

const path = require('node:path')
const fs = require('node:fs/promises')
const { isSupportedMedia } = require('./mediaFormats.js')

// 将来スキーマを変える時の目印。読む側は未知の version を捨てる(壊れた復元より無設定)。
const SETTINGS_VERSION = 1
const FILE_NAME = 'settings.json'
// 復元する割当の上限。設定ファイルは手で書けるので、際限なくトークンを
// 発行させないための歯止め(実際の状態数は mascot JSON 由来でせいぜい数個)。
const MAX_ASSIGNMENTS = 32

/**
 * 信頼できない出所のオブジェクトを、プロトタイプ無しの素の辞書へ写す。
 * `{"__proto__": "..."}` のようなキーが混ざっていても、プロトタイプ差し替えではなく
 * ただのキーとして扱われる(JSON は誰でも書けるので、キーも入力として扱う)。
 */
function toPlainStringMap(source, limit = Infinity) {
  const out = Object.create(null)
  if (!source || typeof source !== 'object') return out
  let count = 0
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== 'string') continue
    if (count >= limit) break
    out[key] = value
    count += 1
  }
  return out
}

function createSettingsStore({ dir, issueToken, releaseToken, resolveUrl }) {
  const filePath = path.join(dir, FILE_NAME)
  // 読み書きを直列化する。素早い操作で save が重なると、読み出し(既存設定)と
  // 書き込みの間に別の save が割り込み、片方の更新が消える。順番に流せばその窓が消える。
  // ※ 効くのはこのプロセス内だけ。同じ userData を二重起動した場合は守れない
  //    (単一インスタンス化は別の課題)。
  let queue = Promise.resolve()
  // 前回の復元で発行したトークン。load をもう一度呼ばれた時に捨てる。
  // 捨てないと、繰り返し呼ぶだけで main のトークン表を無限に太らせられる。
  let issuedOnLoad = []

  /** 生の設定ファイルを読む。無い/壊れている/version 違いは「設定なし」扱い。 */
  async function readRaw() {
    let text
    try {
      text = await fs.readFile(filePath, 'utf8')
    } catch {
      return null // 初回起動など。存在しないのは異常ではない
    }
    try {
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object') return null
      // 手で壊された設定でアプリが起動しなくなる方が困る。黙って既定値へ倒す。
      if (parsed.version !== SETTINGS_VERSION) {
        console.info(`[settings] 未知の version(${parsed.version})なので読み飛ばす`)
        return null
      }
      return parsed
    } catch (err) {
      console.error('[settings] 読み込みに失敗(既定値で起動):', err)
      return null
    }
  }

  /**
   * 保存されたパスを、renderer へ渡せる { url, name } へ変換する。
   * 検証に落ちたら null を返し、その状態は同梱素材へフォールバックさせる。
   */
  async function adoptPath(storedPath) {
    if (!path.isAbsolute(storedPath) || !isSupportedMedia(storedPath)) return null
    try {
      // シンボリックリンク越しに対応形式のふりをされないよう、実体側でも検証する
      // (a.webm → /etc/shadow のような設定を書かれても配信対象にしない)。
      const realPath = await fs.realpath(storedPath)
      if (!isSupportedMedia(realPath)) return null
      const stat = await fs.stat(realPath)
      if (!stat.isFile()) return null
    } catch {
      return null // 選択後に移動/削除された素材。復元できないだけで異常ではない
    }
    return { url: issueToken(storedPath), name: path.basename(storedPath) }
  }

  return {
    /**
     * 設定を読み、素材へは新しいトークンを再発行して返す。
     * 返り値: { assignments: { state: { url, name } } }
     */
    load() {
      const task = async () => {
        // 前回の復元分を無効化してから発行し直す(同じ素材のトークンが増え続けない)。
        for (const url of issuedOnLoad) releaseToken(url)
        issuedOnLoad = []

        const raw = await readRaw()
        const stored = toPlainStringMap(raw?.assignments, MAX_ASSIGNMENTS)
        // 同じパスには 1 つのトークンだけを発行する。復元後も「複数状態が同じ
        // エントリを共有する」形を保たないと、renderer の解放判定(集合差分)が
        // 同一素材を別物と見なし、生きている URL を殺しにいく。
        const issued = new Map()
        const assignments = Object.create(null)
        for (const [state, storedPath] of Object.entries(stored)) {
          if (!issued.has(storedPath)) issued.set(storedPath, await adoptPath(storedPath))
          const entry = issued.get(storedPath)
          if (entry) assignments[state] = entry
        }
        issuedOnLoad = [...issued.values()].filter(Boolean).map((entry) => entry.url)
        return { assignments }
      }
      // 読みも同じキューに載せる。load が重なると(StrictMode の二重マウント等)
      // issuedOnLoad の更新が交錯し、追跡から漏れたトークンが居座る。
      queue = queue.then(task, task)
      return queue
    },

    /**
     * renderer から来た { assignments: { state: トークンURL } } を保存する。
     *
     * 解決できない URL には 2 つの意味があり、区別できない:
     *   - 偽装 URL(乗っ取られた renderer からの任意パス注入)
     *   - リロード等でトークンが一括破棄された後に届いた、遅れてきた保存
     * どちらにせよ「その状態の設定を消す」のは行き過ぎなので、既に保存されている
     * パスがあればそれを残す。攻撃者が送った文字列は解決できない以上入り込めない。
     * 一方、キー自体が来ていない状態は「割当を解除した」なので消える。
     */
    save(settings) {
      const incoming = toPlainStringMap(settings?.assignments)
      // 解決は enqueue の前に行う。キュー待ちの間にトークンが失効しても、
      // 解決済みのパスがそのまま使える。
      const resolved = new Map()
      for (const [state, url] of Object.entries(incoming)) {
        resolved.set(state, resolveUrl(url))
      }

      const task = async () => {
        const previous = await readRaw()
        const previousAssignments = toPlainStringMap(previous?.assignments, MAX_ASSIGNMENTS)
        const assignments = Object.create(null)
        for (const [state, mediaPath] of resolved) {
          const kept = mediaPath ?? previousAssignments[state] ?? null
          if (kept) assignments[state] = kept
        }
        // 割当以外のキー(M5 で足すテーマ等)は素通しで残す。save は割当だけを
        // 差し替える部分更新で、設定ファイル全体の置き換えではない。
        const payload = JSON.stringify(
          { ...(previous ?? {}), version: SETTINGS_VERSION, assignments },
          null,
          2
        )

        await fs.mkdir(dir, { recursive: true })
        // 一時ファイルへ書いてから rename する。rename は同一ボリューム内で
        // 原子的なので、書き込み中に落ちても「途中まで書けた settings.json」が
        // 残らない(次回起動が既定値に戻るのを防ぐ)。
        // 一時ファイル名にプロセス ID を混ぜ、失敗したら消す。放置すると
        // 別プロセス/次回の書き込みが中途半端な残骸を掴む。
        const tmp = `${filePath}.${process.pid}.tmp`
        try {
          await fs.writeFile(tmp, payload, 'utf8')
          await fs.rename(tmp, filePath)
        } catch (err) {
          await fs.rm(tmp, { force: true }).catch(() => {})
          throw err
        }
      }
      // 失敗しても次の save を止めない(then の両腕に同じ task を渡す)。
      queue = queue.then(task, task)
      return queue
    },
  }
}

module.exports = { createSettingsStore, SETTINGS_VERSION, FILE_NAME, MAX_ASSIGNMENTS }
