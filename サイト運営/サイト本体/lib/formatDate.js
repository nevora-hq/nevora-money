// 記事frontmatterのdate/updatedDateは、"2026-08-13"のようなYYYY-MM-DD形式と
// "2026-08-13T09:00:00+09:00"のようなISO8601時刻付き形式が混在している
// (記事によって書式が揺れているため)。表示箇所ごとに個別に整形すると
// 今回のような表示崩れ(ISO生文字列がそのまま出る)が再発するため、
// 日付を画面表示する箇所は必ずこの関数を経由すること。
//
// 常に「YYYY-MM-DD」の10文字に整形する。不正な値・空値はそのまま返す
// (nullや空文字を渡された場合の呼び出し側の条件分岐を壊さないため)。
export function formatDate(value) {
  if (!value) return value;
  const str = String(value);
  // 既にYYYY-MM-DD形式(10文字、ハイフン区切り)ならそのまま返す。
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // "YYYY-MM-DDT..." のようなISO8601時刻付き形式は先頭10文字を取り出す。
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) return isoMatch[1];
  // 上記いずれにも一致しない未知の形式はDateとして解釈を試み、それでも
  // 失敗する場合は元の値をそのまま返す(表示が消えるより崩れたままの方が気づきやすい)。
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return str;
}
