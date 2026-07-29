import Head from "next/head";
import Header from "./Header";
import Footer from "./Footer";

const SITE_NAME = "美容の総合ガイド｜NEVORA";

// サイト全体で常に出す構造化データ(WebSite: サイト内検索をSearchActionとして
// 申告することで、検索結果にサイトリンク検索ボックスが表示される可能性がある)。
// ページ固有のJSON-LD(Article/BreadcrumbList等)はjsonLd propで追加する。
function buildWebsiteJsonLd(siteUrl) {
  if (!siteUrl) return null;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export default function Layout({
  children,
  title = SITE_NAME,
  description = "スキンケア・コスメ・メイクなど信頼できる美容情報をわかりやすく解説します。",
  ogImage = "",
  categories = [],
  hero = null,
  panel = false,
  canonicalPath = "",
  ogType = "website",
  noindex = false,
  jsonLd = [],
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const absoluteOgImage = ogImage && siteUrl ? `${siteUrl}${ogImage}` : ogImage;
  // NEXT_PUBLIC_SITE_URL未設定の環境(ローカル開発等)では絶対URLを組み立てられないため、
  // 不正確なcanonical/og:urlを出力しないよう、その場合はタグ自体を省略する。
  const canonicalUrl = siteUrl && canonicalPath ? `${siteUrl}${canonicalPath}` : "";
  const websiteJsonLd = buildWebsiteJsonLd(siteUrl);
  const allJsonLd = [websiteJsonLd, ...jsonLd].filter(Boolean);

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {noindex && <meta name="robots" content="noindex, nofollow" />}
        {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:locale" content="ja_JP" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content={ogType} />
        {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
        {absoluteOgImage && <meta property="og:image" content={absoluteOgImage} />}
        <meta name="twitter:card" content={absoluteOgImage ? "summary_large_image" : "summary"} />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        {absoluteOgImage && <meta name="twitter:image" content={absoluteOgImage} />}
        {allJsonLd.map((data, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
          />
        ))}
      </Head>
      {/* 全ページ共通の最背面グラデーション(position: fixedでヘッダー/フッターの
          背後にも回り込む)。ページごとの背景色は持たせず、ここに一本化する。 */}
      <div className="site-bg" aria-hidden="true" />
      <Header categories={categories} />
      <main>
        {hero}
        <div className="container">
          {panel ? <div className="page-panel">{children}</div> : children}
        </div>
      </main>
      <Footer />
    </>
  );
}
