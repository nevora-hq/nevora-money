# サイト宣言文 vs 実態 監査

対象: `pages/about.js` `pages/privacy-policy.js` `pages/terms.js` `pages/contact.js`、記事frontmatter(`description`/`disclaimer`)、`docs/CONTRIBUTING.md`、`docs/project-state.md`(このサイトには無い。読まずに進める)

**本監査は検出・一覧化のみ。コード・コンテンツの編集は行わない。**

お金サイトの about.js の宣言文言は、運営形態が「個人運営」、meta description が「…運営者・出典の扱い・AIの利用範囲・広告ポリシーを公開しています。」、AI活用が「記事の下書き・図解・診断コンテンツの制作にAI(生成AI)を活用しています」、出典が「出典を示せる情報だけを記事にする」。運営者の経歴の記述が事実かどうかは【未確定: 運営者の経歴の事実確認(依頼者が確かめる)】。監査の観点(a)〜(f)と、meta description・disclaimer に実在しない体験を書かないという決まりを使う。お金の記事では「運用してみた結果を交えて」「申告した実体験をもとに」等も同じ扱い。

`docs/CONTRIBUTING.md`セクション3は、「実体験に基づく」「使用体験に基づく」等、記事の裏付けとして実在しない体験の存在を主張する記述を禁止している。本文中だけでなく、免責文・注記(`disclaimer`)内の記述も対象に含む。`description`は`pages/posts/[slug].js`で`<meta name="description">`にそのまま出力され、検索結果のスニペットにもなる公開テキストなので、同様に宣言と矛盾させない。

---

## 重大(審査リスク・信頼性リスク)

---

## 中(修正推奨)

---

## 軽微

---

## 監査項目別の結果まとめ

| 項目 | 結果 |
|---|---|
| (a) 体験談非掲載の宣言 vs 実態(本文・meta description・disclaimer) | |
| (b) AI活用宣言 vs トーン・プロセス | |
| (c) 一次情報優先ポリシー vs sources実運用 | |
| (d) updatedDate説明 vs 実運用 | |
| (e) 運営者情報の完全性(AdSense観点: 屋号・連絡先メール・お問い合わせへの導線・所在地。所在地が非公開でも、問い合わせ手段が明示されていれば最低要件は満たす) | |
| (f) その他(about/privacy-policy/terms間の相互リンク・免責事項の重複表記) | |

---

## 総括

発見件数: 重大 件・中 件・軽微 件。
