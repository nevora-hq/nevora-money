import { useRef } from "react";
import PostCard from "./PostCard";

// 新着記事の横スクロールカルーセル(2026-08-10、A1/A3対応)。
// ネイティブのCSS overflow-x横スクロールを土台にしているため、
// JSが無効でもタッチ・トラックパッド・スクロールバーで操作でき、
// 各記事カードのリンクは初期HTMLに常に存在する(JS依存なし)。
// 矢印ボタンはPCでの操作性向上のための追加エンハンスメントで、
// クリック時にscrollByを呼ぶだけなのでJS無効時は単に表示されるだけになる。
export default function NewPostsCarousel({ posts }) {
  const trackRef = useRef(null);

  if (!Array.isArray(posts) || posts.length === 0) return null;

  const scrollByAmount = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector(".post-card--simple");
    const step = card ? card.getBoundingClientRect().width + 16 : track.clientWidth * 0.8;
    track.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  return (
    <div className="new-posts-carousel">
      <div className="new-posts-carousel-track" ref={trackRef}>
        {posts.map((post) => (
          <div className="new-posts-carousel-item" key={post.slug}>
            <PostCard post={post} simple animate={false} />
          </div>
        ))}
      </div>

      {posts.length > 1 && (
        <>
          <button
            type="button"
            className="new-posts-carousel-arrow new-posts-carousel-arrow-prev"
            aria-label="前の新着記事"
            onClick={() => scrollByAmount(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="new-posts-carousel-arrow new-posts-carousel-arrow-next"
            aria-label="次の新着記事"
            onClick={() => scrollByAmount(1)}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
