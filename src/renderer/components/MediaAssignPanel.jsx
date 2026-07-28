// 状態ごとの素材割当 UI。表示とコールバックだけを持ち、
// 割当の保持・解放は App の責務(Mascot/MascotMedia と同じ分担)。
//
// onPreview(state|null) は「今この行を指している」を伝えるだけで、
// 実際の mascotState は変えない。表情連動の本来の挙動を壊さずに
// 「idle にだけ設定したが今 idle じゃないので確認できない」を解消する。
export default function MediaAssignPanel({
  states,
  assignments,
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
        const name = assignments?.[state]?.name
        return (
          <div
            key={state}
            className="assign__row"
            // ホバーだけでなくフォーカスでもプレビューする(キーボード操作でも届く)。
            onMouseEnter={() => onPreview(state)}
            onMouseLeave={() => onPreview(null)}
            onFocus={() => onPreview(state)}
            onBlur={() => onPreview(null)}
          >
            <span className="assign__state">{state}</span>
            <span
              className={`assign__name${name ? '' : ' assign__name--default'}`}
              title={name ?? '同梱の素材を使用中'}
            >
              {name ?? '(同梱)'}
            </span>
            <button
              className="btn btn--sm"
              onClick={() => onPick(state)}
              title={`${state} の素材を選ぶ`}
            >
              選ぶ
            </button>
            <button
              className="btn btn--sm"
              onClick={() => onClear(state)}
              disabled={!name}
              title="同梱の素材に戻す"
            >
              ×
            </button>
          </div>
        )
      })}

      <button
        className="btn btn--wide"
        onClick={onApplyAll}
        title="選んだ 1 つを全状態に設定"
      >
        全部に適用…
      </button>
    </div>
  )
}
