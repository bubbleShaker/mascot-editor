// 拡張性の核: config/ 配下の JSON と assets/ の画像を「データとして」読み込み、
// エディタ本体へ渡す。本体はここが返す形(interface)だけに依存する。
//
// import.meta.glob は Vite の機能で、パターンに一致するファイルをまとめて取り込む。
// eager:true で即時読込。dev では config/ に JSON を足すとホットリロードで増える。

import { mediaKindFromPath } from './media.js'

const themeModules = import.meta.glob('../../../config/themes/*.json', {
  eager: true,
})
const mascotModules = import.meta.glob('../../../config/mascots/*.json', {
  eager: true,
})
// 素材は URL 文字列として取り込む(?url)。<img src> / <video src> にそのまま使える。
// 動画(mp4/webm)も対象にしてあるので、JSON で動画パスを指定すれば動く。
// 拡張子リストは media.js の VIDEO/IMAGE_EXTENSIONS と対で維持すること。
// なお eager glob なので、JSON から参照されていない assets/ 配下の素材も
// dist に出力される。大きな動画を置くとビルド成果物がそのぶん膨らむ。
const assetUrls = import.meta.glob(
  '../../../assets/**/*.{svg,png,gif,webp,jpg,jpeg,avif,mp4,webm,ogv,mov,m4v}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  }
)

// glob のキー(相対パス)末尾が、JSON 内の "assets/..." 指定に一致するものを探す。
// 返す形は { url, kind } に統一する。kind は「元のパス」から判定する点が重要で、
// Vite が付けるハッシュ付き URL(例 /assets/idle-a1b2c3.svg)ではなく
// JSON に書かれた拡張子を見る。
function resolveMedia(relPath) {
  const hit = Object.keys(assetUrls).find((k) => k.endsWith('/' + relPath))
  if (!hit) return null
  return { url: assetUrls[hit], kind: mediaKindFromPath(relPath) }
}

export function loadThemes() {
  return Object.values(themeModules)
    .map((m) => m.default ?? m)
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function loadMascots() {
  return Object.values(mascotModules)
    .map((m) => m.default ?? m)
    .map((mascot) => {
      // 状態→素材パスを、実際に表示できる { url, kind } へ解決しておく。
      const resolved = {}
      for (const [state, p] of Object.entries(mascot.states ?? {})) {
        resolved[state] = resolveMedia(p)
      }
      return { ...mascot, resolvedStates: resolved }
    })
}
