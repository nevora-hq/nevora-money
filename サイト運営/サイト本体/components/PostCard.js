import Link from "next/link";
import { motion } from "motion/react";
import { useFadeInProps } from "./FadeInCard";

// motion.create() はレンダーごとに呼ぶと再マウントされるため、モジュール
// スコープで1度だけラップする。
const MotionLink = motion.create(Link);

const EXCERPT_MAX_LENGTH = 110;

// 一覧性を保つため、カード表示直前にのみ抜粋を切り詰める。
// post.excerpt自体(検索インデックスと共有)は変更しない。
function truncateExcerpt(text) {
  if (!text) return "";
  if (text.length <= EXCERPT_MAX_LENGTH) return text;
  return `${text.slice(0, EXCERPT_MAX_LENGTH)}…`;
}

// simple=true の場合、サムネイル・カテゴリ・タイトルのみのシンプルなカードにする
// (ホームの新着記事・注目記事向け)。カード全体を1つのリンクにするため、
// 通常版のように内部で個別にLinkを分けない。
// animate=false は横スクロールのカルーセル内など、スクロール連動の
// フェードインが噛み合わない場所で使う。
export default function PostCard({ post, simple = false, index = 0, animate = true }) {
  const fade = useFadeInProps(index, { enabled: animate });

  if (simple) {
    const SimpleTag = fade ? MotionLink : Link;
    return (
      <SimpleTag
        {...fade}
        href={`/posts/${post.slug}`}
        className="post-card post-card--simple"
      >
        <span className="post-card-thumb-link">
          {post.thumbnail ? (
            <img
              src={post.thumbnail}
              alt=""
              loading="lazy"
              className="post-card-thumb"
            />
          ) : (
            <span className="post-card-thumb post-card-thumb-fallback" aria-hidden="true">
              📖
            </span>
          )}
        </span>
        <span className="post-card-body">
          <span className="category-badge">{post.category}</span>
          <span className="post-card-title">{post.title}</span>
        </span>
      </SimpleTag>
    );
  }

  const Tag = fade ? motion.div : "div";

  return (
    <Tag {...fade} className="post-card">
      <Link href={`/posts/${post.slug}`} className="post-card-thumb-link">
        {post.thumbnail ? (
          <img
            src={post.thumbnail}
            alt=""
            loading="lazy"
            className="post-card-thumb"
          />
        ) : (
          <span className="post-card-thumb post-card-thumb-fallback" aria-hidden="true">
            📖
          </span>
        )}
      </Link>
      <div className="post-card-body">
        <span className="category-badge">{post.category}</span>
        <h2>
          <Link href={`/posts/${post.slug}`}>{post.title}</Link>
        </h2>
        <p className="excerpt">{truncateExcerpt(post.excerpt)}</p>
      </div>
    </Tag>
  );
}
