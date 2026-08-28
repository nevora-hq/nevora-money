/**
 * 公開キュー共通ロジック(queue.js / queue-status.js / queue-release.js から利用)
 *
 * 対象は「記事データ/公開待ち」配下のみ。確定稿・公開済みの既存記事には
 * 一切書き込まない(URL・公開日を変えないため)。
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), "..", "記事データ");
const QUEUE_DIR = path.join(DATA_DIR, "公開待ち");
const PUBLISHED_DIR = path.join(DATA_DIR, "確定稿");

const DATE_PREFIX_RE = /^(\d{4}-\d{2}-\d{2})_(.+)$/;

/** 公開待ちフォルダ以外への書き込みを禁止するガード */
function assertInQueueDir(filePath) {
  const resolved = path.resolve(filePath);
  const queue = path.resolve(QUEUE_DIR);
  if (resolved !== queue && !resolved.startsWith(queue + path.sep)) {
    throw new Error(`[queue] 公開待ちフォルダ外への書き込みは禁止です: ${resolved}`);
  }
}

function listQueueFiles() {
  if (!fs.existsSync(QUEUE_DIR)) return [];
  return fs
    .readdirSync(QUEUE_DIR)
    .filter((f) => f.toLowerCase().endsWith(".md") && f !== "README.md")
    .sort();
}

/**
 * frontmatterを行単位で扱う軽量パーサ。
 * gray-matterでstringifyし直すとcharts等の複雑なYAMLが再整形されてしまうため、
 * 読み取りは行スキャン、書き込みは該当行の置換のみで行う。
 */
function readFrontmatterLines(raw) {
  const lines = raw.split(/\r?\n/);
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  return { lines, end };
}

/** frontmatter直下(ネストしていない)のキーの値を取り出す */
function getTopLevelValue(raw, key) {
  const fm = readFrontmatterLines(raw);
  if (!fm) return null;
  const re = new RegExp(`^${key}:\\s*(.*)$`);
  for (let i = 1; i < fm.end; i++) {
    const m = fm.lines[i].match(re);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

/** キーが有れば置換、無ければ date の直後(なければfrontmatter末尾)に挿入 */
function setTopLevelValue(raw, key, value) {
  const fm = readFrontmatterLines(raw);
  if (!fm) throw new Error("[queue] frontmatterが見つかりません");
  const { lines, end } = fm;
  const re = new RegExp(`^${key}:\\s*`);
  const newLine = `${key}: "${value}"`;
  for (let i = 1; i < end; i++) {
    if (re.test(lines[i])) {
      lines[i] = newLine;
      return lines.join("\n");
    }
  }
  let insertAt = end;
  for (let i = 1; i < end; i++) {
    if (/^date:\s*/.test(lines[i])) insertAt = i + 1;
  }
  lines.splice(insertAt, 0, newLine);
  return lines.join("\n");
}

function removeTopLevelKey(raw, key) {
  const fm = readFrontmatterLines(raw);
  if (!fm) return raw;
  const { lines, end } = fm;
  const re = new RegExp(`^${key}:\\s*`);
  for (let i = 1; i < end; i++) {
    if (re.test(lines[i])) {
      lines.splice(i, 1);
      break;
    }
  }
  return lines.join("\n");
}

function getTitle(raw, fallback) {
  return getTopLevelValue(raw, "title") || fallback;
}

// --- 日付ユーティリティ(ローカルタイム基準、JSTで運用する前提) ---
function pad(n) {
  return String(n).padStart(2, "0");
}
function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toDateTimeStr(d) {
  return `${toDateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00+09:00`;
}
function parsePublishAt(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function addDays(d, n) {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + n);
  return copy;
}
/** 月曜始まりの週の何日目か(0=月 .. 6=日) */
function weekdayIndexMonday(d) {
  return (d.getDay() + 6) % 7;
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** キュー内の記事メタ一覧(publishAt割当済み・未割当を含む) */
function loadQueue() {
  return listQueueFiles().map((filename) => {
    const filePath = path.join(QUEUE_DIR, filename);
    const raw = fs.readFileSync(filePath, "utf8");
    const publishAtRaw = getTopLevelValue(raw, "publishAt");
    return {
      filename,
      filePath,
      raw,
      title: getTitle(raw, filename.replace(/\.md$/, "")),
      publishAtRaw,
      publishAt: parsePublishAt(publishAtRaw),
    };
  });
}

module.exports = {
  DATA_DIR,
  QUEUE_DIR,
  PUBLISHED_DIR,
  DATE_PREFIX_RE,
  assertInQueueDir,
  listQueueFiles,
  loadQueue,
  getTopLevelValue,
  setTopLevelValue,
  removeTopLevelKey,
  getTitle,
  toDateStr,
  toDateTimeStr,
  parsePublishAt,
  addDays,
  weekdayIndexMonday,
  randInt,
};
