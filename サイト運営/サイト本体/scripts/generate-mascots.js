#!/usr/bin/env node
/**
 * NEVORA MONEYのマスコットSVG(メイン1体 + カテゴリ担当6体)× 3ポーズを生成する。
 *
 *   node scripts/generate-mascots.js            … 全22ファイルを生成
 *   node scripts/generate-mascots.js coinmin    … keyの前方一致で絞り込み
 *
 * 生活サイトの同名スクリプトを移植したもの。体の形だけ「コイン型(正円+内側のリング)」に
 * 差し替えている。全キャラで体・顔・手足のジオメトリを共有し、輪郭色/塗り色/持ち物だけを
 * 差し替えることで、7体を並べても同じシリーズに見えるようにしている。
 *
 * **マスコットの絵はこのスクリプトが唯一の定義元。** public/images/mascot/*.svg は
 * すべて出力物なので直接編集しないこと。絵柄を変えたらここを直して再実行し、
 * 続けて generate-brand-assets.js(ロゴ・ファビコン・OGP)を実行するとサイト全体へ反映される。
 *
 * 出力: public/images/mascot/<key>-<pose>.svg
 *   pose = normal(挨拶) / research(補足) / matome(まとめ)
 *   → lib/categoryMascot.js の normalImage / researchImage / matomeImage と対応する
 *   さらに coinmin だけ coinmin-mark.svg(ロゴマーク・ファビコン用の簡略版)と
 *   coinmin-face.svg(顔アップ。OGP・ロゴの合成元)を出力する
 */
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "..", "public", "images", "mascot");

// ---------------------------------------------------------------------------
// キャラクター定義。color=輪郭線、soft=体の塗り、blush=ほおの赤み、motif=持ち物
// 色は lib/categoryMeta.js のカテゴリ色と一致させる(メインはブランド色)。
// カテゴリを追加するときは、categoryMeta.js・categoryMascot.js と3点セットで追記する。
// ---------------------------------------------------------------------------
const CHARACTERS = [
  { key: "coinmin", name: "コインミンちゃん", color: "#0b5c8a", soft: "#d7ebf5", blush: "#bbd1de", motif: null },
  { key: "fuyamin", name: "フヤミンちゃん", color: "#12528c", soft: "#e7eef4", blush: "#bdcfdf", motif: "chart" },
  { key: "kawasemin", name: "カワセミンちゃん", color: "#075d43", soft: "#e6efec", blush: "#bad2ca", motif: "globe" },
  { key: "zeimin", name: "ゼイミンちゃん", color: "#8a3507", soft: "#f3ebe6", blush: "#dec6ba", motif: "taxform" },
  { key: "mamomin", name: "マモミンちゃん", color: "#5737b6", soft: "#eeebf8", blush: "#d0c7eb", motif: "umbrella" },
  { key: "kakeimin", name: "カケイミンちゃん", color: "#1b5c28", soft: "#e8efea", blush: "#bfd1c3", motif: "calculator" },
  { key: "poimin", name: "ポイミンちゃん", color: "#9a1d49", soft: "#f5e8ed", blush: "#e3c0cc", motif: "card" },
];

const POSES = {
  normal: "",
  research: "(リサーチポーズ)",
  matome: "(まとめポーズ)",
};

// メインのコインミンだけが持つ金色のアクセント(キラリ)。カテゴリ担当には付けない。
const GOLD = "#e8b44c";

// ---------------------------------------------------------------------------
// 共通パーツ。240x240のviewBox。
// ---------------------------------------------------------------------------
const STROKE = 6;

// 体: コイン型(正円)。原画(mascot-full.png)の造形に合わせ、内側にリングを1本入れる。
const BODY_CX = 120;
const BODY_CY = 132;
const BODY_R = 78;
const RING_R = 66;

const shadow = (c) => `<ellipse cx="120" cy="231" rx="52" ry="8" fill="${c.color}" opacity="0.10"/>`;

const body = (c) =>
  `<circle cx="${BODY_CX}" cy="${BODY_CY}" r="${BODY_R}" fill="${c.soft}" stroke="${c.color}" stroke-width="${STROKE}"/>` +
  `<circle cx="${BODY_CX}" cy="${BODY_CY}" r="${RING_R}" fill="none" stroke="${c.color}" stroke-width="3.5"/>`;

