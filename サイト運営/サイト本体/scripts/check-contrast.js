#!/usr/bin/env node
/**
 * 全ページのテキストコントラストを「実ピクセル方式」で測る。
 *
 *   npm run check:contrast                     … http://127.0.0.1:4399 を測定
 *   node scripts/check-contrast.js <baseUrl>   … 任意のURL(本番URLも可)
 *   node scripts/check-contrast.js <baseUrl> --min 4.5
 *
 * 【なぜ実ピクセル方式か】
 * 旧方式(getComputedStyleで背景色を祖先までたどる)には、
 *   - 背景が画像・グラデーションの要素を「測れない」としてスキップしてしまう
 *   - 半透明の重なりやbackdrop-filterを再現できない
 * という穴があった。実際、写真カードの上に置いた「人気」バッジやCTA文字が
 * まるごと測定対象から漏れ、6:1未満のまま見逃されていた(2026-08-28に判明)。
 *
 * そこで本スクリプトは、
 *   1. 対象要素の文字色だけを透明にした状態でスクリーンショットを撮る
 *      (visibility:hiddenだと要素自身の背景色まで消えてしまい、ボタン等を誤検知する)
 *   2. 文字を表示した状態でもう1枚撮る
 *   3. 2枚の差分が出た画素 = 実際に文字が乗っている画素 とみなし、
 *      その位置の「文字なし画像」の色を背景色として使う
 * という手順で、背景が写真でもグラデーションでも半透明でも正しく測る。
 *
 * 判定はCLAUDE.mdの基準に合わせて既定6:1(WCAG AAの4.5:1では余裕が足りないため)。
 */
const path = require("path");

const DEFAULT_BASE = "http://127.0.0.1:4399";
const PAGES = [
  "/",
  "/about",
  "/category",
  "/contact",
  "/privacy-policy",
  "/terms",
  "/ranking",
  "/search",
  "/compare",
  "/404",
];
const VIEWPORTS = [
  { width: 1440, height: 1000, label: "PC" },
  { width: 390, height: 844, label: "SP" },
];

const args = process.argv.slice(2);
const baseUrl = (args.find((a) => !a.startsWith("--")) || DEFAULT_BASE).replace(/\/$/, "");
const minIndex = args.indexOf("--min");
const MIN = minIndex >= 0 ? Number(args[minIndex + 1]) : 6;

function lin(c) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
};

// ページ内の「テキストを持つ要素」を列挙する(ブラウザ側で実行)
const COLLECT = `() => {
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own.length) continue;
    const cs = getComputedStyle(el);
    // 祖先までさかのぼって非表示(display/visibility/opacity:0)を除外する。
    // 例: 閉じているスマホのナビは opacity:0 の親を持つが、リンク自身は opacity:1。
    if (typeof el.checkVisibility === "function") {
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) continue;
    } else if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) {
      continue;
    }
    // 装飾目的の要素(aria-hidden)は読み上げ対象でもなく、絵文字アイコンのように
    // 「文字色」を持たない描画になるため測定から外す
    if (el.closest("[aria-hidden='true']")) continue;
    // 絵文字だけの要素はカラー絵文字として描画され、文字色と一致しないので除外する
    const codes = [...own.map((n) => n.textContent).join("")].map((ch) => ch.codePointAt(0));
    const isEmoji = (cp) =>
      cp >= 0x1f000 ||                       // 絵文字本体(Misc Symbols and Pictographs 以降)
      (cp >= 0x2600 && cp <= 0x27bf) ||      // Misc Symbols / Dingbats
      (cp >= 0x2190 && cp <= 0x21ff) ||      // 矢印
      cp === 0xfe0f || cp === 0x20e3 ||      // 異体字セレクタ・囲み記号
      cp === 0x20;                           // 空白
    const onlyEmoji = codes.every(isEmoji);
    if (onlyEmoji) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.bottom < 0 || r.top > document.documentElement.scrollHeight) continue;
    // グラデーション文字(background-clip:text)は塗りが背景画像側にあるため、
    // 実測色をピクセルから拾う(fillColorはnullにしておく)
    const clipped = cs.webkitTextFillColor === "rgba(0, 0, 0, 0)";
    out.push({
      i: out.length,
      text: own.map((n) => n.textContent).join(" ").trim().slice(0, 24),
      color: clipped ? null : cs.color,
      cls: (el.className || "").toString().slice(0, 48),
      tag: el.tagName.toLowerCase(),
      x: r.x, y: r.y + window.scrollY, w: r.width, h: r.height,
      size: parseFloat(cs.fontSize),
      weight: cs.fontWeight,
    });
    el.setAttribute("data-cc", String(out.length - 1));
  }
  return out;
}`;

const parseRgb = (s) => {
  const m = String(s).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(",").map(parseFloat);
  return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
};

