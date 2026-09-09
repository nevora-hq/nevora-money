#!/usr/bin/env node
/**
 * Pinterest用の縦長ピン画像(1000x1500 / 2:3 PNG)とマニフェストCSVを生成する。
 *
 *   npm run build                                   … 事前に必須(next startで実ページを描画するため)
 *   node scripts/generate-pinterest-pins.js --sample … サンプル数記事(異なるカテゴリ)のみ生成
 *   node scripts/generate-pinterest-pins.js <slug> ... … 指定slugのみ生成
 *   node scripts/generate-pinterest-pins.js --all     … 全記事を生成
 *
 * 生成方式・実装方針は姉妹サイト(美容サイト)の同名スクリプトを移植したもの。
 * Playwrightで実際の記事ページを開き、そのページのCSS/フォントを保ったままbody内容だけを
 * ピン用の3段レイアウトに差し替えて1000x1500でスクリーンショットする
 * (記事HTML内の図解はlib/posts.jsが組み立てて出力しglobals.cssのクラスで配色が決まるため)。
 *
 * 出力先はリポジトリ直下の pinterest-pins/(public配下ではないため公開ビルドには
 * 含まれない)。既存のサムネイル生成・記事ビルド処理には一切手を入れていない。
 *
 * 記事側で図解・タイトルを指定したい場合はfrontmatterに以下を追加できる(任意):
 *   pinFigure: 3        … 何番目の図解を使うか(1始まり。既定は最後の図解=結論に最も近い)
 *   pinTitle: "短縮キャッチ" … ピン上部に出す短縮タイトル(既定は記事タイトル)
 */
const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const matter = require("gray-matter");

const PORT = 4321;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SITE_URL = "https://nevora-money.vercel.app";
const ARTICLES_DIR = path.join(__dirname, "..", "content", "articles");
// リポジトリ直下(サイト運営/サイト本体 から2つ上)に出力する。
const OUT_DIR = path.join(__dirname, "..", "..", "..", "pinterest-pins");

const PIN_WIDTH = 1000;
const PIN_HEIGHT = 1500;

// カテゴリ → Pinterestボード名。お金サイトはlib/categoryMeta.jsのMAJOR_CATEGORIESと
// 表記ゆれが無いため、カテゴリ名をそのままボード名に使う。
const BOARD_BY_CATEGORY = {
  "投資": "投資",
  "FX": "FX",
  "税金・節税": "税金・節税",
  "保険": "保険",
  "家計・節約": "家計・節約",
  "クレカ・ポイント": "クレカ・ポイント",
};
const DEFAULT_BOARD = "家計・節約";

// カテゴリ → 担当マスコット。lib/categoryMascot.js の CATEGORY_MASCOTS と同じ対応。
// (同ファイルはESMでNode CLIからそのままrequireできないため、画像パスと名前だけ持つ)
const MASCOT_BY_CATEGORY = {
  "投資": { file: "fuyamin", name: "フヤミンちゃん" },
  "FX": { file: "kawasemin", name: "カワセミンちゃん" },
  "税金・節税": { file: "zeimin", name: "ゼイミンちゃん" },
  "保険": { file: "mamomin", name: "マモミンちゃん" },
  "家計・節約": { file: "kakeimin", name: "カケイミンちゃん" },
  "クレカ・ポイント": { file: "poimin", name: "ポイミンちゃん" },
};
const DEFAULT_MASCOT = { file: "coinmin", name: "コインミンちゃん" };

// --sample で使う既定の記事(異なるカテゴリを含む3記事)。
const SAMPLE_SLUGS = [
  "2026-08-28_こどもNISA2027年開始予定", // 投資
  "2026-08-29_FXレバレッジと証拠金の仕組み", // FX
  "2026-08-30_家計調査2025から見る支出の内訳", // 家計・節約
];

function killPort(port) {
  const pids = new Set();
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
      out.split("\n").forEach((line) => {
        const m = line.trim().match(/LISTENING\s+(\d+)\s*$/);
        if (m) pids.add(m[1]);
      });
    } else {
      const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      out.split("\n").forEach((t) => /^\d+$/.test(t.trim()) && pids.add(t.trim()));
    }
  } catch (e) {
    /* listenしているプロセスが無い場合はnetstat/lsofが非0で落ちる。無視してよい */
  }
  pids.forEach((pid) => {
    try {
      if (process.platform === "win32") execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
      else process.kill(Number(pid), "SIGKILL");
    } catch (e) {
      /* 既に終了している場合がある */
    }
  });
}

