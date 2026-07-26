# zunda-editor

色とキャラを自由にカスタムできる、拡張しやすい GUI テキストエディタ。
Electron + React + Vite 製。

## 設計の肝
カスタム対象(色・キャラ)は全て **データ(JSON)＋素材(画像)** に外出しし、
エディタ本体のコードから切り離している。

- 色 … `config/themes/*.json` → CSS 変数(`--color-*`)へ注入。
- キャラ … `config/mascots/*.json` → 状態(idle/happy/error)→画像パス。
- 画像 … `assets/` に置いて JSON から参照(差し替えるだけで別キャラに)。

新しいテーマ/キャラは、対応する JSON(と画像)を足すだけで増える。

## 開発
```bash
npm install      # WSL 内で実行(native binary を Linux 版にするため)
npm run dev      # Vite dev + Electron を同時起動
```

## ビルド/起動
```bash
npm run build    # renderer を dist/ へ
npm start        # dist を読んで Electron 起動
```

詳細な段取りは `PLAN.md`、技術調査は `research/01-editor-stack.md` を参照。
