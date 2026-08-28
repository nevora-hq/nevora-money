import AdminLayout from "../../components/AdminLayout";
import { GA_MEASUREMENT_ID } from "../../lib/gtag";

export default function AdminAnalytics() {
  return (
    <AdminLayout title="アクセス解析">
      <div className="admin-card">
        <p>
          Google Analytics 4(GA4)の計測タグは導入済みです(環境変数 NEXT_PUBLIC_GA_MEASUREMENT_ID は
          {GA_MEASUREMENT_ID ? "設定済み" : "未設定です。.envに測定IDを設定してください"}
          )。PV・検索順位・CTR等をこの管理画面上に可視化する機能は未実装です(ダミー画面)。今後、
          GA4 / Search Console 等の外部データ連携、またはデータベースへのアクセスログ保存を検討します。
        </p>
        <div className="admin-grid">
          <div className="admin-card">
            <div>PV(今月)</div>
            <div className="stat-number">-</div>
          </div>
          <div className="admin-card">
            <div>平均検索順位</div>
            <div className="stat-number">-</div>
          </div>
          <div className="admin-card">
            <div>アフィリエイトCTR</div>
            <div className="stat-number">-</div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
