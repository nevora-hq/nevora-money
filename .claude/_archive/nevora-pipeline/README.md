# [無効化済み] NEVORA プレースホルダー方式記事制作パイプライン

**このディレクトリは無効化された旧設計です。参照してはならず、新たな実装・記事制作の
根拠として使わないこと。** `.claude/agents/`・`.claude/skills/`配下からは外してあるため
Claude Codeのスキル/エージェントとしては読み込まれないが、ファイル自体は削除せず
経緯の記録として保存してある。

## 無効化日・理由

- **無効化日**: 2026-08-09
- **理由**: NEVORAサイトの記事は、frontmatterの`accordions`/`charts`配列(見出しテキスト
  完全一致)で構造化コンテンツを表示する方式であり、本文へのプレースホルダー
  (`[[ACC:ID]]`/`[[VIS:ID]]`/`[[TBL:ID]]`/`[[PHOTO:ID]]`)埋め込みという中間工程は
  不要と判断した。実運用は`project-manager`が統括する
  分析者→ライター→レビューアー・法務→検証(`nevora-pipeline-verifier`)→編集長→配信者
  のワークフローで行われており、こちらのプレースホルダー方式パイプラインは
  一度も実行されないまま並行して存在していた

## 何が無効化されたか

以下をこのディレクトリへ移動した(元の場所には残っていない)。

| 元の場所 | 移動先 |
|---|---|
| `.claude/commands/nevora-pipeline.md` | `agents/nevora-pipeline/`ではなく`commands/nevora-pipeline.md`(本ディレクトリ内) |
| `.claude/skills/nevora-pipeline/SKILL.md` | `skills/SKILL.md` |
| `.claude/skills/nevora-pipeline/nevora-accordion.md` | `skills/nevora-accordion.md` |
| `.claude/skills/nevora-pipeline/nevora-visual.md` | `skills/nevora-visual.md` |
| `.claude/skills/nevora-pipeline/nevora-photo.md` | `skills/nevora-photo.md` |
| `.claude/agents/nevora-pipeline/nevora-article-drafter.md` | `agents/nevora-article-drafter.md` |
| `.claude/agents/nevora-pipeline/nevora-accordion-implementer.md` | `agents/nevora-accordion-implementer.md` |
| `.claude/agents/nevora-pipeline/nevora-visual-table-implementer.md` | `agents/nevora-visual-table-implementer.md` |

## 何が無効化されていないか(継続して有効)

- **`docs/pipeline/SPEC-EXTRACT.md`は無効化していない。** NEVORAサイト実装(`lib/posts.js`等)
  の実地調査結果として、記事frontmatterスキーマ・独自記法・アコーディオン/チャートの仕組み・
  画像の扱い等は現在も事実として有効であり、今後の調査・実装の参考になる
- **`.claude/agents/nevora-pipeline/nevora-pipeline-verifier.md`は移動していない。** 内容を
  project-managerワークフロー用(afterHeading一致・アコーディオン本文重複・charts数の
  3項目のみをYes/Noで判定)に全面的に書き換えたうえで、レビューアー・法務の後、編集長の前の
  ステップとして現役で使われている
- **`.claude/agents/nevora-pipeline/nevora-spec-extractor.md`は移動していない。** サイト実装が
  大きく変わった際に`SPEC-EXTRACT.md`を再調査・更新する用途で、今後も使う可能性がある

## 復活させる条件

以下のような問題が、`project-manager`ワークフロー(ライター執筆+
`nevora-pipeline-verifier`の3項目検証)を運用しても再発する場合、この一式の復活を
再検討する候補とする。

- アコーディオンの`content`と本文側の**二重表示**が、検証をすり抜けて繰り返し発生する
- 図解(`charts`)が**実装されないまま**(該当する型が無い、または見出し不一致等で)
  公開されてしまう事例が繰り返し発生する

これらが実際に繰り返し発生した場合のみ、プレースホルダー+IDベースのより厳密な
追跡の仕組み(このディレクトリの設計)を再検討する。それ以外の理由でこのディレクトリの
内容を復活・参照しないこと。
