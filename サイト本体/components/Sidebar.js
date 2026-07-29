import Link from "next/link";

export default function Sidebar({ popularPosts = [], categories = [] }) {
  return (
    <aside className="home-sidebar">
      <div className="sidebar-widget">
        <h2 className="sidebar-widget-title">人気記事</h2>
        <ol className="sidebar-post-list">
          {popularPosts.map((post, i) => (
            <li key={post.slug} className="sidebar-post">
              <span className="sidebar-post-rank">{i + 1}</span>
              <Link href={`/posts/${post.slug}`} className="sidebar-post-link">
                {post.thumbnail && (
                  <img
                    src={post.thumbnail}
                    alt=""
                    loading="lazy"
                    className="sidebar-post-thumb"
                  />
                )}
                <span className="sidebar-post-title">{post.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      <div className="sidebar-widget">
        <h2 className="sidebar-widget-title">カテゴリ</h2>
        <ul className="sidebar-category-list">
          {categories.map((c) => (
            <li key={c.name}>
              <Link href={`/category/${encodeURIComponent(c.name)}`}>
                {c.name}
                <span className="sidebar-category-count">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* 広告枠(AdSense等)は審査通過・掲載準備が整い次第この位置に設置する */}
    </aside>
  );
}
