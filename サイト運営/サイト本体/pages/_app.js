import { useEffect } from "react";
import { useRouter } from "next/router";
import Script from "next/script";
import "../styles/globals.css";
import { GA_MEASUREMENT_ID, isGAEnabled, pageview } from "../lib/gtag";

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    if (!isGAEnabled) return;

    const handleRouteChange = (url) => pageview(url);
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events]);

  return (
    <>
      {isGAEnabled && (
        <>
          {/* Google Analytics 4 (GA4) 計測タグ。
              NEXT_PUBLIC_GA_MEASUREMENT_ID が本番環境で設定されている場合のみ読み込む */}
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');
            `}
          </Script>
        </>
      )}
      <Component {...pageProps} />
    </>
  );
}