function waitForServer(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryFetch = () => {
      const http = require("http");
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) reject(new Error("server did not become ready in time"));
        else setTimeout(tryFetch, 500);
      });
      req.setTimeout(2000, () => req.destroy());
    };
    tryFetch();
  });
}

function loadArticles() {
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data } = matter(fs.readFileSync(path.join(ARTICLES_DIR, f), "utf8"));
      return { slug: f.replace(/\.md$/, ""), fm: data };
    });
}

// ピン説明文案: meta descriptionをベースに、関連キーワードを自然な一文に織り込む。
// タグをそのまま並べると検索クエリの羅列になり読み物として不自然なため、
//   - 検索クエリ調のタグ(空白を含むもの)
//   - すでにmeta descriptionに現れている語
// を除いたうえで、残った2語までを一文に織り込む。残らなければ補完自体を省略する。
// Pinterestの説明文上限は500字。超える場合は末尾を丸める。
function buildPinDescription(fm) {
  const base = String(fm.description || "").trim();
  const category = String(fm.category || "");
  const tags = Array.isArray(fm.tags) ? fm.tags.map((t) => String(t).trim()) : [];
  const usable = tags.filter(
    (t) => t && t !== category && !/\s/.test(t) && t.length >= 2 && !base.includes(t)
  );
  const picked = usable.slice(0, 2);
  const keywordLine = picked.length
    ? `${picked.join("と")}についても、公的データや制度の情報にもとづいて解説しています。`
    : "";
  const tail = `くわしくは「NEVORA|お金の総合ガイド」の記事をご覧ください。#${category.replace(
    /[・\s]/g,
    ""
  )}`;
  let text = [base, keywordLine, tail].filter(Boolean).join(" ");
  if (text.length > 500) text = `${text.slice(0, 499)}…`;
  return text;
}

// ピンタイトル案: 記事タイトルをそのまま使う(100字超過時のみ末尾を丸める)。
function buildPinTitle(fm) {
  const title = String(fm.title || "").trim();
  return title.length > 100 ? `${title.slice(0, 99)}…` : title;
}

function csvCell(v) {
  const s = String(v == null ? "" : v);
  return `"${s.replace(/"/g, '""')}"`;
}

function buildRow(slug, fm) {
  const category = String(fm.category || "");
  return {
    slug,
    url: `${SITE_URL}/posts/${encodeURIComponent(slug)}`,
    category,
    board: BOARD_BY_CATEGORY[category] || DEFAULT_BOARD,
    pinTitle: buildPinTitle(fm),
    pinDescription: buildPinDescription(fm),
  };
}

// CSVの1行(ダブルクォート区切り、""はエスケープされたダブルクォート)をセル配列に分解する。
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

// マニフェスト: 既存行はslug単位でマージし、今回生成した分で上書きする
// (部分生成のときに過去分が消えないようにするため)。
// ステータス列(D列, ボード名の右)はPinterestへの投稿管理用にExcelで手動更新する運用のため、
// 既存slugの値はそのまま引き継ぎ、新規slugのみ既定値「未投稿」を入れる。
function writeManifest(rows) {
  const manifestPath = path.join(OUT_DIR, "pinterest.csv");
  const prevStatus = new Map();
  if (fs.existsSync(manifestPath)) {
    const prevLines = fs.readFileSync(manifestPath, "utf8").replace(/^﻿/, "").split(/\r?\n/).slice(1);
    prevLines.forEach((line) => {
      if (!line.trim()) return;
      const cells = parseCsvLine(line);
      if (cells[0]) prevStatus.set(cells[0], cells[4] || "未投稿");
    });
  }
  const merged = new Map();
  rows.forEach((r) => {
    const status = prevStatus.get(r.slug) || "未投稿";
    merged.set(
      r.slug,
      [r.slug, r.url, r.category, r.board, status, r.pinTitle, r.pinDescription].map(csvCell).join(",")
    );
  });
  // 今回対象外だった既存行はそのまま保持する
  if (fs.existsSync(manifestPath)) {
    const prevLines = fs.readFileSync(manifestPath, "utf8").replace(/^﻿/, "").split(/\r?\n/).slice(1);
    prevLines.forEach((line) => {
      if (!line.trim()) return;
      const cells = parseCsvLine(line);
      const slug = cells[0];
      if (slug && !merged.get(slug)) merged.set(slug, line);
    });
  }
  const header = ["slug", "記事URL", "カテゴリ名", "ボード名", "ステータス", "ピンタイトル案", "ピン説明文案"]
    .map(csvCell)
    .join(",");
  // Excelで文字化けしないようUTF-8 BOM付きで書き出す
  fs.writeFileSync(manifestPath, `﻿${header}\n${[...merged.values()].join("\n")}\n`, "utf8");
  return merged.size;
}

