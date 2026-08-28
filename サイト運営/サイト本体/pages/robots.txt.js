function resolveSiteUrl(req) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

export async function getServerSideProps({ req, res }) {
  const siteUrl = resolveSiteUrl(req);

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

  res.setHeader("Content-Type", "text/plain");
  res.write(body);
  res.end();

  return { props: {} };
}

export default function Robots() {
  return null;
}
