# 技術調査: 自作エディタのスタック選定

## 要件
- 色を自由に設定できる
- キャラ（立ち絵/画像マスコット）を自由に設定できる
- 拡張しやすい

## 方式比較

| 方式 | 代表スタック | 色 | キャラ | 拡張性 | 学習コスト |
|------|------------|----|-------|--------|-----------|
| CLI(TUI) | Node+Ink, Go+bubbletea, Rust+ratatui | 256/truecolor(端末依存) | AA中心 | 良 | 中 |
| GUI(Electron) | Electron+React | フルカラー | 画像/GIF/Live2D | 良(Web技術) | 低〜中 |
| GUI(Tauri) | Tauri(Rust)+React | フルカラー | 画像/GIF | 良 | 中(Rust) |

## 決定: Electron + React + Vite

理由:
- 「画像立ち絵の常駐マスコット」を最重視 → GUI が圧倒的有利。
- 既存 custom-browser が Electron 製 → main/preload/renderer 流儀を流用できる。
- React で UI 状態(現在テーマ/キャラ状態)を宣言的に扱える。
- Vite は HMR が速く、開発体験が良い。

Tauri を採らない理由: Rust 側の学習コストを今回は避け、custom-browser の知見を優先。
将来 Tauri へ移す場合も、renderer(React) はほぼ流用できる。

## 拡張性の設計原則
「カスタム対象は全てデータ(JSON)＋素材(画像)」に外出しする。

- 色: `config/themes/*.json` → CSS カスタムプロパティ(`--color-*`)へ注入。
- キャラ: `config/mascots/*.json` → 状態(idle/happy/error)→画像パスのマップ。
- エディタ本体は具体的なテーマ/キャラを知らない(依存は一方向)。

## セキュリティ(Electron)
- `contextIsolation: true`, `nodeIntegration: false`。
- Node 権限は preload の `contextBridge` で最小 API のみ公開。
- renderer から直接 fs を触らせない(IPC 経由)。

## 参考: ビルド構成
- 開発: Vite dev server(`http://localhost:5173`) を Electron が読み込む。
- 本番: `vite build` → `dist/` を `file://` で読み込む(`base: './'`)。
- main/preload は素の CommonJS(Electron が直接実行、bundle 不要)。
