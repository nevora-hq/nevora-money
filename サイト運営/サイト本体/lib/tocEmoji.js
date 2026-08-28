// 記事専用モジュール(lib/*Widgets.js, lib/*Extras.js)の独自目次が、見出しに合わせて
// 絵文字を1つ選ぶための共通ロジック。キーワード→絵文字の対応表は記事ごとに内容が異なるため
// 各ファイル側で保持し、選定ロジック(pickHeadingEmoji)だけをここに集約する。
//
// 見出し本文(item.text)が既に絵文字を含む場合、この関数はさらに絵文字を追加しない
// (目次1行に絵文字が2つ並ぶ二重表示を防ぐガード)。

const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;

export function headingHasEmoji(text) {
  return EMOJI_PATTERN.test(String(text || ""));
}

export function pickHeadingEmoji(text, keywordTable, fallback = "📌") {
  const value = String(text || "");
  if (headingHasEmoji(value)) return "";
  const found = keywordTable.find(([re]) => re.test(value));
  return found ? found[1] : fallback;
}
