# NEVORA 公開済み記事ステータス一覧

`サイト運営/記事データ/確定稿`・`公開済み` → (`npm run sync-content`) → `サイト運営/サイト本体/content/articles`
に存在する記事について、専用実装(lib)・使用中のchart type・画像枚数・
`scripts/verify-article.js`による9項目検証の結果をまとめる。

- 対象: `content/articles/*.md`(`npm run sync-content`実行直後の状態)
- 検証コマンド: `node scripts/verify-article.js <記事Markdownパス>`
- 表の並び順: frontmatterの`date`昇順(公開日が無い記事は先頭)

## 列の定義

- **専用libファイル**: その記事のためだけに作られた`lib/*.js`(記事名を含むコメントで
  「〇〇記事専用」と明記されているファイル)。汎用実装(`bar`/`stat`/`pie`・`donut`/
  `prosCons`/`quadrant`/`steps`/`checklist`/`summaryCard`/`compareCards`等、`lib/posts.js`
  本体に実装されている汎用chart type)のみを使う記事は「なし」
- **使用中のchart type**: frontmatterの`charts[].type`のユニーク一覧(重複除去、出現順)。
  `type`省略時はサイト側の実装で棒グラフとして描画されるため`bar`と表記する
- **画像枚数(サムネ/本文)**: `thumbnail`フィールドの有無(0/1)と、本文中の
  Markdown画像記法`![alt](path)`の出現数(HTMLコメント内は除外)
- **9項目検証の結果**: `Yes`=9項目すべて合格。`No(n,m,...)`=Noだった項目番号
  (項目の意味は下記「9項目の定義」を参照)

## 9項目の定義(`scripts/verify-article.js`)

| # | 項目名 |
|---|---|
| 1 | afterHeadingの見出し一致 |
| 2 | アコーディオンの本文重複 |
| 3 | chartsの数(2件以上) |
| 4 | 装飾要素の合計使用数(6件以上) |
| 5 | NEVORAポイントの文字数(80字以内) |
| 6 | NEVORAポイント内のハイライト |
| 7 | 連続プレーンテキストの上限(200字以内) |
| 8 | H2セクションごとの視覚要素 |
| 9 | 未変換の装飾記号(2026-08-09追加) |

---

## 記事一覧

| 記事slug | 公開日 | 専用libファイル | 使用中のchart type | 画像枚数(サムネ/本文) | 9項目検証の結果 |
|---|---|---|---|---|---|

---

## 集計

- **注意**: `sectionAlternate` は使わない(新しい記事は `false`。`true` は形の指摘として直させる。依頼者の決定 2026-10-11。`.claude/agents/writer.md` が正)。`lib/posts.js` に slug 固有のH2セクション背景交互化ラッパー(`wrapXxxSections`)を持つ旧記事に `sectionAlternate: true` を足してはいけない(二重ラップでHTML構造が破綻する)という注意はそのまま残るが、そもそも `true` にしない決まりである(詳細は`.claude/agents/writer.md`・`nevora-pipeline-verifier.md`参照)。

- **No項目数ごとの記事数**

  | No項目数 | 記事数 |
  |---|---|
  | 0(Yes) |  |
  | 1個 |  |
  | 2個 |  |
  | 3個 |  |
  | 4個 |  |
  | 5個 |  |
  | 6個以上 |  |

- **項目別No集計(該当記事数)**

  | 項目 | 該当記事数 |
  |---|---|
  | 1. afterHeading一致 |  |
  | 2. アコーディオン本文重複 |  |
  | 3. chartsの数 |  |
  | 4. 装飾要素の合計使用数 |  |
  | 5. NEVORAポイント文字数 |  |
  | 6. NEVORAポイント内ハイライト |  |
  | 7. 連続プレーンテキストの上限 |  |
  | 8. H2セクションごとの視覚要素 |  |
  | 9. 未変換の装飾記号 |  |

- **セルフ診断ページ(`SkinTypeQuiz.js`)からリンクされている記事**: 診断結果ページから`/posts/{slug}`への遷移リンクとして`SkinTypeQuiz.js`内にハードコードされている。お金サイトのセルフ診断ページの slug は【未確定: セルフ診断ページの slug】。

## 補足・既知の注意点

- 集計の前に`npm run sync-content`を実行して`content/articles/`を
  `記事データ/確定稿`・`公開済み`と同期させる。`content/articles/`は
  生成物であり直接編集しないこと(`scripts/sync-content.js`のコメント参照)。
