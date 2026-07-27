# mascot-editor

色とキャラを自由にカスタムできる、拡張しやすい GUI テキストエディタ。
Electron + React + Vite 製。

## 設計の肝
カスタム対象(色・キャラ)は全て **データ(JSON)＋素材(画像)** に外出しし、
エディタ本体のコードから切り離している。

- 色 … `config/themes/*.json` → CSS 変数(`--color-*`)へ注入。
- キャラ … `config/mascots/*.json` → 状態(idle/happy/error)→メディアパス。
- 素材 … `assets/` に置いて JSON から参照(差し替えるだけで別キャラに)。

新しいテーマ/キャラは、対応する JSON(と素材)を足すだけで増える。

### キャラのメディア(画像/動画)
状態ごとの素材は **画像でも動画でもよい**。拡張子で自動的に出し分ける。

| 種別 | 対応拡張子 | 描画 |
|---|---|---|
| 画像 | svg / png / gif / webp / jpg / jpeg / avif | `<img>` |
| 動画 | mp4 / webm / ogv / mov / m4v | `<video autoplay loop muted playsinline>` |

動画は常に無音ループ再生になる(ブラウザの自動再生ポリシー対策)。
再生できるコンテナ/コーデックは Chromium の対応範囲に依存する
(webm / mp4(H.264) が確実。`mov` は再生できないことが多い)。
表示に失敗した素材はフォールバック表示 `(・ω・)` に落ちる。

試すには、`config/mascots/zundamon.json` の状態を同梱のデモ動画に向ければよい:

```json
"states": { "idle": "assets/demo/pulse.webm", ... }
```

## 同梱サンプル
特定のキャラ専用ツールではない。以下は「拡張のお手本」として同梱している1例で、
消しても本体は動く。

- キャラ … `config/mascots/zundamon.json` + `assets/zunda/*.svg`
- テーマ … `config/themes/zunda-dark.json` / `zunda-light.json`
- 動画 … `assets/demo/pulse.webm`(動画対応の確認用。ffmpeg 生成の無地アニメ)

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
