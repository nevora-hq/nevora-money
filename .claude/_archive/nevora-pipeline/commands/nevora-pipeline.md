---
description: NEVORA記事制作パイプラインの現在の進捗を判定し、次に実行すべき工程のエージェントへ引き継ぐ
argument-hint: [対象記事ファイルパス(工程1開始時のみ必須)] [任意: 実行したい工程番号 0-4]
---

あなたはNEVORA記事制作パイプラインの進行管理を行います。**あなた自身は記事を書いたり
実装したりしない。** 状態を判定し、正しいエージェントへ引き継ぐことだけを行います。

引数: `$ARGUMENTS`

# 手順

1. `docs/pipeline/_source-spec-v1.md/NEVORA_article_pipeline_spec_v1.md` と
   `docs/pipeline/README.md` を読み、パイプライン全体像と決定事項ログを把握する。

2. `docs/pipeline/SPEC-EXTRACT.md` の存在を確認する。
   - 無ければ: `nevora-spec-extractor` エージェント(工程0)の実行が必要と報告し、
     ユーザーに実行してよいか確認してから Agent ツールで起動する。他の工程には進まない。

3. `docs/pipeline/RUN-PARAMS.md` の存在を確認する。
   - 無ければ: `docs/pipeline/templates/RUN-PARAMS-template.md` をコピーして
     `docs/pipeline/RUN-PARAMS.md` を作成し、**ここで停止する**。「§1相当の項目を
     埋めてから再度このコマンドを実行してください」と伝え、埋まっていない項目(⬜)を
     一覧で示す。工程1以降には絶対に進まない(源スペック§0の「1つでも空欄のまま
     パイプラインを起動しない」を厳守する)。

4. `docs/pipeline/RUN-PARAMS.md` の⬜(空欄)を確認する。1つでも残っていれば、
   その項目を列挙して停止する。

5. 引数で工程番号が明示されていればそれを使う。無ければ、以下の順で
   `docs/pipeline/HANDOFF-0N.md` / `docs/pipeline/VERIFY-REPORT.md` の存在を確認し、
   次に実行すべき工程を自動判定する:
   - `HANDOFF-01.md` が無い → 工程1(`nevora-article-drafter`)。引数の記事ファイルパスを
     `RUN-PARAMS.md` の#2に反映してから起動する(引数が無ければ新規記事パスの入力を促す)
   - `HANDOFF-01.md` はあるが `HANDOFF-02.md` が無い → 工程2(`nevora-accordion-implementer`)
   - `HANDOFF-02.md` はあるが `HANDOFF-03.md` が無い → 工程3(`nevora-visual-table-implementer`)
   - `HANDOFF-03.md` はあるが `VERIFY-REPORT.md` が無い、または最新の`VERIFY-REPORT.md`が
     「不合格」 → 工程4(`nevora-pipeline-verifier`)
   - `VERIFY-REPORT.md` が「合格」 → 「工程4まで合格済みです。公開はpublisherエージェントの
     担当のため、このコマンドの対象外です」と報告して終了する
   - `VERIFY-REPORT.md` が「条件付き合格(写真未手配N件)」 → **差し戻しではない**ため
     どの工程にも進まない。`VERIFY-REPORT.md`の写真手配リスト(ID・想定ファイルパス・alt・
     配置位置)をそのままユーザーに提示し、「画像を用意して該当箇所へ反映後、確認のため
     工程4を再実行してください」と伝えて終了する(画像の生成・配置・タグ反映はこの
     コマンド・どのエージェントも行わない。人間の作業)

6. 差し戻しループの判定: `VERIFY-REPORT.md` が不合格で、同一項目が**2回連続**不合格に
   なっている形跡がある場合(過去の`VERIFY-REPORT.md`をユーザーが保持していれば参照する。
   無ければユーザーに確認する)、**自動修正を止めて依頼者にエスカレーションする**
   (源スペック§8の「3周目に入る場合は自動修正を止め、依頼者にエスカレーションする」)。

7. 判定した工程・引き継ぎ内容(対象記事・直前のハンドオフファイル)をユーザーに
   簡潔に提示し、実行してよいか確認する。承認を得てから、Agentツールで該当する
   `nevora-pipeline` エージェントを起動する。**確認を取らずに連続して複数工程を
   自動実行しない**(1回の実行につき1工程)。

# 禁止事項

- このコマンド自身が記事を編集・生成すること
- ユーザー確認なしに工程を進めること
- RUN-PARAMS.mdの空欄を埋める判断を代わりに行うこと(依頼者が決めるべき値)
