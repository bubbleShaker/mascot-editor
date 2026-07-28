// 上部バー。open/save ボタン・ファイル名・未保存印・テーマ切替を出す。
export default function Toolbar({
  themes,
  themeId,
  onThemeChange,
  mascotLabel,
  fileName,
  dirty,
  onOpen,
  onSave,
  mediaName,
  onPickMedia,
  onResetMedia,
}) {
  return (
    <header className="toolbar">
      <div className="toolbar__brand">🎨 mascot-editor</div>

      <div className="toolbar__actions">
        <button className="btn" onClick={onOpen} title="開く (Ctrl+O)">
          開く
        </button>
        <button className="btn" onClick={onSave} title="保存 (Ctrl+S)">
          保存
        </button>
      </div>

      <div className="toolbar__file">
        {dirty && <span className="toolbar__dot" title="未保存">●</span>}
        {fileName}
      </div>

      <div className="toolbar__spacer" />

      <div className="toolbar__actions">
        <button
          className="btn"
          onClick={onPickMedia}
          title="画像/動画を選んでマスコットに設定"
        >
          キャラ素材…
        </button>
        {mediaName && (
          <button className="btn" onClick={onResetMedia} title="同梱の素材に戻す">
            戻す
          </button>
        )}
      </div>

      {mascotLabel && (
        <span className="toolbar__mascot" title={mediaName ?? undefined}>
          キャラ: {mediaName ?? mascotLabel}
        </span>
      )}
      <label className="toolbar__theme">
        テーマ
        <select value={themeId} onChange={(e) => onThemeChange(e.target.value)}>
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
