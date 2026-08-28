const { PHASE_PRODUCTION_BUILD } = require("next/constants");

// 統合・非公開化した記事の旧URL → 統合先の恒久リダイレクト(301)。
// 記事を「記事データ/非公開アーカイブ」へ移すと、そのslugはgetStaticPathsから
// 消えて404になるため、検索エンジンとブックマークの受け皿としてここに定義する。
// アーカイブした記事を復活させる場合は、先に該当の定義を削除すること。
// 日本語スラッグはブラウザ・クローラーからは percent-encoded で届くため、
// sourceも同じくエンコード済みで書く(生の日本語のままではマッチせず404になる)。
// destinationはNext.jsがLocationヘッダーへ出力する際にエンコードするため生のままでよい。
const ARTICLE_REDIRECTS = [
  {
    // 2026-08-25 統合: 「ドライヤーの当て方でパサつきは変わる」と検索意図が同一だったため
    // source: /posts/2026-08-25_ドライヤーは根もとから乾かす
    source:
      "/posts/2026-08-25_%E3%83%89%E3%83%A9%E3%82%A4%E3%83%A4%E3%83%BC%E3%81%AF%E6%A0%B9%E3%82%82%E3%81%A8%E3%81%8B%E3%82%89%E4%B9%BE%E3%81%8B%E3%81%99",
    destination: "/posts/2026-08-09_ドライヤーの当て方でパサつきは変わる",
    // permanent: true は308を返すため、301を明示指定する(statusCodeとpermanentは併用不可)。
    statusCode: 301,
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return ARTICLE_REDIRECTS;
  },
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
