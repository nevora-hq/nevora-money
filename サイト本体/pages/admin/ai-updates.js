import AdminLayout from "../../components/AdminLayout";

// 今後、project-manager等のエージェント実行ログをファイル/DBから読み込んで表示する想定のダミーデータ
const DUMMY_HISTORY = [
  {
    date: "2026-07-17",
    action: "記事公開",
    detail: "ダイエット中の食事管理で意識したい5つのポイント",
    agent: "publisher",
  },
  {
    date: "2026-07-16",
    action: "記事公開",
    detail: "初心者向け基礎化粧品の選び方完全ガイド",
    agent: "publisher",
  },
  {
    date: "2026-07-16",
    action: "トレンド調査",
    detail: "美容健康トレンド調査を実施",
    agent: "keyword-researcher",
  },
];

export default function AdminAiUpdates() {
  return (
    <AdminLayout title="AI自動更新">
      <div className="admin-card">
        <p style={{ color: "#888", fontSize: "0.85rem" }}>
          エージェント(project-manager配下の各エージェント)による更新履歴のダミー表示です。
          実運用では実行ログをデータベース等に保存し、この画面から実行状況の確認・再実行操作を行えるようにする想定です。
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>日付</th>
              <th>アクション</th>
              <th>内容</th>
              <th>実行エージェント</th>
            </tr>
          </thead>
          <tbody>
            {DUMMY_HISTORY.map((h, i) => (
              <tr key={i}>
                <td>{h.date}</td>
                <td>{h.action}</td>
                <td>{h.detail}</td>
                <td>{h.agent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
