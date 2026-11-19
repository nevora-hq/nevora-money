// トップページ「カテゴリで探す」の円形ナビ用のジャンル定義。
// カテゴリを増減したら、このファイルの categories を編集するだけでよい
// (コンポーネントは数・名前に依存しない)。
// - categories … lib/categoryMeta.js の MAJOR_CATEGORIES と同じカテゴリ名
// - どのジャンルにも入っていないカテゴリは resolveGenres() が「その他」に自動で入れる
// - icon は components/CategoryGenreNav.js の GENRE_ICONS のキー
// - soft/line は円の背景色・枠色。文字色はサイト共通の本文色なので、薄い色のままでよい
export const CATEGORY_GENRES = [
  {
    id: "grow",
    label: "ふやす",
    icon: "grow",
    soft: "#dff0ff",
    line: "#4f95c9",
    categories: ["投資", "FX"],
  },
  {
    id: "protect",
    label: "まもる",
    icon: "shield",
    soft: "#ffe8d9",
    line: "#c97a3e",
    categories: ["税金・節税", "保険"],
  },
  {
    id: "organize",
    label: "ととのえる",
    icon: "home",
    soft: "#e6f7ea",
    line: "#4aa05c",
    categories: ["家計・節約", "クレカ・ポイント"],
  },
];

const OTHER_GENRE = {
  id: "other",
  label: "その他",
  icon: "folder",
  soft: "#f1f3f5",
  line: "#7a8591",
  categories: [],
};

// 実在するカテゴリ名だけに絞り、未登録のカテゴリは「その他」に集める。
// 実在カテゴリが0件のジャンルは落とす。
export function resolveGenres(categoryNames) {
  const existing = new Set(categoryNames);
  const placed = new Set();
  const genres = CATEGORY_GENRES.map((g) => {
    const categories = g.categories.filter((name) => existing.has(name) && !placed.has(name));
    categories.forEach((name) => placed.add(name));
    return { ...g, categories };
  });
  const leftovers = categoryNames.filter((name) => !placed.has(name));
  if (leftovers.length > 0) genres.push({ ...OTHER_GENRE, categories: leftovers });
  return genres.filter((g) => g.categories.length > 0);
}
