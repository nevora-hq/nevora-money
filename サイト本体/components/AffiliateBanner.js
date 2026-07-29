// アフィリエイトリンク1件分の表示コンポーネント。
// バナー画像(frontmatterのimage/banner等)があれば画像リンク、なければ
// テキストボタンにフォールバックする。どちらの場合もPRバッジを付け、
// AdSense広告枠と混同されないよう視覚的に区別する。
// 記事本文中への埋め込みはlib/posts.js側でHTML文字列として生成しているため、
// このコンポーネントは記事末尾のフォールバック表示(本文中に言及が見つからなかった
// リンク)にのみ使用する。
export default function AffiliateBanner({ link }) {
  return (
    <div className="affiliate-inline-banner">
      <span className="pr-badge">PR</span>
      {link.image ? (
        <a
          href={link.url}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          className="affiliate-banner-link"
        >
          <img
            src={link.image}
            alt={link.label}
            loading="lazy"
            className="affiliate-banner-img"
          />
        </a>
      ) : (
        <a
          href={link.url}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          className="affiliate-link-btn"
        >
          {link.label} を見る(公式サイト)
        </a>
      )}
    </div>
  );
}
