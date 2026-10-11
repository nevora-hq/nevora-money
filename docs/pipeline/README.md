# NEVORA 記事制作パイプライン(実行レイヤー)README

> **[2026-08-09 無効化済み]** このREADMEが記述する実行レイヤー(プレースホルダー方式・
> 工程0〜4・RUN-PARAMS.md・HANDOFFファイル等)は**無効化された**。詳細・理由・復活条件は
> `.claude/_archive/nevora-pipeline/README.md`を参照。実運用の記事制作は
> `サイト運営/サイト本体/scripts/autonomy/run-local.js`(依頼者の「記事制作を実行して」で起動)
> ただ一つの経路で行う(2026-09-11。それまで統括していた`project-manager`は廃止。設計は
> `docs/pipeline/autonomy/DESIGN.md`)。**`docs/pipeline/SPEC-EXTRACT.md`は
> 無効化していない。** サイト実装(`lib/posts.js`等)の事実記録として現在も有効。
> このREADME自体は経緯の記録として残しているが、以下の内容(決定事項#14を除く)は
> 無効化された設計を前提にしている。

このディレクトリは、`_source-spec-v1.md`(設計・ルールの正、変更しない)と
`SPEC-EXTRACT.md`(既存コードベースの事実、工程0が固定した基準)の上に、
実際に動かすための実行レイヤー(サブエージェント5つ・スキル・スラッシュコマンド・
記事YAMLテンプレート)を載せたものである。

**このREADMEは「決定事項の記録」を主目的とする。** `_source-spec-v1.md`はルールブックとして
不変を保ち、`SPEC-EXTRACT.md`は既存コードの事実記録として不変を保つ。両者だけでは
決まらなかった/矛盾していた論点に対する**依頼者の決定**をここに集約する。

---

## 読む順序(すべてのエージェント共通)

1. `docs/pipeline/_source-spec-v1.md/NEVORA_article_pipeline_spec_v1.md` — §1(依頼者確定値)と§2(共通規約)、および自分の担当章
2. `docs/pipeline/SPEC-EXTRACT.md` — 既存コードベースの事実(記法・コンポーネント・アコーディオン・画像・マスコット・実測値)
3. このREADME — 上記2つだけでは決まらなかった論点の決定事項
4. `docs/pipeline/RUN-PARAMS.md` — 今回の記事1本ぶんの§1相当パラメータ(無ければ`/nevora-pipeline`コマンドが雛形を作る)
5. 直前工程のハンドオフファイル(`docs/pipeline/HANDOFF-0N.md`)

---

## 決定事項ログ(2026-08-08)

`SPEC-EXTRACT.md`の「確認すべき未確定事項」に対する依頼者の回答。今後この一覧に
反する実装をしないこと。変更したい場合は実装を進めず、依頼者に再確認すること。

| # | 論点 | 決定 | 根拠・補足 |
|---|---|---|---|
| 1 | 1段落の上限文字数 | **140字**(全角換算) | `SPEC-EXTRACT.md`§7.5の提案どおり採用。実測最大149字・平均62字が根拠 |
| 1 | テキスト段落の連続許容数 | **2**(3つ以上禁止) | `SPEC-EXTRACT.md`§7.5の提案どおり採用。旧サイト(美容)の基準記事に1件例外があることは記録済みだが、新規記事では基準どおり2を守る |
| 2 | 文字数の集計範囲 | **Markdown本文のみ**。プレースホルダーブロック(`[[ACC:...]]`/`[[VIS:...]]`/`[[TBL:...]]`/`[[UNRESOLVED:...]]`)の中身は文字数に含めない | frontmatterやプレースホルダー内のデータは「本文の文章量」ではなく構造化データのため |
| 3 | V-15(Lint)の扱い | **SKIP**と明記して対象外にする。理由は「ESLint未設定のため」。ESLint整備後に有効化する | `npm run lint`が現状exit 1で失敗する(`SPEC-EXTRACT.md`§9)。今回のタスクではLintの修正は行わない |
| 3 | V-14(ビルド)の扱い | **必須のまま変更なし** | `npm run build`は成功済み(`SPEC-EXTRACT.md`§9) |
| 4 | VIS(図解)の実装範囲 | **汎用7種(bar/stat/pie・donut/prosCons/quadrant/flowchart/lineChart)の範囲に限定**。記事生成の中で新規コンポーネント・新規chart.type・新規レンダー関数を実装することを**禁止** | 詳細は`.claude/_archive/nevora-pipeline/skills/nevora-visual.md`。7種で表現できない場合は代替を発明せず`[[UNRESOLVED:VIS-XX]]`を残し、工程4を不合格にする。コンポーネント追加は記事生成と独立した別タスクとして人間が判断する |
| 5 | プレースホルダー(`[[ACC:ID ...]]`等)と既存レンダラー(frontmatter+見出しテキスト一致)の整合方針 | **プレースホルダー文法(ID方式)を維持する。既存レンダラーがfrontmatterからしかデータを受け取れない制約に対しては、工程2/3が「本文プレースホルダー→frontmatter転記+`<!-- impl:ID -->`」という**併存方式**で橋渡しする | 見出し名の完全一致だけに頼ると、見出し文言の変更で紐づけが無言で外れ「実装したつもりで未実装」を検出できない。ID方式ならHANDOFF経由でV-03により機械検出できる。詳細手順は`.claude/_archive/nevora-pipeline/skills/nevora-accordion.md`(ACC)・`nevora-visual.md`(VIS)。**この併存方式にも残存リスクがある**(後述「残存リスクと追加検証」参照) |
| 6 | 消費マーカー構文 | **`<!-- impl:ID -->`(標準HTMLコメント)を正式採用** | `SPEC-EXTRACT.md`§8の実機検証により、源スペック§2.4例示の`{/* impl:ID */}`(JSXコメント)はこのプロジェクトでは可視テキストとして出力されてしまい機能しないことを確認済み |
| 7 | 基準記事3本の扱い | お金サイトの記事3本(公開済み1・確定稿2)(2026-10-07 火災保険の水災補償は必要か判断手順〔保険〕/2026-10-10 貯蓄の平均と中央値二人以上世帯〔家計・節約〕/2026-08-29 NISA金融機関変更の期限と手順〔投資〕。選定理由は下記)を**基準記事として固定する。生成した記事をこの基準記事に昇格させる場合は人間の承認を要する** | `SPEC-EXTRACT.md`§0.3に同文言を追記済み |
| 8 | 旧サイト(美容)の`美顔器効果を感じない原因と選び方`記事の`date`欠落(お金サイトの記事には該当なし) | **修正しない**。既知の欠陥として記録のみ | 本パイプラインの対象外。触らない |
| 9 | 工程4(検証)のtools・書き込み範囲 | `Read, Glob, Grep, Bash, Write`。**Writeは`VERIFY-REPORT.md`と`docs/pipeline/work/`配下のみ**。記事・画像・コンポーネントへの書き込みは禁止。V-16(検証者の非改変)を追加 | ビルド確認(V-14)にはBashが要るためWriteだけを禁止しても不十分。書き込み範囲そのものを限定し、`git status --porcelain`による事後チェック(V-16)で担保する。定義は`.claude/agents/nevora-pipeline-verifier.md` |
| 10 | VIS 7種に構造説明図(断面図・比較図等)が無い件 | 既知のギャップとして記録するに留め、**新規コンポーネントは追加しない**。該当要求は`UNRESOLVED`になる | `lib/posts.js`を再確認し、汎用7種がすべてデータ表現型で構造説明図が無いことを確認済み。詳細は`SPEC-EXTRACT.md`§4.2・`.claude/_archive/nevora-pipeline/skills/nevora-visual.md`「既知のギャップ」節 |
| 11 | 本文写真(`PHOTO`)を4種目のプレースホルダーTYPEとして追加 | **追加する。`_source-spec-v1.md`自体は変更しない**(本パイプライン運用上の追加として`.claude/_archive/nevora-pipeline/skills/nevora-photo.md`に定義)。文法・ID採番・消費マーカーは既存3種(ACC/VIS/TBL)と同じ規則。必須フィールドは`intent`/`content`/`alt`。工程3(`nevora-visual-table-implementer`)の担当。**UNRESOLVED運用にはしない**: 工程3は配置位置と`alt`の確定までを行い、実ファイルの用意(生成・撮影)は人間が行う。受け渡しは`HANDOFF-03.md`の「画像手配リスト」 | 既存の本文写真はfrontmatterを経由せず本文へ直接`![alt](path)`を書く方式で、`ACC`/`VIS`のような見出しテキスト一致の制約が無いことを確認(`SPEC-EXTRACT.md`§4.4)。画像ファイル未用意時に候補位置だけ書き残し後で人間が反映する運用は既存(`writer.md:72`)にあり、これを踏襲した |
| 12 | V-17(写真の手配状況)を追加。総合判定を3状態化 | 工程4に**V-17**(`status=pending-photo`の件数を報告)を追加。**総合判定は「合格」「条件付き合格(写真未手配N件)」「不合格」の3状態**にする。V-17が1件以上ある場合、他の必須項目がすべてYesでも「合格」とは表示せず「条件付き合格」とする。0件で初めて「合格」。`VERIFY-REPORT.md`に未手配のID・想定パスの一覧を出力する。**条件付き合格は差し戻しではない**(源スペック§8の2周ループ対象にしない) | 定義は`.claude/_archive/nevora-pipeline/skills/nevora-photo.md`「V-17」節。判定表・出力様式・完了条件は`nevora-pipeline-verifier.md` |
| 13 | V-09(未使用記法)から消費マーカーのHTMLコメントを除外 | **確認の結果、除外規定が無く不具合だった(修正済み)**。V-09は走査前に本文からHTMLコメント(`<!-- impl:... -->`等)をすべて除去してから記法パターンを検出する方式に変更した | 除外していないと、正しく設置した消費マーカー(`impl:ID`・`status=pending-photo`)が`SPEC-EXTRACT.md`§1のカタログに無い記法として誤検出され、正常な実装がV-09で不合格になる不具合があった。site側の`stripHtmlComments`(`lib/posts.js:164-166`)と同じ前処理に揃えることで解消。定義は`nevora-pipeline-verifier.md`「V-09の実施方法」節 |
| 14 | **プレースホルダー方式パイプライン一式を無効化(削除はしない)** | 工程0〜3のエージェント3つ(article-drafter/accordion-implementer/visual-table-implementer)・共通スキル一式(SKILL.md/nevora-accordion.md/nevora-visual.md/nevora-photo.md)・`/nevora-pipeline`コマンドを`.claude/_archive/nevora-pipeline/`へ移動し、`.claude/agents/`・`.claude/skills/`から外した(=Claude Codeからは読み込まれない)。**`nevora-pipeline-verifier.md`と`nevora-spec-extractor.md`は移動せず存続**(前者はproject-managerワークフロー用に全面改修済み、後者は`SPEC-EXTRACT.md`再調査用に温存)。`SPEC-EXTRACT.md`は無効化していない | 理由: サイトはfrontmatter(`accordions`/`charts`配列+見出しテキスト一致)方式であり、本文へのプレースホルダー埋め込みという中間工程は不要と判断。実運用はproject-manager統括のワークフロー(分析者→ライター→レビューアー・法務→検証→編集長→配信者)で行われており、このパイプラインは一度も実行されないまま存在していた。復活条件は`.claude/_archive/nevora-pipeline/README.md`に記載(二重表示・図解未実装がproject-manager運用でも繰り返し再発した場合のみ再検討) |

**基準記事3本の選定理由(2026-10-11、実記事のfrontmatterを確認して選定。カテゴリが分かれるように選んだ)**

- `サイト運営\記事データ\公開済み\2026-10-07_火災保険の水災補償は必要か判断手順.md`〔保険〕: chartsに数値推移(stat)・断面図(crossSection)・手順(steps)・チェック(checklist)・横スクロール比較表(compareScroll)がそろい、accordionsと内部リンクも持つ図解・折りたたみの型の見本
- `サイト運営\記事データ\確定稿\2026-10-10_貯蓄の平均と中央値二人以上世帯.md`〔家計・節約〕: 折れ線(lineChart)・チェック・横スクロール比較表を使う統計解説の型。出典URLと図表ごとのsource/sourceUrlの書き方の見本
- `サイト運営\記事データ\確定稿\2026-08-29_NISA金融機関変更の期限と手順.md`〔投資〕: 断面図(crossSection)・診断(diagnosis)・チェック・比較表とアコーディオンを備えた手続き解説の型。sourcesのprimary/secondary区分の見本

※ 2026-10-11 106万円の壁〔保険〕は`sectionAlternate: false`入りの最新形式のfrontmatterの参照用(型の見本は上記3本)。

---

## 併存方式の残存リスクと追加検証(V-ACC-01 / V-VIS-01)・V-16

決定事項5の併存方式(本文はID・実装はfrontmatterの見出しテキスト一致)は、**レンダリングの
瞬間だけは依然として見出しテキストの完全一致に依存する**残存リスクがある。この対処として
`_source-spec-v1.md`§7.1のV-01〜V-15に**加えて**、本パイプライン独自の検証を追加している
(**これは源スペックへの変更ではなく、本パイプライン固有の追加チェック**)。

**定義の正はここではなく各スキルファイル/エージェント定義に置く(重複を避けるため)。**

| # | 検査内容(概要) | 定義の所在 |
|---|---|---|
| V-ACC-01 | アコーディオンの見出し紐づけ破損検査 | `.claude/_archive/nevora-pipeline/skills/nevora-accordion.md`「残存リスクと追加検証」節 |
| V-VIS-01 | 図解の見出し紐づけ破損検査 | `.claude/_archive/nevora-pipeline/skills/nevora-visual.md`「残存リスクと追加検証」節 |
| V-16 | 工程4自身が記事ファイルを改変していないことの検査 | `.claude/agents/nevora-pipeline-verifier.md`「V-16の実施方法」節 |

検証項目の全リスト(V-01〜V-16・V-ACC-01・V-VIS-01)は
`.claude/agents/nevora-pipeline-verifier.md`の判定表を参照する
(このREADMEでは個々の判定方法・合格条件を再掲しない)。

---

## ID↔見出しテキスト 併存方式の概要(詳細は各スキルファイル)

- **ACC**: `.claude/_archive/nevora-pipeline/skills/nevora-accordion.md`
- **VIS**: `.claude/_archive/nevora-pipeline/skills/nevora-visual.md`
- **TBL**: frontmatterを経由しない(本文にGFM表をそのまま書く)ため、見出しテキスト一致の問題が発生しない。`.claude/_archive/nevora-pipeline/skills/SKILL.md`に手順を記載
- **PHOTO**(決定事項#11、源スペックに無い4種目): TBLと同じくfrontmatterを経由しないため見出しテキスト一致の問題は発生しない。ただし実ファイルの用意は工程3の範囲外(UNRESOLVED運用にはしない)。`.claude/_archive/nevora-pipeline/skills/nevora-photo.md`に手順を記載

---

## 構成ファイル一覧

**2026-08-09時点、下表のうち「状態」が無効化済みの行は`.claude/_archive/nevora-pipeline/`へ
移動済み。パスは移動後の場所を示す。**

| 種別 | パス | 役割 | 状態 |
|---|---|---|---|
| ルール(不変) | `docs/pipeline/_source-spec-v1.md/NEVORA_article_pipeline_spec_v1.md` | パイプライン設計の正 | 保持(参照のみ、無効化の対象外) |
| 事実(不変) | `docs/pipeline/SPEC-EXTRACT.md` | 既存コードベースの棚卸し結果 | **有効(無効化していない)** |
| 決定事項(本ファイル) | `docs/pipeline/README.md` | 未確定事項への回答・追加検証の定義 | 経緯記録として保持(決定事項#14が最新) |
| 実行時パラメータ | `docs/pipeline/RUN-PARAMS.md`(未生成) | 記事1本ぶんの§1相当パラメータ | 無効化済み(生成する`/nevora-pipeline`コマンド自体が無効化済み) |
| 記事frontmatterテンプレート | `docs/pipeline/templates/article-frontmatter-template.md` | 工程1が新規記事作成時にコピーする雛形 | 無効化済みパイプライン専用(ファイル自体は未移動) |
| スキル(共通) | `.claude/_archive/nevora-pipeline/skills/SKILL.md` | プレースホルダー構文・ID規則・停止ルールの要約と各章への導線 | 無効化済み |
| スキル(VIS) | `.claude/_archive/nevora-pipeline/skills/nevora-visual.md` | 汎用7種のフィールド定義・禁止事項・UNRESOLVED運用 | 無効化済み |
| スキル(ACC) | `.claude/_archive/nevora-pipeline/skills/nevora-accordion.md` | ID↔見出しテキスト併存方式の実装手順 | 無効化済み |
| スキル(PHOTO) | `.claude/_archive/nevora-pipeline/skills/nevora-photo.md` | 本文写真プレースホルダー(源スペックに無い4種目)の文法・pending-photoマーカー・HANDOFF-03.md画像手配リストの様式 | 無効化済み |
| エージェント(旧工程0) | `.claude/agents/nevora-spec-extractor.md` | 仕様棚卸し | **有効・存続**(移動していない) |
| エージェント(旧工程1) | `.claude/_archive/nevora-pipeline/agents/nevora-article-drafter.md` | 本文執筆+プレースホルダー配置 | 無効化済み |
| エージェント(旧工程2) | `.claude/_archive/nevora-pipeline/agents/nevora-accordion-implementer.md` | アコーディオン実装 | 無効化済み |
| エージェント(旧工程3) | `.claude/_archive/nevora-pipeline/agents/nevora-visual-table-implementer.md` | ビジュアル・表・写真(PHOTO)実装 | 無効化済み |
| エージェント(旧工程4→転用) | `.claude/agents/nevora-pipeline-verifier.md` | (旧)最終検証。**(新)project-managerワークフロー用にafterHeading一致・アコーディオン本文重複・charts数の3項目のみを判定するエージェントとして全面改修** | **有効・存続するが役割が別物に変更済み**(移動していない) |
| コマンド | `.claude/_archive/nevora-pipeline/commands/nevora-pipeline.md` | 現在の進捗を判定し、次の工程のエージェントへ引き継ぐ | 無効化済み |

## この実行レイヤーと既存の記事制作エージェント群の関係(過去の設計。現状は下記参照)

> 以下は本パイプラインが有効だった当時の記述で、経緯として残している。**現状(2026-09-11以降)は
> `サイト運営/サイト本体/scripts/autonomy/run-local.js` ただ一つの経路に統合されている
> (企画 → 執筆 → 多層判定 → 公開待ち。設計は`docs/pipeline/autonomy/DESIGN.md`)。**
> (2026-10-11 依頼者の決定: 指摘はア〔差し戻す〕・イ〔まとめて直す〕・ウ〔差し戻さない〕に分ける。差し戻したあとは直した所に関係する判定だけをやり直し、上限は1つの記事で合計5回〔第3層は1回まで〕。公開待ちに置いて push したあとは、自動処理を待たず公開キューを手動で実行してすぐ公開する。詳細は `.claude/skills/run-article-production/SKILL.md` の「判定の流れ」と `docs/pipeline/JUDGE-ITEMS.md`。)

`.claude/agents/writer.md`・`.claude/agents/editor-in-chief.md`等、
プロジェクト全体の既存エージェント群は**ジャンル汎用**(`[対象ジャンル]`プレースホルダー方式、
CLAUDE.mdの「対象分野」が唯一の情報源)で、キーワード調査から公開までのPDCA全体を担う。

対して本パイプライン(`nevora-pipeline`一式、無効化済み)は、**NEVORAサイトの実装
(`lib/posts.js`等)に直接依存する技術的な自動化レイヤー**であり、ジャンル非依存の設計にはしていない
(`[対象ジャンル]`プレースホルダーを使わない)。両者は別物として扱い、混同しない。
本パイプラインは主に工程1(本文執筆)以降を担い、キーワード調査・法務チェック・
公開作業(publisher)は既存エージェント群の担当のままとする。

デプロイ確認 2026-08-08
デプロイ確認(nevora-money) 2026-08-08
