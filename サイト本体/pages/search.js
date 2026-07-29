import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import PostCard from "../components/PostCard";
import { getAllPostsForSearch } from "../lib/posts";

export async function getStaticProps() {
  // 検索ページのみ、本文全文(body)を含む記事一覧を使う(タイトル・抜粋・
  // カテゴリ・タグだけでなく本文も検索対象にするため)。他ページは
  // getAllPostsMeta を使い続け、propsの肥大化を避ける。
  const posts = getAllPostsForSearch();
  return { props: { posts } };
}

// キーワードとの関連度を単純なスコアリングで算出する。タイトル一致を最も
// 重視し、タグ・カテゴリ・本文の順に重みを下げる。記事数が少ない小規模サイト
// 向けの簡易実装であり、専用の検索エンジン導入等は行わない。
function scorePost(post, query) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const title = (post.title || "").toLowerCase();
  const category = (post.category || "").toLowerCase();
  const tags = (post.tags || []).map((t) => String(t).toLowerCase());
  const body = (post.body || post.excerpt || "").toLowerCase();

  let score = 0;

  if (title === q) score += 100;
  else if (title.startsWith(q)) score += 60;
  else if (title.includes(q)) score += 40;

  if (tags.some((t) => t === q)) score += 25;
  else if (tags.some((t) => t.includes(q))) score += 15;

  if (category.includes(q)) score += 10;

  if (body.includes(q)) {
    // 本文中の出現回数に応じて少し加点する(あまり重くしすぎない)
    const occurrences = body.split(q).length - 1;
    score += Math.min(occurrences, 5) * 2;
  }

  return score;
}

export default function SearchPage({ posts }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  // Layoutで申告しているWebSiteのSearchAction(?q=キーワード)経由の遷移に対応するため、
  // URLクエリがあれば初期検索語として反映する(サイトリンク検索ボックス対応)。
  useEffect(() => {
    if (typeof router.query.q === "string") {
      setQuery(router.query.q);
    }
  }, [router.query.q]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return posts;
    // スコアが高い順(関連度順)に並べ替える。Array.sortは安定ソートのため、
    // 同スコアの記事はもとの新着順(getAllPostsForSearchの並び)が保たれる。
    return posts
      .map((post) => ({ post, score: scorePost(post, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.post);
  }, [query, posts]);

  return (
    <Layout
      title="記事検索 | 美容の総合ガイド｜NEVORA"
      description="美容の総合ガイド｜NEVORAの記事をキーワードで検索できます。"
      canonicalPath="/search"
      panel
    >
      <h1 className="page-title">記事を検索</h1>
      <div className="search-box">
        <input
          type="text"
          placeholder="キーワードを入力(タイトル・タグ等)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <p className="result-count">{results.length}件見つかりました</p>
      <div className="post-list">
        {results.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </Layout>
  );
}
