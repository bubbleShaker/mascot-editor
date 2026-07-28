import MascotMedia from './MascotMedia.jsx'

// キャラ表示。mascot(データ)と state(idle/happy/error)を受け取り、
// 対応するメディアとセリフを出すだけ。誰のキャラかは一切知らない。
//
// mediaOverride はユーザーがピッカーで選んだ素材。M4-2 では全状態に一括で
// かぶせる(状態ごとの割当は M4-3)。セリフは state のまま変えないので、
// 見た目が差し替わっても表情連動の手応えは残る。
export default function Mascot({ mascot, state, mediaOverride }) {
  if (!mascot) return null

  const activeState = mascot.resolvedStates?.[state]
    ? state
    : mascot.default
  const media = mediaOverride ?? mascot.resolvedStates?.[activeState]
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
