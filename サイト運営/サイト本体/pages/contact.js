import Layout from "../components/Layout";

const CONTACT_EMAIL = "nevora01123@gmail.com";

// 問い合わせはメール直行に一本化している(2026-08-29)。
// 以前はFormspree経由の送信フォームを置いていたが、外部サービスへの依存と
// 「入力内容が第三者のサービスを経由する」という説明責任を無くすため廃止した。
// 件名・本文のひな形だけをmailtoに載せ、実際の送信は訪問者のメールソフトに任せる。
const MAIL_SUBJECT = "【お金の総合ガイド｜NEVORA】お問い合わせ";
const MAIL_BODY = [
  "以下にお問い合わせ内容をご記入ください。",
  "",
  "―――――――――――――――",
  "お名前:",
  "お問い合わせ内容:",
  "（記事へのご指摘の場合は、該当記事のURLもあわせてお知らせください）",
  "―――――――――――――――",
  "",
].join("\n");

const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  MAIL_SUBJECT
)}&body=${encodeURIComponent(MAIL_BODY)}`;

export default function Contact() {
  return (
    <Layout
      title="お問い合わせ | お金の総合ガイド｜NEVORA"
      description="お金の総合ガイド｜NEVORAへのお問い合わせページです。記事内容へのご意見・訂正依頼などをメールで受け付けています。"
      canonicalPath="/contact"
    >
      <h1 className="page-title">お問い合わせ</h1>
      <div className="article-body">
        <p>
          記事内容に関するご意見・ご指摘、掲載情報の訂正依頼、取材・お仕事のご依頼は、下記のメールアドレスまでご連絡ください。内容を確認のうえ、必要に応じて運営者よりご返信いたします。
        </p>

        <div className="contact-mail-card">
          <p className="contact-mail-label">メールアドレス</p>
          <p className="contact-mail-address">{CONTACT_EMAIL}</p>
          <a href={mailtoHref} className="affiliate-link-btn contact-mail-button">
            メールソフトで問い合わせを作成する
          </a>
          <p className="contact-mail-note">
            ボタンを押すと、お使いのメールソフトで件名・本文のひな形が入った下書きが開きます。うまく開かない場合は、上のアドレスをコピーしてお使いのメールソフトから直接お送りください。
          </p>
        </div>

        <h2>ご連絡の際にお書き添えいただきたいこと</h2>
        <ul>
          <li>お名前（ニックネームでも構いません）</li>
          <li>お問い合わせの内容</li>
          <li>記事へのご指摘の場合は、該当記事のURL</li>
        </ul>

        <h2>ご返信について</h2>
        <p>
          個人で運営しているため、ご返信までにお時間をいただく場合があります。また、内容によってはご返信を差し控えることがありますので、あらかじめご了承ください。
        </p>
        <p>
          なお、当サイトは金融商品の販売・仲介や、個別の投資助言・税務相談は行っておりません。個別の事情に関するご相談は、金融機関・税務署・税理士など専門家へお問い合わせください（
          <a href="/terms">免責事項・利用規約</a>
          をご確認ください）。
        </p>

        <p className="page-note" style={{ marginTop: 24, marginBottom: 0 }}>
          いただいたメールの内容は、お問い合わせへの対応のみに利用します。詳しくは
          <a href="/privacy-policy">プライバシーポリシー</a>
          をご確認ください。
        </p>
      </div>
    </Layout>
  );
}
