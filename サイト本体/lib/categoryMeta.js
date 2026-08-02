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
  "投資": {
    icon: "📈",
    color: "#0b7285",
    soft: "#e3fafc",
    description:
      "NISA・投資信託・株式・不動産など、資産形成の考え方と選び方をまとめています。",
  },
  "FX": {
    icon: "💱",
    color: "#c2255c",
    soft: "#ffe3ec",
    description:
      "FXの仕組みや取引・分析の基礎から、リスク管理の考え方までを紹介します。",
  },
  "税金": {
    icon: "🧮",
    color: "#5c940d",
    soft: "#f4fce3",
    description:
      "所得税・住民税・確定申告・節税など、税金の仕組みと対策をまとめています。",
  },
};

// ホームページに常時表示する大カテゴリ。記事がまだ0件の段階でも
// 「カテゴリで探す」セクションに表示し、記事が増え次第自然に中身が充実する形にする。
// 中カテゴリ・小カテゴリ(CLAUDE.md外部で管理する分類表)は個別カテゴリとして
// 公開せず、記事のtagsとして扱う(記事が揃うまでは独立カテゴリを増やさない)。
export const ALWAYS_VISIBLE_CATEGORIES = ["投資", "FX", "税金"];

const DEFAULT_META = {
  icon: "📁",
  color: "#495057",
  soft: "#f1f3f5",
  description: "このカテゴリに関する記事をまとめています。",
};

export function getCategoryMeta(name) {
  return CATEGORY_META[name] || DEFAULT_META;
}
