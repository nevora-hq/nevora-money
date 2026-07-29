// トップページの「カテゴリで探す」まとめセクション用の表示情報。
// 対象ジャンルはプロジェクト直下のCLAUDE.mdを唯一の情報源とし、
// カテゴリが増えた場合はここに追記する(未登録カテゴリはdefaultにフォールバック)。
const CATEGORY_META = {
  "お金・家計": {
    icon: "💰",
    color: "#2f9e44",
    soft: "#e6f7ea",
    description:
      "固定費の見直しや家計管理のコツなど、無理なく続けられるお金の知恵をまとめています。",
  },
  "節約": {
    icon: "🧾",
    color: "#1c7ed6",
    soft: "#e7f5ff",
    description:
      "日々の生活で実践できる節約術や支出管理の工夫を紹介します。",
  },
  "ポイ活": {
    icon: "🎁",
    color: "#e8590c",
    soft: "#ffe8d9",
    description:
      "効率よくポイントを貯める方法やお得なサービスの活用法をまとめています。",
  },
  "保険": {
    icon: "🛡️",
    color: "#7048e8",
    soft: "#ede6fd",
    description:
      "保険の見直しポイントや選び方など、ライフステージに合わせた情報を紹介します。",
  },
};

const DEFAULT_META = {
  icon: "📁",
  color: "#495057",
  soft: "#f1f3f5",
  description: "このカテゴリに関する記事をまとめています。",
};

export function getCategoryMeta(name) {
  return CATEGORY_META[name] || DEFAULT_META;
}
