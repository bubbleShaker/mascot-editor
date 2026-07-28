// 状態ごとの素材割当 UI。表示とコールバックだけを持ち、
// 割当の保持・解放は App の責務(Mascot/MascotMedia と同じ分担)。
// 受け取るのは names(状態→表示名)だけで、url も release も見えない。
//
// onPreview(state|null) は「今この行を指している」を伝えるだけで、
// 実際の mascotState は変えない。表情連動の本来の挙動を壊さずに
// 「idle にだけ設定したが今 idle じゃないので確認できない」を解消する。
export default function MediaAssignPanel({
  states,
  names,
  onPick,
  onClear,
  onApplyAll,
  onPreview,
}) {
  if (!states?.length) return null

  return (
    <div className="assign">
      <div className="assign__title">素材の割当</div>

      {states.map((state) => {
        const name = names?.[state]
        return (
          <div
            key={state}
            className="assign__row"
            // ホバーだけでなくフォーカスでもプレビューする(キーボード操作でも届く)。
            onMouseEnter={() => onPreview?.(state)}
            onMouseLeave={() => onPreview?.(null)}
            onFocus={() => onPreview?.(state)}
            onBlur={() => onPreview?.(null)}
          >
            <span className="assign__state">{state}</span>
            <span
              className={`assign__name${name ? '' : ' assign__name--default'}`}
              title={name ?? '同梱の素材を使用中'}
            >
              {name ?? '(同梱)'}
            </span>
            {/* 押した時点でプレビューを畳む。ネイティブダイアログが開くと
                mouseleave が飛ばないことがあり、× は押下で disabled になるため
                blur も来ない。どちらもプレビューが張り付いたままになり、
                以後 typing/save の表情連動が画面に出なくなる。 */}
            <button
              className="btn btn--sm"
              onClick={() => {
                onPreview?.(null)
                onPick(state)
              }}
              title={`${state} の素材を選ぶ`}
            >
              選ぶ
            </button>
            <button
              className="btn btn--sm"
              onClick={() => {
                onPreview?.(null)
                onClear(state)
              }}
              disabled={!name}
              title="同梱の素材に戻す"
              aria-label={`${state} の割当を解除`}
            >
              ×
            </button>
          </div>
        )
      })}

      <button
        className="btn btn--wide"
        onClick={() => {
          onPreview?.(null)
          onApplyAll()
        }}
        title="選んだ 1 つを全状態に設定(既存の割当は置き換わる)"
      >
        全部に適用…
      </button>
    </div>
  )
}