/**
 * 記事ページを開いたブラウザ上で、bodyをピン用の3段レイアウトに差し替える。
 * headはそのまま(サイトのCSS・Webフォント)なので図解の配色・書体が記事と一致する。
 */
function buildPinInPage(opts) {
  const { title, figureIndex, siteName, domain, mascotSrc, category } = opts;
  // 記事によってはグラフ系(article-chart)が無く、メリット/デメリット表(pros-cons-block)や
  // 数値タイル(article-stat-tile)だけのことがある。その場合はそれらを図解として扱う。
  let figures = Array.from(document.querySelectorAll("figure.article-chart"));
  if (figures.length === 0) {
    figures = Array.from(
      document.querySelectorAll("figure.pros-cons-block, figure.article-stat-tile")
    );
  }
  if (figures.length === 0) {
    // 独自レイアウト記事は専用クラスのfigureを持つ。
    // SVGを含むfigureを優先し、無ければ本文中のfigure全般から選ぶ。
    const all = Array.from(document.querySelectorAll("article figure"));
    const withSvg = all.filter((f) => f.querySelector("svg"));
    figures = withSvg.length ? withSvg : all;
  }
  if (figures.length === 0) return { ok: false, reason: "図解(figure)が見つかりません" };
  const idx = figureIndex == null ? figures.length - 1 : Math.min(Math.max(figureIndex, 0), figures.length - 1);
  const figure = figures[idx];

  // 図解の配色は祖先要素のクラス(記事ごとのカラースコープ)に依存することがあるため、
  // bodyまでの祖先のclassを外側から再現したラッパーで包む。
  const ancestorClasses = [];
  for (let el = figure.parentElement; el && el !== document.body; el = el.parentElement) {
    if (el.className && typeof el.className === "string") ancestorClasses.unshift(el.className);
  }
  const figureClone = figure.cloneNode(true);
  // 「データを表で見る」等の折りたたみはピンでは不要(閉じた状態のsummaryだけが写るため除去)
  figureClone.querySelectorAll("details, .chart-table-toggle").forEach((el) => el.remove());

  // 記事本文では図解カードが何重ものパネル(余白・枠線・影)に包まれており、
  // そのまま持ってくるとピン内で図が小さくなる。配色スコープは保ったまま、
  // 余白・枠・影・幅制限だけ打ち消す。
  const FLATTEN = "margin:0;padding:0;border:0;box-shadow:none;background:none;max-width:none;width:100%;box-sizing:border-box;";
  figureClone.style.cssText += FLATTEN;
  // 図解の見出し・注記はピンの表示サイズでも読める大きさに引き上げる。
  figureClone.querySelectorAll(".chart-title").forEach((el) => {
    el.style.cssText += "font-size:34px;line-height:1.4;margin:0 0 16px;";
  });
  // 注記・出典はピン上では脇役なので本文(22px)の約80%に落とす。
  const NOTE_FONT = 18;
  const NOTE_LINE = 1.5;
  const notes = [
    ...figureClone.querySelectorAll(".chart-source, .chart-note, figcaption:not(.chart-title), p"),
  ].filter((el) => !el.classList.contains("chart-title"));
  notes.forEach((el) => {
    el.style.cssText += `font-size:${NOTE_FONT}px;line-height:${NOTE_LINE};margin:12px 0 0;`;
  });
  // 注記内のリンクは下線・リンク色を解除し、地の文と同じ見え方にする
  // (ピン画像上はクリックできないため、装飾だけが目立ってしまう)。
  figureClone.querySelectorAll("a").forEach((el) => {
    el.style.cssText += "color:inherit;text-decoration:none;border-bottom:0;";
  });
  figureClone.querySelectorAll("svg").forEach((el) => {
    // 記事本文では図解SVGにmax-width(例: 360px)が掛かっており、これを外さないと
    // ピンの中で図が小さいまま残る。
    el.style.cssText += "width:100%;max-width:none;height:auto;display:block;margin:0 auto;";
  });

  let inner = figureClone;
  for (let i = ancestorClasses.length - 1; i >= 0; i--) {
    const w = document.createElement("div");
    w.className = ancestorClasses[i];
    w.style.cssText = FLATTEN;
    w.appendChild(inner);
    inner = w;
  }

  document.body.innerHTML = "";
  document.body.style.cssText =
    "margin:0;padding:0;width:1000px;height:1500px;overflow:hidden;background:#fff;";

  const root = document.createElement("div");
  root.id = "pin-root";
  root.style.cssText =
    "width:1000px;height:1500px;display:flex;flex-direction:column;background:#fff;box-sizing:border-box;";

  // --- 1) 上部: タイトル帯(〜350px) ---
  // ブランドカラーはお金サイトの --color-primary(#0b5c8a) / --color-primary-surface(#f2f9fc)
  const head = document.createElement("div");
  head.style.cssText =
    "height:350px;flex:0 0 350px;background:#f2f9fc;border-bottom:6px solid #0b5c8a;" +
    "box-sizing:border-box;padding:40px 60px;display:flex;flex-direction:column;" +
    "align-items:center;justify-content:center;gap:16px;";
  const cat = document.createElement("div");
  cat.textContent = category;
  cat.style.cssText =
    "font-family:var(--font-sans);font-size:30px;font-weight:700;color:#fff;background:#0b5c8a;" +
    "padding:6px 24px;border-radius:999px;letter-spacing:.04em;";
  const h = document.createElement("div");
  h.textContent = title;
  h.style.cssText =
    "font-family:var(--font-sans);font-weight:700;color:#24242b;text-align:center;" +
    "line-height:1.35;letter-spacing:.01em;font-size:72px;max-width:880px;";
  head.appendChild(cat);
  head.appendChild(h);

  // --- 2) 中央: 図解1点(〜900px) ---
  const body = document.createElement("div");
  body.style.cssText =
    "flex:1 1 auto;box-sizing:border-box;padding:40px;display:flex;" +
    "align-items:center;justify-content:center;overflow:hidden;";
  const stage = document.createElement("div");
  // 基準幅は中央枠(880px)より狭く取り、あとのfitFigureで縦横に余裕がある分だけ
  // 拡大する。こうすると横長の図解でも縦の余白を活かして大きく見せられる。
  stage.style.cssText = "width:560px;display:flex;align-items:center;justify-content:center;";
  stage.appendChild(inner);
  body.appendChild(stage);

  // --- 3) 下部: サイト名 + マスコット + ドメイン(〜250px) ---
  const foot = document.createElement("div");
  foot.style.cssText =
    "height:250px;flex:0 0 250px;background:#0b5c8a;box-sizing:border-box;" +
    "padding:40px 60px;display:flex;align-items:center;justify-content:space-between;gap:32px;";
  const brand = document.createElement("div");
  brand.style.cssText = "display:flex;flex-direction:column;gap:10px;";
  const bname = document.createElement("div");
  // 「NEVORA|お金の総合ガイド」は1行だと帯幅(マスコット分を除く約620px)に
  // 収まらないため、区切りで改行した2行構成にする。
  bname.innerHTML = "";
  const [brandMain, brandSub] = siteName.split("|");
  const l1 = document.createElement("div");
  l1.textContent = brandMain;
  l1.style.cssText =
    "font-family:var(--font-serif);font-size:56px;font-weight:700;color:#fff;letter-spacing:.06em;line-height:1.1;white-space:nowrap;";
  const l2 = document.createElement("div");
  l2.textContent = brandSub || "";
  l2.style.cssText =
    "font-family:var(--font-sans);font-size:30px;font-weight:700;color:#fff;letter-spacing:.04em;line-height:1.2;white-space:nowrap;";
  bname.appendChild(l1);
  if (brandSub) bname.appendChild(l2);
  bname.style.cssText = "display:flex;flex-direction:column;gap:6px;";
  const bdomain = document.createElement("div");
  bdomain.textContent = domain;
  bdomain.style.cssText =
    "font-family:var(--font-sans);font-size:28px;font-weight:500;color:#d7ebf5;letter-spacing:.04em;white-space:nowrap;";
  brand.appendChild(bname);
  brand.appendChild(bdomain);
  const mascot = document.createElement("img");
  mascot.src = mascotSrc;
  mascot.style.cssText = "height:170px;width:auto;flex:0 0 auto;";
  foot.appendChild(brand);
  foot.appendChild(mascot);

  root.appendChild(head);
  root.appendChild(body);
  root.appendChild(foot);
  document.body.appendChild(root);

  // 注記は最大3行。超える場合は出典表記(「(参照: …)」「(出典: …)」等)を必ず残したまま、
  // その手前の説明文を「。」(文末)単位で後ろから落として収める。文の途中で切ると
  // 意味の通らない文になるため、収まる範囲の最後の文末で切る
  // (元記事側の注記テキストは変更しない。ピン画像上のみ)。
  let notesTruncated = 0;
  notes.forEach((el) => {
    const maxHeight = NOTE_FONT * NOTE_LINE * 3 + 1;
    if (el.getBoundingClientRect().height <= maxHeight) return;
    const full = el.textContent;
    const m = full.match(/[((](?:参照|出典)[::][^))]*[))]。?$/);
    const sourcePart = m ? m[0] : "";
    const lead = sourcePart ? full.slice(0, full.length - sourcePart.length) : full;
    // 「。」を含んだまま文に分割する(最後の要素は句点で終わらない端数)
    const sentences = lead.match(/[^。]*。/g) || [];
    let applied = false;
    for (let n = sentences.length; n >= 1; n--) {
      el.textContent = `${sentences.slice(0, n).join("")}${sourcePart}`;
      if (el.getBoundingClientRect().height <= maxHeight) {
        applied = true;
        break;
      }
    }
    // 1文すら収まらない場合は出典表記だけを残す
    if (!applied) el.textContent = sourcePart || "";
    notesTruncated += 1;
  });

  // タイトルは最大3行かつタイトル帯(350px)の内側に収める。
  // スマホの検索一覧でも読めるよう下限は56px。56pxでも3行に収まらない場合は
  // 記事タイトルが長すぎるので末尾を丸める(frontmatterのpinTitleで短縮推奨)。
  const MAX_LINES = 3;
  const fits = (size) => {
    h.style.fontSize = `${size}px`;
    const lines = Math.round(h.getBoundingClientRect().height / (size * 1.35));
    return lines <= MAX_LINES && head.scrollHeight <= head.clientHeight;
  };
  let titleTruncated = false;
  let usedSize = 56;
  for (const size of [72, 68, 64, 60, 56]) {
    if (fits(size)) {
      usedSize = size;
      break;
    }
  }
  if (!fits(usedSize)) {
    let text = title;
    while (text.length > 8 && !fits(usedSize)) {
      text = text.slice(0, -2);
      h.textContent = `${text}…`;
      titleTruncated = true;
    }
  }

  return {
    ok: true,
    figureIndex: idx,
    figureCount: figures.length,
    figureTitle: (figure.querySelector(".chart-title") || {}).textContent || "",
    notesTruncated,
    titleFontSize: usedSize,
    titleTruncated,
  };
}

