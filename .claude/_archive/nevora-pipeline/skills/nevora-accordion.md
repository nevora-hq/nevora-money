# ACC(アコーディオン) ID↔見出しテキスト併存方式

`.claude/skills/nevora-pipeline/SKILL.md` を先に読んだ前提。工程1・工程2が対象。

## 制約(根拠)

既存のアコーディオン実装は、frontmatterの`accordions[]`配列を**見出しテキストの完全一致**
(`afterHeading`)でしか本文へ挿入できない。ID(`ACC-01`等)を直接解釈する仕組みはコード側に
存在しない。

- データ構造は`afterHeading`/`summary`/`content`の3フィールドのみ(`normalizeAccordions`,
  `サイト運営\サイト本体\lib\posts.js:1197-1206`)
- 挿入は`embedAccordions`(`lib/posts.js:1046-1070`)が本文をブロック分割し、テキストが
  `afterHeading`と完全一致するH2/H3見出しの直後に挿入する
- 本文への生HTML(`<details>`等)の直書きは無効(remark-htmlのサニタイズで除去される。
  SPEC-EXTRACT.md §3・§8)
- 同じ`afterHeading`を持つ複数エントリは、その1箇所にまとめて連続挿入される(FAQ形式の
  実装で使われている実例あり。SPEC-EXTRACT.md §3)

## 工程1(本文執筆)の配置ルール

- `[[ACC:ACC-01 ...]]`は、対応させたいH2またはH3見出しの**直後**に置く(見出しの前や、
  見出し直後の別段落のさらに後ろには置かない。理由: 工程2が「直前の見出し」を機械的に
  特定できるようにするため)
- 源スペック§4.3のフィールド(`intent`/`lead`/`title`/`items[].label`/`items[].body`)を
  そのまま使う。フィールドを追加・省略しない
- 既存記事の「パネル外プレビュー文」の作法(SPEC-EXTRACT.md §3)を踏まえ、`lead`は
  「ここに畳んである」という予告の一文にとどめ、`items[].body`と同じ内容を書かない

## 工程2(実装)の転記手順

1. `[[ACC:ID ...]]`ブロックの直前にある、本文中で最も近いH2またはH3見出しのテキストを
   **一字一句そのまま**取得する(絵文字・記号も含めて完全一致させる)。これが`afterHeading`
   の値になる
2. `items[]`の各要素ごとに、frontmatterの`accordions[]`へ1エントリを追加する
   - `afterHeading` = 手順1で取得したテキスト
   - `summary` = `items[i].label`
   - `content` = `items[i].body`(Markdown文字列としてそのまま。工程2は文言を変えない)
3. `items`が複数ある場合、同じ`afterHeading`を持つエントリが複数できる(想定どおりの挙動。
   既存コードが出現順にまとめて連続挿入する)
4. `lead`がある場合、プレースホルダーのあった位置に短い1文の地の文としてそのまま残す。
   無い場合は何も残さない
5. `title`はfrontmatterへの転記先が無い(既存UIに独立した表示枠が無いため)。**捨てずに
   HANDOFF-02.mdへ記録する**。`lead`が無く`title`だけがある場合、`title`を基にした
   1文を`lead`の代わりに残してよい(内容の水増しはしない)
6. プレースホルダーブロック全体を削除し、(leadの文があればその直後に)
   `<!-- impl:ACC-01 -->` を1行残す
7. **HANDOFF-02.mdに ID→afterHeading対応表を必須で記載する**(全ACCエントリぶん)。
   例:

   | ID | afterHeading(完全一致テキスト) | items数 |
   |---|---|---|
   | ACC-01 | やりがちなNGケア5選 | 5 |

## 実装後の確認

- `SPEC-EXTRACT.md`§9のビルドコマンド(`npm run build`)を実行し成功を確認する
- 生成HTMLで実際に意図した見出しの直後に挿入されているか目視確認する(過去に
  `splitHtmlBlocks`の境界判定不備で意図しない位置に挿入された実例がある。
  `.claude\agents\サイト制作者\site-engineer.md:65-68`参照)
- `items[].body`の文言が工程1の原文と一致しているか差分確認する(要約・書き換え禁止)

## 残存リスクと追加検証(V-ACC-01。本項が定義の正)

この併存方式でも、後から誰かが該当H2/H3の文言を変更すると`afterHeading`の一致が無言で
外れ、アコーディオンが無言で消える。IDそのものにはこれを検知する力が無い(IDはHANDOFF内の
対応表にしか存在しないため)。工程2はこれに備え、対応表を省略・簡略化しないこと。

**V-ACC-01(源スペックのV-01〜V-15には無い、本パイプライン独自の追加検証)**

| 項目 | 内容 |
|---|---|
| 検査項目 | アコーディオンの見出し紐づけ破損 |
| 判定方法 | `HANDOFF-02.md`のID→afterHeading対応表の全行について、frontmatterの`accordions[].afterHeading`が本文中に実在するH2/H3見出しテキストと完全一致するかを機械チェックする |
| 合格条件 | 不一致0件 |
| 実施工程 | 工程4(`nevora-pipeline-verifier`) |
| 不合格時の差し戻し先 | 工程2(`nevora-accordion-implementer`) |

他のファイル(`docs/pipeline/README.md`・`nevora-pipeline-verifier.md`)はこの定義を
再掲せず、本項を参照すること。
