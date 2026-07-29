import Head from "next/head";
import Layout from "../components/Layout";
import PostCard from "../components/PostCard";
import HeroBanner from "../components/HeroBanner";
import ImageSlider from "../components/ImageSlider";
import Sidebar from "../components/Sidebar";
import { getAllPostsMeta, getAllCategories, getPostsByCategory } from "../lib/posts";
import { getCategoryMeta } from "../lib/categoryMeta";
import { getCategoryMascot } from "../lib/categoryMascot";
import Mascot from "../components/Mascot";
import Link from "next/link";

export async function getStaticProps() {
  const posts = getAllPostsMeta();
  const categories = getAllCategories();
  const sliderPosts = posts.filter((p) => p.thumbnail).slice(0, 5);

  const categorySummaries = categories.map((c) => ({
    ...c,
    ...getCategoryMeta(c.name),
    posts: getPostsByCategory(c.name).slice(0, 3),
  }));

  return {
    props: {
      newPosts: posts.slice(0, 6),
      featuredPosts: posts.slice(0, 3),
      popularPosts: posts.slice(0, 5),
      categories,
      categorySummaries,
      sliderPosts,
    },
  };
}

export default function Home({
  newPosts,
  featuredPosts,
  popularPosts,
  categories,
  categorySummaries,
  sliderPosts,
}) {
  return (
    <Layout
      title="美容の総合ガイド｜NEVORA｜スキンケア・コスメ・メイクの美容情報"
      categories={categories}
      canonicalPath="/"
      hero={
        <>
          <HeroBanner />
          <ImageSlider slides={sliderPosts} />
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
        <div className="home-layout">
          <div className="home-main">
            {categorySummaries.length > 0 && (
              <section className="category-summary-section">
                <h2 className="home-section-title">カテゴリで探す</h2>
                <p className="home-section-lead">
                  気になるテーマから、関連記事をまとめてチェックできます。
                </p>
                <div className="category-summary-grid">
                  {categorySummaries.map((cat) => (
                    <div
                      key={cat.name}
                      className="category-summary-card"
                      style={{ "--cat-color": cat.color, "--cat-soft": cat.soft }}
                    >
                      {getCategoryMascot(cat.name) && (
                        <div className="category-summary-mascot">
                          <Mascot mascot={getCategoryMascot(cat.name)} />
                        </div>
                      )}
                      <div className="category-summary-head">
                        <span className="category-summary-icon" aria-hidden="true">
                          {cat.icon}
                        </span>
                        <div>
                          <h3 className="category-summary-name">{cat.name}</h3>
                          <span className="category-summary-count">{cat.count}件の記事</span>
                        </div>
                      </div>
                      <p className="category-summary-desc">{cat.description}</p>
                      {cat.posts.length > 0 && (
                        <ul className="category-summary-posts">
                          {cat.posts.map((p) => (
                            <li key={p.slug}>
                              <Link href={`/posts/${p.slug}`} className="category-summary-post-link">
                                {p.thumbnail && (
                                  <img src={p.thumbnail} alt="" loading="lazy" />
                                )}
                                <span>{p.title}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Link
                        href={`/category/${encodeURIComponent(cat.name)}`}
                        className="category-summary-more"
                      >
                        {cat.name}の記事をすべて見る →
                      </Link>
                    </div>
                  ))}
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
                    <PostCard key={post.slug} post={post} />
                  ))}
                </div>
              )}
            </section>

            <section className="home-new-section">
              <h2 className="home-section-title">新着記事</h2>
              <div className="post-list">
                {newPosts.map((post) => (
                  <PostCard key={post.slug} post={post} />
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