// メインだけの装飾。右上のキラリ(4点星)と左上の小さな円。
const sparkle = (c) =>
  c.key === "coinmin"
    ? `<path d="M203 62 l6 15 15 6 -15 6 -6 15 -6 -15 -15 -6 15 -6 z" fill="${GOLD}"/>` +
      `<circle cx="44" cy="64" r="9" fill="${GOLD}"/>`
    : "";

const blush = (c) =>
  `<ellipse cx="86" cy="150" rx="14" ry="9" fill="${c.blush}"/>` +
  `<ellipse cx="154" cy="150" rx="14" ry="9" fill="${c.blush}"/>`;

// 目。open=丸い点、arch=「^ ^」(考えている)、happy=にっこり閉じた目
function eyes(type) {
  if (type === "arch") {
    return (
      `<path d="M90 130 Q98 122 106 130" stroke="#24242b" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<path d="M134 130 Q142 122 150 130" stroke="#24242b" stroke-width="5" fill="none" stroke-linecap="round"/>`
    );
  }
  if (type === "happy") {
    return (
      `<path d="M90 132 Q98 123 106 132" stroke="#24242b" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<path d="M134 132 Q142 123 150 132" stroke="#24242b" stroke-width="5" fill="none" stroke-linecap="round"/>`
    );
  }
  return (
    `<circle cx="98" cy="129" r="8" fill="#24242b"/>` +
    `<circle cx="142" cy="129" r="8" fill="#24242b"/>` +
    `<circle cx="100.8" cy="125.6" r="2.4" fill="#fff"/>` +
    `<circle cx="144.8" cy="125.6" r="2.4" fill="#fff"/>`
  );
}

// 口。上向きに開いたカーブ(にっこり)。widthで開き具合を変える
const mouth = (wide = false) =>
  wide
    ? `<path d="M106 150 Q120 165 134 150" stroke="${"#24242b"}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`
    : `<path d="M109 152 Q120 163 131 152" stroke="#24242b" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;

const legs = (c) =>
  `<path d="M104 205 q-7 13 -3 22" stroke="${c.color}" stroke-width="${STROKE}" fill="none" stroke-linecap="round"/>` +
  `<path d="M136 205 q7 13 3 22" stroke="${c.color}" stroke-width="${STROKE}" fill="none" stroke-linecap="round"/>`;

// 腕。down=垂らす / up=上げる / hold=持ち物を持つ / together=前で合わせる
function arm(c, side, type) {
  const s = side === "left" ? -1 : 1;
  const x = side === "left" ? 46 : 194;
  if (type === "up") {
    return `<path d="M${x} 160 q${16 * s} -6 ${20 * s} -20" stroke="${c.color}" stroke-width="${STROKE}" fill="none" stroke-linecap="round"/>`;
  }
  if (type === "hold") {
    return `<path d="M${x} 164 q${12 * s} 10 ${18 * s} 12" stroke="${c.color}" stroke-width="${STROKE}" fill="none" stroke-linecap="round"/>`;
  }
  if (type === "together") {
    return `<path d="M${side === "left" ? 62 : 178} 174 q${18 * s} 16 ${38 * s} 8" stroke="${c.color}" stroke-width="${STROKE}" fill="none" stroke-linecap="round"/>`;
  }
  return `<path d="M${x} 160 q${16 * s} 2 ${22 * s} 14" stroke="${c.color}" stroke-width="${STROKE}" fill="none" stroke-linecap="round"/>`;
}

// ---------------------------------------------------------------------------
// 持ち物。いずれも 0,0 起点・約40x40の座標系で描き、translate/scaleで配置する。
// 輪郭は輪郭線と同じ色、塗りは体と同じ淡色に統一する。
// ---------------------------------------------------------------------------
const MOTIFS = {
  // 共通(research/matomeで全キャラが使う)
  magnifier: (c) =>
    `<circle cx="17" cy="17" r="13" fill="${c.soft}" stroke="${c.color}" stroke-width="4"/>` +
    `<path d="M27 27 L37 37" stroke="${c.color}" stroke-width="5" stroke-linecap="round"/>`,
  notebook: (c) =>
    `<rect x="4" y="6" width="32" height="28" rx="4" fill="${c.soft}" stroke="${c.color}" stroke-width="4"/>` +
    `<path d="M12 15 H28 M12 21 H28 M12 27 H22" stroke="${c.color}" stroke-width="3" stroke-linecap="round"/>`,

  // 投資: 右肩上がりのグラフ
  chart: (c) =>
    `<rect x="3" y="4" width="34" height="32" rx="4" fill="${c.soft}" stroke="${c.color}" stroke-width="4"/>` +
    `<path d="M9 28 L17 20 L23 24 L31 12" fill="none" stroke="${c.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M25 12 H31 V18" fill="none" stroke="${c.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  // FX: 地球儀(経線・緯線のみ。国名や地形は描かない)
  globe: (c) =>
    `<circle cx="20" cy="18" r="15" fill="${c.soft}" stroke="${c.color}" stroke-width="4"/>` +
    `<path d="M5 18 H35 M20 3 C12 10 12 26 20 33 M20 3 C28 10 28 26 20 33" fill="none" stroke="${c.color}" stroke-width="3"/>` +
    `<path d="M20 33 V39 M12 39 H28" stroke="${c.color}" stroke-width="4" stroke-linecap="round"/>`,
  // 税金・節税: 申告書(書類+押印)
  taxform: (c) =>
    `<path d="M7 3 H26 L33 10 V37 H7 Z" fill="${c.soft}" stroke="${c.color}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M13 16 H27 M13 22 H27" stroke="${c.color}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="26" cy="30" r="6" fill="none" stroke="${c.color}" stroke-width="3"/>`,
  // 保険: 傘
  umbrella: (c) =>
    `<path d="M3 21 A17 17 0 0 1 37 21 Z" fill="${c.soft}" stroke="${c.color}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M20 4 V21 M20 21 V33 q0 5 -6 5 t-6 -5" fill="none" stroke="${c.color}" stroke-width="4" stroke-linecap="round"/>`,
  // 家計・節約: 電卓
  calculator: (c) =>
    `<rect x="6" y="3" width="28" height="34" rx="4" fill="${c.soft}" stroke="${c.color}" stroke-width="4"/>` +
    `<rect x="11" y="8" width="18" height="7" rx="2" fill="${c.color}"/>` +
    `<path d="M13 22 H15 M19 22 H21 M25 22 H27 M13 29 H15 M19 29 H21 M25 29 H27" stroke="${c.color}" stroke-width="3.5" stroke-linecap="round"/>`,
  // クレカ・ポイント: カード(番号やブランドマークは描かない)
  card: (c) =>
    `<rect x="2" y="9" width="36" height="24" rx="4" fill="${c.soft}" stroke="${c.color}" stroke-width="4"/>` +
    `<path d="M2 17 H38" stroke="${c.color}" stroke-width="4"/>` +
    `<rect x="8" y="23" width="9" height="6" rx="1.5" fill="${c.color}"/>`,
};

