# VIS(図解・グラフ) 汎用11種 限定運用

`.claude/skills/nevora-pipeline/SKILL.md` を先に読んだ前提。工程1・工程3が対象。

## 決定事項(README.md #4)

**VIS(図解)の実装は、汎用11種(データ形状さえ合わせればどの記事でも使える既存chart.type)
の範囲に限定する。記事生成の中で新しいコンポーネント・新しいchart.type文字列・新しい
レンダー関数(`lib/*.js`)を追加することを禁止する。** コンポーネントの追加は記事生成とは
独立した別タスクとして、人間が必要性を判断してから行う。

根拠(SPEC-EXTRACT.md §4・§10): 既存の`chart.type`は40種類以上存在するが、汎用11種以外は
すべて「以下N種は『◯◯記事』専用」とコード内コメントで明記された**1記事だけのハードコード
実装**であり、他記事から呼んでも意味のある結果にならない。新規記事のたびに専用実装を
増やすと、V-ANのような1回限りの使い捨てコードが際限なく積み重なる。

**2026-08-08追記**: 従来の汎用7種(stat〜lineChart)に加え、記事ごとの専用widgetファイル
(asemo/pore/kusumi/hairType等)で同じ形の実装が繰り返されていた4パターン(手順図・
チェックリスト・まとめカード・見分け方比較カード)を汎用型として`lib/posts.js`に追加し、
11種になった。既存12記事の専用実装(`renderCareStepsHtml`等)は移行しておらず、新規記事は
下表の`steps`/`checklist`/`summaryCard`/`compareCards`を使う。

## 使ってよい11種(すべて `サイト運営\サイト本体\lib\posts.js` に実装済み、汎用)

| 用途 | `chart.type` | 必須フィールド | 根拠(行) |
|---|---|---|---|
| 単一数値を大きく見せる | `stat` | `value`,`unit`,`label`,`source`,`sourceUrl` | `lib/posts.js:480-525` |
| 複数カテゴリの量比較(棒グラフ) | (省略) | `title`,`data:[{label,value}]`,`unit`,`source`,`sourceUrl` | `lib/posts.js:417-478` |
| 内訳・構成比(5項目まで) | `pie` または `donut` | `title`,`data:[{label,value}]`,`unit` | `lib/posts.js:527-600` |
| メリット/デメリット比較(出典不要) | `prosCons` | `title`,`pros:[]`,`cons:[]` | `lib/posts.js:602-619` |
| 2軸ポジショニングマップ | `quadrant` | `title`,`xLabel`,`yLabel`,`data:[{label,x,y}]`(x/yは0〜100) | `lib/posts.js:621-711` |
| 質問→タイプ診断フロー | `flowchart` | `title`,`questions:[]`,`outcomes:[{label,color,answers:[]}]` | `lib/posts.js:755-788` |
| 経時変化のイメージ折れ線 | `lineChart` | `title`,`unit`,`xLabels:[]`,`series:[{label,color,points:[]}]`,`note` | `lib/posts.js:790-878` |
| 手順を番号付きで見せる(出典不要) | `steps` | `title`,`items:[{step,note}]` | `lib/posts.js:880-913` |
| 「今日からできること」チェックリスト | `checklist` | `title`(省略可),`items:[]` | `lib/posts.js:915-929` |
| 記事末の結論・次の一歩・関連記事カード | `summaryCard` | `conclusion:[]`,`nextStep`,`links:[{label,url}]`(見出し文言は固定・上書き不可) | `lib/posts.js:931-950` |
| 症状/商品の見分け方比較(横スクロールカード) | `compareCards` | `title`,`rows:[{label,color(任意),cause,appearance,itch,spot}]`(4観点キーは固定) | `lib/posts.js:952-976` |

## VISプレースホルダー→chart.type 選定の早見表(工程3が使う)

`[[VIS:ID kind:... content:... labels:... caption:... alt:...]]` を見て、以下の順で
1つ選ぶ。**当てはまるものが無ければ選ばない(=UNRESOLVED、後述)。**

1. 比較対象のない単一の割合・人数 → `stat`
2. 複数カテゴリの量を比べたい → (typeを省略、棒グラフ)
3. 内訳・構成比(合計≒100%になる) → `pie`/`donut`
4. メリット/デメリットの整理 → `prosCons`
5. 2つの性質の組み合わせ(例: 洗浄力×刺激の起きにくさ) → `quadrant`
6. 質問に答えるとタイプが決まる自己診断 → `flowchart`
7. 時間経過での変化のイメージ → `lineChart`
8. 手順・ステップを番号付きで見せたい → `steps`
9. 「今日からできること」をチェックリストで見せたい → `checklist`
10. 記事末に結論・次の一歩・関連記事リンクをカードでまとめたい → `summaryCard`
11. 症状/商品の見分け方を「原因・見た目・かゆみや痛み・できやすい部位」の4観点で
    横スクロールカード比較したい → `compareCards`(**この4観点以外の比較をしたい場合は
    選ばない**。`quadrant`や通常の表で代替できないか先に検討する)
