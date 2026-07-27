import { useEffect, useState } from 'react'

// メディア1枚の描画だけを担う。{ url, kind } を受け取り、
// kind に応じて <img> か <video> を出す。「どのメディアを出すか」は
// 呼び出し側(Mascot)の責務で、ここは「どう出すか」だけを知る。
export default function MascotMedia({ media, label }) {
  // 解決はできたが再生/表示に失敗した(コーデック非対応・破損など)ケースを拾う。
  // M4-2 でユーザーが任意ファイルを選べるようになると現実的に起きるので、
  // 黒い矩形や壊れ画像アイコンではなくフォールバックへ落とす。
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [media?.url])

  // 素材が見つからない/表示できない時のフォールバック(拡張時の欠損に強くする)。
  if (!media?.url || failed) return <div className="mascot__fallback">(・ω・)</div>

  if (media.kind === 'video') {
    return (
      // key に url を渡すのは、状態が切り替わった時に <video> を作り直して
      // 再生を頭出しさせるため。src だけ差し替えると React は同じ要素を
      // 使い回し、前の再生位置のまま止まることがある。
      //
      // muted + playsInline はブラウザの自動再生ポリシー対策。
      // 音の出る動画は autoPlay がブロックされるので、マスコットは常に無音扱い。
      <video
        key={media.url}
        className="mascot__img"
        src={media.url}
        autoPlay
        loop
        muted
        playsInline
        aria-label={label ?? ''}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <img
      className="mascot__img"
      src={media.url}
      alt={label ?? ''}
      onError={() => setFailed(true)}
    />
  )
}
