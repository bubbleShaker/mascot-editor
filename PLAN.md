# PLAN: mascot-editor

色とキャラを自由にカスタムできる、拡張しやすい GUI テキストエディタ。
スタック: Electron + React + Vite。詳細は `research/01-editor-stack.md`。

## 設計原則
カスタム対象(色・キャラ)は全てデータ(JSON)＋素材(画像)に外出しし、
エディタ本体のコードから切り離す。依存は「本体 → 設定interface」の一方向。
本体は特定キャラに依存しない。`zundamon` / `zunda-*` は同梱サンプルの1例に過ぎず、
消しても動く状態を保つ(キャラを増やす拡張の見本を兼ねる)。

## ディレクトリ
```
src/main/main.js        Electron main。window生成・IPC(ファイル操作)
src/main/preload.js     contextBridge で安全な window.mascotEditor を公開
src/renderer/           React アプリ
  App.jsx               全体レイアウト
  components/
    Editor.jsx          編集本体(M0はtextarea)
    Mascot.jsx          キャラ表示
    Toolbar.jsx         open/save/テーマ切替
  config/loader.js      themes/mascots の読込
config/themes/*.json    色テーマ(CSS変数に注入)
config/mascots/*.json   キャラ定義(状態→画像パス)
assets/                 キャラ画像素材
```

## マイルストーン
- [x] M0: Walking skeleton。Electron+React が起動し、textarea 編集・
      テーマJSON適用・マスコット表示ができる(=拡張アーキ実証)。
- [x] M1: ファイル open/save。編集中/保存/エラーでマスコット表情が変わる。
      環境で実装を切替える fileService 抽象(Electron=IPC+fs / ブラウザ=input+Blob)で、
      Pages プレビューでも open/save が動くようにする。
- [ ] M2: テーマ切替UI と複数テーマ。ユーザーが JSON 追加で増やせる導線。
- [ ] M3: CodeMirror 導入でシンタックスハイライト。行番号・複数言語。
- [ ] M4: ★キャラのメディア自由選択。ユーザーが手元の画像/動画(png/gif/webp/mp4/webm)を
      ピッカーで選び、マスコットに設定できる。Mascot は拡張子で <img>/<video> を出し分け、
      状態(idle/happy/error)ごとに別メディアも割当可能。選択内容は永続化。
- [ ] M5: 設定永続化(最後のテーマ/キャラ/メディア/開いてたファイル)。

## 長期ゴール(ユーザー要望)
「動画・画像を好きに選べる」= M4 が本命。マスコットは静止画だけでなく mp4/webm 等の
動画も設定できるようにする。設計上は「メディアはデータ(パス)＋素材」で本体から切り離す方針を踏襲。

## 開発サイクル
Issue 起票 → 実装 → reviewer サブエージェントでレビュー → PR → マージ。
🔴 must 指摘は解消してから次へ。/compact はマイルストーン区切りで。
