import { useState } from "react";
import Head from "next/head";
import Layout from "../components/Layout";
import PostCard from "../components/PostCard";
import HeroBanner from "../components/HeroBanner";
import ImageSlider from "../components/ImageSlider";
import Sidebar from "../components/Sidebar";
import { getAllPostsMeta, getAllCategories, getPostsByCategory } from "../lib/posts";
import { getCategoryMeta, ALWAYS_VISIBLE_CATEGORIES } from "../lib/categoryMeta";
import { getCategoryMascot, MAIN_MASCOT } from "../lib/categoryMascot";
import Mascot from "../components/Mascot";
import MascotGreeting from "../components/MascotGreeting";
import Link from "next/link";

// トップページの「カテゴリで探す」を初期表示するカテゴリ(人気カテゴリー)。
// これ以外のALWAYS_VISIBLE_CATEGORIESは、アコーディオンを開いたときのみ見せる
// (ただしSEO維持のため、リンク自体は開閉に関わらず常に初期HTML内に存在させる)。
const POPULAR_CATEGORIES = ["株式投資", "税金", "保険"];

// 「あなたのお金の悩みから探す」チップ。既存のカテゴリページ/検索ページの
// URL構造を変更せず、遷移先はすべて既存ページ(/category/*, /search)を利用する。
const WORRY_GROUPS = [
  {
    title: "貯める・増やす",
    chips: [
      { label: "家計管理", href: "/search?q=家計" },
      { label: "節約・ポイ活", href: "/search?q=節約" },
      { label: "新NISA", href: "/search?q=新NISA" },
      { label: "株式投資", href: "/category/株式投資" },
      { label: "資産運用の始め方", href: "/search?q=資産運用" },
    ],
  },
  {
    title: "備える・守る",
    chips: [
      { label: "保険の見直し", href: "/category/保険" },
      { label: "税金・確定申告", href: "/category/税金" },
      { label: "ふるさと納税", href: "/search?q=ふるさと納税" },
      { label: "老後資金", href: "/search?q=老後資金" },
      { label: "法人保険", href: "/search?q=法人保険" },
    ],
  },
  {
    title: "学ぶ・広げる",
    chips: [
      { label: "不動産投資", href: "/category/不動産投資" },
      { label: "FX", href: "/category/FX" },
      { label: "お金の用語がわからない", href: "/category/用語辞典" },
      { label: "副業収入との両立", href: "/search?q=副業" },
      { label: "投資信託の選び方", href: "/search?q=投資信託" },
    ],
  },
];

export async function getStaticProps() {
  const posts = getAllPostsMeta();
  const categories = getAllCategories();

  // 記事がまだ無い大カテゴリ(投資/FX/税金)も、記事が0件のカードとして
  // 常時トップページに表示する(中カテゴリ/小カテゴリは記事のtagsとして扱い、
  // 独立カテゴリとしては公開しない)。
  const categoryNames = new Set(categories.map((c) => c.name));
  const placeholderCategories = ALWAYS_VISIBLE_CATEGORIES.filter(
    (name) => !categoryNames.has(name)
  ).map((name) => ({ name, count: 0 }));

  const categorySummaries = [...categories, ...placeholderCategories].map((c) => ({
    ...c,
    ...getCategoryMeta(c.name),
    posts: getPostsByCategory(c.name).slice(0, 3),
  }));

  // ヒーロー直下のスライドは記事サムネイルではなく、大カテゴリの選定画像を表示する。
  const categorySlides = categorySummaries
    .filter((c) => c.image)
    .map((c) => ({
      key: c.name,
      name: c.name,
      image: c.image,
      href: `/category/${encodeURIComponent(c.name)}`,
    }));

  return {
    props: {
      newPosts: posts.slice(0, 2),
      featuredPosts: posts.slice(2, 4),
      popularPosts: posts.slice(0, 5),
      categories,
      categorySummaries,
      categorySlides,
    },
  };
}

