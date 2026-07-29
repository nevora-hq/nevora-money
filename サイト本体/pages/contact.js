import Layout from "../components/Layout";

const CONTACT_EMAIL = "nevora01123@gmail.com";

export default function Contact() {
  function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value;
    const email = form.email.value;
    const message = form.message.value;

    const subject = encodeURIComponent("【美容の総合ガイド｜NEVORA】お問い合わせ");
    const body = encodeURIComponent(
      `お名前: ${name}\nメールアドレス: ${email}\n\n${message}`
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <Layout
      title="お問い合わせ | 美容の総合ガイド｜NEVORA"
      description="美容の総合ガイド｜NEVORAへのお問い合わせページです。"
      canonicalPath="/contact"
    >
      <h1 className="page-title">お問い合わせ</h1>
      <div className="article-body">
        <p>
          記事内容に関するご意見・ご指摘、掲載情報の訂正依頼、その他お問い合わせは、以下のフォームよりご連絡ください。
          送信ボタンを押すと、お使いのメールソフトで下書きが作成されます。内容をご確認のうえ送信してください。
        </p>

        <form onSubmit={handleSubmit} className="form">
          <label className="form-field">
            お名前
            <input type="text" name="name" required />
          </label>
          <label className="form-field">
            メールアドレス
            <input type="email" name="email" required />
          </label>
          <label className="form-field">
            お問い合わせ内容
            <textarea name="message" required rows={6} />
          </label>
          <button type="submit" className="affiliate-link-btn form-submit">
            メールソフトで送信する
          </button>
        </form>

        <p className="page-note" style={{ marginTop: 24, marginBottom: 0 }}>
          メールソフトが開かない場合は、{CONTACT_EMAIL} まで直接ご連絡ください。
        </p>
      </div>
    </Layout>
  );
}
