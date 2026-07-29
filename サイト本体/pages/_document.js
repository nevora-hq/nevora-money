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
        {GSC_VERIFICATION && (
          <meta name="google-site-verification" content={GSC_VERIFICATION} />
        )}
        {ADSENSE_CLIENT && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
