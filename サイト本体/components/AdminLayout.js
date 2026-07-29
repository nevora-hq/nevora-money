import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

const NAV_ITEMS = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/articles", label: "記事管理" },
  { href: "/admin/ads", label: "広告管理" },
  { href: "/admin/analytics", label: "アクセス解析" },
  { href: "/admin/seo", label: "SEO管理" },
  { href: "/admin/ai-updates", label: "AI自動更新" },
];

export default function AdminLayout({ children, title = "管理者ダッシュボード" }) {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>{title} | 管理者ダッシュボード</title>
        {/* 管理画面は検索結果に出す必要がないため、常にクロール対象外にする */}
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div style={{ padding: "0 24px 20px", fontWeight: "bold" }}>
            管理者ダッシュボード
          </div>
          <nav>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={router.pathname === item.href ? "active" : ""}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div style={{ padding: "20px 24px 0" }}>
            <Link href="/">← サイトに戻る</Link>
          </div>
        </aside>
        <main className="admin-main">
          <h1 className="page-title">{title}</h1>
          {children}
        </main>
      </div>
    </>
  );
}
