import Link from "next/link";
import Layout from "../../components/Layout";
import AffiliateBanner from "../../components/AffiliateBanner";
import ArticleToc from "../../components/ArticleToc";
import ScrollProgressBar from "../../components/ScrollProgressBar";
import FinancialDisclaimer, { shouldShowFinancialDisclaimer } from "../../components/FinancialDisclaimer";
import ArticleSources from "../../components/ArticleSources";
import { useEffect } from "react";
import { initDiagnosisWidgets } from "../../components/diagnosisWidget";

import {
  getAllSlugs,
  getPostBySlug,
  getPostsByCategory,
  getNextPost,
} from "../../lib/posts";
import { getWorryItemBySlug } from "../../lib/worryTopics";
import { buildArticleJsonLd, buildBreadcrumbJsonLd, SITE_NAME, AUTHOR_NAME } from "../../lib/structuredData";
import { formatDate } from "../../lib/formatDate";

export async function getStaticPaths() {
  const slugs = getAllSlugs();
  return {
    paths: slugs.map((slug) => ({ params: { slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const post = await getPostBySlug(params.slug);
  if (!post) {
    return { notFound: true };
  }
  const related = getPostsByCategory(post.category)
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3);
  const nextPost = getNextPost(params.slug);

  return { props: { post, related, nextPost } };
}

// frontmatterの日付("2026-07-17")をISO 8601(JST)へ整形する。
// article:published_time は日時まで含む形が望ましいため0時0分として扱う。
function toIsoJst(date) {
  if (!date) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00+09:00` : date;
}

// 記事ページ固有の構造化データ(Article + パンくずリスト)を組み立てる。
// NEXT_PUBLIC_SITE_URL未設定時は絶対URLが組み立てられないため、その場合は
// スキーマ自体を出力しない(Layout側のcanonical/og:urlの扱いと同じ方針)。
function buildPostJsonLd(post, siteUrl) {
  if (!siteUrl) return [];
  // 日本語スラッグはsitemap.xml(pages/sitemap.xml.js)と同じくpercent-encodedで出力し、
  // canonical・JSON-LD・sitemapの3者でURL表記を一致させる。post.slugは生の
  // ファイル名(未エンコード)なので二重エンコードにはならない。
  const url = `${siteUrl}/posts/${encodeURIComponent(post.slug)}`;
  const article = buildArticleJsonLd(post, siteUrl);
  const breadcrumb = buildBreadcrumbJsonLd(siteUrl, [
    { name: "トップ", url: siteUrl },
    { name: post.category, url: `${siteUrl}/category/${encodeURIComponent(post.category)}` },
    { name: post.title, url },
  ]);
  return [article, breadcrumb].filter(Boolean);
}

export default function PostPage({ post, related, nextPost }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  // frontmatterのchart type "diagnosis"(セルフ診断ウィザード)は静的HTMLとして
  // 埋め込まれており、マウント後にJSでのみ1問ずつ進むUIへ拡張する。対象記事を
  // 限定しないため、diagnosis型を使う記事が増えてもこの呼び出しは変更不要。
  useEffect(() => {
    initDiagnosisWidgets();
  }, [post.slug]);

  return (
    <Layout
      title={`${post.title} | ${SITE_NAME}`}
      description={post.description}
      ogImage={post.thumbnail}
      canonicalPath={`/posts/${encodeURIComponent(post.slug)}`}
      ogType="article"
      publishedTime={toIsoJst(post.date)}
      modifiedTime={toIsoJst(post.updatedDate || post.date)}
      jsonLd={buildPostJsonLd(post, siteUrl)}
      panel
    >
      <ScrollProgressBar />
      <article>
        <nav className="breadcrumb" aria-label="パンくずリスト">
          <a href="/">トップ</a>
          <span className="sep">/</span>
          <a href={`/category/${encodeURIComponent(post.category)}`}>{post.category}</a>
          <span className="sep">/</span>
          <span className="current">{post.title}</span>
        </nav>

        <div className="article-header">
          <span className="category-badge">{post.category}</span>
          <h1>{post.title}</h1>
          {(post.date || post.readTimeMinutes) && (
            <p className="article-meta">
              {post.date && <span>公開日: {formatDate(post.date)}</span>}
              {post.updatedDate && post.updatedDate !== post.date && (
                <span className="article-meta-updated"> / 最終更新日: {formatDate(post.updatedDate)}</span>
              )}
              <span className="article-meta-author">
                {" "}
                / 執筆:{" "}
                <Link href="/about">NEVORA編集部(運営者: {AUTHOR_NAME})</Link>
              </span>
              {post.readTimeMinutes && (
                <span className="article-meta-readtime"> / 読了目安: 約{post.readTimeMinutes}分</span>
              )}
            </p>
          )}
        </div>

        {(post.heroImage || post.thumbnail) && (
          <img
            src={post.heroImage || post.thumbnail}
            alt={post.title}
            className="article-hero-image"
            fetchPriority="high"
          />
        )}

        {(post.summaryPoints?.length > 0 ||
          post.targetReader ||
          post.comparisonCriteria?.length > 0) && (
          <div className="article-summary-box">
            {post.summaryPoints?.length > 0 && (
              <div className="article-summary-block">
                <details open className="article-accordion article-summary-accordion">
                  <summary className="article-accordion-summary">
                    <h2 className="article-summary-heading">この記事で分かること</h2>
                  </summary>
                  <div className="article-accordion-body">
                    <ul>
                      {post.summaryPoints.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                </details>
              </div>
            )}
            {post.targetReader && (
              <div className="article-summary-block">
                <h2 className="article-summary-heading">どんな人におすすめか</h2>
                <p>{post.targetReader}</p>
              </div>
            )}
            {post.comparisonCriteria?.length > 0 && (
              <div className="article-summary-block">
                <h2 className="article-summary-heading">比較の基準</h2>
                <ul>
                  {post.comparisonCriteria.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {post.conclusionAnchor && (
              <a href={`#${post.conclusionAnchor.id}`} className="article-summary-conclusion-link">
                結論を先に見る →
              </a>
            )}
          </div>
        )}

        {/*
          lib/posts.js側で本文冒頭に記事専用の折りたたみ目次を埋め込み済みの記事
          (post.hasEmbeddedToc)は、この共通目次を重ねて表示すると目次が2つ並んで
          しまうため出し分ける。
        */}
        {!post.hasEmbeddedToc && <ArticleToc items={post.toc} />}

        {post.affiliateLinks?.length > 0 && (
          <div className="ad-notice">
            ※本記事にはアフィリエイト広告(PR)を含みます。当サイトを経由して商品・サービスに申込みがあった場合、
            売上の一部が当サイトの収益となることがあります。
          </div>
        )}

        <div
          className="article-body"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        {/*
          アフィリエイトリンクは原則、話題に関連する本文の直後にバナー(画像またはPR付き
          テキストリンク)として埋め込まれる(lib/posts.jsのembedAffiliateBanners参照)。
          本文中に紐づく言及が見つからなかったリンクのみ、ここにフォールバック表示する。
        */}
        {post.unplacedAffiliateLinks?.length > 0 && (
          <div className="affiliate-box">
            <h3>この記事で紹介した商品・サービス</h3>
            {post.unplacedAffiliateLinks.map((link) => (
              <AffiliateBanner key={link.url} link={link} />
            ))}
          </div>
        )}

        {nextPost && (
          <div className="article-next-post">
            <a href={`/posts/${nextPost.slug}`} className="article-next-post-link">
              {nextPost.thumbnail ? (
                <img
                  src={nextPost.thumbnail}
                  alt=""
                  loading="lazy"
                  className="article-next-post-thumb"
                />
              ) : (
                <span
                  className="article-next-post-thumb article-next-post-thumb-fallback"
                  aria-hidden="true"
                >
                  📖
                </span>
              )}
              <span className="article-next-post-body">
                <span className="article-next-post-eyebrow">次の記事へ進む →</span>
                <span className="article-next-post-title">{nextPost.title}</span>
              </span>
            </a>
          </div>
        )}

        {related.length > 0 && (
          <div className="related-posts">
            <h3 className="related-posts-heading">
              <span className="related-posts-icon" aria-hidden="true">
                📚
              </span>
              関連記事
            </h3>
            <ul className="related-posts-grid">
              {related.map((p) => (
                <li key={p.slug} className="related-post-card">
                  <a href={`/posts/${p.slug}`} className="related-post-link">
                    {p.thumbnail ? (
                      <img
                        src={p.thumbnail}
                        alt={p.title}
                        loading="lazy"
                        className="related-post-thumb"
                      />
                    ) : (
                      <span className="related-post-thumb related-post-thumb-fallback" aria-hidden="true">
                        📖
                      </span>
                    )}
                    <span className="related-post-title">{p.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* この記事に関連する悩みへの逆リンク。worryが空配列の記事では非表示。 */}
        {Array.isArray(post.worry) && post.worry.length > 0 && (
          <div className="related-worries">
            <h3 className="related-posts-heading">
              <span className="related-posts-icon" aria-hidden="true">
                🔍
              </span>
              この記事に関連する悩み
            </h3>
            <div className="worry-finder-chips">
              {post.worry.map((worrySlug) => {
                const worryItem = getWorryItemBySlug(worrySlug);
                if (!worryItem) return null;
                return (
                  <a key={worrySlug} href={`/worry/${worrySlug}`} className="worry-chip">
                    {worryItem.label}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        <ArticleSources sources={post.sources} />

        <p className="article-reference-note">
          ※本記事の作成にあたっては、公的機関の情報・学術情報・メーカー公表情報などを参考にしています。
        </p>

        {shouldShowFinancialDisclaimer(post.disclaimer) && <FinancialDisclaimer />}
      </article>
    </Layout>
  );
}
