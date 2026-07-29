import Link from "next/link";

export default function PostCard({ post }) {
  return (
    <div className="post-card">
      {post.thumbnail && (
        <Link href={`/posts/${post.slug}`} className="post-card-thumb-link">
          <img
            src={post.thumbnail}
            alt={post.title}
            loading="lazy"
            className="post-card-thumb"
          />
        </Link>
      )}
      <div className="post-card-body">
        <span className="category-badge">{post.category}</span>
        <h2>
          <Link href={`/posts/${post.slug}`}>{post.title}</Link>
        </h2>
        <p className="excerpt">{post.excerpt}</p>
        {post.tags?.length > 0 && (
          <p className="tags">{post.tags.map((t) => `#${t}`).join(" ")}</p>
        )}
      </div>
    </div>
  );
}
