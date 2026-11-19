import Link from "next/link";
import Layout from "../../components/Layout";
import { responsiveImageExists } from "../../lib/siteImages";
import PageHero from "../../components/PageHero";
import { getPublishedWorryGroups } from "../../lib/worryTopics";
import { getWorryContent } from "../../lib/worryContent";
import { getAllPostsMeta } from "../../lib/posts";
import { buildBreadcrumbJsonLd, buildItemListJsonLd } from "../../lib/structuredData";

// グループごとの色(いずれも白面の上で6:1以上)。グループ数が増えたら循環して使う。
const WORRY_GROUP_COLORS = ["#12528c", "#8a3507", "#1b5c28", "#5737b6", "#9a1d49"];

export async function getStaticProps() {
  const publishedGroups = getPublishedWorryGroups();
  // 本文が1件も用意できていない間は、中身の無いハブページを公開しない
  // (CLAUDE.mdのアドセンス審査基準「準備中ページを公開状態にしない」)。
  if (publishedGroups.length === 0) return { notFound: true };

  const allPosts = getAllPostsMeta();

  const groups = publishedGroups.map((group) => ({
    heading: group.heading,
    items: group.items.map((item) => {
      const content = getWorryContent(item.slug);
      const count = allPosts.filter(
        (post) => Array.isArray(post.worry) && post.worry.includes(item.slug)
      ).length;
      return {
        slug: item.slug,
        label: item.label,
        summary: content ? content.summary : "",
        count,
      };
    }),
  }));

  return { props: { groups, hasBand: responsiveImageExists("/images/band/band-01") } };
}

function buildWorryHubJsonLd(groups, siteUrl) {
  if (!siteUrl) return [];
  const breadcrumb = buildBreadcrumbJsonLd(siteUrl, [
    { name: "トップ", url: siteUrl },
    { name: "悩みから探す", url: `${siteUrl}/worry` },
  ]);
  const allItems = groups.flatMap((group) => group.items);
  const itemList = buildItemListJsonLd(
    allItems.map((item) => ({ name: item.label, url: `${siteUrl}/worry/${item.slug}` }))
  );
  return [breadcrumb, itemList].filter(Boolean);
}

export default function WorryHubPage({ groups, hasBand }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  return (
    <Layout
      panel
      hero={
        <PageHero
          eyebrow="Worry"
          title="あなたのお金の悩みから探す"
          lead="悩みを選ぶと、原因の整理から対策までが見られます。"
          base="/images/band/band-01"
          hasImage={hasBand}
        />
      }
      title="あなたのお金の悩みから探す｜お金の総合ガイド｜NEVORA"
      description="投資の始め方・新NISA・確定申告・保険の見直し・固定費の削減など、お金の悩みから、背景の整理やセルフチェック、今日からできる対策がまとまった記事ページを探せます。"
      canonicalPath="/worry"
      ogImage="/images/logo.png"
      jsonLd={buildWorryHubJsonLd(groups, siteUrl)}
    >
      <nav className="breadcrumb" aria-label="パンくずリスト">
        <Link href="/">トップ</Link>
        <span className="sep">/</span>
        <span className="current">悩みから探す</span>
      </nav>

      <p className="home-section-lead">
        気になる悩みを選ぶと、原因の整理からセルフチェック、今日からできる対策までをまとめた専用ページに移動します。
      </p>

      {groups.map((group, gi) => (
        <section
          className="article-section worry-hub-group"
          key={group.heading}
          style={{ "--wg": WORRY_GROUP_COLORS[gi % WORRY_GROUP_COLORS.length] }}
        >
          <div className="worry-hub-group-head">
            <h2 className="worry-hub-group-title">{group.heading}</h2>
            {group.en && <span className="worry-hub-group-en">{group.en}</span>}
          </div>
          <div className="worry-hub-grid">
            {group.items.map((item) => (
              <Link key={item.slug} href={`/worry/${item.slug}`} className="worry-hub-card">
                <span className="worry-hub-card-label">{item.label}</span>
                <span className="worry-hub-card-summary">{item.summary}</span>
                <span className="worry-hub-card-count">
                  {item.count}件の記事
                  <span className="worry-hub-card-arrow" aria-hidden="true">
                    →
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </Layout>
  );
}
