import MascotMedia from './MascotMedia.jsx'

// キャラ表示。mascot(データ)と state(idle/happy/error)を受け取り、
// 対応するメディアとセリフを出すだけ。誰のキャラかは一切知らない。
export default function Mascot({ mascot, state }) {
  if (!mascot) return null

  const activeState = mascot.resolvedStates?.[state]
    ? state
    : mascot.default
  const media = mascot.resolvedStates?.[activeState]
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
