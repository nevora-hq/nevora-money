import AdminLayout from "../../components/AdminLayout";
import { getAllPostsMeta } from "../../lib/posts";

export async function getStaticProps() {
  const posts = getAllPostsMeta();
  return {
    props: {
      posts: posts.map((p) => ({
        slug: p.slug,
        title: p.title,
        description: p.description,
        hasDescription: !!p.description,
      })),
    },
  };
}

export default function AdminSeo({ posts }) {
  return (
    <AdminLayout title="SEO管理">
      <div className="admin-card">
        <p style={{ color: "#888", fontSize: "0.85rem" }}>
          記事ごとのメタ情報(description)の設定状況です。構造化データ(JSON-LD)の自動出力は今後実装予定です。
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>記事タイトル</th>
              <th>meta description</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.slug}>
                <td>
                  <a href={`/posts/${post.slug}`}>{post.title}</a>
                </td>
                <td>{post.description || "(未設定)"}</td>
                <td>
                  <span className={`status-badge ${post.hasDescription ? "published" : "draft"}`}>
                    {post.hasDescription ? "設定済み" : "未設定"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
