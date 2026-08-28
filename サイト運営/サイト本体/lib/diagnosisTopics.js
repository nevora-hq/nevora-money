// セルフ診断ページ(/diagnosis/[slug])の定義を一元管理する。
// 「投資スタイル診断」「保険の必要保障額タイプ診断」などを想定した汎用の枠組み。
//
// 【骨組みの使い方】
// 下記スキーマで DIAGNOSES に1件追加すると、その診断ページが生成される。
// 1件も登録が無い間は /diagnosis 配下のページを生成しない(中身の無い
// 「準備中ページ」を公開しないため。CLAUDE.mdのアドセンス審査基準)。
//
//   <slug>: {
//     title: "…診断｜お金の総合ガイド｜NEVORA",
//     heading: "…診断",
//     description: "…",                     // meta description
//     note: "…",                            // 見出し下の説明文
//     disclaimer: "…",                      // 結果画面に出す注意書き
//     // 選択肢ごとに typeキー への加点を持たせ、合計が最大のtypeを結果とする
//     questions: [
//       { id: "q1", text: "…", choices: [{ label: "…", score: { <type>: 2 } }] },
//     ],
//     results: {
//       <type>: {
//         title: "…タイプ", emoji: "📈", description: "…",
//         slug: "<誘導先の記事slug>",       // 任意
//         worrySlugs: ["<lib/worryTopics.jsのslug>"], // 任意
//       },
//     },
//     defaultType: "<結果が同点だったときのtype>",
//   }
export const DIAGNOSES = {};

export function getDiagnosisSlugs() {
  return Object.keys(DIAGNOSES);
}

export function getDiagnosis(slug) {
  return DIAGNOSES[slug] || null;
}
