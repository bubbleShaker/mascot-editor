// 上部バー。M0 はテーマ切替のみ。M1 で open/save ボタンを足す。
export default function Toolbar({ themes, themeId, onThemeChange, mascotLabel }) {
  return (
    <header className="toolbar">
      <div className="toolbar__brand">🫛 zunda-editor</div>
      <div className="toolbar__spacer" />
      {mascotLabel && (
        <span className="toolbar__mascot">キャラ: {mascotLabel}</span>
      )}
      <label className="toolbar__theme">
        テーマ
        <select
          value={themeId}
          onChange={(e) => onThemeChange(e.target.value)}
        >
          {themes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
    </header>
  )
}
