import AdminLayout from "../../components/AdminLayout";
import { getAllPostsMeta, getAllCategories } from "../../lib/posts";

export async function getStaticProps() {
  const posts = getAllPostsMeta();
  const categories = getAllCategories();
  return {
    props: {
      postCount: posts.length,
      categoryCount: categories.length,
      totalAffiliateLinks: posts.reduce((sum, p) => sum + p.affiliateLinks.length, 0),
    },
  };
}

export default function AdminHome({ postCount, categoryCount, totalAffiliateLinks }) {
  return (
    <AdminLayout title="ダッシュボード">
      <div className="admin-grid">
        <div className="admin-card">
          <div>公開記事数</div>
          <div className="stat-number">{postCount}</div>
        </div>
        <div className="admin-card">
          <div>カテゴリ数</div>
          <div className="stat-number">{categoryCount}</div>
        </div>
        <div className="admin-card">
          <div>アフィリエイトリンク数</div>
          <div className="stat-number">{totalAffiliateLinks}</div>
        </div>
        <div className="admin-card">
          <div>PV(直近30日)</div>
          <div className="stat-number">-</div>
          <small style={{ color: "#888" }}>アクセス解析未連携</small>
        </div>
      </div>

      <div className="admin-card">
        <h3>お知らせ</h3>
        <p>
          このダッシュボードは骨組み段階です。記事管理・広告管理・アクセス解析・SEO管理・AI自動更新の各ページから、
          今後データベース連携やAPI連携を追加していく予定です。
        </p>
      </div>
    </AdminLayout>
  );
}
