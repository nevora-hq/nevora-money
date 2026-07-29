// トップページの「カテゴリで探す」まとめセクション用の表示情報。
// 対象ジャンルはプロジェクト直下のCLAUDE.mdを唯一の情報源とし、
// カテゴリが増えた場合はここに追記する(未登録カテゴリはdefaultにフォールバック)。
const CATEGORY_META = {
  "スキンケア": {
    icon: "💧",
    color: "#d6336c",
    soft: "#ffe3ec",
    description:
      "毛穴・乾燥・肌荒れなど、肌悩み別のお手入れ方法とアイテム選びのコツをまとめています。",
  },
  "ダイエット": {
    icon: "🥗",
    color: "#2f9e44",
    soft: "#e6f7ea",
    description:
      "無理なく続けられる食事管理や生活習慣の工夫で、健康的に理想の体型を目指す情報を紹介します。",
  },
  "メイク": {
    icon: "💄",
    color: "#e8590c",
    soft: "#ffe8d9",
    description:
      "崩れにくく仕上げるテクニックや、肌悩みをカバーするメイク方法をまとめています。",
  },
  "美容": {
    icon: "✨",
    color: "#7048e8",
    soft: "#ede6fd",
    description:
      "美容医療から日々のセルフケアまで、キレイをサポートする幅広い情報を紹介します。",
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
