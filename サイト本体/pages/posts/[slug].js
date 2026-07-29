import Layout from "../../components/Layout";
import AffiliateBanner from "../../components/AffiliateBanner";
import ArticleToc from "../../components/ArticleToc";
import ScrollProgressBar from "../../components/ScrollProgressBar";
import {
  getAllSlugs,
  getPostBySlug,
  getPostsByCategory,
  getNextPost,
} from "../../lib/posts";

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

const SITE_NAME = "美容の総合ガイド｜NEVORA";

// 記事ページ固有の構造化データ(Article + パンくずリスト)を組み立てる。
// NEXT_PUBLIC_SITE_URL未設定時は絶対URLが組み立てられないため、その場合は
// スキーマ自体を出力しない(Layout側のcanonical/og:urlの扱いと同じ方針)。
function buildPostJsonLd(post, siteUrl) {
  if (!siteUrl) return [];

  const url = `${siteUrl}/posts/${post.slug}`;
  const image = post.thumbnail ? `${siteUrl}${post.thumbnail}` : undefined;

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    ...(image && { image: [image] }),
    datePublished: post.date || undefined,
    dateModified: post.updatedDate || post.date || undefined,
    author: { "@type": "Person", name: "nevora" },
    publisher: { "@type": "Organization", name: SITE_NAME },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "トップ", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: post.category,
        item: `${siteUrl}/category/${encodeURIComponent(post.category)}`,
      },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };

  return [article, breadcrumb];
}

export default function PostPage({ post, related, nextPost }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  return (
    <Layout
      title={`${post.title} | ${SITE_NAME}`}
      description={post.description}
      ogImage={post.thumbnail}
      canonicalPath={`/posts/${post.slug}`}
      ogType="article"
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
              {post.date && <span>公開日: {post.date}</span>}
              {post.updatedDate && post.updatedDate !== post.date && (
                <span className="article-meta-updated"> / 更新日: {post.updatedDate}</span>
              )}
              {post.readTimeMinutes && (
                <span className="article-meta-readtime"> / 読了目安: 約{post.readTimeMinutes}分</span>
              )}
            </p>
          )}
        </div>

        {post.thumbnail && (
          <img
            src={post.thumbnail}
            alt={post.title}
            className="article-hero-image"
            fetchPriority="high"
          />
        )}

        <ArticleToc items={post.toc} />

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
      </article>
    </Layout>
  );
}
