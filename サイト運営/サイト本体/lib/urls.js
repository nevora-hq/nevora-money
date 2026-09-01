// URLに使う文字列のエスケープを一元化するヘルパー。
//
// 記事のslug(=確定稿のファイル名)やサムネイルのパスには日本語のほか
// `%`(例: 「住宅ローン変動金利75%時代の備え方」)が入りうる。日本語は
// ブラウザが自動でパーセントエンコードしてくれるが、`%` は
// 「不正なパーセントエスケープ」と解釈され、リンクを踏むと 400 になる
// (2026-09-01、公開直後のトップページから当該記事へ遷移できない不具合を確認)。
// canonical/sitemap側は既にエンコード済みだったため、表示側のリンク・画像も
// ここに集約して同じ表記に揃える。

// slug 1個分をURLの1セグメントとしてエンコードする
export function encodeSlug(slug) {
  return encodeURIComponent(String(slug ?? ""));
}

// 記事ページへのリンク先(`/posts/<encoded slug>`)
export function postHref(slug) {
  return `/posts/${encodeSlug(slug)}`;
}

// `/images/articles/...` のようなパスを、区切りの `/` を保ったままエンコードする。
// encodeURI では `%` がそのまま残るため使えない。
export function encodePath(p) {
  if (!p) return "";
  const s = String(p);
  if (/^https?:\/\//i.test(s)) return s;
  return s.split("/").map(encodeURIComponent).join("/");
}
