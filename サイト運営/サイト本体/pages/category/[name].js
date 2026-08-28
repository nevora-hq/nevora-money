import Layout from "../../components/Layout";
import PostCard from "../../components/PostCard";
import { getAllCategories, getPostsByCategory } from "../../lib/posts";
import MascotComment from "../../components/MascotComment";
import { getCategoryMeta } from "../../lib/categoryMeta";
import { getCategoryMascot, getMascotIntroComment } from "../../lib/categoryMascot";
import { buildBreadcrumbJsonLd, buildItemListJsonLd } from "../../lib/structuredData";

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
  const mascot = getCategoryMascot(params.name);
  const mascotComment = mascot ? getMascotIntroComment(mascot, params.name) : "";
  return { props: { posts, category: params.name, description, mascot, mascotComment } };
}

function buildCategoryJsonLd(category, posts, siteUrl) {
  if (!siteUrl) return [];
  const breadcrumb = buildBreadcrumbJsonLd(siteUrl, [
    { name: "トップ", url: siteUrl },
    { name: category, url: `${siteUrl}/category/${encodeURIComponent(category)}` },
  ]);
  const itemList = buildItemListJsonLd(
    posts.map((p) => ({ name: p.title, url: `${siteUrl}/posts/${p.slug}` }))
  );
  return [breadcrumb, itemList].filter(Boolean);
}

export default function CategoryPage({ posts, category, description, mascot, mascotComment }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  return (
    <Layout
      title={`${category}の記事一覧 | お金の総合ガイド｜NEVORA`}
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
      <p className="page-note">{description}</p>
      <MascotComment mascot={mascot} comment={mascotComment} />
      {posts.length === 0 ? (
        <p>このカテゴリの記事はまだありません。</p>
      ) : (
        <div className="post-list">
          {posts.map((post, i) => (
            <PostCard key={post.slug} post={post} index={i} />
          ))}
        </div>
      )}
    </Layout>
  );
}
