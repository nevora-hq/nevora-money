#!/usr/bin/env node
/**
 * トップページで使う写真素材(ヒーロー/カテゴリカード/セクションバンド)を
 * 元画像(PNG)からWebPに一括変換する。
 *
 *   node scripts/generate-site-images.js            … 全件生成
 *   node scripts/generate-site-images.js hero band  … キー前方一致で絞り込み
 *
 * 元画像はリポジトリ外(デスクトップの画像フォルダ)に置いたまま参照する。
 * 素材を差し替えたときは、下のMANIFESTのsrcを書き換えて再実行すれば
 * 出力側のファイル名・幅構成は保たれる。
 *
 * 出力の考え方:
 *   - responsive: true  … 640/1024/1536wの3枚 + srcset非対応向けの
 *                         フォールバック<name>.webp(=1536w)を出力。
 *                         画面幅いっぱいに敷くヒーロー・バンド用。
 *   - fixed: {w,h}      … 指定サイズちょうどに中央クロップしてPNGで出力。
 *                         SNSのOGP画像(1200x630、PNG固定)用。
 *   - responsive: false … <name>.webp 1枚(既定800w)のみ。
 *                         カード内に収まるカテゴリ画像用(表示幅は最大でも
 *                         約380pxなので、DPR2でも800wで足りる)。
 * どちらも縦横比は元画像のまま出力し、トリミングはCSSのobject-fit/positionに任せる。
 */
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const SRC_DIR =
  "c:/Users/kokim/OneDrive/デスクトップ/画像フォルダ/各種サイト/お金サイト/ホームページ修正用";
const PUBLIC_DIR = path.join(__dirname, "..", "public");
// 1536は画像生成AI(ChatGPT等)の横長出力の実寸(1536x1024)に合わせた上限。
// 元画像がこれより小さい場合は元画像の幅に丸められる(main()参照)。
const RESPONSIVE_WIDTHS = [640, 1024, 1536];
const RESPONSIVE_FALLBACK = 1536;
const CARD_WIDTH = 800;
const QUALITY = 78;

// key: 絞り込み用の識別子 / src: 元画像 / out: public配下の出力パス(拡張子なし)
const MANIFEST = [
  // ---- ヒーロー ----
  { key: "hero", src: "home-hero.png", out: "images/hero/home-hero", responsive: true },

  // ---- セクションバンド ----
  // band-01: 左側に余白がある横長写真。「あなたのお金の悩みから探す」の見出しを重ねる
  { key: "band-01", src: "band-01.png", out: "images/band/band-01", responsive: true },
  // band-02: 装飾用の静物(テキストは重ねない)
  { key: "band-02", src: "band-02.png", out: "images/band/band-02", responsive: true },

  // ---- カテゴリカード。出力名は lib/categoryMeta.js の image と一致させること ----
  { key: "category-investment", src: "category-investment.png", out: "images/category/investment" },
  { key: "category-fx", src: "category-fx.png", out: "images/category/fx" },
  { key: "category-tax", src: "category-tax.png", out: "images/category/tax" },
  { key: "category-insurance", src: "category-insurance.png", out: "images/category/insurance" },
  { key: "category-household", src: "category-household.png", out: "images/category/household" },
  { key: "category-card-point", src: "category-card-point.png", out: "images/category/card-point" },

  // ---- SNSシェア用のOGP画像。1200x630ちょうど・PNGで出力する ----
  // (components/Layout.js の DEFAULT_OG_IMAGE が参照する)
  { key: "ogp", src: "ogp.png", out: "images/ogp", fixed: { w: 1200, h: 630 } },
];


async function emit(srcPath, outBase, width, suffix) {
  const outPath = suffix ? `${outBase}-${suffix}.webp` : `${outBase}.webp`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await sharp(srcPath)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(outPath);
  return outPath;
}

async function main() {
  const filters = process.argv.slice(2);
  const targets = filters.length
    ? MANIFEST.filter((m) => filters.some((f) => m.key.startsWith(f)))
    : MANIFEST;

  if (targets.length === 0) {
    console.error(`該当する素材がありません: ${filters.join(", ")}`);
    process.exit(1);
  }

  let total = 0;
  for (const item of targets) {
    const srcPath = path.join(SRC_DIR, item.src);
    if (!fs.existsSync(srcPath)) {
      console.error(`  [NG] 元画像が見つかりません: ${srcPath}`);
      process.exitCode = 1;
      continue;
    }
    const meta = await sharp(srcPath).metadata();
    const outBase = path.join(PUBLIC_DIR, item.out);

    const written = [];
    if (item.fixed) {
      // OGPは規定サイズちょうどが求められるため、中央クロップしてPNGで出力する。
      const outPath = `${outBase}.png`;
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      await sharp(srcPath)
        .resize({ width: item.fixed.w, height: item.fixed.h, fit: "cover", position: "centre" })
        .png()
        .toFile(outPath);
      written.push(outPath);
    } else if (item.responsive) {
      // 元画像より大きい幅は拡大になるので作らない。最大幅は元画像の幅に丸め、
      // srcsetの最大候補と実ファイルが必ず一致するようにする。
      const maxWidth = Math.min(RESPONSIVE_FALLBACK, meta.width);
      const widths = [...new Set([...RESPONSIVE_WIDTHS.filter((w) => w < maxWidth), maxWidth])];
      for (const w of widths) {
        written.push(await emit(srcPath, outBase, w, String(w)));
      }
      // srcset非対応環境向けのフォールバックは最大幅のコピー
      written.push(await emit(srcPath, outBase, maxWidth, null));
      console.log(`    srcset幅: ${widths.join(", ")}`);
    } else {
      written.push(await emit(srcPath, outBase, CARD_WIDTH, null));
    }

    const kb = written.reduce((sum, p) => sum + fs.statSync(p).size, 0) / 1024;
    total += kb;
    console.log(
      `  ${item.key}: ${meta.width}x${meta.height} → ${written.length}枚 / 計${kb.toFixed(1)} KB`
    );
    console.log(`    ${written.map((p) => path.relative(PUBLIC_DIR, p).replace(/\\/g, "/")).join(", ")}`);
  }
  console.log(`\n合計 ${targets.length}素材 / ${total.toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
