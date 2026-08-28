/**
 * 公開時刻の到来した記事を「公開待ち」→「確定稿」へ移動する(=実際の公開)
 *
 *   npm run queue:release [-- --dry-run]
 *
 * GitHub Actions(.github/workflows/publish-queue.yml)から30分おきに実行される。
 * 確定稿へ移動された記事は次のビルドで sync-content の対象となり、サイト・
 * sitemap に出る。移動しなかった記事はサイト上のどこにも出ない。
 *
 * 表示・sitemap・JSON-LD の公開日を「実際に公開された日」に一致させるため、
 * 予定日と実際の公開日がズレた場合(ビルド停止など)は date とファイル名の
 * 日付プレフィックスを実際の公開日に書き換えてから移動する。
 *
 * 標準出力の最終行に JSON(公開した記事のタイトル一覧)を出し、Actions 側の
 * コミットメッセージ生成に使う。
 */
const fs = require("fs");
const path = require("path");
const {
  QUEUE_DIR,
  PUBLISHED_DIR,
  DATE_PREFIX_RE,
  loadQueue,
  setTopLevelValue,
  removeTopLevelKey,
  toDateStr,
} = require("./queue-lib");

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const now = new Date();
  const today = toDateStr(now);

  const due = loadQueue()
    .filter((q) => q.publishAt && q.publishAt <= now)
    .sort((a, b) => a.publishAt - b.publishAt);

  if (due.length === 0) {
    console.log("[queue:release] 公開時刻の到来した記事はありません");
    console.log(`RELEASED_JSON:${JSON.stringify([])}`);
    return;
  }

  fs.mkdirSync(PUBLISHED_DIR, { recursive: true });
  const released = [];

  for (const item of due) {
    const m = item.filename.match(DATE_PREFIX_RE);
    const body = m ? m[2] : item.filename;
    const newFilename = `${today}_${body}`;
    const destPath = path.join(PUBLISHED_DIR, newFilename);

    if (fs.existsSync(destPath)) {
      console.error(`[queue:release] 移動先に同名ファイルが既にあります(スキップ): ${newFilename}`);
      process.exitCode = 1;
      continue;
    }

    console.log(`[queue:release] 公開: ${today} <- 予定 ${item.publishAtRaw}  ${item.title}`);
    if (!dryRun) {
      let raw = setTopLevelValue(item.raw, "date", today);
      raw = removeTopLevelKey(raw, "publishAt");
      fs.writeFileSync(destPath, raw, "utf8");
      fs.rmSync(item.filePath, { force: true });
    }
    released.push({ title: item.title, slug: newFilename.replace(/\.md$/, "") });
  }

  console.log(`[queue:release] ${released.length}本を公開しました`);
  console.log(`RELEASED_JSON:${JSON.stringify(released)}`);
}

main();
