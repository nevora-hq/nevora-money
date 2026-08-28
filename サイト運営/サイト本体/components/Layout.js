import Head from "next/head";
import Header from "./Header";
import Footer from "./Footer";
import { SITE_NAME, buildWebsiteJsonLd } from "../lib/structuredData";

// ページ固有のJSON-LD(Article/BreadcrumbList等)はjsonLd propで追加する。
// サイト全体で常に出すWebSite構造化データはlib/structuredData.jsを参照。

// SNSシェア時の共通OGP画像。記事側でthumbnailが無い場合もこれを使う。
// TODO: お金サイト用の1200x630のOGP画像(/images/ogp.png)を用意したら差し替える。
// 美容サイトのogp.pngは「美容の総合ガイド」の文字が焼き込まれていたため削除済みで、
// 暫定的にロゴ画像を使っている。
const DEFAULT_OG_IMAGE = "/images/logo.png";

export default function Layout({
  children,
  title = SITE_NAME,
  description = "投資・FX・税金(節税)・保険・家計など、信頼できるお金の情報をわかりやすく解説します。",
  ogImage = "",
  categories = [],
  hero = null,
  panel = false,
  // wide=true で本文コンテナを1180pxに広げる。
  // 記事ページは1行の文字数が増えすぎて読みにくくなるため既定の960pxのままにする。
  wide = false,
  // fullWidth=true では共通のcontainerで包まず、childrenをmain直下に置く。
  // トップページのように「画面幅いっぱいの帯を縦に積み、帯の中で
  // 自前のcontainerを持つ」構成のためのもの(2026-08-17 Step5)。
  fullWidth = false,
  canonicalPath = "",
  ogType = "website",
  // Pinterestのリッチピン(記事タイプ)向け。og:type="article"のページで
  // frontmatterの公開日/更新日をISO 8601(JST)に整形して渡す(2026-08-27)。
  publishedTime = "",
  modifiedTime = "",
  noindex = false,
  jsonLd = [],
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  // ogImage未指定(またはサムネイル未設定の記事)では、サイト共通のOGP画像を使う。
  const resolvedOgImage = ogImage || DEFAULT_OG_IMAGE;
  const absoluteOgImage = siteUrl ? `${siteUrl}${resolvedOgImage}` : resolvedOgImage;
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
        {ogType === "article" && publishedTime && (
          <meta property="article:published_time" content={publishedTime} />
        )}
        {ogType === "article" && modifiedTime && (
          <meta property="article:modified_time" content={modifiedTime} />
        )}
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
      <main className={fullWidth ? "main--full" : undefined}>
        {hero}
        {fullWidth ? (
          children
        ) : (
          <div className={`container${wide ? " container--wide" : ""}`}>
            {panel ? <div className="page-panel">{children}</div> : children}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
