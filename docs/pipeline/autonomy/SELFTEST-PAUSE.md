# run-local.js の self-test の停止と再開の条件

> お金サイトの現在の期は運用期である(2026-10-10、依頼者の決定: 「運用期・設計期などありません。すべて運用期です。」)。

## 再開後の扱い

- 下の「再開条件」の1・2がそろったあとも、`run-local.js` 経由の記事の生成・修正を再び使うかどうかは、依頼者が決める(この文書は使えるようにする決定ではない)。
- `ledger-add-visual-check.js` は、検査用ビルドで `sync-content.js` を飛ばし、台帳への追記まで通しで走る作りである(台帳の代行記録の手順そのものは、この文書では変えない。お金サイトでの確認は【未確定: お金サイトでの ledger-add-visual-check.js の確認】)。

## 状態

`node scripts/autonomy/run-local.js start`(`--revise`含む)は、入口の self-test(判定条件の自己テスト)が不合格になると、`overall: "中止"`で終了する。全記事見直し・ルール改修の期間中に self-test を意図的に不合格のまま止めておく場合、これは**バグではなく意図的な状態である**(エージェントが「既存バグではないか」と誤診しないように、ここに明記する)。

## 不合格になる場合

- 注入テストの期待が、現在の `verify-article.js` の仕様と食い違うと、発火するはずの注入が発火せず不合格になる。例:
  - 項目6「NEVORAポイントの本文からハイライト(`==`)を取り除く」→ 発火せず(判定結果 N/A)
  - 項目8「視覚要素をひとつも持たないH2セクションを追加する」→ 発火せず(判定結果 Yes)
  - 項目22「sourcesを全件『(要人手確認)』付きにする」→ 発火せず(判定結果 Yes)

## 原因

self-testの期待値(`scripts/autonomy/self-test.js`・`self-test-fixtures/`)が、以下の`verify-article.js`側の仕様変更に追随していないと不合格になる:

- 項目8・項目22を「廃止・永久欠番」にし、常に`result: "Yes"`(違反なし)を返す実装に変更する
- 項目6は「参考(非ブロッキング)」へ移し、常に`result: "N/A"`を返す実装に変更する

self-testの期待値が、これらの変更以前の「注入した違反が発火するはず」という期待のまま更新されていないと、不合格になる。`self-test-result.json` の過去の `passed: true` は、その後の仕様変更のあとに self-test が合格したことを裏付けない。

## 再開条件

全記事見直し・ルール改修の期間が終わり、`run-local.js`(`start`・`--revise`とも)を記事の生成・修正の入口として再び使う際は、その前に以下を行う:

1. `scripts/autonomy/self-test.js`・`self-test-fixtures/`の期待値を、現在の`verify-article.js`の仕様(項目6=参考情報・項目8/22=廃止永久欠番)に合わせて更新する
2. 更新後、`node scripts/autonomy/run-local.js start --revise <既存記事のパス>`等でself-testが合格することを確認する

この2点が完了するまで、`run-local.js`経由での記事の生成・修正(自己テストを含む入口)は実行できない。この期間中の記事修正は「全記事見直し」の手順(`docs/pipeline/autonomy/FULL-REWRITE-PROCEDURE.md`、依頼者の目視確認+`scripts/ledger-add-visual-check.js`)を使う。

## 参照

- `docs/CONTRIBUTING.md` 40節
