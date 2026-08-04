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
        <div className="home-layout">
          <div className="home-main">
            {categorySummaries.length > 0 && (
              <section className="category-summary-section">
                <h2 className="home-section-title">カテゴリで探す</h2>
                <p className="home-section-lead">
                  気になるテーマから、関連記事をまとめてチェックできます。
                </p>
                <div className="category-summary-grid">
                  {categorySummaries.map((cat) => {
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
                  })}
                </div>
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
