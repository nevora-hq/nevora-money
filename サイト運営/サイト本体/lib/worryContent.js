// 悩みページ(/worry/[slug])の独自コンテンツを一元管理する。
// slugをキーに、以下のスキーマで登録する(slugは lib/worryTopics.js と一致させる)。
//
//   <slug>: {
//     title: "<悩み>の…｜お金の総合ガイド｜NEVORA",  // <title>用
//     description: "…",        // meta description(120〜160文字程度)
//     summary: "…",            // /worry ハブのカード内サマリー(1文)
//     cta: { title: "…", desc: "…" },        // 任意。ページ下部の誘導カード
//     intro: "…",                            // 導入文(300文字前後)
//     keyPoints: ["…", "…"],                 // 要点(3つ前後)
//     causes: [{ title: "…", body: "…" }],   // 原因・背景
//     selfCheck: { title: "…", items: ["…"] },
//     steps: [{ title: "…", body: "…" }],    // 今日からできる手順
//     faq: [{ q: "…", a: "…" }],
//   }
//
// 金融商品を扱うため、断定的な利回り・「必ず儲かる」等の表現は使わない
// (金融商品取引法・景品表示法。詳細は legal-checker エージェント定義を参照)。
//
// 未登録の悩みはページを生成しない(lib/worryTopics.js の getPublishedWorryItems 参照)。
const worryContent = {};

export function hasWorryContent(slug) {
  return Object.prototype.hasOwnProperty.call(worryContent, slug);
}

export function getWorryContent(slug) {
  return worryContent[slug] || null;
}

export default worryContent;
