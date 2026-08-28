import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import { getAllPostsMeta } from "../lib/posts";
import { getAllWorryItems } from "../lib/worryTopics";

export async function getStaticProps() {
  const posts = getAllPostsMeta();
  // 記事のaffiliateLinksを商品として集約し、比較表のデータを構成する。
  // カテゴリ・悩み(worry)は絞り込みに使うため、行データにそのまま引き継ぐ。
  const items = [];
  for (const post of posts) {
    for (const link of post.affiliateLinks) {
      items.push({
        name: link.label,
        url: link.url,
        category: post.category,
        worry: post.worry,
        sourcePost: post.title,
        sourceSlug: post.slug,
      });
    }
  }
  const categories = [...new Set(items.map((item) => item.category))].sort((a, b) =>
    a.localeCompare(b, "ja")
  );
  return { props: { items, categories } };
}

export default function ComparePage({ items, categories }) {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [worry, setWorry] = useState("");
  const worryItems = getAllWorryItems();

  // /compare?worry=nisa や /compare?category=投資 のようなURLクエリを
  // 初期絞り込み状態として反映する(悩みページの比較CTA等からの遷移用)。
  useEffect(() => {
    if (typeof router.query.category === "string") setCategory(router.query.category);
    if (typeof router.query.worry === "string") setWorry(router.query.worry);
  }, [router.query.category, router.query.worry]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (category && item.category !== category) return false;
      if (worry && !item.worry.includes(worry)) return false;
      return true;
    });
  }, [items, category, worry]);

  // 選択状態をURLクエリに反映する(ブックマーク・共有可能にするため)。
  // ページ自体はcanonicalPath="/compare"固定(クエリ違いを別ページとして
  // 扱わせないため)なので、ここではshallow routingでURLだけを更新する。
  const updateQuery = (next) => {
    const query = { ...router.query, ...next };
    Object.keys(query).forEach((key) => {
      if (!query[key]) delete query[key];
    });
    router.replace({ pathname: "/compare", query }, undefined, { shallow: true });
  };

  const handleCategoryChange = (e) => {
    const value = e.target.value;
    setCategory(value);
    updateQuery({ category: value });
  };

  const handleWorryChange = (e) => {
    const value = e.target.value;
    setWorry(value);
    updateQuery({ worry: value });
  };

  const handleReset = () => {
    setCategory("");
    setWorry("");
    router.replace({ pathname: "/compare" }, undefined, { shallow: true });
  };

  const hasFilter = Boolean(category || worry);

  return (
    <Layout
      title="商品・サービス比較 | お金の総合ガイド｜NEVORA"
      description="お金の総合ガイド｜NEVORAで紹介している商品・サービスを一覧で比較できるページです。"
      canonicalPath="/compare"
      // 掲載アフィリエイトリンクが0件の間は、中身のないページとしてインデックスされないようnoindexにする。
      // items.length > 0 に戻れば自動的にindex対象に戻る(sitemap.xml.js側の除外もitems有無と連動)。
      noindex={items.length === 0}
      panel
    >
      <h1 className="page-title">商品・サービス比較</h1>
      {items.length > 0 && (
        <p className="page-note">
          ※本ページにはアフィリエイト広告(PR)を含みます。当サイトを経由して商品・サービスに申込みがあった場合、売上の一部が当サイトの収益となることがあります。比較項目(価格・特徴等)は今後の記事追加に合わせて拡充予定です。
        </p>
      )}
      {items.length === 0 ? (
        <p>比較対象の商品・サービスがまだ登録されていません。</p>
      ) : (
        <>
          <div className="compare-filter-bar">
            <div className="compare-filter-field">
              <label htmlFor="compare-filter-category">カテゴリで絞り込む</label>
              <select id="compare-filter-category" value={category} onChange={handleCategoryChange}>
                <option value="">すべてのカテゴリ</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="compare-filter-field">
              <label htmlFor="compare-filter-worry">悩みで絞り込む</label>
              <select id="compare-filter-worry" value={worry} onChange={handleWorryChange}>
                <option value="">すべての悩み</option>
                {worryItems.map((w) => (
                  <option key={w.slug} value={w.slug}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
            {hasFilter && (
              <button type="button" className="compare-filter-reset" onClick={handleReset}>
                絞り込みを解除
              </button>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <p className="compare-empty-note">
              条件に一致する商品・サービスが見つかりませんでした。絞り込み条件を変えてお試しください。
            </p>
          ) : (
            <table className="compare-table">
              <thead>
                <tr>
                  <th>商品・サービス名</th>
                  <th>カテゴリ</th>
                  <th>紹介記事</th>
                  <th>リンク</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.url}>
                    <td>{item.name}</td>
                    <td>{item.category}</td>
                    <td>
                      <a href={`/posts/${item.sourceSlug}`}>{item.sourcePost}</a>
                    </td>
                    <td>
                      <a href={item.url} target="_blank" rel="nofollow sponsored noopener noreferrer">
                        詳細を見る
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </Layout>
  );
}
