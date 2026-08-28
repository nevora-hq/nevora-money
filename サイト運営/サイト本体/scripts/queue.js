/**
 * 公開キューへの公開予定日時(publishAt)の一括割り当て
 *
 *   npm run queue -- --weekly-min 2 --weekly-max 3 [--start 2026-09-01] [--dry-run]
 *
 * 「記事データ/公開待ち」内の publishAt 未割当の記事に、公開予定日時を採番する。
 * あわせて、URLに日付が含まれる構成(/posts/YYYY-MM-DD_タイトル)に合わせて
 * ファイル名の日付プレフィックスと frontmatter の date も公開予定日に揃える
 * (未公開=まだ誰も踏んでいないURLのため、この時点でのリネームは安全)。
 *
 * 既に publishAt を持つ記事は再割当しない。確定稿・公開済みには一切触れない。
 */
const fs = require("fs");
const path = require("path");
const {
  QUEUE_DIR,
  DATE_PREFIX_RE,
  assertInQueueDir,
  loadQueue,
  setTopLevelValue,
  toDateStr,
  toDateTimeStr,
  addDays,
  weekdayIndexMonday,
} = require("./queue-lib");
const { buildSchedule } = require("./queue-schedule");

function parseArgs(argv) {
  const args = { weeklyMin: 2, weeklyMax: 3, dryRun: false, start: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--weekly-min") args.weeklyMin = Number(argv[++i]);
    else if (a === "--weekly-max") args.weeklyMax = Number(argv[++i]);
    else if (a === "--start") args.start = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else throw new Error(`[queue] 不明な引数: ${a}`);
  }
  if (!Number.isInteger(args.weeklyMin) || args.weeklyMin < 1) throw new Error("[queue] --weekly-min は1以上の整数");
  if (!Number.isInteger(args.weeklyMax) || args.weeklyMax < args.weeklyMin || args.weeklyMax > 7)
    throw new Error("[queue] --weekly-max は --weekly-min 以上7以下の整数");
  return args;
}

/**
 * 既存の割当から採番の「開始日」を求める。
 * 既存割当の最終日の翌日から採番を続けることで、既に決まっている予定を崩さない。
 */
function resolveStart(assigned, startOverride) {
  const today = new Date();
  const tomorrow = addDays(today, 1);

  if (startOverride) {
    const d = new Date(`${startOverride}T00:00:00`);
    if (Number.isNaN(d.getTime())) throw new Error(`[queue] --start の日付が不正: ${startOverride}`);
    return { start: d };
  }
  if (assigned.length === 0) return { start: tomorrow };

  const lastDay = assigned.reduce((m, a) => (a.publishAt > m ? a.publishAt : m), assigned[0].publishAt);
  const start = addDays(lastDay, 1);
  return { start: start > tomorrow ? start : tomorrow };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(QUEUE_DIR)) {
    console.error(`[queue] 公開待ちフォルダがありません: ${QUEUE_DIR}`);
    process.exit(1);
  }

  const queue = loadQueue();
  const assigned = queue.filter((q) => q.publishAt);
  const pending = queue.filter((q) => !q.publishAt);

  if (pending.length === 0) {
    console.log(`[queue] 未割当の記事はありません(割当済み ${assigned.length}件)`);
    return;
  }

  const { start } = resolveStart(assigned, args.start);
  const schedule = buildSchedule(start, pending.length, {
    weeklyMin: args.weeklyMin,
    weeklyMax: args.weeklyMax,
  });

  const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];
  const plans = pending.map((item, i) => {
    const slot = schedule[i];
    const at = new Date(slot.date.getFullYear(), slot.date.getMonth(), slot.date.getDate(), slot.hour, slot.minute);
    const dateStr = toDateStr(at);
    // 日付プレフィックス付きなら日付部分だけ差し替え、無ければ先頭に付与する
    const m = item.filename.match(DATE_PREFIX_RE);
    const body = m ? m[2] : item.filename;
    return { item, at, dateStr, newFilename: `${dateStr}_${body}` };
  });

  // リネーム後のファイル名衝突チェック(既存ファイル・plan同士の両方)
  const existing = new Set(queue.map((q) => q.filename));
  const taken = new Set();
  for (const p of plans) {
    existing.delete(p.item.filename);
    if (existing.has(p.newFilename) || taken.has(p.newFilename)) {
      console.error(`[queue] ファイル名が衝突します: ${p.newFilename}(${p.item.filename})`);
      process.exit(1);
    }
    taken.add(p.newFilename);
  }

  console.log(
    `[queue] ${pending.length}件に公開予定日時を割り当てます(週${args.weeklyMin}〜${args.weeklyMax}本・1日1本 / 開始 ${toDateStr(start)})${
      args.dryRun ? " ※dry-run" : ""
    }`
  );

  for (const p of plans) {
    const weekday = WEEKDAYS[weekdayIndexMonday(p.at)];
    console.log(
      `  ${p.dateStr}(${weekday}) ${String(p.at.getHours()).padStart(2, "0")}:${String(p.at.getMinutes()).padStart(2, "0")}  ${p.item.title}`
    );
    if (args.dryRun) continue;

    let raw = setTopLevelValue(p.item.raw, "date", p.dateStr);
    raw = setTopLevelValue(raw, "publishAt", toDateTimeStr(p.at));

    const destPath = path.join(QUEUE_DIR, p.newFilename);
    assertInQueueDir(p.item.filePath);
    assertInQueueDir(destPath);
    fs.writeFileSync(p.item.filePath, raw, "utf8");
    if (destPath !== p.item.filePath) fs.renameSync(p.item.filePath, destPath);
  }

  const days = new Set(plans.map((p) => p.dateStr));
  console.log(
    `[queue] 完了: ${plans.length}件 / ${days.size}日ぶん(${plans[0].dateStr} 〜 ${plans[plans.length - 1].dateStr})`
  );
}

main();
