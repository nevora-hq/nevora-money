const { PHASE_PRODUCTION_BUILD } = require("next/constants");

// 統合・非公開化した記事の旧URL → 統合先の恒久リダイレクト(301)は、
// 完全静的エクスポート(output: "export")では redirects() が使えないため vercel.json に移した。
// 記事を復活させる場合は、先に vercel.json の該当の定義を削除すること。

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 公開ページをすべて静的ファイルにして、VercelのFunctionを出さない(out/ に書き出す)。
  output: "export",
};

// NEXT_PUBLIC_SITE_URL未設定時、components/Layout.jsはcanonical/OGPタグを
// 丸ごと出力しないフェイルセーフ設計になっている(安全側だが検知されにくい)。
// ビルド時点で気づけるよう、`next build`(本番ビルド)では未設定をエラーにし、
// `next dev`では警告のみに留める。
module.exports = (phase) => {
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    const message =
      "[next.config.js] NEXT_PUBLIC_SITE_URL が未設定です。canonical/OGP(components/Layout.js)が出力されなくなります。";
    if (phase === PHASE_PRODUCTION_BUILD) {
      throw new Error(message);
    }
    console.warn(message);
  }
  return nextConfig;
};
