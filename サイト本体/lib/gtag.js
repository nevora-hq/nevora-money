// Google Analytics 4 (GA4) 用のヘルパー
// 計測IDは環境変数 NEXT_PUBLIC_GA_MEASUREMENT_ID から取得する。
// 未設定の場合は空文字を返し、呼び出し側でスクリプトを読み込まない。

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

// 本番環境かつ計測IDが設定されている場合のみ有効にする
// (開発環境で余計なページビューが計測されるのを防ぐ)
export const isGAEnabled =
  typeof GA_MEASUREMENT_ID === "string" &&
  GA_MEASUREMENT_ID.length > 0 &&
  process.env.NODE_ENV === "production";

// ページ遷移時にページビューを送信する(App Routerではなくpages routerのため
// _app.js のルーター遷移イベントから呼び出す)
export const pageview = (url) => {
  if (!isGAEnabled || typeof window === "undefined" || !window.gtag) return;
  window.gtag("config", GA_MEASUREMENT_ID, {
    page_path: url,
  });
};
