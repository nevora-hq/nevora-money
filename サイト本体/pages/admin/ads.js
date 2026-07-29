import AdminLayout from "../../components/AdminLayout";
import { getAllPostsMeta } from "../../lib/posts";

export async function getStaticProps() {
  const posts = getAllPostsMeta();
  const links = [];
  for (const post of posts) {
    for (const link of post.affiliateLinks) {
      links.push({ ...link, postTitle: post.title, slug: post.slug });
    }
  }
  return { props: { links } };
}

export default function AdminAds({ links }) {
  return (
    <AdminLayout title="広告管理">
      <div className="admin-card">
        <p style={{ color: "#888", fontSize: "0.85rem" }}>
          各記事のfrontmatter(affiliateLinks)に登録されたアフィリエイトリンクの一覧です。
          広告枠(バナー等)の管理機能は今後追加予定です。
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>商品・サービス名</th>
              <th>リンク先</th>
              <th>掲載記事</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.url}>
                <td>{link.label}</td>
                <td>
                  <a href={link.url} target="_blank" rel="nofollow sponsored noopener noreferrer">
                    {link.url}
                  </a>
                </td>
                <td>
                  <a href={`/posts/${link.slug}`}>{link.postTitle}</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
