import Layout from "../components/Layout";
import { getAllPostsMeta } from "../lib/posts";

export async function getStaticProps() {
  // 現時点ではアクセス数データがないため、新着順を「注目度ランキング」として暫定表示する。
  // 将来的にはアクセス解析(PV)データを基準にソートする想定(README参照)。
  const posts = getAllPostsMeta().slice(0, 10);
  return { props: { posts } };
}

export default function RankingPage({ posts }) {
  return (
    <Layout
      title="人気記事ランキング | 美容の総合ガイド｜NEVORA"
      description="美容の総合ガイド｜NEVORAのおすすめ記事ランキングです。"
      canonicalPath="/ranking"
      panel
    >
      <h1 className="page-title">おすすめ記事ランキング</h1>
      <p className="page-note">
        ※現在はアクセス解析データの蓄積前のため、新着順で暫定表示しています。
      </p>
      <ol className="ranking-list">
        {posts.map((post, i) => (
          <li key={post.slug} className="ranking-item">
            <span className="rank-number">{i + 1}</span>
            {post.thumbnail && (
              <a href={`/posts/${post.slug}`} className="ranking-thumb-link">
                <img src={post.thumbnail} alt="" loading="lazy" className="ranking-thumb" />
              </a>
            )}
            <div>
              <h2>
                <a href={`/posts/${post.slug}`}>{post.title}</a>
              </h2>
            </div>
          </li>
        ))}
      </ol>
    </Layout>
  );
}
