// 資産運用・税金など、読者の判断に影響しうる内容を含む記事末尾に表示する注記。
// スタイルは記事本文中の注意ボックス(lib/posts.jsのblockquote変換)と同じ
// .warning-box系を流用し、既存の見た目のトーンと統一する。
//
// opt-out方式: 全記事デフォルト表示とし、frontmatterに `disclaimer: none` が
// 明示されている記事のみ非表示にする(カテゴリのallowlist方式は、カテゴリを
// 追加するたびに対象漏れが起きる構造的欠陥があるため採用しない)。
export function shouldShowFinancialDisclaimer(disclaimer) {
  return disclaimer !== "none";
}

export default function FinancialDisclaimer() {
  return (
    <div className="warning-box">
      <span className="warning-box-icon" aria-hidden="true">
        ⚠️
      </span>
      <div className="warning-box-body">
        <p className="warning-box-label">注意</p>
        <p>
          本記事は一般的な情報提供を目的としており、特定の金融商品の取得・売却を勧誘するものではなく、税務・法務・投資助言を行うものでもありません。投資には元本割れをはじめとするリスクがあり、税制・制度・手数料等は改正される場合があります。最終的な判断はご自身の責任で行い、個別の事情については金融機関・税務署・税理士など専門家にご相談ください。
        </p>
      </div>
    </div>
  );
}
