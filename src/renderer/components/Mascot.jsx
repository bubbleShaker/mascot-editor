// キャラ表示。mascot(データ)と state(idle/happy/error)を受け取り、
// 対応する画像とセリフを出すだけ。誰のキャラかは一切知らない。
export default function Mascot({ mascot, state }) {
  if (!mascot) return null

  const activeState = mascot.resolvedStates?.[state]
    ? state
    : mascot.default
  const src = mascot.resolvedStates?.[activeState]
  const line = mascot.lines?.[activeState]

  return (
    <aside className="mascot">
      <div className="mascot__stage">
        {src ? (
          <img className="mascot__img" src={src} alt={mascot.label} />
        ) : (
          // 画像が見つからない時のフォールバック(拡張時の欠損に強くする)。
          <div className="mascot__fallback">(・ω・)</div>
        )}
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
