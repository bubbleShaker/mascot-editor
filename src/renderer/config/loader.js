// 拡張性の核: config/ 配下の JSON と assets/ の画像を「データとして」読み込み、
// エディタ本体へ渡す。本体はここが返す形(interface)だけに依存する。
//
// import.meta.glob は Vite の機能で、パターンに一致するファイルをまとめて取り込む。
// eager:true で即時読込。dev では config/ に JSON を足すとホットリロードで増える。

const themeModules = import.meta.glob('../../../config/themes/*.json', {
  eager: true,
})
const mascotModules = import.meta.glob('../../../config/mascots/*.json', {
  eager: true,
})
// 画像は URL 文字列として取り込む(?url)。<img src> にそのまま使える。
const assetUrls = import.meta.glob('../../../assets/**/*.{svg,png,gif,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})

// glob のキー(相対パス)末尾が、JSON 内の "assets/..." 指定に一致するものを探す。
function resolveAsset(relPath) {
  const hit = Object.keys(assetUrls).find((k) => k.endsWith('/' + relPath))
  return hit ? assetUrls[hit] : null
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
      // 状態→画像パスを、実際に表示できる URL へ解決しておく。
      const resolved = {}
      for (const [state, p] of Object.entries(mascot.states ?? {})) {
        resolved[state] = resolveAsset(p)
      }
      return { ...mascot, resolvedStates: resolved }
    })
}
