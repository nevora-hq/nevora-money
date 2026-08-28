/**
 * 公開キューの状況表示
 *
 *   npm run queue:status [-- --days 7]
 *
 * - 残り本数(割当済み / 未割当)
 * - 今後N日間(既定7日)の公開予定(休載日も明示)
 * - このペースでの在庫枯渇予定日(=最後の公開予定日)
 */
const { loadQueue, toDateStr, addDays, weekdayIndexMonday } = require("./queue-lib");

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

function parseArgs(argv) {
  let days = 7;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--days") days = Number(argv[++i]);
    else throw new Error(`[queue:status] 不明な引数: ${argv[i]}`);
  }
  if (!Number.isInteger(days) || days < 1) throw new Error("[queue:status] --days は1以上の整数");
  return { days };
}

function hhmm(d) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function main() {
  const { days } = parseArgs(process.argv.slice(2));
  const now = new Date();
  const queue = loadQueue();
  const assigned = queue.filter((q) => q.publishAt).sort((a, b) => a.publishAt - b.publishAt);
  const unassigned = queue.filter((q) => !q.publishAt);
  const future = assigned.filter((q) => q.publishAt > now);
  const overdue = assigned.filter((q) => q.publishAt <= now);

  console.log("=== 公開キューの状況 ===");
  console.log(`  在庫合計        : ${queue.length}本`);
  console.log(`  公開予定日時あり: ${assigned.length}本(うち公開待機中 ${future.length}本)`);
  console.log(`  未割当(要queue): ${unassigned.length}本`);
  if (overdue.length > 0) {
    console.log(`  ⚠ 公開時刻を過ぎたまま未反映: ${overdue.length}本(次回 queue:release で公開されます)`);
    overdue.forEach((q) => console.log(`      ${q.publishAtRaw}  ${q.title}`));
  }

  console.log(`\n=== 今後${days}日間の公開予定 ===`);
  const byDay = new Map();
  for (const q of future) {
    const key = toDateStr(q.publishAt);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(q);
  }
  for (let i = 0; i < days; i++) {
    const day = addDays(now, i);
    const key = toDateStr(day);
    const label = `${key}(${WEEKDAYS[weekdayIndexMonday(day)]})`;
    const items = byDay.get(key);
    if (!items || items.length === 0) {
      console.log(`  ${label}  — 休載`);
      continue;
    }
    console.log(`  ${label}  ${items.length}本`);
    items.forEach((q) => console.log(`      ${hhmm(q.publishAt)}  ${q.title}`));
  }

  console.log("\n=== 在庫枯渇の見通し ===");
  if (future.length === 0) {
    console.log("  公開待機中の記事がありません。記事を 公開待ち/ に追加し npm run queue を実行してください");
  } else {
    const last = future[future.length - 1].publishAt;
    const daysLeft = Math.ceil((last - now) / 86400000);
    console.log(`  最後の公開予定 : ${toDateStr(last)} ${hhmm(last)}(残り約${daysLeft}日)`);
    console.log(`  → 枯渇予定日   : ${toDateStr(last)}(この日を過ぎると公開が止まります)`);
    if (unassigned.length > 0) {
      console.log(`  ※ 未割当 ${unassigned.length}本を npm run queue で採番すると、さらに先まで伸びます`);
    }
  }
}

main();