(async () => {
  let pw;
  try {
    pw = require("playwright-core");
  } catch (e) {
    console.error("playwright-coreが見つかりません。npm installを確認してください。", e.message);
    process.exit(1);
  }
  const sharp = require("sharp");
  const browser = await pw.chromium.launch();
  const violations = [];
  let measured = 0;

  for (const vp of VIEWPORTS) {
    for (const route of PAGES) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
      const res = await page.goto(baseUrl + route, { waitUntil: "networkidle" });
      if (!res || (res.status() >= 400 && route !== "/404")) {
        console.warn(`  [skip] ${route} (${res && res.status()})`);
        await page.close();
        continue;
      }
      // 遅延読み込みを全部発火させてから測る
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(500);

      // カルーセルの自動送りやCSSアニメーションが2枚のスクリーンショットの間に
      // 進むと、背景が変わった画素を「文字」と誤認する。測定前に止めておく。
      await page.evaluate(() => {
        const style = document.createElement("style");
        style.textContent =
          "*,*::before,*::after{animation:none !important;transition:none !important;scroll-behavior:auto !important;}";
        document.head.appendChild(style);
        const maxId = setInterval(() => {}, 100000);
        for (let i = 1; i <= maxId; i++) clearInterval(i);
      });
      await page.waitForTimeout(200);

      const items = await page.evaluate(eval("(" + COLLECT + ")"));
      if (!items.length) {
        await page.close();
        continue;
      }
      const withText = await sharp(await page.screenshot({ fullPage: true })).raw().toBuffer({ resolveWithObject: true });
      await page.evaluate(() => {
        // 文字だけを消す。visibility:hiddenだと要素自身の背景・枠線も消えてしまい、
        // 「白文字+濃い背景のボタン」を誤検知するため、色だけを透明にする。
        const style = document.createElement("style");
        style.textContent =
          "[data-cc]{color:transparent !important;-webkit-text-fill-color:transparent !important;text-shadow:none !important;}";
        document.head.appendChild(style);
      });
      await page.waitForTimeout(150);
      const noText = await sharp(await page.screenshot({ fullPage: true })).raw().toBuffer({ resolveWithObject: true });
      await page.close();

      const info = withText.info;
      const A = withText.data;
      const B = noText.data;
      const ch = info.channels;

      for (const it of items) {
        const fg = parseRgb(it.color);
        let worst = Infinity;
        let worstBg = null;
        let glyphs = 0;
        const x0 = Math.max(0, Math.floor(it.x));
        const y0 = Math.max(0, Math.floor(it.y));
        const x1 = Math.min(info.width, Math.ceil(it.x + it.w));
        const y1 = Math.min(info.height, Math.ceil(it.y + it.h));
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * info.width + x) * ch;
            const diff =
              Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
            // アンチエイリアスの縁は文字色と背景の中間色になるため、
            // グラデーション文字(実描画色を使う側)では「濃い画素」だけを見る。
            if (diff < (fg ? 60 : 150)) continue; // 文字が乗っていない画素
            glyphs++;
            const bgL = L(B[i], B[i + 1], B[i + 2]);
            // 文字色: computedStyleがあればそれを、グラデーション文字は実描画色を使う
            const fgL = fg ? L(fg.r, fg.g, fg.b) : L(A[i], A[i + 1], A[i + 2]);
            const r = ratio(fgL, bgL);
            if (r < worst) {
              worst = r;
              worstBg = `rgb(${B[i]},${B[i + 1]},${B[i + 2]})`;
            }
          }
        }
        // アンチエイリアスだけを拾った可能性がある極小サンプルは除外する
        if (glyphs < 24) continue;
        measured++;
        if (worst < MIN) {
          violations.push({
            page: route,
            vp: vp.label,
            ratio: Number(worst.toFixed(2)),
            text: it.text,
            cls: it.cls || it.tag,
            color: it.color || "(グラデーション文字)",
            bg: worstBg,
            size: it.size,
            weight: it.weight,
          });
        }
      }
      console.log(`  ${vp.label} ${route.padEnd(18)} 要素${items.length}件を測定`);
    }
  }
  await browser.close();

  console.log(`\n測定対象: ${measured}件(基準 ${MIN}:1)`);
  if (!violations.length) {
    console.log(`✅ ${MIN}:1未満は0件`);
    return;
  }
  console.log(`❌ ${MIN}:1未満が ${violations.length}件\n`);
  violations
    .sort((a, b) => a.ratio - b.ratio)
    .forEach((v) => {
      console.log(
        `${String(v.ratio).padStart(5)}  ${v.vp} ${v.page}  ${v.cls}\n        "${v.text}" ${v.color} on ${v.bg} (${v.size}px/${v.weight})`
      );
    });
  process.exitCode = 1;
})();
