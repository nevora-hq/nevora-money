---
name: site-scaffold
description: アフィリエイトブログサイト本体(Next.js)のページ・機能を実装する際の指針。サイト構築・機能追加を依頼された場合に使う。
---

# サイト実装スキル(サイト制作者)

## 作業前に必ず確認すること
- `サイト運営\サイト本体\README.md` のサイトマップ・技術方針を確認する
- ユーザーはサーバー・ドメイン・Web知識を持たない前提で説明・提案を行う

## ディレクトリ構成の目安(Next.js, Pages Router)
```
サイト本体/
  pages/
    index.js               … トップページ
    posts/[slug].js         … 記事ページ(getStaticPaths/getStaticProps)
    category/[name].js      … カテゴリページ
    compare.js               … 比較ページ
    ranking.js                … ランキングページ
    search.js                  … 検索機能
    admin/
      articles.js             … 記事管理
      ads.js                  … 広告管理
      analytics.js            … アクセス解析
      seo.js                  … SEO管理
      ai-updates.js           … AI自動更新管理
  content/articles/          … 記事Markdown(frontmatter付き。.gitignore対象・ビルド時に記事データから配置される)
  lib/posts.js                … 記事読み込み・frontmatter正規化・検索等の共通ロジック
```

## 記事データの扱い
- 記事Markdownのfrontmatter(`title`/`description`/`category`/`tags`/`affiliateLinks`)をそのままページ描画・カテゴリ分け・検索に利用する
- `サイト運営\記事データ\確定稿\`から`content/`への配置は配信者(publisher)が行うため、site-engineerは読み込み・表示側の実装に専念する

## 管理者ダッシュボードの考え方
- 認証(誰でもアクセスできる状態を避ける)を最低限用意してから実装を進める。認証方式(簡易パスワード保護 / 本格的な認証サービス)は規模に応じてユーザーに選択肢を提示する
- 記事管理: 公開・非公開の切替、記事一覧の表示
- 広告管理: アフィリエイトリンク・広告枠の登録・編集
- アクセス解析: 外部ツール(Google Search Console/Analytics)との連携、または簡易な自前集計の表示
- SEO管理: メタ情報・構造化データ・サイトマップ(sitemap.xml)の管理
- AI自動更新: エージェントによる記事追加・更新の実行履歴を確認できる画面

## 進め方
- 一度に全機能を作ろうとせず、優先度の高いもの(トップページ・記事ページ・カテゴリページ)から段階的に実装する
- 実装後は必ずローカルでの起動確認手順をユーザーに案内する
- 大きな設計判断(DB導入、認証方式等)は事前にユーザーに選択肢とおすすめを提示し、承認を得てから進める
