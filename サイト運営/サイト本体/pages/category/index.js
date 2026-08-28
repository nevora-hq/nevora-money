import Link from "next/link";
import Layout from "../../components/Layout";
import { MAJOR_CATEGORIES, getCategoryMeta } from "../../lib/categoryMeta";
import { buildBreadcrumbJsonLd, buildItemListJsonLd } from "../../lib/structuredData";

// トップページの「カテゴリで探す」セクションでJSが無効な環境向けの
// フォールバック遷移先を兼ねる、全カテゴリの一覧ページ(2026-08-10新設)。
export async function getStaticProps() {
  const categories = MAJOR_CATEGORIES.map((name) => ({
    name,
    ...getCategoryMeta(name),
  }));
  return { props: { categories } };
}

function buildCategoryIndexJsonLd(categories, siteUrl) {
  if (!siteUrl) return [];
  const breadcrumb = buildBreadcrumbJsonLd(siteUrl, [
    { name: "トップ", url: siteUrl },
    { name: "カテゴリ一覧", url: `${siteUrl}/category` },
  ]);
  const itemList = buildItemListJsonLd(
    categories.map((c) => ({
      name: c.name,
      url: `${siteUrl}/category/${encodeURIComponent(c.name)}`,
    }))
  );
  return [breadcrumb, itemList].filter(Boolean);
}

export default function CategoryIndexPage({ categories }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  return (
    <Layout
      title="カテゴリ一覧 | お金の総合ガイド｜NEVORA"
      description="お金の総合ガイド｜NEVORAの記事カテゴリ一覧です。気になるテーマから記事をまとめてチェックできます。"
      canonicalPath="/category"
      jsonLd={buildCategoryIndexJsonLd(categories, siteUrl)}
    >
      <h1 className="page-title">カテゴリ一覧</h1>
      <p className="home-section-lead">気になるテーマから、関連記事をまとめてチェックできます。</p>
      <ul className="category-index-list">
        {categories.map((cat) => (
          <li key={cat.name} className="category-index-item">
            <Link href={`/category/${encodeURIComponent(cat.name)}`} className="category-index-link">
              <span className="category-index-icon" aria-hidden="true">
                {cat.icon}
              </span>
              <span className="category-index-body">
                <span className="category-index-name">{cat.name}</span>
                <span className="category-index-summary">{cat.shortSummary}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Layout>
  );
}
