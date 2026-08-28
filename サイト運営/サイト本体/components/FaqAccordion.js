// lib/posts.js の renderAccordionHtml(記事Markdown用)と同一のDOM構造をJSXで再現。
// ネイティブ <details>/<summary> のみで開閉するため状態管理は持たない。
// globals.css の .article-accordion 系クラス(既存)がそのまま効く。
export default function FaqAccordion({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <>
      {items.map((item, i) => (
        <details key={i} className="article-accordion">
          <summary className="article-accordion-summary">{item.question}</summary>
          <div className="article-accordion-body">
            <p>{item.answer}</p>
          </div>
        </details>
      ))}
    </>
  );
}
