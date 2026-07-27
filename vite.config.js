import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' にするのは、本番で file:// から dist/ を読む際に
// 相対パスで参照させるため(Electron でよく使う定番設定)。
export default defineConfig({
  plugins: [react()],
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Vite は既定で 4KB 未満の素材を data: URL へインライン化する。
    // 動画は必ず実ファイルとして出力させる: index.html の CSP は media-src を
    // 持たず default-src 'self' にフォールバックするため、data: の動画は
    // ブロックされて「無言で再生されない」バグになる。
    // (画像は img-src に data: があるのでインライン化して良い)
    assetsInlineLimit: (filePath) =>
      /\.(mp4|webm|ogv|mov|m4v)$/i.test(filePath) ? false : undefined,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