// 持ち物を右手のあたりに置く。scaleは40pxの座標系を実寸に落とす倍率。
function held(c, motif, { x = 184, y = 156, scale = 1.15 } = {}) {
  if (!motif || !MOTIFS[motif]) return "";
  return `<g transform="translate(${x} ${y}) scale(${scale})">${MOTIFS[motif](c)}</g>`;
}

// ---------------------------------------------------------------------------
// ポーズ組み立て
// ---------------------------------------------------------------------------
function buildSvg(c, pose) {
  const label = `マスコットキャラクター ${c.name}${POSES[pose]}`;
  const parts = [shadow(c), legs(c)];

  if (pose === "normal") {
    // 挨拶。メインは右手を上げて手を振り、カテゴリ担当は持ち物を持つ。
    parts.push(arm(c, "left", "down"), arm(c, "right", c.motif ? "hold" : "up"));
    parts.push(body(c), sparkle(c), blush(c), eyes("open"), mouth());
    if (c.motif) parts.push(held(c, c.motif));
  } else if (pose === "research") {
    // 補足。虫めがねを持って調べている。
    parts.push(arm(c, "left", "down"), arm(c, "right", "hold"));
    parts.push(body(c), sparkle(c), blush(c), eyes("arch"), mouth());
    parts.push(held(c, "magnifier", { x: 188, y: 164, scale: 1.05 }));
  } else {
    // まとめ。両手を前で合わせ、ノートを添える。
    parts.push(body(c), sparkle(c), blush(c), eyes("happy"), mouth(true));
    parts.push(arm(c, "left", "together"), arm(c, "right", "together"));
    parts.push(held(c, "notebook", { x: 182, y: 138, scale: 0.85 }));
  }

  return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">
  ${parts.join("\n  ")}
</svg>
`;
}

// 顔アップ。OGP合成・ロゴ・ファビコンの元になる。手足・影を省き、
// コインを画面いっぱいまで拡大する。原画(mascot-face.png)の構図に合わせる。
function buildFaceSvg(c) {
  const label = `${c.name}(顔アップ)`;
  const parts = [
    `<circle cx="120" cy="120" r="106" fill="${c.soft}" stroke="${c.color}" stroke-width="9"/>`,
    `<circle cx="120" cy="120" r="90" fill="none" stroke="${c.color}" stroke-width="5"/>`,
    c.key === "coinmin"
      ? `<path d="M168 68 l6 15 15 6 -15 6 -6 15 -6 -15 -15 -6 15 -6 z" fill="${GOLD}"/>`
      : "",
    `<ellipse cx="76" cy="141" rx="19" ry="12" fill="${c.blush}"/>`,
    `<ellipse cx="164" cy="141" rx="19" ry="12" fill="${c.blush}"/>`,
    `<circle cx="92" cy="115" r="11" fill="#24242b"/>`,
    `<circle cx="148" cy="115" r="11" fill="#24242b"/>`,
    `<circle cx="95.8" cy="110.6" r="3.2" fill="#fff"/>`,
    `<circle cx="151.8" cy="110.6" r="3.2" fill="#fff"/>`,
    `<path d="M104 146 Q120 161 136 146" stroke="#24242b" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  ].filter(Boolean);
  return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">
  ${parts.join("\n  ")}
