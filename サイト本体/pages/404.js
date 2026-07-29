import Layout from "../components/Layout";
import Link from "next/link";
import { getAllCategories, getAllPostsMeta } from "../lib/posts";

export async function getStaticProps() {
  const categories = getAllCategories();
  const popularPosts = getAllPostsMeta().slice(0, 5);
  return { props: { categories, popularPosts } };
}

export default function NotFound({ categories = [], popularPosts = [] }) {
  return (
    <Layout
      title="ページが見つかりません | 美容の総合ガイド｜NEVORA"
      description="お探しのページが見つかりませんでした。トップページやカテゴリ一覧、記事検索から目的のページをお探しください。"
      noindex
      panel
    >
      <div className="not-found">
        <p className="not-found-code">404</p>
        <p>
          お探しのページは見つかりませんでした。URLが変更・削除されたか、入力に誤りがある可能性があります。
        </p>
        <p>
          <Link href="/">トップページ</Link>に戻るか、以下からお探しの記事をご覧ください。
        </p>

        {categories.length > 0 && (
          <div className="not-found-section">
            <h2>カテゴリから探す</h2>
            <ul className="not-found-link-list">
              {categories.map((c) => (
                <li key={c.name}>
                  <Link href={`/category/${encodeURIComponent(c.name)}`}>{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {popularPosts.length > 0 && (
          <div className="not-found-section">
            <h2>よく読まれている記事</h2>
            <ul className="not-found-link-list">
              {popularPosts.map((p) => (
                <li key={p.slug}>
                  <Link href={`/posts/${p.slug}`}>{p.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p>
          <Link href="/search">記事を検索する</Link>
        </p>
      </div>
    </Layout>
  );
}
