import AdminLayout from "../../components/AdminLayout";
import { getAllPostsMeta } from "../../lib/posts";

export async function getStaticProps() {
  const posts = getAllPostsMeta();
  return { props: { posts } };
}

export default function AdminArticles({ posts }) {
  return (
    <AdminLayout title="記事管理">
      <div className="admin-card">
        <p style={{ color: "#888", fontSize: "0.85rem" }}>
          記事データは Markdown(サイト運営/記事データ/確定稿)を元に自動生成されています。
          公開・非公開の切替や編集は、現時点ではMarkdownファイル側(ライター・編集長・配信者の作業)で行います。
          将来データベース化した際に、この画面から直接操作できるようにする予定です。
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>タイトル</th>
              <th>カテゴリ</th>
              <th>タグ</th>
              <th>公開日</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.slug}>
                <td>
                  <a href={`/posts/${post.slug}`}>{post.title}</a>
                </td>
                <td>{post.category}</td>
                <td>{post.tags.join(", ")}</td>
                <td>{post.date || "-"}</td>
                <td>
                  <span className="status-badge published">公開中</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