12. 断面図・体の部位・構造を絵で見せるイラスト等、上記1〜11のどれにも当てはまらないもの
    → **選ばない。`[[UNRESOLVED:VIS-XX ...]]`にする**(下記「既知のギャップ」を参照)

### 既知のギャップ: 構造説明図は専用実装はあるが再利用可能な汎用型が無い

汎用11種はほとんどが**データ表現型**(数値・割合・分類の可視化)であり、2026-08-08に
加わった4種も**コンテンツ整理型**(手順・チェックリスト・まとめ・固定観点の比較)である。
断面図・部位比較図のような**構造説明図**(実体の物理的な構造・形状を絵で説明する図)は、
専用実装としては存在するが、汎用11種のように他記事から再利用できる型は無い
(2026-08-08、`サイト運営\サイト本体\lib\posts.js`を再確認。`CrossSection`/`Diagram`を
含む関数名は`renderLipCrossSectionHtml`・`renderMakeupCrossSectionHtml`・
`renderBarrierDiagramHtml`・`renderSkinLayerDiagramHtml`・`renderHairCrossSectionHtml`・
`renderMkskorderLayerCrossSectionHtml`・`renderScalpCrossSectionHtml`・
`renderSweatGlandCrossSectionHtml`(あせも記事)等いずれも存在するが、すべて特定の1記事専用の
chart.typeにのみ紐づいており汎用11種には含まれない。同様に診断フロー(`asemoDiagnosisFlow`
等)も記事ごとの専用実装のままで、汎用化は見送られている(判断材料はサイト側の設計検討
記録を参照)。詳細は`SPEC-EXTRACT.md`§4.2)。

**この既知のギャップに対して新規コンポーネントを追加しない。** 断面図・構造比較図が
必要なVISプレースホルダーは、上記選定早見表のどれにも一致しないため機械的に
`UNRESOLVED`になる。これは意図した挙動であり、工程3の実装漏れではない。

## プレースホルダーのフィールド対応付け

- `labels` → 選んだtypeのデータ配列のlabel群(`data[].label`/`series[].label`/
  `outcomes[].label`等)に1:1で対応させる。**labelsに無い文言を図中に追加しない**
  (源スペック§4.3のVIS実装ルールのまま)
- `caption` → chartの`title`(figcaptionとして視覚的に表示される)
- `alt` → 従来の汎用7種(stat〜lineChart)と`steps`は`<img>`ではなく
  `<svg role="img" aria-label="{title}">`で実装されており(SPEC-EXTRACT.md §4.3)、独立した
  `alt`属性の入れ物が無い。`alt`の内容は`title`に統合する。`checklist`/`summaryCard`/
  `compareCards`はsvgを使わない通常のHTML(div/figure)実装のためこの統合ルール自体が
  対象外(alt相当の入れ物がそもそも無い)。`caption`と`alt`の内容が大きく異なる場合、
  統合すると意味が変わってしまうため工程1に差し戻す(源スペック§2.6の停止ルール4に該当)
- `kind` → 上記の早見表でtypeを決める手がかりとして使う。そのままレンダリングへは渡さない

## UNRESOLVEDの扱い(源スペック§2.5のまま)

11種のいずれにも当てはまらない場合、代替実装を考えない。該当箇所に次を残して報告する。

```
[[UNRESOLVED:VIS-XX
reason: 検討した11種のうちどれが・なぜ合わなかったかを1文で。参照した本ファイルの節番号を明記
]]
```

工程4はこれをV-02で検出し不合格にする。差し戻し先は「工程0(仕様の再棚卸し)→該当実装工程」
(源スペック§7.3のまま)。**工程3が自力で新しい図解手段を発明して押し通すことは禁止**。

## 残存リスクと追加検証(V-VIS-01。本項が定義の正)

ACC(`nevora-accordion.md`)と同じ理由・同じ方式で、工程3は転記時に`afterHeading`を
一字一句取得しHANDOFF-03.mdへID→afterHeading対応表を記載する。

**V-VIS-01(源スペックのV-01〜V-15には無い、本パイプライン独自の追加検証)**

| 項目 | 内容 |
|---|---|
| 検査項目 | 図解の見出し紐づけ破損 |
| 判定方法 | `HANDOFF-03.md`のID→afterHeading対応表の全行について、frontmatterの`charts[].afterHeading`が本文中に実在するH2/H3見出しテキストと完全一致するかを機械チェックする |
| 合格条件 | 不一致0件 |
| 実施工程 | 工程4(`nevora-pipeline-verifier`) |
| 不合格時の差し戻し先 | 工程3(`nevora-visual-table-implementer`) |

他のファイル(`docs/pipeline/README.md`・`nevora-pipeline-verifier.md`)はこの定義を
再掲せず、本項を参照すること。
