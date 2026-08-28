import { useState } from "react";
import Layout from "../components/Layout";

const CONTACT_EMAIL = "nevora01123@gmail.com";

// Formspreeのフォームエンドポイント(例: https://formspree.io/f/xxxxxxxx)。
// 未設定の場合はmailto:方式(訪問者のメールソフトで下書きを開く)にフォールバックし、
// フォーム自体は壊れないようにしている。
const FORM_ENDPOINT = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT || "";

export default function Contact() {
  // idle | sending | sent | error
  const [status, setStatus] = useState("idle");

  function sendByMailto(name, email, message) {
    const subject = encodeURIComponent("【お金の総合ガイド｜NEVORA】お問い合わせ");
    const body = encodeURIComponent(
      `お名前: ${name}\nメールアドレス: ${email}\n\n${message}`
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value;
    const email = form.email.value;
    const message = form.message.value;

    // ハニーポット。人間には見えない項目が埋まっていればbotとみなし、
    // 送信したように見せて破棄する。
    if (form._gotcha.value) {
      setStatus("sent");
      return;
    }

    if (!FORM_ENDPOINT) {
      sendByMailto(name, email, message);
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) throw new Error(`Formspree responded ${res.status}`);
      form.reset();
      setStatus("sent");
    } catch (err) {
      setStatus("error");
    }
  }

  return (
    <Layout
      title="お問い合わせ | お金の総合ガイド｜NEVORA"
      description="お金の総合ガイド｜NEVORAへのお問い合わせページです。"
      canonicalPath="/contact"
    >
      <h1 className="page-title">お問い合わせ</h1>
      <div className="article-body">
        <p>
          記事内容に関するご意見・ご指摘、掲載情報の訂正依頼、その他お問い合わせは、以下のフォームよりご連絡ください。
          {FORM_ENDPOINT
            ? "内容を確認のうえ、必要に応じて運営者よりご返信いたします。"
            : "送信ボタンを押すと、お使いのメールソフトで下書きが作成されます。内容をご確認のうえ送信してください。"}
        </p>

        {status === "sent" ? (
          <p className="form-message form-message-success" role="status">
            送信が完了しました。お問い合わせいただきありがとうございます。
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="form">
            <label className="form-field">
              お名前
              <input type="text" name="name" required disabled={status === "sending"} />
            </label>
            <label className="form-field">
              メールアドレス
              <input type="email" name="email" required disabled={status === "sending"} />
            </label>
            <label className="form-field">
              お問い合わせ内容
              <textarea name="message" required rows={6} disabled={status === "sending"} />
            </label>

            {/* スパム対策のハニーポット。画面には表示しない */}
            <input
              type="text"
              name="_gotcha"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ display: "none" }}
            />

            <button
              type="submit"
              className="affiliate-link-btn form-submit"
              disabled={status === "sending"}
            >
              {status === "sending"
                ? "送信中…"
                : FORM_ENDPOINT
                  ? "送信する"
                  : "メールソフトで送信する"}
            </button>

            {status === "error" && (
              <p className="form-message form-message-error" role="alert">
                送信に失敗しました。時間をおいて再度お試しいただくか、{CONTACT_EMAIL} まで直接ご連絡ください。
              </p>
            )}
          </form>
        )}

        <p className="page-note" style={{ marginTop: 24, marginBottom: 0 }}>
          {FORM_ENDPOINT
            ? "ご入力いただいた内容は、お問い合わせへの対応のみに利用します。送信にはフォーム配信サービス「Formspree」を利用しており、入力内容は同サービスを経由して運営者へ届きます。詳しくは"
            : "ご入力いただいた内容は、お問い合わせへの対応のみに利用します。詳しくは"}
          <a href="/privacy-policy">プライバシーポリシー</a>
          をご確認ください。フォームが利用できない場合は、{CONTACT_EMAIL} まで直接ご連絡ください。
        </p>
      </div>
    </Layout>
  );
}
