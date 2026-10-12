import { getAllPostsMeta, getAllCategories } from "./posts";
import { getWorryPageItems } from "./worryTopics";
import { getDiagnosisSlugs } from "./diagnosisTopics";

// sitemap.xml / robots.txt の中身を組み立てる。
// 以前は pages/sitemap.xml.js・pages/robots.txt.js の getServerSideProps(リクエスト時生成)だったが、
// 公開ページをすべて静的にするため、ビルド時に scripts/generate-seo-files.mjs が呼んで
// public/ に書き出す形に変えた(出力内容は同じ)。

function escapeXml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// <loc>には、サイト内リンク(next/link)が出力するのと同じ percent-encoded の
// URLを入れる。日本語スラッグを生のまま出力すると、サイト側が返すURLと一致せず
// Googleのクロールで404になる(2026-08-24に本番で全196記事が404だった原因)。
function urlEntry(loc, lastmod) {
  return `<url><loc>${escapeXml(loc)}</loc>${
    lastmod ? `<lastmod>${lastmod}</lastmod>` : ""
  }</url>`;
}

// カテゴリに属する記事のupdatedDate/dateのうち最も新しいものをlastmodとして使う
// (記事1件のlastmodと同じ考え方をカテゴリ単位に広げたもの)。該当記事が無い、
// または日付が1件も無い場合はundefined(lastmodタグ自体を出力しない)。
function latestDate(posts) {
  const dates = posts
    .map((p) => p.updatedDate || p.date)
    .filter(Boolean)
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (dates.length === 0) return undefined;
  const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
  return latest.toISOString().slice(0, 10);
}

export function buildSitemapXml(siteUrl) {
  const posts = getAllPostsMeta();
  const categories = getAllCategories();
  const worryItems = getWorryPageItems();
  // 診断・悩みページは、中身(lib/diagnosisTopics.js / lib/worryContent.js)が
  // 登録されたものだけを載せる。未登録の間はページ自体を生成していない。
  const diagnosisSlugs = getDiagnosisSlugs();
  // /compareは掲載中のアフィリエイトリンクを全記事から集約するページ(pages/compare.js参照)。
  // リンクが0件の間は中身のない空ページになるため、sitemapにも載せない(compare.js側のnoindexと連動)。
  const hasCompareItems = posts.some((p) => p.affiliateLinks.length > 0);

  const staticPaths = [
    "/",
    "/about",
    "/contact",
    "/privacy-policy",
    "/terms",
    ...(hasCompareItems ? ["/compare"] : []),
    "/ranking",
    "/search",
    ...diagnosisSlugs.map((slug) => `/diagnosis/${slug}`),
    "/category",
  ];

  const entries = [
    ...staticPaths.map((path) => urlEntry(`${siteUrl}${path}`)),
    ...categories.map((c) => {
      const categoryPosts = posts.filter((p) => p.category === c.name);
      return urlEntry(
        `${siteUrl}/category/${encodeURIComponent(c.name)}`,
        latestDate(categoryPosts)
      );
    }),
    ...posts.map((p) =>
      urlEntry(
        `${siteUrl}/posts/${encodeURIComponent(p.slug)}`,
        p.updatedDate || p.date || undefined
      )
    ),
    ...(worryItems.length > 0 ? [urlEntry(`${siteUrl}/worry`)] : []),
    ...worryItems.map((item) => {
      const worryPosts = posts.filter(
        (p) => Array.isArray(p.worry) && p.worry.includes(item.slug)
      );
      return urlEntry(
        `${siteUrl}/worry/${encodeURIComponent(item.slug)}`,
        latestDate(worryPosts)
      );
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join(
    ""
  )}</urlset>`;

  return xml;
}

export function buildRobotsTxt(siteUrl) {
  // ドメイン確定前の暫定公開ではサイト全体をクロール拒否にする。
  // components/Layout.js のnoindexメタと同じフラグで切り替わる。
  // 正式公開時にVercelの環境変数で NEXT_PUBLIC_ALLOW_INDEX=1 を設定すると解除される。
  const allowIndex = process.env.NEXT_PUBLIC_ALLOW_INDEX === "1";

  const body = allowIndex
    ? `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: ${siteUrl}/sitemap.xml
`
    : // 検索エンジンには拾わせないが、SNSのリンクプレビュー用クローラーだけは通す。
      // (これらもrobots.txtに従うため、全面Disallowにするとカード画像が出なくなる)
      `User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: Facebot
Allow: /

User-agent: Slackbot-LinkExpanding
Allow: /

User-agent: Discordbot
Allow: /

User-agent: LINE
Allow: /

User-agent: *
Disallow: /
`;

  return body;
}
