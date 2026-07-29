// カテゴリ別のマスコットキャラクター設定。
// 現状はジャンル(対象分野はプロジェクト直下のCLAUDE.mdが唯一の情報源)全体で
// 美容ブランチ(スキンケア/メイク/美容)のみ「ツヤミンちゃん」を割り当てている。
// ダイエットや将来追加するジャンルは、専用マスコットができ次第ここに追記する
// (未登録カテゴリはnullを返し、マスコットは非表示になる)。
const TSUYAMIN = {
  name: "ツヤミンちゃん",
  normalImage: "/images/mascot/tsuyamin-normal.svg",
  researchImage: "/images/mascot/tsuyamin-research.svg",
  comments: [
    "肌にあうかどうかは人それぞれ。まずは少量から試してみてね。",
    "似合うかどうかは、実際に試してみるのが一番だよ。",
    "情報を集めて、自分に合う方法を見つけよう。",
  ],
};

const CATEGORY_MASCOTS = {
  "スキンケア": TSUYAMIN,
  "メイク": TSUYAMIN,
  "美容": TSUYAMIN,
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
