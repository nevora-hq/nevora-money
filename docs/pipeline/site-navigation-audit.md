# サイトレベル整合性監査

対象: `サイト運営/サイト本体/`
方針: 検出・一覧化のみ。コード編集は行わない。

お金サイトの本番URLは `https://nevora-money.vercel.app`、独自ドメインは【未確定: 独自ドメイン】、診断ページの slug は【未確定: お金サイトの診断ページ slug】。確認の観点(§1〜§4)をそのまま使う。

## 1. ユーザー動線チェック(index → posts/[slug] → about → contact)

- `pages/index.js`・`pages/posts/[slug].js`・`pages/about.js`・`pages/contact.js` から出るリンクが、すべて実在するページ/動的ルートに対応しているか(リンク切れなし)。
- `pages/contact.js` は外部送信APIを使わず`mailto:`リンクでフォーム送信する設計のため、リンク切れの概念自体がない。

判定:

## 2. ヘッダー/フッター/共通コンポーネントの全内部リンク生存確認

- `components/Header.js`・`components/Footer.js`・`components/Sidebar.js`・`PostCard.js` など共通コンポーネントの内部リンクが、`pages/`配下の実在ファイル・動的ルートと一致しているか。
- 記事間の直リンクを持つ部品は、該当スラッグが`公開済み`フォルダに実在するか。
- 外部リンク(`ArticleSources.js`の`source.url`は記事データ側で管理。`ArticleToc.js`のアンカーリンクは内部ページ内リンクのため対象外。部品内に直書きされた出典URLは`nofollow noopener noreferrer`付きか、生存を確認したか)。

判定:

## 3. 404ページの品質確認 (`pages/404.js`)

- (a) 誘導リンク: トップページ・カテゴリ一覧・人気記事・検索ページへのリンクを備えるか。
- (b) デザイン・文言: 「404」表示+状況説明+複数の誘導セクションがあり、最低限の品質を満たすか。
- (c) noindex: `<Layout ... noindex ...>`で明示的に設定されているか。

判定:

## 4. 旧ドメイン表記(vercel.app)の残存確認

Grep範囲: `pages/`・`components/`・`lib/`・`記事データ/公開済み`・`記事データ/公開済み`・`next.config.js`・`pages/robots.txt.js`・`sitemap.xml.js`・環境変数ファイル(キー名のみ)。

検出件数:

| ファイル | 内容 | 判定 |
|---|---|---|

対象外の分類: 公開記事ではない調査メモ、移行作業の記録・手順書(`docs/project-state.md`(このサイトには無い。読まずに進める)・`docs/domain-migration-plan.md`・`docs/audit-report.md`(このサイトには無い。読まずに進める))、作業ログ(`サイト運営/実務/配信者/メモ/*.md`)、汎用プレースホルダー(`.env.example`の`your-site.vercel.app`)。`lib/siteLinks.js`の他のNEVORAサイトのURLは、`docs/domain-migration-plan.md`3節の「例外がないかの最終確認」のとおり、他サイト自身のドメインであり当サイトの移行とは無関係。ローカル開発用のサンプル値(`.env.local.example`)は軽微として扱う。

公開記事本文(公開済み配下)とサイト本体コード(`pages/`・`components/`・`next.config.js`・`sitemap.xml.js`・`robots.txt`)に旧ドメインのハードコードが無いか(`NEXT_PUBLIC_SITE_URL`環境変数経由で一元管理されているか)を確認する。

## まとめ

| 分類 | 件数 |
|---|---|
| 重大(審査リスク) | |
| 中(修正推奨) | |
| 軽微 | |
