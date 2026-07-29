import Layout from "../components/Layout";
import { getAllPostsMeta } from "../lib/posts";

export async function getStaticProps() {
  const posts = getAllPostsMeta();
  // 記事のaffiliateLinksを商品として集約し、比較表のダミーデータを構成する
  const items = [];
  for (const post of posts) {
    for (const link of post.affiliateLinks) {
      items.push({
        name: link.label,
        url: link.url,
        category: post.category,
        sourcePost: post.title,
        sourceSlug: post.slug,
      });
    }
  }
  return { props: { items } };
}

export default function ComparePage({ items }) {
  return (
    <Layout
      title="商品・サービス比較 | 美容の総合ガイド｜NEVORA"
      description="美容の総合ガイド｜NEVORAで紹介している商品・サービスを一覧で比較できるページです。"
      canonicalPath="/compare"
      panel
    >
      <h1 className="page-title">商品・サービス比較</h1>
      <p className="page-note">
        ※本ページはアフィリエイト広告(PR)を含みます。比較項目(価格・特徴等)は今後の記事追加に合わせて拡充予定です。
      </p>
      {items.length === 0 ? (
        <p>比較対象の商品・サービスがまだ登録されていません。</p>
      ) : (
        <table className="compare-table">
          <thead>
            <tr>
              <th>商品・サービス名</th>
              <th>カテゴリ</th>
              <th>紹介記事</th>
              <th>リンク</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.url}>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>
                  <a href={`/posts/${item.sourceSlug}`}>{item.sourcePost}</a>
                </td>
                <td>
                  <a href={item.url} target="_blank" rel="nofollow sponsored noopener noreferrer">
                    詳細を見る
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
}
