<!--
記事YAMLテンプレート(工程1が新規記事作成時にコピーして使う)。

根拠: 美容サイト時代のfrontmatterフィールド出現率実測(SPEC-EXTRACT.mdは移行時に削除。必要になったら`nevora-spec-extractor`で作り直す)。
90記事中90/90で出現した7フィールド(title/description/category/tags/thumbnail/
summaryPoints/targetReader)+ほぼ必須のdateを「事実上の必須項目」として採用している。

このテンプレートに含めていないもの(意図的):
- accordions / charts: 工程1では書かない。プレースホルダー([[ACC:...]] [[VIS:...]])を
  本文に置くのみで、frontmatterへの反映は工程2/3の仕事(docs/pipeline/README.md 決定事項#5)。
- affiliateLinks: ASP提携が確定している場合のみ追加する(一部の記事のみ)。
  無い場合はキー自体を書かない(空配列やプレースホルダー文言を残さない)。
  中盤に挿入される1コメント(40〜70字目安)。挨拶・まとめは自動生成されるため書かない。
-->

---
title: "SEOキーワードを含むタイトル"
description: "検索結果に表示される120字程度の要約"
category: "lib/categoryMeta.js の MAJOR_CATEGORIES、またはRUN-PARAMS.mdで指定されたカテゴリと一致させる"
tags: ["キーワード1", "キーワード2"]
date: "YYYY-MM-DD"
thumbnail: ""
summaryPoints:
  - "この記事で分かることA"
  - "この記事で分かることB"
  - "この記事で分かることC"
targetReader: "想定読者・検索意図(1〜2文)"
---