export default function Home({
  newPosts,
  featuredPosts,
  popularPosts,
  categories,
  categorySummaries,
  categorySlides,
}) {
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  const popularSummaries = POPULAR_CATEGORIES.map((name) =>
    categorySummaries.find((c) => c.name === name)
  ).filter(Boolean);
  const extraSummaries = categorySummaries.filter(
    (c) => !POPULAR_CATEGORIES.includes(c.name)
  );

  const renderCategoryCard = (cat) => {
    const mascot = getCategoryMascot(
      cat.name,
      cat.name,
      `${cat.description} 気になった方は、上の画像をタップして記事をチェックしてみてね。`
    );
    const categoryHref = `/category/${encodeURIComponent(cat.name)}`;

    return (
      <div
        key={cat.name}
        className="category-summary-card"
        style={{ "--cat-color": cat.color, "--cat-soft": cat.soft }}
      >
        {cat.image ? (
          <Link href={categoryHref} className="category-summary-image-link">
            <img
              src={cat.image}
              alt={`${cat.name}のカテゴリ画像`}
              className="category-summary-image"
              loading="lazy"
            />
            <span className="category-summary-image-badge">
              <span className="category-summary-icon" aria-hidden="true">
                {cat.icon}
              </span>
              <span className="category-summary-name">{cat.name}</span>
            </span>
          </Link>
        ) : (
          <div className="category-summary-head">
            <span className="category-summary-icon" aria-hidden="true">
              {cat.icon}
            </span>
            <div>
              <h3 className="category-summary-name">{cat.name}</h3>
            </div>
          </div>
        )}

        {mascot && (
          <div className="category-summary-mascot-row">
            <img
              src={mascot.normalImage}
              alt={mascot.name}
              width={56}
              height={56}
              className="category-summary-mascot-img"
            />
            <div className="category-summary-mascot-bubble">
              <span className="category-summary-mascot-name">{mascot.name}</span>
              <p className="category-summary-mascot-text">{mascot.comment}</p>
            </div>
          </div>
        )}

        {!mascot && <p className="category-summary-desc">{cat.description}</p>}
      </div>
    );
  };

  return (
    <Layout
      title="お金の総合ガイド｜NEVORA｜投資・節税・家計管理の情報"
      categories={categories}
      canonicalPath="/"
      hero={
        <>
          <HeroBanner />
          <ImageSlider slides={categorySlides} />
        </>
      }
    >
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className="home-page">
        <div className="container">
          <MascotGreeting mascot={MAIN_MASCOT} />
        </div>
        <section className="worry-section container">
          <h2 className="home-section-title">あなたのお金の悩みから探す</h2>
          <p className="home-section-lead">
            気になるキーワードをタップすると、関連する記事やカテゴリをチェックできます。
          </p>
          <div className="worry-groups">
            {WORRY_GROUPS.map((group) => (
              <div key={group.title} className="worry-group">
                <h3 className="worry-group-title">{group.title}</h3>
                <div className="worry-chip-list">
                  {group.chips.map((chip) => (
                    <Link key={chip.label} href={chip.href} className="worry-chip">
                      {chip.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="home-layout">
          <div className="home-main">
            {categorySummaries.length > 0 && (
              <section className="category-summary-section">
                <h2 className="home-section-title">カテゴリで探す</h2>
                <p className="home-section-lead">
                  気になるテーマから、関連記事をまとめてチェックできます。
                </p>
                <div className="category-summary-grid">
                  {popularSummaries.map((cat) => renderCategoryCard(cat))}
                </div>

                {extraSummaries.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="category-summary-toggle"
                      aria-expanded={categoriesExpanded}
                      aria-controls="category-summary-extra"
                      onClick={() => setCategoriesExpanded((v) => !v)}
                    >
                      {categoriesExpanded
                        ? "− お金カテゴリーを閉じる"
                        : "＋ すべてのお金カテゴリーを見る"}
                    </button>
                    <div
                      id="category-summary-extra"
                      className={`category-summary-grid category-summary-extra-grid${
                        categoriesExpanded ? " is-open" : ""
                      }`}
                      inert={!categoriesExpanded}
                    >
                      {extraSummaries.map((cat) => renderCategoryCard(cat))}
                    </div>
                  </>
                )}
              </section>
            )}

            <section className="home-featured-section">
              <h2 className="home-section-title">注目記事</h2>
              {featuredPosts.length === 0 ? (
                <p>まだ記事がありません。記事データを確定稿フォルダに追加してください。</p>
              ) : (
                <div className="post-list">
                  {featuredPosts.map((post) => (
                    <PostCard key={post.slug} post={post} compact />
                  ))}
                </div>
              )}
            </section>

            <section className="home-new-section">
              <h2 className="home-section-title">新着記事</h2>
              <div className="post-list">
                {newPosts.map((post) => (
                  <PostCard key={post.slug} post={post} compact />
                ))}
              </div>
            </section>
          </div>

          <Sidebar popularPosts={popularPosts} categories={categories} />
        </div>
      </div>
    </Layout>
  );
}
