import MascotMedia from './MascotMedia.jsx'

// キャラ表示。mascot(データ)と state(idle/happy/error)を受け取り、
// 対応するメディアとセリフを出すだけ。誰のキャラかは一切知らない。
//
// assignments はユーザーがピッカーで選んだ状態ごとの素材 { state: {url,kind} }。
// 未割当の状態は同梱サンプル(mascot.resolvedStates)へフォールバックする。
export default function Mascot({ mascot, state, assignments }) {
  if (!mascot) return null

  // 割当か同梱のどちらかで絵が出せる状態だけを採用し、出せなければ default へ。
  // 割当だけがある状態(同梱素材を持たない状態)も表示対象にしたいので、
  // 判定は「割当 or 同梱」の or になる。
  const hasMedia = assignments?.[state] || mascot.resolvedStates?.[state]
  const activeState = hasMedia ? state : mascot.default

  const media = assignments?.[activeState] ?? mascot.resolvedStates?.[activeState]
  const line = mascot.lines?.[activeState]

  return (
    <aside className="mascot">
      <div className="mascot__stage">
        <MascotMedia media={media} label={mascot.label} />
      </div>
      {line && (
        <div className="mascot__bubble">
          <span className="mascot__name">{mascot.label}</span>
          {line}
        </div>
      )}
    </aside>
  )
}
