// トップページのファーストビュー(雑誌型 full-bleedヒーロー)。
// 画像はLayoutの外側(container外)に描画されるため、CSSを足さなくても画面幅いっぱいに広がる。
// LCP対策として pages/index.js 側で同じURLを rel="preload" しており、
// ここでは lazy を付けず fetchPriority="high" で即時読み込みさせる。
export default function HeroBanner({ hasImage = true }) {
  return (
    <section className={`hero-banner${hasImage ? "" : " hero-banner--no-image"}`}>
      {/* srcsetの各幅は scripts/generate-site-images.js で生成する。
          full-bleed(画面幅いっぱい)のため sizes は 100vw。
          素材差し替え中で実ファイルが無い間は hasImage=false で描画しない。 */}
      {hasImage && (
        <img
          src="/images/hero/home-hero.webp"
          srcSet="/images/hero/home-hero-640.webp 640w, /images/hero/home-hero-1024.webp 1024w, /images/hero/home-hero-1600.webp 1600w"
          sizes="100vw"
          alt=""
          className="hero-banner-img"
          fetchPriority="high"
          decoding="async"
        />
      )}
      {/* 暖色ウォッシュ→スクリムの順で重ねる(CSSのレイヤー構成コメント参照) */}
      <div className="hero-banner-warm" aria-hidden="true" />
      <div className="hero-banner-scrim" aria-hidden="true" />
      <div className="hero-banner-overlay">
        <div className="hero-banner-inner">
          <div className="hero-banner-copy">
            <p className="hero-banner-eyebrow">WEB MAGAZINE</p>
            <h1 className="hero-banner-title">お金の総合ガイド｜NEVORA</h1>
            <p className="hero-banner-lead">
              お金の悩みや疑問に、信頼できる情報で寄り添う総合ガイド
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
