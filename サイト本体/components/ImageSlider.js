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
    <section className="hero-slider" aria-label="カテゴリ紹介スライド">
      <div className="container">
        <div className="hero-slider-viewport">
          <div
            className="hero-slider-track"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((slide, i) => (
              <Link key={slide.key} href={slide.href} className="hero-slider-slide">
                {/* 先頭スライドは初期表示範囲に入るため遅延読み込みにしない(LCP対策) */}
                <img
                  src={slide.image}
                  alt={slide.name}
                  loading={i === 0 ? undefined : "lazy"}
                  fetchPriority={i === 0 ? "high" : undefined}
                />
                <div className="hero-slider-caption">
                  <span className="hero-slider-category-name">{slide.name}</span>
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
            {slides.map((slide, i) => (
              <button
                key={slide.key}
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
