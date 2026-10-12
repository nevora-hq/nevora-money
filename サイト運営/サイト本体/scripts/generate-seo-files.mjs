/**
 * sitemap.xml / robots.txt をビルド時に public/ へ書き出す。
 * (以前は getServerSideProps でリクエスト時に生成していた。公開ページをすべて静的にするため変更)
 * next dev / next build の前に自動実行される(package.json の predev / prebuild を参照)。
 *
 * lib/ は拡張子なしの import を使う(Next.js のバンドラ前提)ため、素の Node で読めるよう
 * 解決フックで ".js" を補う。
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(
  "data:text/javascript," +
    encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (e) {
    if (specifier.startsWith(".") && !specifier.endsWith(".js")) {
      return next(specifier + ".js", context);
    }
    throw e;
  }
}`),
  import.meta.url
);

// ローカルでは Next.js が読む .env.local を、素の Node でも読む(既存の環境変数は上書きしない。Vercelでは不要)。
for (const f of [".env.local", ".env"]) {
  if (fs.existsSync(f)) process.loadEnvFile(f);
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!siteUrl) {
  // next.config.js が本番ビルドでは未設定をエラーにする。dev では生成しない。
  console.warn("[generate-seo-files] NEXT_PUBLIC_SITE_URL 未設定のため sitemap.xml / robots.txt を生成しません。");
  process.exit(0);
}

const { buildSitemapXml, buildRobotsTxt } = await import(
  pathToFileURL(path.join(process.cwd(), "lib", "seoFiles.js")).href
);

const publicDir = path.join(process.cwd(), "public");
fs.writeFileSync(path.join(publicDir, "sitemap.xml"), buildSitemapXml(siteUrl));
fs.writeFileSync(path.join(publicDir, "robots.txt"), buildRobotsTxt(siteUrl));
console.log("[generate-seo-files] public/sitemap.xml, public/robots.txt を生成しました");
