// ホームの「あなたのお金の悩みから探す」チップの定義。
// 各件が /worry/[slug] へ着地する。記事との紐付けは記事frontmatterの
// worry フィールド(明示付与、部分一致判定は使わない)のみで行う。
// 注意: このファイルは pages/index.js(クライアントバンドルに含まれる)からも
// importされるため、Node専用のlib/posts.js(fs使用)を絶対にimportしないこと。
// 記事一覧の絞り込み(getPostsByWorry相当)はpages/worry/[slug].jsのgetStaticProps側で行う。
//
// 【骨組みの使い方】
// WORRY_GROUPS に { slug, label, primaryCategory } を追加し、対応する本文を
// lib/worryContent.js に同じ slug で登録すると、その悩みのページが生成される。
// 本文が未登録の悩みはページを生成せず、トップ・ハブページにも表示しない
// (中身の無い「準備中ページ」を公開しないため。CLAUDE.mdのアドセンス審査基準)。

import { hasWorryContent } from "./worryContent";

export const WORRY_GROUPS = [
  {
    heading: "ふやす",
    items: [
      { slug: "start-investing", label: "投資の始め方", primaryCategory: "投資" },
      { slug: "nisa", label: "新NISA", primaryCategory: "投資" },
      { slug: "ideco", label: "iDeCo・年金", primaryCategory: "投資" },
      { slug: "fx-basics", label: "FXの基礎", primaryCategory: "FX" },
    ],
  },
  {
    heading: "まもる",
    items: [
      { slug: "tax-return", label: "確定申告", primaryCategory: "税金・節税" },
      { slug: "deduction", label: "控除・節税", primaryCategory: "税金・節税" },
      { slug: "furusato", label: "ふるさと納税", primaryCategory: "税金・節税" },
      { slug: "insurance-review", label: "保険の見直し", primaryCategory: "保険" },
    ],
  },
  {
    heading: "ととのえる",
    items: [
      { slug: "fixed-cost", label: "固定費の削減", primaryCategory: "家計・節約" },
      { slug: "saving", label: "貯蓄・家計管理", primaryCategory: "家計・節約" },
      { slug: "credit-card", label: "クレカ選び", primaryCategory: "クレカ・ポイント" },
      { slug: "point", label: "ポイント還元", primaryCategory: "クレカ・ポイント" },
    ],
  },
];

// 全悩みチップをフラットな配列で取得(定義ベース。本文の有無は問わない)。
export function getAllWorryItems() {
  return WORRY_GROUPS.flatMap((group) =>
    group.items.map((item) => ({ ...item, group: group.heading }))
  );
}

// 本文(lib/worryContent.js)が用意できている悩みだけを返す。
// トップページのチップ・ハブページ・サイトマップ・/worry/[slug]の生成は
// すべてこちらを使い、中身の無いページを公開しないようにする。
export function getPublishedWorryItems() {
  return getAllWorryItems().filter((item) => hasWorryContent(item.slug));
}

// 本文が用意できている悩みだけを、グループ構造を保ったまま返す。
// 1件も無いグループは落とす。
export function getPublishedWorryGroups() {
  return WORRY_GROUPS.map((group) => ({
    heading: group.heading,
    items: group.items.filter((item) => hasWorryContent(item.slug)),
  })).filter((group) => group.items.length > 0);
}

// /worry/[slug] を生成する対象。
export function getWorryPageItems() {
  return getPublishedWorryItems();
}

export function getWorryItemBySlug(slug) {
  return getAllWorryItems().find((item) => item.slug === slug) || null;
}

// 悩みのリンク先URL。全件 /worry/[slug] に統一。
export function getWorryHref(item) {
  return `/worry/${item.slug}`;
}
