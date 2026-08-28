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

// frontmatter先頭のpublishAt(公開予定日時)をタイムスタンプで返す。未指定はnull。
// gray-matterに依存させず、frontmatterブロックの行走査だけで判定する。
function readPublishAt(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  for (let i = 1; i < end; i++) {
    const m = lines[i].match(/^publishAt:\s*(.*)$/);
    if (!m) continue;
    const value = m[1].trim().replace(/^["']|["']$/g, "");
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
  }
  return null;
}

function main() {
  ensureDir(DEST_DIR);
  clearDir(DEST_DIR);

  let totalCount = 0;
  let skippedCount = 0;

  for (const sourceDir of SOURCE_DIRS) {
    if (!fs.existsSync(sourceDir)) {
      console.warn(`[sync-content] 記事データフォルダが見つかりません: ${sourceDir}`);
      continue;
    }

    const files = fs
      .readdirSync(sourceDir)
      .filter((name) => name.toLowerCase().endsWith(".md"));

    for (const file of files) {
      const srcPath = path.join(sourceDir, file);
      // 公開キューの安全弁: publishAtが未来の記事は同期しない。
      // 公開待ちの記事は「記事データ/公開待ち」に置かれ、そもそもSOURCE_DIRSに
      // 含まれないため通常はここに来ないが、確定稿へ誤って置かれた場合でも
      // サイト・sitemapに出ないようにする(scripts/queue.js参照)。
      const publishAt = readPublishAt(srcPath);
      if (publishAt && publishAt > Date.now()) {
        skippedCount += 1;
        console.log(`[sync-content] 公開予定日時が未来のためスキップ: ${file} (publishAt=${new Date(publishAt).toISOString()})`);
        continue;
      }
      fs.copyFileSync(srcPath, path.join(DEST_DIR, file));
      totalCount += 1;
    }
  }

  console.log(
    `[sync-content] ${totalCount}件の記事を同期しました${
      skippedCount > 0 ? `(公開予定日時が未来のため${skippedCount}件スキップ)` : ""
    } (${SOURCE_DIRS.join(", ")} -> ${DEST_DIR})`
  );
}

main();
