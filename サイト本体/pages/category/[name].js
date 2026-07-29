import Layout from "../../components/Layout";
import PostCard from "../../components/PostCard";
import { getAllCategories, getPostsByCategory } from "../../lib/posts";
import { getCategoryMeta } from "../../lib/categoryMeta";

export async function getStaticPaths() {
  const categories = getAllCategories();
  return {
    paths: categories.map((c) => ({ params: { name: c.name } })),
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }) {
  const posts = getPostsByCategory(params.name);
  const { description } = getCategoryMeta(params.name);
  return { props: { posts, category: params.name, description } };
}

function buildCategoryJsonLd(category, posts, siteUrl) {
  if (!siteUrl) return [];
  return [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "トップ", item: siteUrl },
        {
          "@type": "ListItem",
          position: 2,
          name: category,
          item: `${siteUrl}/category/${encodeURIComponent(category)}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: posts.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${siteUrl}/posts/${p.slug}`,
        name: p.title,
      })),
    },
  ];
}

export default function CategoryPage({ posts, category, description }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  return (
    <Layout
      title={`${category}の記事一覧 | 美容の総合ガイド｜NEVORA`}
      description={description}
      canonicalPath={`/category/${encodeURIComponent(category)}`}
      jsonLd={buildCategoryJsonLd(category, posts, siteUrl)}
    >
      <nav className="breadcrumb" aria-label="パンくずリスト">
        <a href="/">トップ</a>
        <span className="sep">/</span>
        <span className="current">{category}</span>
      </nav>
      <h1 className="page-title">カテゴリ: {category}</h1>
      {posts.length === 0 ? (
        <p>このカテゴリの記事はまだありません。</p>
      ) : (
        <div className="post-list">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </Layout>
  );
}
