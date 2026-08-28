// トップページの「カテゴリで探す」まとめセクション用の表示情報。
// colorは上辺のボーダーだけでなく文字色(--cat-color)としても使われるため、
// 白カード上・自身のsoft上・帯のティント上のいずれでも6.3:1以上になる値にしている
// (2026-08-29、npm run check:contrast の実ピクセル監査で是正)。
// 色を変えるときは色相を保ったまま明度だけを調整し、必ず監査を通し直すこと。
// 対象ジャンルはプロジェクト直下のCLAUDE.mdを唯一の情報源とし、
// カテゴリが増えた場合はここに追記する(未登録カテゴリはdefaultにフォールバック)。
const CATEGORY_META = {
  "投資": {
    icon: "📈",
    color: "#12528c",
    soft: "#dff0ff",
    image: "/images/category/investment.webp",
    description:
      "新NISA・iDeCo・投資信託・株式など、資産形成の始め方と商品の選び方をまとめています。",
    shortSummary:
      "新NISA・iDeCo・投資信託・株式など、資産形成の始め方と選び方。",
  },
  "FX": {
    icon: "💱",
    color: "#075d43",
    soft: "#dff7ee",
    image: "/images/category/fx.webp",
    description:
      "FXの仕組み・スプレッド・レバレッジ・リスク管理など、為替取引の基礎と業者選びを紹介します。",
    shortSummary:
      "FXの仕組み・スプレッド・レバレッジ・リスク管理と業者選び。",
  },
  "税金・節税": {
    icon: "🧾",
    color: "#8a3507",
    soft: "#ffe8d9",
    image: "/images/category/tax.webp",
    description:
      "確定申告・控除・ふるさと納税など、払いすぎを防ぐための税金の知識と手続きをまとめています。",
    shortSummary:
      "確定申告・控除・ふるさと納税など、税金の知識と手続き。",
  },
  "保険": {
    icon: "🛡️",
    color: "#5737b6",
    soft: "#ece6fb",
    image: "/images/category/insurance.webp",
    description:
      "生命保険・医療保険・自動車保険など、必要な保障の見極め方と見直しのコツを紹介します。",
    shortSummary:
      "生命保険・医療保険・自動車保険など、保障の見極め方と見直し。",
  },
  "家計・節約": {
    icon: "🏠",
    color: "#1b5c28",
    soft: "#e6f7ea",
    image: "/images/category/household.webp",
    description:
      "固定費の削減・家計簿・貯蓄計画など、日々のお金の流れを整える方法をまとめています。",
    shortSummary:
      "固定費の削減・家計簿・貯蓄計画など、お金の流れを整える方法。",
  },
  "クレカ・ポイント": {
    icon: "💳",
    color: "#9a1d49",
    soft: "#fde3ee",
    image: "/images/category/card-point.webp",
    description:
      "クレジットカード・キャッシュレス決済・ポイント還元など、日常の支払いを得にする工夫を紹介します。",
    shortSummary:
      "クレカ・キャッシュレス決済・ポイント還元など、支払いを得にする工夫。",
  },
};

// ホームページで常時表示する大カテゴリ(CLAUDE.mdの対象分野を唯一の情報源とする
// 分類表に基づく表示順)。記事の有無に関わらずこの並び順で表示する。
export const MAJOR_CATEGORIES = [
  "投資",
  "FX",
  "税金・節税",
  "保険",
  "家計・節約",
  "クレカ・ポイント",
];

const DEFAULT_META = {
  icon: "📁",
  color: "#495057",
  soft: "#f1f3f5",
  description: "このカテゴリに関する記事をまとめています。",
  shortSummary: "このカテゴリに関する記事をまとめています。",
};

export function getCategoryMeta(name) {
  return CATEGORY_META[name] || DEFAULT_META;
}
