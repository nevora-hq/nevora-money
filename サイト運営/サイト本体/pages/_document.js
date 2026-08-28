import { Html, Head, Main, NextScript } from "next/document";

// Google Search Console(GSC)の所有権確認用metaタグ。
// 環境変数 NEXT_PUBLIC_GSC_VERIFICATION が設定されている場合のみ出力する。
// (HTMLファイルによる確認方式を使う場合は、確認用ファイルを public/ 直下に置くだけでよい)
const GSC_VERIFICATION = process.env.NEXT_PUBLIC_GSC_VERIFICATION || "";

// Google AdSenseの所有権確認・広告配信用コード。
// 環境変数 NEXT_PUBLIC_ADSENSE_CLIENT が設定されている場合のみ出力する。
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";

export default function Document() {
  return (
    <Html lang="ja">
      <Head>
        {/* ファビコン/アプリアイコンは2026-08-23に公式マスコット(ネヴォミン)の
            デザインへ差し替え。旧SVG(/images/favicon.svg)はSVG対応ブラウザで
            PNGより優先されてしまい新デザインが出ないため、リンクを外している。 */}
        {/* 高級感のあるトーンへ振るためのWebフォント(2026-08-27, design-luxury)。
            見出し=明朝(Shippori Mincho)/本文=Zen Kaku Gothic New。
            display=swapでFOITを避け、未読込時は従来のヒラギノ系にフォールバックする。 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap"
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16" />
        <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
        <link rel="icon" href="/icon-512.png" type="image/png" sizes="512x512" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {GSC_VERIFICATION && (
          <meta name="google-site-verification" content={GSC_VERIFICATION} />
        )}
        {/* Pinterestのドメイン認証用metaタグ(2026-08-27) */}
        <meta name="p:domain_verify" content="31b8c990221468291bec6b83972b47f6" />
        {ADSENSE_CLIENT && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
        {/* スクロール連動のフェードインはSSR時にopacity:0で出力されるため、
            JS無効環境ではカードが見えなくなる。noscript時のみ打ち消す。 */}
        <noscript>
          <style>{`.post-card,.category-summary-card{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
