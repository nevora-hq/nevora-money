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
            株式・不動産・FX・税金・保険——判断に役立つお金の知識を、正確に、わかりやすく。
          </p>
        </div>
        <div className="hero-banner-mascot-wrap">
          <img
            src={MAIN_MASCOT.welcomeImage}
            alt={MAIN_MASCOT.name}
            className="hero-banner-mascot"
            width="150"
            height="150"
            loading="eager"
          />
        </div>
      </div>
    </section>
  );
}
