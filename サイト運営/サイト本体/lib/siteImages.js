// public配下の画像ファイルが実在するかをビルド時(getStaticProps)に確認する。
// ジャンル変更に伴い写真素材(ヒーロー/バンド/カテゴリ)を差し替える途中でも、
// 存在しない画像の<img>を出して壊れた見た目にしないためのガード。
// 素材は scripts/generate-site-images.js で生成する。
// 注意: fsを使うためクライアントコンポーネントからimportしないこと。
import fs from "fs";
import path from "path";

const PUBLIC_DIR = path.join(process.cwd(), "public");

export function publicFileExists(publicPath) {
  if (!publicPath) return false;
  const rel = publicPath.replace(/^\//, "");
  return fs.existsSync(path.join(PUBLIC_DIR, rel));
}

// SectionBand/HeroBanner のように "<base>.webp" + "<base>-{width}.webp" を
// srcsetで参照する画像一式が揃っているか(フォールバック1枚があれば可とする)。
export function responsiveImageExists(base) {
  return publicFileExists(`${base}.webp`);
}