// 図解が3段レイアウトの中央枠に収まるよう、実寸を測ってscaleを掛ける。
function fitFigureInPage({ maxW, maxH }) {
  const stage = document.querySelector("#pin-root > div:nth-child(2) > div");
  const target = stage.firstElementChild;
  target.style.transformOrigin = "center center";
  const r = target.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return { scale: 1, width: r.width, height: r.height };
  // 図解はSVGなので拡大しても粗くならない。ただし極端な拡大は線が太く見えるため
  // 2.4倍を上限とし、縮小は必要なだけ掛ける。
  const scale = Math.min(maxW / r.width, maxH / r.height, 2.4);
  target.style.transform = `scale(${scale})`;
  return { scale, width: r.width, height: r.height };
}

async function main() {
  const argv = process.argv.slice(2);
  const isSample = argv.includes("--sample");
  const isAll = argv.includes("--all");
  const explicit = argv.filter((a) => !a.startsWith("--"));

  const articles = loadArticles();
  const bySlug = new Map(articles.map((a) => [a.slug, a]));
  let targets;
  if (isSample) targets = SAMPLE_SLUGS.map((s) => bySlug.get(s)).filter(Boolean);
  else if (explicit.length) targets = explicit.map((s) => bySlug.get(s)).filter(Boolean);
  else if (isAll) targets = articles;
  else {
    console.error("使い方: --sample / --all / <slug>...");
    process.exit(1);
  }
  if (targets.length === 0) {
    console.error("対象記事が見つかりません。");
    process.exit(1);
  }

  // --manifest-only: 画像は再生成せず、マニフェストCSVだけを作り直す。
  // タイトル案・説明文案の文言だけを直したいときに使う。
  if (argv.includes("--manifest-only")) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const total = writeManifest(targets.map(({ slug, fm }) => buildRow(slug, fm)));
    console.log(`[pins] マニフェストのみ更新: ${targets.length}件を再生成 / 全${total}行`);
    return;
  }

  let playwright;
  try {
    playwright = require("playwright-core");
  } catch (e) {
    console.error("playwright-coreが見つかりません。npm installを確認してください。", e.message);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  killPort(PORT);
  console.log(`[pins] next start をポート${PORT}で起動します(事前に npm run build 済みであること)...`);
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: process.cwd(),
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  server.stdout.on("data", (d) => (serverOutput += d.toString()));
  server.stderr.on("data", (d) => (serverOutput += d.toString()));
  try {
    await waitForServer(BASE_URL, 60000);
  } catch (e) {
    console.error("[pins] next start の起動に失敗しました。");
    console.error(serverOutput.slice(-2000));
    killPort(PORT);
    process.exit(1);
  }

  const browser = await playwright.chromium.launch();
  const rows = [];
  const failures = [];
  const truncatedSlugs = [];

  try {
    for (const { slug, fm } of targets) {
      const category = String(fm.category || "");
      const mascot = MASCOT_BY_CATEGORY[category] || DEFAULT_MASCOT;
      const page = await browser.newPage({
        viewport: { width: PIN_WIDTH, height: PIN_HEIGHT },
        deviceScaleFactor: 1,
      });
      try {
        const url = `${BASE_URL}/posts/${encodeURIComponent(slug)}`;
        const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        if (!resp || !resp.ok()) throw new Error(`ページ取得に失敗: ${resp && resp.status()}`);

        const result = await page.evaluate(buildPinInPage, {
          title: String(fm.pinTitle || fm.title || ""),
          figureIndex: Number.isInteger(fm.pinFigure) ? fm.pinFigure - 1 : null,
          siteName: "NEVORA|お金の総合ガイド",
          domain: "nevora-money.vercel.app",
          mascotSrc: `/images/mascot/${mascot.file}-normal.svg`,
          category,
        });
        if (!result.ok) throw new Error(result.reason);

        // Webフォント(Shippori Mincho / Zen Kaku Gothic New)の読み込み完了を待ってから測る
        await page.evaluate(() => document.fonts.ready);
        const fit = await page.evaluate(fitFigureInPage, { maxW: 880, maxH: 820 });

        const outPath = path.join(OUT_DIR, `${slug}.png`);
        await page.screenshot({
          path: outPath,
          clip: { x: 0, y: 0, width: PIN_WIDTH, height: PIN_HEIGHT },
        });

        if (result.notesTruncated > 0) truncatedSlugs.push(slug);
        rows.push(buildRow(slug, fm));
        console.log(
          `[pins] ${slug} → ${path.basename(outPath)}(図解 ${result.figureIndex + 1}/${result.figureCount}` +
            `「${result.figureTitle}」 scale=${fit.scale.toFixed(2)})`
        );
      } catch (e) {
        failures.push({ slug, message: e.message });
        console.error(`[pins] 失敗: ${slug} … ${e.message}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    try {
      server.kill();
    } catch (e) {
      /* killPortで確実に落とす */
    }
    killPort(PORT);
  }

  writeManifest(rows);

  console.log(`[pins] 生成${rows.length}件 / 失敗${failures.length}件 → ${OUT_DIR}`);
  console.log(`[pins] 注記の切り詰めが発動: ${truncatedSlugs.length}件`);
  failures.forEach((f) => console.log(`[pins] 失敗詳細: ${f.slug} … ${f.message}`));
  if (failures.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  killPort(PORT);
  process.exit(1);
});
