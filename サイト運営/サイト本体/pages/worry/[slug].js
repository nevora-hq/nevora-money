import Link from "next/link";
import Layout from "../../components/Layout";
import PostCard from "../../components/PostCard";
import FaqAccordion from "../../components/FaqAccordion";
import WorrySelfCheck from "../../components/WorrySelfCheck";
import {
  getAllWorryItems,
  getWorryItemBySlug,
  getWorryPageItems,
} from "../../lib/worryTopics";
import { getWorryContent } from "../../lib/worryContent";
import { getCategoryMeta } from "../../lib/categoryMeta";
import { getAllPostsMeta } from "../../lib/posts";
import {
  buildBreadcrumbJsonLd,
  buildItemListJsonLd,
  buildFaqJsonLd,
} from "../../lib/structuredData";

export async function getStaticPaths() {
  const items = getWorryPageItems();
  return {
    paths: items.map((item) => ({ params: { slug: item.slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const item = getWorryItemBySlug(params.slug);
  const content = getWorryContent(params.slug);
  if (!item || !content) {
    return { notFound: true };
  }

  const posts = getAllPostsMeta().filter(
    (post) => Array.isArray(post.worry) && post.worry.includes(params.slug)
  );
  const { image: categoryImage } = getCategoryMeta(item.primaryCategory);
  const relatedWorries = getAllWorryItems().filter(
    (other) => other.group === item.group && other.slug !== item.slug
  );

  // 悩みCTA(ブロック9)の遷移先。その悩みのprimaryCategoryのカテゴリページへ誘導する。
  // 比較CTA(ブロック10、/compare?worry={slug})と行き先が重ならないようにする。
  // 診断ページ(lib/diagnosisTopics.js)を用意した悩みでは、worryContent側の
  // cta.href で個別に上書きできる。
  const ctaHref =
    (content.cta && content.cta.href) ||
    `/category/${encodeURIComponent(item.primaryCategory)}`;

  return {
    props: {
      slug: params.slug,
      label: item.label,
      content,
      posts,
      categoryImage: categoryImage || "",
      relatedWorries,
      ctaHref,
    },
  };
}

function buildWorryJsonLd(slug, label, content, posts, siteUrl) {
  if (!siteUrl) return [];
  const pageUrl = `${siteUrl}/worry/${slug}`;
  const breadcrumb = buildBreadcrumbJsonLd(siteUrl, [
    { name: "トップ", url: siteUrl },
    { name: "悩みから探す", url: `${siteUrl}/worry` },
    { name: label, url: pageUrl },
  ]);
  const itemList = buildItemListJsonLd(
    posts.map((p) => ({ name: p.title, url: `${siteUrl}/posts/${p.slug}` }))
  );
  const faq = buildFaqJsonLd(content.faq);
  return [breadcrumb, itemList, faq].filter(Boolean);
}

export default function WorryPage({
  slug,
  label,
  content,
  posts,
  categoryImage,
  relatedWorries,
  ctaHref,
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  return (
    <Layout
      panel
      title={content.title}
      description={content.description}
      canonicalPath={`/worry/${slug}`}
      ogImage={categoryImage}
      jsonLd={buildWorryJsonLd(slug, label, content, posts, siteUrl)}
    >
      {/* 1. パンくず */}
      <nav className="breadcrumb" aria-label="パンくずリスト">
        <Link href="/">トップ</Link>
        <span className="sep">/</span>
        <Link href="/worry">悩みから探す</Link>
        <span className="sep">/</span>
        <span className="current">{label}</span>
      </nav>

      {/* 2. H1 + intro */}
      <h1 className="page-title">{label}に悩んでいる方へ</h1>
      <p className="home-section-lead">{content.intro}</p>

      {/* 3. まずは結論(keyPoints) */}
      <div className="quick-conclusion-box">
        <p className="quick-conclusion-label">
          <span aria-hidden="true">🔍</span> まずは結論
        </p>
        <ul className="quick-conclusion-body">
          {content.keyPoints.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      </div>

      {/* 4. よくある原因 */}
      <section className="article-section">
        <h2 className="home-section-title">よくある原因</h2>
        <div className="worry-cause-list">
          {content.causes.map((cause, i) => (
            <div className="worry-cause-item" key={i}>
              <p className="worry-cause-title">{cause.title}</p>
              <p className="worry-cause-body">{cause.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. セルフチェック */}
      <section className="article-section">
        <h2 className="home-section-title">セルフチェック</h2>
        <WorrySelfCheck
          title={`「${label}」セルフチェック`}
          items={content.selfCheck.items}
          judgements={content.selfCheck.judgements}
        />
      </section>

      {/* 6. 今日からできる対策 */}
      <section className="article-section">
        <h2 className="home-section-title">今日からできる対策</h2>
        <ol className="worry-steps-list">
          {content.steps.map((step, i) => (
            <li className="worry-steps-item" key={i}>
              <p className="worry-steps-title">{step.title}</p>
              <p className="worry-steps-body">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 7. この悩みの記事(0件の場合はセクションごと非表示) */}
      {posts.length > 0 && (
        <section className="article-section">
          <h2 className="home-section-title">この悩みの記事</h2>
          {content.postsNote && <p className="page-note">{content.postsNote}</p>}
          <div className="post-list">
            {posts.map((post, i) => (
              <PostCard key={post.slug} post={post} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* 8. 関連する他の悩み */}
      {relatedWorries.length > 0 && (
        <section className="article-section">
          <h2 className="home-section-title">関連する他の悩み</h2>
          <div className="worry-finder-chips">
            {relatedWorries.map((other) => (
              <Link key={other.slug} href={`/worry/${other.slug}`} className="worry-chip">
                {other.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 9. 悩みに応じたCTA(既定は関連カテゴリ、cta.href指定時はそちらへ) */}
      <Link href={ctaHref} className="diagnosis-banner">
        <span className="diagnosis-banner-icon" aria-hidden="true">
          🔍
        </span>
        <span className="diagnosis-banner-text">
          <span className="diagnosis-banner-title">{content.cta.title}</span>
          <span className="diagnosis-banner-desc">{content.cta.desc}</span>
        </span>
        <span className="diagnosis-banner-arrow" aria-hidden="true">
          →
        </span>
      </Link>

      {/* 10. 比較CTA(この悩みで絞り込んだ/compareへ。9とは行き先・文言を分ける) */}
      <Link href={`/compare?worry=${slug}`} className="diagnosis-banner">
        <span className="diagnosis-banner-icon" aria-hidden="true">
          📊
        </span>
        <span className="diagnosis-banner-text">
          <span className="diagnosis-banner-title">おすすめアイテムを比較する</span>
          <span className="diagnosis-banner-desc">
            気になるアイテムを条件で比較できます。
          </span>
        </span>
        <span className="diagnosis-banner-arrow" aria-hidden="true">
          →
        </span>
      </Link>

      {/* 11. FAQ */}
      <section className="article-section">
        <h2 className="home-section-title">よくある質問</h2>
        <FaqAccordion items={content.faq} />
      </section>
    </Layout>
  );
}
