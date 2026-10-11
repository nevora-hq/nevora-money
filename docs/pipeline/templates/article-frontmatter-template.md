<!--
(このテンプレートは旧パイプライン用で、docs/pipeline/README.md の冒頭と一覧表(101行)のとおり無効化済み。現行の frontmatter は writer.md に従い、charts・accordions は frontmatter に直接書く。)

記事YAMLテンプレート(工程1が新規記事作成時にコピーして使う)。

根拠: docs/pipeline/SPEC-EXTRACT.md §0.2(frontmatterフィールドの出現率実測)。
旧美容サイトの90記事中90/90で出現した7フィールド(title/description/category/tags/thumbnail/
summaryPoints/targetReader)+ほぼ必須のdateを「事実上の必須項目」として採用している。

このテンプレートに含めていないもの(意図的):
- accordions / charts: 工程1では書かない。プレースホルダー([[ACC:...]] [[VIS:...]])を
  本文に置くのみで、frontmatterへの反映は工程2/3の仕事(docs/pipeline/README.md 決定事項#5)。
- affiliateLinks: ASP提携が確定している場合のみ追加する(SPEC-EXTRACT.md §0.2、14/90記事のみ)。現在は全カット方針で、アフィリエイトリンクは置かないので書かない(docs/project-state.md(このサイトには無い。読まずに進める) 2節-10)。
  無い場合はキー自体を書かない(空配列やプレースホルダー文言を残さない)。
- mascotComment: 必須・字数・口調・中身は writer.md の mascotComment の規則〔frontmatter の項〕が正。
  記事ページには、カテゴリ担当マスコット(投資=フヤミンちゃん・FX=カワセミンちゃん・税金・節税=ゼイミンちゃん・保険=マモミンちゃん・家計・節約=カケイミンちゃん・クレカ・ポイント=ポイミンちゃん)の一言が、サイト側のコード(lib/posts.js の insertMascotComment・lib/categoryMascot.js)で自動で入る。H2見出しの直前に、最初のH2の前=挨拶(H2が1つ以上のとき)、中ほどのH2の前=補足(H2が2つ以上のとき)、本文の末尾=振り返り。
  frontmatter の mascotComment を書くと、中盤の補足の1コメントにその文が使われる。書かなければ、カテゴリごとの既定のコメントから自動で選ばれる(ライターは必須として書く)。挨拶・振り返りは常に既定のコメントが自動で入るため書かない。カテゴリがマスコットの一覧に無い記事は、マスコットが入らない。
-->

---
title: "SEOキーワードを含むタイトル"
description: "検索結果に表示される80〜110字の要約(題名の約束を具体にする1文。writer.md 規則30(i))"
category: "投資 / FX / 税金・節税 / 保険 / 家計・節約 / クレカ・ポイント のいずれか1つ(lib/categoryMeta.js の MAJOR_CATEGORIES と、カテゴリページ pages/category/[name].js に従う)"
tags: ["キーワード1", "キーワード2"]
date: "YYYY-MM-DD"
thumbnail: ""
# sectionAlternate: 見出しごとの背景の切り替えは使わない。新しい記事は false
sectionAlternate: false
summaryPoints:
  - "この記事で分かることA"
  - "この記事で分かることB"
  - "この記事で分かることC"
targetReader: "想定読者・検索意図(1〜2文)"
---
