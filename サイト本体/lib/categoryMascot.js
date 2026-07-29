// カテゴリ別のマスコットキャラクター設定。
// 現状はジャンル(対象分野はプロジェクト直下のCLAUDE.mdが唯一の情報源)全体で
// お金・家計ブランチのみ「ゼニまるくん」を割り当てている。
// 実際のカテゴリ名はキーワード調査・記事制作が進み次第確定するため、
// カテゴリページ設計時にCATEGORY_MASCOTSのキーを実際のカテゴリ名に合わせて追記・修正すること
// (未登録カテゴリはnullを返し、マスコットは非表示になる)。
const ZENIMARU = {
  name: "ゼニまるくん",
  normalImage: "/images/mascot/zenimaru-normal.svg",
  researchImage: "/images/mascot/zenimaru-research.svg",
  comments: [
    "家計の見直しは、まず固定費から手をつけるのがコツだよ。",
    "無理な節約より、続けられるやり方を選ぶのが一番だよ。",
    "情報を集めて、自分に合ったお金の管理方法を見つけよう。",
  ],
};

const CATEGORY_MASCOTS = {
  "お金・家計": ZENIMARU,
};

function pickComment(mascot, seed) {
  const sum = String(seed)
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return mascot.comments[sum % mascot.comments.length];
}

export function getCategoryMascot(categoryName, seed = categoryName, overrideComment = "") {
  const mascot = CATEGORY_MASCOTS[categoryName];
  if (!mascot) return null;
  return { ...mascot, comment: overrideComment || pickComment(mascot, seed) };
}
