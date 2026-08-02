import { MAIN_MASCOT } from "../lib/categoryMascot";

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
          <h1 className="hero-banner-title">お金の総合ガイド｜NEVORA</h1>
          <p className="hero-banner-lead">
            家計管理・節約・ポイ活など信頼できるお金の情報をわかりやすく解説します。
          </p>
        </div>
        <img
          src={MAIN_MASCOT.welcomeImage}
          alt={MAIN_MASCOT.name}
          className="hero-banner-mascot"
          width="150"
          height="150"
          loading="eager"
        />
      </div>
    </section>
  );
}
