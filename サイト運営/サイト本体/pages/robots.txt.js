function resolveSiteUrl(req) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

export async function getServerSideProps({ req, res }) {
  const siteUrl = resolveSiteUrl(req);

  // サイト全体のnoindexスイッチ(components/Layout.jsのmetaタグと連動)。
  // NEXT_PUBLIC_NOINDEX=1 の間はクロール自体を禁止し、sitemapも案内しない。
  const noindex = process.env.NEXT_PUBLIC_NOINDEX === "1";

  const body = noindex
    ? `User-agent: *
Disallow: /
`
    : `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: ${siteUrl}/sitemap.xml
`;

  res.setHeader("Content-Type", "text/plain");
  res.write(body);
  res.end();

  return { props: {} };
}

export default function Robots() {
  return null;
}
