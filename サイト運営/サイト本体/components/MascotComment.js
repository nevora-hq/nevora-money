// カテゴリ担当マスコットの一言コメント表示。
// pages/category/[name].js から抽出した共通マークアップ。
export default function MascotComment({ mascot, comment }) {
  if (!mascot) return null;

  return (
    <div className="mascot-comment mascot-comment-category">
      <img
        src={mascot.normalImage}
        alt={mascot.name}
        width={56}
        height={56}
        className="mascot-comment-img"
        loading="lazy"
      />
      <div className="mascot-comment-bubble">
        <span className="mascot-comment-name">{mascot.name}</span>
        <p className="mascot-comment-text">{comment}</p>
      </div>
    </div>
  );
}
