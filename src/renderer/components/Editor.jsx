// M0 の編集本体。まずは textarea で最小構成。
// M3 で CodeMirror に差し替え、シンタックスハイライトを入れる予定。
export default function Editor({ value, onChange }) {
  return (
    <div className="editor">
      <textarea
        className="editor__area"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder="ここに書くのだ…"
      />
    </div>
  )
}
