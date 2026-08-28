#!/usr/bin/env node
/**
 * マスコット原画(透過PNG)から、サイトのブランド資産一式を生成する。
 *
 *   node scripts/generate-brand-assets.js
 *
 * 入力(SRC_DIR、リポジトリ外):
 *   mascot-full.png … 全身。logo.png と OGP合成に使う
 *   mascot-face.png … 顔アップ。logo-mark.png と favicon 一式に使う
 *   ogp.png         … OGPの背景(generate-site-images.js の素材と同じもの)
 *
 * 出力(public配下):
 *   images/logo.png        512x512  構造化データのlogo・OGPのフォールバック
 *   images/logo-mark.png   128x128  ヘッダー左のマーク
 *   favicon-16/32/48.png, icon-192/512.png, apple-touch-icon.png, favicon.ico
 *   images/ogp.png         1200x630 背景にマスコットを合成したもの
 *
 * 原画を描き直したときは、同じファイル名で置き換えて再実行すれば全点が揃う。
 */
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const SRC_DIR =
  "c:/Users/kokim/OneDrive/デスクトップ/画像フォルダ/各種サイト/お金サイト/ライブラリ/ホームページ用";
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const src = (name) => path.join(SRC_DIR, name);
const out = (rel) => {
  const p = path.join(PUBLIC_DIR, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
};

// 透過の余白を落としてから、指定サイズの正方形に「余白率 pad」で収める。
// trim()を挟むことで、原画ごとの余白量の差に影響されず見た目の大きさが揃う。
async function squareFit(srcPath, size, pad = 0.06, background = { r: 0, g: 0, b: 0, alpha: 0 }) {
  const trimmed = await sharp(srcPath).trim().png().toBuffer();
  const inner = Math.round(size * (1 - pad * 2));
  const fitted = await sharp(trimmed)
    .resize({ width: inner, height: inner, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: fitted, gravity: "centre" }])
    .png()
    .toBuffer();
}

// PNGを内包するICO(Vista以降で標準的な形式)を自前で組み立てる。
// sharpは.icoを書き出せないため、ICONDIR/ICONDIRENTRYを手で作る。
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const entries = [];
  let offset = 6 + count * 16;
  for (const { size, data } of pngBuffers) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.data)]);
}

async function main() {
  for (const f of ["mascot-full.png", "mascot-face.png", "ogp.png"]) {
    if (!fs.existsSync(src(f))) {
      console.error(`  [NG] 元画像が見つかりません: ${src(f)}`);
      process.exit(1);
    }
  }

  const written = [];

  // ---- ロゴ ----
  fs.writeFileSync(out("images/logo.png"), await squareFit(src("mascot-full.png"), 512, 0.06));
  written.push("images/logo.png");
  fs.writeFileSync(out("images/logo-mark.png"), await squareFit(src("mascot-face.png"), 128, 0.02));
  written.push("images/logo-mark.png");

  // ---- ファビコン(顔アップ。小サイズでも潰れないよう余白は最小) ----
  const icoSizes = [16, 32, 48];
  const icoPngs = [];
  for (const size of [...icoSizes, 192, 512]) {
    const buf = await squareFit(src("mascot-face.png"), size, 0.02);
    const name = size <= 48 ? `favicon-${size}.png` : `icon-${size}.png`;
    fs.writeFileSync(out(name), buf);
    written.push(name);
    if (icoSizes.includes(size)) icoPngs.push({ size, data: buf });
  }
  fs.writeFileSync(out("favicon.ico"), buildIco(icoPngs));
  written.push("favicon.ico");

  // apple-touch-iconは透過を持てない(iOSが黒で埋める)ため白背景で焼き込む。
  fs.writeFileSync(
    out("apple-touch-icon.png"),
    await sharp(await squareFit(src("mascot-face.png"), 180, 0.08))
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer()
  );
  written.push("apple-touch-icon.png");

  // ---- OGP(背景の右側にマスコットを合成し、左側は文字を重ねられる余白として残す) ----
  const OGP_W = 1200;
  const OGP_H = 630;
  const bg = await sharp(src("ogp.png"))
    .resize({ width: OGP_W, height: OGP_H, fit: "cover", position: "centre" })
    .toBuffer();
  const mascotH = Math.round(OGP_H * 0.62);
  const mascot = await sharp(await sharp(src("mascot-full.png")).trim().png().toBuffer())
    .resize({ height: mascotH, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const mw = (await sharp(mascot).metadata()).width;
  fs.writeFileSync(
    out("images/ogp.png"),
    await sharp(bg)
      .composite([
        {
          input: mascot,
          left: Math.round(OGP_W * 0.80 - mw / 2),
          top: Math.round((OGP_H - mascotH) / 2),
        },
      ])
      .png()
      .toBuffer()
  );
  written.push("images/ogp.png");

  let total = 0;
  for (const rel of written) {
    const kb = fs.statSync(path.join(PUBLIC_DIR, rel)).size / 1024;
    total += kb;
    console.log(`  ${rel.padEnd(28)} ${kb.toFixed(1)} KB`);
  }
  console.log(`\n合計 ${written.length}点 / ${total.toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
