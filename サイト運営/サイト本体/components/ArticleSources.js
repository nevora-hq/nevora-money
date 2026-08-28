// frontmatterのsources(データ駆動方式、docs/citation-format.md参照)を描画する。
// sourcesが無い記事(移行未対応)ではこのコンポーネントは何も描画せず、
// 従来通り本文中の「## 出典」セクションがそのまま表示される(後方互換)。
const TYPE_LABELS = {
  primary: "一次情報",
  secondary: "二次情報",
  editorial: "編集部調査",
};

function EditorialMeta({ source }) {
  const parts = [
    // surveyNは数値(n数)のほか、参照資料の内訳など文字列も受け付ける。
    // 数値のときだけ「n=」を前置し、文字列はそのまま表示する。
    source.surveyN &&
      (/^\d+$/.test(String(source.surveyN)) ? `n=${source.surveyN}` : String(source.surveyN)),
    source.surveyMethod,
    source.surveyDate && `${source.surveyDate}実施`,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <span className="article-sources-meta">({parts.join("、")})</span>;
}

export default function ArticleSources({ sources }) {
  if (!Array.isArray(sources) || sources.length === 0) return null;

  return (
    <section className="article-sources" aria-labelledby="article-sources-heading">
      <h2 id="article-sources-heading">出典</h2>
      <ul className="article-sources-list">
        {sources.map((source, index) => (
          <li
            key={`${source.label}-${index}`}
            className={`article-sources-item article-sources-item--${source.type}`}
          >
            <span className="article-sources-badge">{TYPE_LABELS[source.type] || "出典"}</span>
            {source.type === "editorial" ? (
              <span>
                {source.label} <EditorialMeta source={source} />
              </span>
            ) : (
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
