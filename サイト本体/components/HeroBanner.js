export default function HeroBanner() {
  return (
    <section className="hero-banner">
      <img
        src="/images/hero/home-hero.webp"
        alt=""
        className="hero-banner-img"
        fetchPriority="high"
      />
      <div className="hero-banner-overlay">
        <div className="container hero-banner-inner">
          <p className="hero-banner-eyebrow">WEB MAGAZINE</p>
          <h1 className="hero-banner-title">お金・家計の総合ガイド｜NEVORA</h1>
          <p className="hero-banner-lead">
            家計管理・節約・ポイ活など信頼できるお金の情報をわかりやすく解説します。
          </p>
        </div>
      </div>
    </section>
  );
}
