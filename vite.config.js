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
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
