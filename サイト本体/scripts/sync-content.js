/**
 * 記事データ同期スクリプト
 *
 * サイト運営/記事データ/確定稿 と 公開済み の *.md を、サイト本体/content/articles/ にコピーする。
 * (公開済みはThreads投稿後に確定稿から移動されるだけで、サイト掲載自体は継続するため両方を対象とする)
 * next dev / next build の前に自動実行される(package.json の predev / prebuild を参照)。
 *
 * 元データ(確定稿・公開済み)を編集するのはライター・編集長・配信者の役目であり、
 * このサイト側では content/ ディレクトリを直接編集しないこと(次回同期で上書きされる)。
 */
const fs = require("fs");
const path = require("path");

const SOURCE_DIRS = [
  path.join(process.cwd(), "..", "記事データ", "確定稿"),
  path.join(process.cwd(), "..", "記事データ", "公開済み"),
];
const DEST_DIR = path.join(process.cwd(), "content", "articles");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function clearDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, file), { force: true });
  }
}

function main() {
  ensureDir(DEST_DIR);
  clearDir(DEST_DIR);

  let totalCount = 0;

  for (const sourceDir of SOURCE_DIRS) {
    if (!fs.existsSync(sourceDir)) {
      console.warn(`[sync-content] 記事データフォルダが見つかりません: ${sourceDir}`);
      continue;
    }

    const files = fs
      .readdirSync(sourceDir)
      .filter((name) => name.toLowerCase().endsWith(".md"));

    for (const file of files) {
      fs.copyFileSync(path.join(sourceDir, file), path.join(DEST_DIR, file));
    }

    totalCount += files.length;
  }

  console.log(
    `[sync-content] ${totalCount}件の記事を同期しました (${SOURCE_DIRS.join(", ")} -> ${DEST_DIR})`
  );
}

main();
