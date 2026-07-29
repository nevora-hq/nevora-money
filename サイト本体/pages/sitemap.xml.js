import { getAllPostsMeta, getAllCategories } from "../lib/posts";

// next/imageのような組み込みのsitemap機能がないPages Routerのため、
// リクエスト時にXMLを組み立てて返す動的ページとして実装する。
// NEXT_PUBLIC_SITE_URL未設定時は、リクエストのホスト名から絶対URLを補う
// (プレビュー環境・本番環境のどちらでも正しいドメインのsitemapを返すため)。
function resolveSiteUrl(req) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

function escapeXml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function urlEntry(loc, lastmod) {
  return `<url><loc>${escapeXml(loc)}</loc>${
    lastmod ? `<lastmod>${lastmod}</lastmod>` : ""
  }</url>`;
}

export async function getServerSideProps({ req, res }) {
  const siteUrl = resolveSiteUrl(req);
  const posts = getAllPostsMeta();
  const categories = getAllCategories();

  const staticPaths = ["/", "/about", "/contact", "/privacy-policy", "/terms", "/compare", "/ranking", "/search"];

  const entries = [
    ...staticPaths.map((path) => urlEntry(`${siteUrl}${path}`)),
    ...categories.map((c) =>
      urlEntry(`${siteUrl}/category/${encodeURIComponent(c.name)}`)
    ),
    ...posts.map((p) =>
      urlEntry(`${siteUrl}/posts/${p.slug}`, p.updatedDate || p.date || undefined)
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join(
    ""
  )}</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.write(xml);
  res.end();

  return { props: {} };
}

export default function Sitemap() {
  return null;
}
