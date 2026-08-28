import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function ImageSlider({ slides = [] }) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  const count = slides.length;

  useEffect(() => {
    if (count <= 1) return undefined;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, 4500);
    return () => clearInterval(timerRef.current);
  }, [count]);

  if (count === 0) return null;

  const goTo = (i) => {
    clearInterval(timerRef.current);
    setIndex((i + count) % count);
  };

  return (
    <section className="hero-slider" aria-label="注目記事スライド">
      {/* トップページ専用のため、本文コンテナと同じ1180px幅に揃える */}
      <div className="container container--wide">
        <div className="hero-slider-viewport">
          <div
            className="hero-slider-track"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((slide, i) => (
              <Link
                key={slide.key || slide.slug}
                href={slide.href || `/posts/${slide.slug}`}
                className="hero-slider-slide"
              >
                {/* 先頭スライドは初期表示範囲に入るため遅延読み込みにしない(LCP対策) */}
                <img
                  src={slide.thumbnail}
                  alt={slide.title}
                  loading={i === 0 ? undefined : "lazy"}
                  fetchPriority={i === 0 ? "high" : undefined}
                />
                <div className="hero-slider-caption">
                  <span className="hero-slider-caption-name">{slide.category || slide.title}</span>
                </div>
              </Link>
            ))}
          </div>

          {count > 1 && (
            <>
              <button
                type="button"
                className="hero-slider-arrow hero-slider-arrow-prev"
                aria-label="前のスライド"
                onClick={() => goTo(index - 1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="hero-slider-arrow hero-slider-arrow-next"
                aria-label="次のスライド"
                onClick={() => goTo(index + 1)}
              >
                ›
              </button>
            </>
          )}
        </div>

        {count > 1 && (
          <div className="hero-slider-dots">
            {slides.map((post, i) => (
              <button
                key={post.slug}
                type="button"
                className={`hero-slider-dot${i === index ? " active" : ""}`}
                aria-label={`${i + 1}枚目を表示`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
