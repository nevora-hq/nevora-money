import { useEffect, useRef } from "react";

// 記事ページ専用のスクロール進捗バー。ヘッダー(sticky)直下に固定表示し、
// ページ全体に対する現在のスクロール位置を細いバーの幅で示す。
// 頻繁に発火するscrollイベントのたびにReactの再レンダリングを起こさないよう、
// stateではなくrefで直接DOMのstyle.widthを書き換える。
export default function ScrollProgressBar() {
  const barRef = useRef(null);

  useEffect(() => {
    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress =
        docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0;
      if (barRef.current) {
        barRef.current.style.width = `${progress}%`;
      }
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  return (
    <div className="article-scroll-progress" aria-hidden="true">
      <div className="article-scroll-progress-bar" ref={barRef} />
    </div>
  );
}
