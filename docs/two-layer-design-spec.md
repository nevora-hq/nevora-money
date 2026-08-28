# 視覚要素の二層設計 正式仕様

フェーズ2(2026-08-10)で、既存の `renderBarChartHtml`(`サイト運営\サイト本体\lib\posts.js`)パターンを正式仕様として文書化したもの。NEVORAのビジョン4「文字を補助とし、視覚情報をメインにする」を実現しつつ、検索エンジン・アクセシビリティのために**すべての視覚要素はテキストで等価な情報を持つこと**という制約(マスタープロンプトの「ビジョン4の実装原則」)を満たすための最低基準を定める。

**このドキュメントの対象**: `lib/posts.js` の `renderChartHtml` から呼ばれる各chart type(bar/donut/lineChart/prosCons/compareCards等)、およびの図解・グラフ描画関数(記事専用モジュールはCONTRIBUTING.mdルール2により新規追加禁止)。

## 二層設計の3要素(すべて必須)

新しいchart type・図解ウィジェットを追加または改修する際は、以下3点をすべて満たすこと。1つでも欠けると「画像内テキストだけに情報を置く」状態になり、マスタープロンプトの制約に違反する。

### 1. `role="img"` + `aria-label`

SVGを描画する要素には必ず `role="img"` と、グラフ全体の内容を要約する `aria-label` を付与する。

```html
<svg viewBox="..." class="chart-svg" role="img" aria-label="{グラフのタイトル}">
```

スクリーンリーダー利用者は`aria-label`だけでグラフの主題を把握できる必要がある。

### 2. SVG内に実テキストとしてラベル・数値を描画する

グラフ内の各項目のラベル・数値は、SVG内の`<text>`要素として**実テキスト**で描画する(画像化・パス化しない)。`renderBarChartHtml`では `class="chart-cat-label"`(項目名)・`class="chart-value-label"`(数値)として各バーの`<text>`に描画している。

- 検索エンジンのクローラーはSVG内の`<text>`もインデックス対象にできるため、装飾目的の画像(webp/png等)とは異なりテキスト情報が失われない。
- 色だけで意味を伝えない(色覚特性への配慮)。ラベル・数値は必ずテキストとして併記する。

### 3. `<details>` + `<table>` によるデータ表フォールバック

グラフの下(または近接)に、同じデータを表形式で確認できる `<details><summary>データを表で見る</summary><table>...</table></details>` を必ず設置する。

- JS未実行環境・SVG非対応環境でも、`<details>`はネイティブに開閉可能でデータにアクセスできる。
- 表は`<thead>`で列見出しを明示し、グラフと同じデータを過不足なく含める。

```html
<details class="chart-table-toggle">
  <summary>データを表で見る</summary>
  <table class="chart-table">
    <thead><tr><th>項目</th><th>値</th></tr></thead>
    <tbody>...</tbody>
  </table>
</details>
```

## 出典表示(数値グラフの場合)

数値を伴うグラフ(bar/stat/lineChart等)は、`chart.source`(出典名)・`chart.sourceUrl`(URL)を`figcaption`として描画する(`renderBarChartHtml`の`sourceHtml`部分)。

- **フェーズ0監査B4(出典不明な数値)を再発させないため**、`source`は必ず設定すること。空欄のまま公開しない。
- 編集部独自の調査・試算である場合は、`source`に「編集部調査(n=◯、調査方法、実施時期)」のように明記し、外部の一次情報と誤認されない表現にする(フェーズ1指示7項の方針、`docs/citation-format.md`の`editorial`タイプとも整合させる)。
- `source`はあるが検証可能な `sourceUrl` が無い場合(編集部調査・非公式ヒアリング等)は、それを隠さずそのままラベルに含める。実在しない・確認できないURLを`sourceUrl`に書かない。

## 実写真(`![alt](path)`)のalt要件

- altテキストは「写真」「image」等の形骸的な文言ではなく、写真が示す具体的な状況を説明する文で書く(既存記事のサンプル確認では概ね遵守されている。フェーズ0監査観点5参照)。
- 画像内にのみ存在する情報(画像に埋め込まれた数値・ラベル等)を作らない。数値・データは必ず本文またはグラフのテキスト側にも存在させる。

## セルフ診断のクロール可能性

`type: "diagnosis"` の診断ウィジェット(`renderDiagnosisHtml` + `components/diagnosisWidget.js`)は、質問・選択肢・結果(`outcomes`)がすべてfrontmatterのデータとして存在し、静的HTMLとしてサーバー側でレンダリングされる(JSは進行状態の切り替えのみを担当するプログレッシブエンハンスメント)。新しい診断コンテンツを追加する場合もこの設計を踏襲し、診断ロジック・結果文言をJS側にしか存在しない形で実装しないこと。

## 新しいchart type / ウィジェットを追加する際のチェックリスト

1. `role="img"` + `aria-label` を設定したか
2. ラベル・数値がSVG内の実テキストとして描画されているか(パス化・画像化していないか)
3. `<details><table>` によるデータ表フォールバックがあるか
4. 数値を伴う場合、`source`(必要なら`sourceUrl`)を設定したか。編集部調査の場合は`docs/citation-format.md`の`editorial`形式に沿っているか
5. 色だけに意味を持たせていないか(テキストの併記があるか)
6. (CONTRIBUTING.mdルール2)新しい記事専用モジュール(`lib\*Widgets.js`)を追加していないか。既存の`type`で表現できないか、`lib\posts.js`側の汎用レンダラーへの追加で対応できないかを先に検討したか

## 既知の限定的な例外

記事専用モジュール(`lib/*Widgets.js`・`lib/*Extras.js`)はお金サイトへの移行時に全て削除済みのため、現在この仕様の対象は `lib/posts.js` の `renderChartHtml` から呼ばれる汎用chart typeのみである。
