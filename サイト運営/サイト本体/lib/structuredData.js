// サイト全体で使う構造化データ(JSON-LD)の共通組み立て関数。
// 各ページ(pages/*.js)には出力先の呼び出しだけを残し、スキーマの組み立て
// ロジック自体はここに一本化する。SITE_NAMEもここを唯一の定義元とする
// (以前は components/Layout.js と pages/posts/[slug].js に重複定義していた)。

export const SITE_NAME = "お金の総合ガイド｜NEVORA";
// 運営者(個人)の氏名。記事のauthor・Organizationのfounderに用いる。
export const AUTHOR_NAME = "眞井 虹輝";

// サイトのロゴは、メインマスコット「コインミンちゃん」
// (public/images/mascot/coinmin-normal.svg)を512×512pxのPNGへ書き出したもの。
// 生成は scripts/generate-brand-assets.js が行う
// (Googleの推奨最小サイズ112×112pxを満たす)。
export const LOGO_PATH = "/images/logo.png";

// サイト全体で常に出す構造化データ(WebSite: サイト内検索をSearchActionとして
// 申告することで、検索結果にサイトリンク検索ボックスが表示される可能性がある)。
export function buildWebsiteJsonLd(siteUrl) {
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

// パンくずリスト。items: [{name, url}] を先頭から順に並べる。
export function buildBreadcrumbJsonLd(siteUrl, items) {
  if (!siteUrl || !Array.isArray(items) || items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// 一覧ページ(カテゴリ/悩み/悩みハブ等)用のItemList。items: [{name, url}]。
export function buildItemListJsonLd(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

// FAQPage。faqs: [{question, answer}]。
export function buildFaqJsonLd(faqs) {
  if (!Array.isArray(faqs) || faqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

// 記事のauthor・/aboutページで共通して使う運営者(Person)。
// url を /about に向けることで、記事 → 運営者情報ページの著者同一性を
// 構造化データ上でも示す。
export function buildAuthorPerson(siteUrl) {
  return {
    "@type": "Person",
    name: AUTHOR_NAME,
    jobTitle: "運営者",
    ...(siteUrl && { url: `${siteUrl}/about` }),
  };
}

// 記事のpublisherとして使う発行元(Organization)。
export function buildPublisherOrganization(siteUrl) {
  return {
    "@type": "Organization",
    name: SITE_NAME,
    ...(siteUrl && { url: siteUrl }),
    ...(siteUrl && {
      logo: { "@type": "ImageObject", url: `${siteUrl}${LOGO_PATH}` },
    }),
  };
}

// 記事ページ用のArticle。
export function buildArticleJsonLd(post, siteUrl) {
  if (!siteUrl) return null;
  const url = `${siteUrl}/posts/${post.slug}`;
  const image = post.thumbnail ? `${siteUrl}${post.thumbnail}` : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    ...(image && { image: [image] }),
    datePublished: post.date || undefined,
    dateModified: post.updatedDate || post.date || undefined,
    author: buildAuthorPerson(siteUrl),
    publisher: buildPublisherOrganization(siteUrl),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
}

// 運営者情報ページ(/about)用のOrganization。
// sameAs(SNS等)は現状アカウントが存在しないため含めない。
export function buildOrganizationJsonLd(siteUrl) {
  if (!siteUrl) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: siteUrl,
    logo: `${siteUrl}${LOGO_PATH}`,
    founder: buildAuthorPerson(siteUrl),
    member: buildAuthorPerson(siteUrl),
    address: {
      "@type": "PostalAddress",
      addressCountry: "JP",
      addressRegion: "東京都",
      addressLocality: "新宿区",
    },
  };
}

// 運営者情報ページ(/about)用のPerson。Organizationとは別エンティティとして
// 出力し、記事のauthorと同じ url(/about)で結びつける。
export function buildAboutPersonJsonLd(siteUrl) {
  if (!siteUrl) return null;
  return {
    "@context": "https://schema.org",
    ...buildAuthorPerson(siteUrl),
    worksFor: buildPublisherOrganization(siteUrl),
  };
}
