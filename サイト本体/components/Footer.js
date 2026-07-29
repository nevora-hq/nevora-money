import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p>
          本サイトはアフィリエイト広告(Amazonアソシエイト・ASP等)を利用しています。
        </p>
        <p className="footer-ad-notice">
          ※本サイトの記事にはアフィリエイト広告(PR)を含みます。当サイトを経由して商品・サービスに申込みがあった場合、
          売上の一部が当サイトの収益となることがあります。広告(PR)であることが分かるよう、該当箇所には「PR」表記および
          広告枠であることを示す装飾を付けています。
        </p>
        <nav className="footer-nav">
          <Link href="/about">運営者情報</Link>
          <Link href="/privacy-policy">プライバシーポリシー</Link>
          <Link href="/terms">免責事項・利用規約</Link>
          <Link href="/contact">お問い合わせ</Link>
        </nav>
        <div className="footer-sites">
          <p className="footer-sites-title">運営サイト一覧</p>
          <ul className="footer-sites-list">
            <li>
              <a href="https://nevora-beauty.vercel.app/" target="_blank" rel="noopener noreferrer">
                美容の総合ガイド｜NEVORA
              </a>
            </li>
            <li>
              <a href="https://nevora-ai.vercel.app/" target="_blank" rel="noopener noreferrer">
                AI活用の総合ガイド｜NEVORA
              </a>
            </li>
            <li>
              <a href="https://nevora-job.vercel.app/" target="_blank" rel="noopener noreferrer">
                副業・在宅ワークの総合ガイド｜NEVORA
              </a>
            </li>
            <li>
              <a href="https://nevora-lifestyle.vercel.app/" target="_blank" rel="noopener noreferrer">
                生活を豊かにする総合ガイド｜NEVORA
              </a>
            </li>
          </ul>
        </div>
        <p>&copy; {new Date().getFullYear()} お金の総合ガイド｜NEVORA</p>
      </div>
    </footer>
  );
}
