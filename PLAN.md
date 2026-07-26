# PLAN: zunda-editor

色とキャラを自由にカスタムできる、拡張しやすい GUI テキストエディタ。
スタック: Electron + React + Vite。詳細は `research/01-editor-stack.md`。

## 設計原則
カスタム対象(色・キャラ)は全てデータ(JSON)＋素材(画像)に外出しし、
エディタ本体のコードから切り離す。依存は「本体 → 設定interface」の一方向。

## ディレクトリ
```
src/main/main.js        Electron main。window生成・IPC(ファイル操作)
src/main/preload.js     contextBridge で安全な window.api を公開
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
- [ ] M1: ファイル open/save(IPC)。編集中/保存でマスコット表情が変わる。
- [ ] M2: テーマ切替UI と複数テーマ。ユーザーが JSON 追加で増やせる導線。
- [ ] M3: CodeMirror 導入でシンタックスハイライト。行番号・複数言語。
- [ ] M4: キャラ差替UI。ユーザー配置の mascots/*.json を読む。
- [ ] M5: 設定永続化(最後のテーマ/キャラ/開いてたファイル)。

## 開発サイクル
Issue 起票 → 実装 → reviewer サブエージェントでレビュー → PR → マージ。
🔴 must 指摘は解消してから次へ。/compact はマイルストーン区切りで。