</svg>
`;
}

// ファビコン/ロゴマーク用の簡略版。手足・影・リング以外の装飾を省き、輪郭線を太くする。
// 16pxまで縮めても形が潰れないようにする。金のキラリは原画から続く識別要素なので残す
// (16pxでは数ピクセルの暖色の点になるが、他サイトのファビコンとの区別に効く)。
function buildMarkSvg(c) {
  const label = `${c.name}(シンボルマーク)`;
  const parts = [
    `<circle cx="120" cy="120" r="104" fill="${c.soft}" stroke="${c.color}" stroke-width="13"/>`,
    `<circle cx="120" cy="120" r="86" fill="none" stroke="${c.color}" stroke-width="6"/>`,
    c.key === "coinmin"
      ? `<path d="M171 66 l7 17 17 7 -17 7 -7 17 -7 -17 -17 -7 17 -7 z" fill="${GOLD}"/>`
      : "",
    `<ellipse cx="76" cy="142" rx="20" ry="13" fill="${c.blush}"/>`,
    `<ellipse cx="164" cy="142" rx="20" ry="13" fill="${c.blush}"/>`,
    `<circle cx="92" cy="114" r="12" fill="#24242b"/>`,
    `<circle cx="148" cy="114" r="12" fill="#24242b"/>`,
    `<path d="M103 147 Q120 163 137 147" stroke="#24242b" stroke-width="7" fill="none" stroke-linecap="round"/>`,
  ].filter(Boolean);
  return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">
  ${parts.join("\n  ")}
</svg>
`;
}

function main() {
  const filters = process.argv.slice(2);
  const targets = filters.length
    ? CHARACTERS.filter((c) => filters.some((f) => c.key.startsWith(f)))
    : CHARACTERS;
  if (!targets.length) {
    console.error(`該当するキャラクターがありません: ${filters.join(", ")}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let count = 0;
  for (const c of targets) {
    for (const pose of Object.keys(POSES)) {
      fs.writeFileSync(path.join(OUT_DIR, `${c.key}-${pose}.svg`), buildSvg(c, pose), "utf8");
      count++;
    }
    if (c.key === "coinmin") {
      fs.writeFileSync(path.join(OUT_DIR, `${c.key}-mark.svg`), buildMarkSvg(c), "utf8");
      fs.writeFileSync(path.join(OUT_DIR, `${c.key}-face.svg`), buildFaceSvg(c), "utf8");
      count += 2;
    }
    console.log(`  ${c.key.padEnd(11)} ${c.name.padEnd(18)} ${c.color}  ${c.motif || "(持ち物なし)"}`);
  }
  console.log(`\n合計 ${count}ファイル → ${path.relative(process.cwd(), OUT_DIR)}`);
}

main();
