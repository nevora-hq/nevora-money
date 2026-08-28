import { useState } from "react";

// 記事ページ専用の目次(TOC)。lib/posts.js の addHeadingIdsAndBuildToc が
// 組み立てた見出し一覧([{ level, id, text }])から、本文中のH2/H3見出しへの
// アンカーリンク一覧を表示する。スマホでも読みやすいよう開閉トグル付き。
export default function ArticleToc({ items = [] }) {
  const [open, setOpen] = useState(true);

  // 見出しが少ない記事(1つ以下)では目次のメリットが薄いため表示しない
  if (items.length < 2) return null;

  return (
    <nav className="article-toc" aria-label="目次">
      <button
        type="button"
        className="article-toc-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>目次</span>
        <span className="article-toc-toggle-icon" aria-hidden="true">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <ol className="article-toc-list">
          {items.map((item) => (
            <li key={item.id} className={`article-toc-item level-${item.level}`}>
              <a href={`#${item.id}`}>{item.text}</a>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}
