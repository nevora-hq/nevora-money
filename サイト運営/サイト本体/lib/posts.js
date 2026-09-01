import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkHtml from "remark-html";
import { getCategoryMascot, getMascotIntroComment, getMascotOutroComment } from "./categoryMascot";
import { MAJOR_CATEGORIES } from "./categoryMeta";
import { encodePath } from "./urls";

// npm run sync-content (predev/prebuild) によって
// サイト運営/記事データ/確定稿 から自動コピーされるディレクトリ
const ARTICLES_DIR = path.join(process.cwd(), "content", "articles");

// renderXTocHtml/insertXToc(このファイル内、下記slug === 〇〇分岐)でcontentHtml冒頭に
// 記事専用の折りたたみ目次を埋め込んでいるslug一覧。post.hasEmbeddedTocの算出に使う
// (2026-08-09、目次重複バグ対応で新設)。
const SLUGS_WITH_EMBEDDED_TOC = new Set([]);

function readArticleFiles() {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".md"));
}

function slugFromFilename(filename) {
  return filename.replace(/\.md$/, "");
}

// ライター/編集長が本文に残す内部向けメモ(HTMLコメント)を除去する。
// 抜粋生成・本文表示のどちらでも、読者向けの表示に混入しないようにする。
function stripHtmlComments(content) {
  return content.replace(/<!--[\s\S]*?-->/g, "");
}

// 記事によってaffiliateLinksの表示名キーが label / name のどちらかで揺れているため、
// ここで label に統一して吸収する(未指定の場合はnullではなく空文字にし、
// getStaticPropsでのJSONシリアライズエラー(undefined不可)を防ぐ)。
// バナー画像は image / banner / imageUrl / bannerUrl のいずれのキーでも受け付ける。
// バナー画像がまだ用意できていない記事もあるため、未指定時は空文字にして
// レンダリング側でテキストリンク+PR表記のフォールバック表示に切り替える。
function normalizeAffiliateLinks(links) {
  if (!Array.isArray(links)) return [];
  return links.map((link) => ({
    label: link.label || link.name || "",
    url: link.url || "",
    image: link.image || link.banner || link.imageUrl || link.bannerUrl || "",
  }));
}

// ライターが本文中で使える軽量な装飾記法をHTMLに変換する。
// ==text== → ハイライト(マーカー)、++text++ → 下線、
// ^^text^^ → 感情の変化・気づきを強調する装飾(文字を大きく・色を変える)、
// %%text%% → 出典の信頼性注記など「補足・留意点」を示す小さめ・控えめな色の注記
//   (打消し表示が過度に目立たなくなり景品表示法上問題化しないよう、
//   完全に読めなくなるほど小さく/薄くはしない。styles/globals.cssの
//   .article-note参照)。
// remarkは未知の記法をプレーンテキストとしてそのまま通すため、
// remarkHtml適用後の文字列に対して行う。
// 区切り記号(==/^^/%%)は「2文字連続」のみを区切りとして扱い、内容中に単独の
// 同一記号(例: "82.7%"の%、"A=B"の=)が1つだけ含まれるケースでも正しく変換
// できるようにする(2026-08-09修正: [^=\n]+?のような単純な文字除外だと、
// 区切り記号と同じ文字が内容中に1つでも現れた時点でそこで打ち切られてしまい、
// 対応する閉じ記号まで届かず変換自体が失敗し、==や%%が生テキストとして
// 読者に表示される不具合があった)。
function applyInlineMarkup(html) {
  return html
    .replace(/==((?:(?!==)[^\n])+?)==/g, '<mark class="hl">$1</mark>')
    // (?<!\+)\+\+(?!\+) ... (?<!\+)\+\+(?!\+): "++"区切りが3つ以上連続する"+"の一部として
    // 出現している場合(例: 本文中の"PA++++"という4連続プラス表記)は区切りとして扱わない。
    // 境界アサーションを付けないと、"++++"を「++」の開き/閉じの組み合わせとして誤って
    // マッチしてしまい、"PA++++が追加され...(+〜++++)"のような文が"++が追加され...(+〜</u>++)"
    // という形で一部だけ下線タグに巻き込まれ、表示上「PA++」のように化けて見える不具合があった
    // (2026-08-12、SPF・PA記事のPA++++表記で発見)。
    .replace(/(?<!\+)\+\+(?!\+)([^\n]+?)(?<!\+)\+\+(?!\+)/g, '<u class="u-accent">$1</u>')
    .replace(/\^\^((?:(?!\^\^)[^\n])+?)\^\^/g, '<span class="emotion-emphasis">$1</span>')
    .replace(/%%((?:(?!%%)[^\n])+?)%%/g, '<span class="article-note">$1</span>');
}

// 本文中の「> 💡 NEVORAポイント」「> ⚠️ 注意」形式のblockquoteを、
// マスコットの一言・注意喚起として視覚的に区別できるボックスに変換する。
// remark-htmlの生HTML不許可方針を維持したまま(記事Markdown側は素の
// 引用記法のみを使う)、サイト側の文字列後置換で見た目だけ強化する方式
// (embedAccordions等と同じ設計)。パターンに一致しない通常の引用は
// 変更せずそのまま通す。
function enhanceAnnotationBlockquotes(html) {
  return html
    .replace(
      /<blockquote>\s*<p>⏱\s*30秒でわかる\s*<br>\s*([\s\S]*?)<\/p>\s*<\/blockquote>/g,
      (_m, inner) =>
        `<div class="quick-summary-box"><p class="quick-summary-label"><span aria-hidden="true">⏱</span> 30秒でわかる</p><p class="quick-summary-body">${inner}</p></div>`
    )
    .replace(
      /<blockquote>\s*<p>🔍\s*結論だけ知りたい人へ\s*<br>\s*([\s\S]*?)<\/p>\s*<\/blockquote>/g,
      (_m, inner) =>
        `<div class="quick-conclusion-box"><p class="quick-conclusion-label"><span aria-hidden="true">🔍</span> 結論だけ知りたい人へ</p><p class="quick-conclusion-body">${inner}</p></div>`
    )
    .replace(
      /<blockquote>\s*<p>💡\s*NEVORAポイント\s*<br>\s*([\s\S]*?)<\/p>\s*<\/blockquote>/g,
      (_m, inner) =>
        `<div class="nevora-point-box"><span class="nevora-point-icon" aria-hidden="true">💡</span><div class="nevora-point-body"><p class="nevora-point-label">NEVORAポイント</p><p>${inner}</p></div></div>`
    )
    .replace(
      /<blockquote>\s*<p>⚠️\s*注意\s*<br>\s*([\s\S]*?)<\/p>\s*<\/blockquote>/g,
      (_m, inner) =>
        `<div class="warning-box"><span class="warning-box-icon" aria-hidden="true">⚠️</span><div class="warning-box-body"><p class="warning-box-label">注意</p><p>${inner}</p></div></div>`
    )
    .replace(
      /<blockquote>\s*<p>🎯\s*まとめカード\s*<br>\s*([\s\S]*?)<\/p>\s*<\/blockquote>/g,
      (_m, inner) =>
        `<div class="azelaic-summary-card"><p class="quick-summary-label">🎯 まとめ</p><p>${inner}</p></div>`
    );
}

function escapeHtmlText(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// アフィリエイトリンク1件分の「バナー画像+PRバッジ」(画像未指定時はテキストボタン+PR)を
// HTML文字列として組み立てる。AdSense広告枠と混同されないよう、PRバッジと
// 枠線付きブロックで視覚的に区別する。
function renderAffiliateBannerHtml(link) {
  const url = escapeHtmlText(link.url);
  const label = escapeHtmlText(link.label);
  const inner = link.image
    ? `<a href="${url}" target="_blank" rel="nofollow sponsored noopener noreferrer" class="affiliate-banner-link"><img src="${escapeHtmlText(
        link.image
      )}" alt="${label}" loading="lazy" class="affiliate-banner-img" /></a>`
    : `<a href="${url}" target="_blank" rel="nofollow sponsored noopener noreferrer" class="affiliate-link-btn">${label} を見る(公式サイト)</a>`;

  return `<div class="affiliate-inline-banner"><span class="pr-badge">PR</span>${inner}</div>`;
}

// マスコットキャラクターの吹き出しコメントをHTML文字列として組み立てる。
// components/Mascot.jsの吹き出し表示(.mascot-comment)と見た目を揃えている。
// pose: "normal"(記事冒頭の挨拶) / "research"(中盤の補足) / "matome"(末尾の振り返り)
function renderMascotCommentHtml(mascot, pose, comment) {
  const name = escapeHtmlText(mascot.name);
  const image =
    pose === "normal" ? mascot.normalImage : pose === "matome" ? mascot.matomeImage : mascot.researchImage;
  return `<div class="mascot-comment mascot-comment-inline mascot-comment-${pose}"><img src="${escapeHtmlText(
    image
  )}" alt="${name}" width="56" height="56" class="mascot-comment-img" loading="lazy" /><div class="mascot-comment-bubble"><span class="mascot-comment-name">${name}</span><p class="mascot-comment-text">${escapeHtmlText(
    comment
  )}</p></div></div>`;
}

// 記事内へのマスコット挿入(冒頭の挨拶/中盤の補足/末尾の振り返り)をまとめて行う。
// 挿入位置はH2見出しの直前(セクションの切れ目)に限定する。段落・リスト単位
// (splitHtmlBlocks)で区切ると、比較ブロック(メリット/デメリット等の<figure>)の
// 内部で使われる</p></ul>にも反応して分割されてしまい、独自レイアウトの
// 途中にマスコットが挟まる不具合が過去にあったため、必ず記事の大きな
// セクション区切りであるH2見出しの直前にのみ挿入する。
// H2が少ない(短文)記事では中盤の補足が不自然になるため2つ未満の場合は挿入しない。
// 文字列末尾への追記から順に(末尾→中盤→冒頭の順で、位置が後ろのものから)
// 行うことで、挿入によるオフセットのズレを避けている。
function insertMascotComment(html, mascot, seed) {
  if (!mascot) return html;

  const headingPositions = [];
  const headingRe = /<h2[ >]/g;
  let match;
  while ((match = headingRe.exec(html))) {
    headingPositions.push(match.index);
  }

  let result = html + renderMascotCommentHtml(mascot, "matome", getMascotOutroComment(mascot, seed));

  if (headingPositions.length >= 2) {
    const midAt = headingPositions[Math.floor(headingPositions.length / 2)];
    result =
      result.slice(0, midAt) +
      renderMascotCommentHtml(mascot, "research", mascot.comment) +
      result.slice(midAt);
  }

  if (headingPositions.length >= 1) {
    const introAt = headingPositions[0];
    result =
      result.slice(0, introAt) +
      renderMascotCommentHtml(mascot, "normal", getMascotIntroComment(mascot, seed)) +
      result.slice(introAt);
  }

  return result;
}

// 本文HTML(remarkで生成済み)を段落・リスト等のブロック単位で分割し、
// そのアフィリエイトリンクへの言及(文中の[ラベル](URL)リンク)が最初に登場する
// ブロックの直後にバナー(または画像未指定時はPR付きテキストリンク)を挿入する。
// 記事下部に一括表示するのではなく、話題に関連する箇所の直後に配置するための処理。
// 本文中にリンクへの言及が見つからなかった分は unplaced として返し、
// 呼び出し側でフォールバック表示(記事末尾にまとめて表示)に使う。
function escapeRegExp(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// remarkHtmlが出力するHTMLを、段落・見出し等のブロック単位で分割する共通処理。
// アフィリエイトバナー・グラフの挿入箇所判定の両方で使う。
function splitHtmlBlocks(html) {
  // NEVORAポイント/注意ボックス(nevora-point-box, warning-box)はblockquoteから
  // applyInlineMarkupでネストしたdiv2重構造(</div></div>で終わる)に変換される一方、
  // 「⏱30秒でわかる」「🔍結論だけ知りたい人へ」「🎯まとめカード」(enhanceAnnotationBlockquotes参照)
  // は単一div構造(</div>のみ)に変換される。単純な</div>境界は2重div構造を
  // 誤って分割してしまう危険がある一方、単一div構造の境界が無いと、
  // これらのボックス直後の見出しに対するchart/accordion挿入がその見出しを
  // ブロック先頭と認識できず失敗する(2026-08-14、髪のパサつき記事で発覚。
  // 「🔍結論だけ知りたい人へ」ボックス直後の最初の見出しに紐づくchartが
  // 実際のHTMLに一度も挿入されていなかった=verify-article.jsのfrontmatter
  // チェックだけでは検出できない「item28類似」のサイレント失敗)。
  //
  // 対策: 2重div(</div></div>、隣接する2つの閉じタグの間には何も無いもの)を
  // 先にプレースホルダへ退避してから単一の</div>を境界として追加し、
  // 分割後にプレースホルダを</div></div>へ復元する。これにより2重div構造の
  // 内部で誤分割することなく、単一div構造の直後にも正しく境界を作れる。
  const DOUBLE_DIV_PLACEHOLDER = "@@NEVORA_DOUBLE_DIV_CLOSE@@";
  const protectedHtml = html.split("</div></div>").join(DOUBLE_DIV_PLACEHOLDER);
  // 境界タグに figure/aside/details/section を追加(2026-08-17、embedChartsの
  // tip/skincareTip型セクション末尾描画化により、`</aside>`(mn-tip/skb-tip等の
  // NEVORAポイント包み)の直後に次の見出しが直接続くパターンが常態化した。
  // 従来のタグ一覧(p/ul/ol/blockquote/h1-6/pre/table/div)にasideが無かったため、
  // `</aside><h2>...`が1ブロックに誤って結合され、embedAccordionsがそのh2を
  // ブロック先頭として認識できず、紐づくアコーディオンが挿入されない
  // サイレント失敗(item33で検出)が発生した。figure(多くのchartのラッパー)・
  // details(accordion自体・checklist等)・section も同種のリスクがあるため
  // 合わせて境界に追加する。
  const blocks = protectedHtml.split(
    new RegExp(
      `(?<=<\\/(?:p|ul|ol|blockquote|h1|h2|h3|h4|h5|h6|pre|table|div|figure|aside|details|section)>|${DOUBLE_DIV_PLACEHOLDER}|<hr ?\\/?>)\\n*(?=<)`
    )
  );
  return blocks.map((b) => b.split(DOUBLE_DIV_PLACEHOLDER).join("</div></div>"));
}

function stripTags(text) {
  return String(text || "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

// ASP提携前で複数の商品が同じ AFFILIATE_LINK_PLACEHOLDER を暫定URLとして
// 共有しているケースがあるため、URLの一致だけで「使用済み」を判定すると
// 2件目以降が本文中にも記事末尾にも表示されず消えてしまう。
// そのため単純なURL重複排除ではなく、各ブロック内に実際に出現する
// href="URL" の「個数」を数え、その個数分だけリンクを割り当てる方式にする。
function embedAffiliateBanners(html, affiliateLinks) {
  const links = affiliateLinks.filter((l) => l.url);
  if (links.length === 0) {
    return { html, unplaced: [] };
  }

  const blocks = splitHtmlBlocks(html);
  const linkUsed = new Array(links.length).fill(false);
  const outBlocks = [];

  for (const block of blocks) {
    outBlocks.push(block);

    const availableByUrl = new Map();
    const consumedByUrl = new Map();

    for (const link of links) {
      if (availableByUrl.has(link.url)) continue;
      const pattern = new RegExp(
        `href="(?:${escapeRegExp(link.url)}|${escapeRegExp(
          escapeHtmlText(link.url)
        )})"`,
        "g"
      );
      const count = (block.match(pattern) || []).length;
      availableByUrl.set(link.url, count);
    }

    links.forEach((link, i) => {
      if (linkUsed[i]) return;
      const available = availableByUrl.get(link.url) || 0;
      const consumed = consumedByUrl.get(link.url) || 0;
      if (consumed < available) {
        linkUsed[i] = true;
        consumedByUrl.set(link.url, consumed + 1);
        outBlocks.push(renderAffiliateBannerHtml(link));
      }
    });
  }

  const unplaced = links.filter((_, i) => !linkUsed[i]);
  return { html: outBlocks.join(""), unplaced };
}

// frontmatterのchartsから、出典付きの横棒グラフをSVGで組み立てる。
// クライアント側JSに依存せず(静的HTML)、ホバーで値が見えるnative <title>と、
// アクセシビリティ用に<details>でテーブル表示も併記する。
// 全角(CJK等)は1、半角(数字・記号等)は0.5として文字幅を概算する
// (verify-article.jsのzenkakuLengthと同じ考え方。バーチャートの
// カテゴリラベル列の幅を、ラベル文字数に応じて動的に決めるために使う)。
function estimateZenkakuLength(text) {
  let total = 0;
  for (const ch of Array.from(String(text || ""))) {
    const code = ch.codePointAt(0);
    const isFullWidth =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe4f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6);
    total += isFullWidth ? 1 : 0.5;
  }
  return total;
}

// maxLineChars文字(生の文字数、全角/半角を区別しない)を超えるラベルを
// 2行に分割する(バーチャートのカテゴリラベルはみ出し恒久対策、2026-08-16、
// 案2ベース)。文字数基準は`scripts/verify-declared-vs-rendered.js`の汎用SVG
// テキストスキャナの推定式(`charLen * emUnits`、全角/半角を区別せず1文字を
// 均等にemUnits幅として見積もる保守的な式)に合わせたもの(全角換算〔0.5/1.0
// 加重〕で見積もると、数字主体のラベル・値ラベルでスキャナの推定よりも
// 実装側の見積もりが甘くなり、はみ出しが解消しきれない食い違いが生じていた)。
// 中間点付近に「の」「・」「(」「（」「スペース」等の自然な区切り文字があれば
// そこで、無ければ文字数の中間点に最も近い位置で分割する。
function splitLabelForWrap(label, maxLineChars) {
  const text = String(label || "");
  const chars = Array.from(text);
  if (chars.length <= maxLineChars) return [text];
  const bestIdx = Math.ceil(chars.length / 2);
  // 句点・感嘆符を追加(2026-08-25)。CHAR_UNIT引き上げで折り返しが増えた際、
  // 「。」が次の行の先頭に落ちる行頭禁則違反が発生したため。
  const breakChars = new Set(["の", "・", "(", "（", " ", "、", "。", "!", "?", "！", "？"]);
  let chosen = bestIdx;
  for (let d = 0; d <= 2 && chosen === bestIdx; d += 1) {
    if (breakChars.has(chars[bestIdx - 1 + d])) chosen = bestIdx + d;
    else if (bestIdx - 1 - d >= 0 && breakChars.has(chars[bestIdx - 1 - d])) chosen = bestIdx - d;
  }
  chosen = Math.max(1, Math.min(chars.length - 1, chosen));
  return [chars.slice(0, chosen).join(""), chars.slice(chosen).join("")];
}

function renderBarChartHtml(chart) {
  const { title, unit = "", data, source, sourceUrl } = chart;
  if (!Array.isArray(data) || data.length === 0) return "";

  const values = data.map((d) => Number(d.value) || 0);
  const max = Math.max(...values, 1);
  const barHeight = 30;
  const barGap = 16;
  const chartWidth = 560;
  // 文字幅の推定単位: scripts/verify-declared-vs-rendered.jsの汎用SVGテキスト
  // スキャナが用いる推定式(GENERIC_LABEL_FONT_PX=12.5px相当のフォントを、
  // 実機の想定表示幅325pxに対するviewBox幅の比率でviewBox単位に換算する
  // 保守的な推定式)と同じ考え方でchartWidth=560基準の単位を算出する
  // (2026-08-16、旧実装が1文字=13単位という独自の緩い見積もりを使っていたため、
  // スキャナの推定〔1文字=約21.5単位、実機基準でより保守的〕との乖離により
  // 「幅を広げたつもりでもスキャナ上ははみ出したまま」という食い違いが生じていた
  // ことが§3の再測定で判明。同じ基準で計算し直す)。
  const CHAR_UNIT = 12.5 * (chartWidth / 325);
  // カテゴリラベル列: 1行あたり生の文字数6字を上限に2行折り返しする
  // (2026-08-16、案2ベースの恒久対策。labelWidth自体を広げる旧方式〔幅動的化のみ〕
  // では長いラベルのはみ出しを解消しきれないことが汎用SVGスキャナの再測定で
  // 判明したため、折り返しと組み合わせる方式に変更)。
  const CAT_LABEL_MAX_LINE_CHARS = 6;
  const catLines = data.map((d) => splitLabelForWrap(d.label, CAT_LABEL_MAX_LINE_CHARS));
  const maxLineLen = Math.max(
    ...catLines.flat().map((line) => Array.from(line).length),
    0
  );
  const labelWidth = Math.max(140, Math.ceil(maxLineLen * CHAR_UNIT) + 24);
  // 値ラベル列: 最長の値ラベル(値+単位)の推定幅をあらかじめ右マージンとして
  // 確保し、バーが右端まで伸びても値ラベルがviewBox右端を超えないようにする
  // (2026-08-16、値ラベル側のはみ出しが未対応だったことが汎用SVGスキャナの
  // 再測定〔B-a〕で判明したため追加)。
  const maxValueLen = Math.max(
    ...data.map((d) => Array.from(`${d.value}${unit}`).length),
    0
  );
  const valueMargin = Math.ceil(maxValueLen * CHAR_UNIT) + 16;
  const plotWidth = chartWidth - labelWidth - valueMargin - 8;
  // 2行ラベルの行は縦方向に余分な高さを確保し、バー自体の高さ(barHeight)は
  // 変えずにスロット内で縦中央に配置する。2行の間隔(24単位)は、CHAR_UNIT基準の
  // ascent/descent(スキャナの推定式と同じ0.88/0.2比率)で2行が互いに重ならない
  // 最小限のマージンを確保した値。
  const rowHeights = catLines.map((lines) => (lines.length > 1 ? barHeight + 34 : barHeight));
  const rowTops = [];
  {
    let cursor = barGap;
    for (const rh of rowHeights) {
      rowTops.push(cursor);
      cursor += rh + barGap;
    }
  }
  const height = rowTops[rowTops.length - 1] + rowHeights[rowHeights.length - 1] + barGap;

  const bars = data
    .map((d, i) => {
      const value = Number(d.value) || 0;
      const rowTop = rowTops[i];
      const rowHeight = rowHeights[i];
      const barY = rowTop + (rowHeight - barHeight) / 2;
      const barWidth = Math.max((value / max) * plotWidth, 2);
      const lines = catLines[i];
      const valueText = escapeHtmlText(`${d.value}${unit}`);
      const labelHtml =
        lines.length > 1
          ? `<text x="${labelWidth - 10}" y="${
              barY + barHeight / 2 - 12
            }" text-anchor="end" class="chart-cat-label">${escapeHtmlText(
              lines[0]
            )}</text><text x="${labelWidth - 10}" y="${
              barY + barHeight / 2 + 12
            }" text-anchor="end" class="chart-cat-label">${escapeHtmlText(lines[1])}</text>`
          : `<text x="${labelWidth - 10}" y="${
              barY + barHeight / 2
            }" text-anchor="end" dominant-baseline="middle" class="chart-cat-label">${escapeHtmlText(
              lines[0]
            )}</text>`;
      return `<g><title>${escapeHtmlText(d.label)}: ${valueText}</title>${labelHtml}<rect x="${labelWidth}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="4" class="chart-bar" /><text x="${
        labelWidth + barWidth + 8
      }" y="${
        barY + barHeight / 2
      }" dominant-baseline="middle" class="chart-value-label">${valueText}</text></g>`;
    })
    .join("");

  const tableRows = data
    .map(
      (d) =>
        `<tr><td>${escapeHtmlText(d.label)}</td><td>${escapeHtmlText(
          `${d.value}${unit}`
        )}</td></tr>`
    )
    .join("");

  const sourceHtml = source
    ? `<figcaption class="chart-source">出典: ${
        sourceUrl
          ? `<a href="${escapeHtmlText(
              sourceUrl
            )}" target="_blank" rel="nofollow noopener noreferrer">${escapeHtmlText(
              source
            )}</a>`
          : escapeHtmlText(source)
      }</figcaption>`
    : "";

  return `<figure class="article-chart"><figcaption class="chart-title">${escapeHtmlText(
    title
  )}</figcaption><svg viewBox="0 0 ${chartWidth} ${height}" class="chart-svg" role="img" aria-label="${escapeHtmlText(
    title
  )}">${bars}</svg><details class="chart-table-toggle"><summary>データを表で見る</summary><table class="chart-table"><thead><tr><th>項目</th><th>値</th></tr></thead><tbody>${tableRows}</tbody></table></details>${sourceHtml}</figure>`;
}

// 1つの数値のみを示す統計(単一の割合・人数等)は棒グラフではなく
// 大きな数字で見せる「stat tile」として表示する(比較対象がない値を
// 無理に棒グラフ化しない)。
function renderStatTileHtml(chart) {
  const { value, unit = "", label, source, sourceUrl } = chart;

  const sourceHtml = source
    ? `<figcaption class="chart-source">出典: ${
        sourceUrl
          ? `<a href="${escapeHtmlText(
              sourceUrl
            )}" target="_blank" rel="nofollow noopener noreferrer">${escapeHtmlText(
              source
            )}</a>`
          : escapeHtmlText(source)
      }</figcaption>`
    : "";

  return `<figure class="article-stat-tile"><div class="stat-tile-value">${escapeHtmlText(
    String(value)
  )}<span class="stat-tile-unit">${escapeHtmlText(
    unit
  )}</span></div><p class="stat-tile-label">${escapeHtmlText(
    label
  )}</p>${sourceHtml}</figure>`;
}

// 円グラフ(ドーナツ)用の配色。dataviz skillのvalidate_palette.jsで
// 5色までCVD(色覚特性)安全性・視認性を検証済みの組み合わせ。
// データ点が5件を超える場合は上位4件+「その他」にまとめて表示する
// (6件以上は隣接ペアの識別性が担保できなくなるため)。
const DONUT_PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

function buildDonutSlices(data) {
  const items = data.map((d) => ({
    label: d.label,
    value: Number(d.value) || 0,
  }));
  if (items.length <= 5) return items;

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 4);
  const restSum = sorted.slice(4).reduce((sum, d) => sum + d.value, 0);
  return [...top, { label: "その他", value: restSum }];
}

// frontmatterのcharts(type: "pie" or "donut")から、内訳を示す
// ドーナツチャート+凡例+出典を組み立てる。単一の割合の推移ではなく
// 「内訳・構成比」を示したいデータ向け(単一値はrenderStatTileHtml、
// 項目間の量の比較はrenderBarChartHtmlを使う)。
function renderDonutChartHtml(chart) {
  const { title, unit = "", data, source, sourceUrl } = chart;
  if (!Array.isArray(data) || data.length === 0) return "";

  const slices = buildDonutSlices(data);
  const total = slices.reduce((sum, d) => sum + d.value, 0) || 1;

  const size = 220;
  const center = size / 2;
  const strokeWidth = 34;
  const radius = center - strokeWidth / 2 - 4;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const arcs = slices
    .map((d, i) => {
      const fraction = d.value / total;
      const dash = fraction * circumference;
      const offset = -cumulative;
      cumulative += dash;
      const color = DONUT_PALETTE[i % DONUT_PALETTE.length];
      const percent = Math.round(fraction * 100);
      const label = escapeHtmlText(d.label);
      const valueText = escapeHtmlText(`${d.value}${unit}`);
      return `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="${dash} ${
        circumference - dash
      }" stroke-dashoffset="${offset}" transform="rotate(-90 ${center} ${center})"><title>${label}: ${valueText}(${percent}%)</title></circle>`;
    })
    .join("");

  const legend = slices
    .map((d, i) => {
      const fraction = d.value / total;
      const percent = Math.round(fraction * 100);
      const color = DONUT_PALETTE[i % DONUT_PALETTE.length];
      return `<li><span class="donut-swatch" style="background:${color}"></span><span class="donut-legend-label">${escapeHtmlText(
        d.label
      )}</span><span class="donut-legend-value">${escapeHtmlText(
        `${d.value}${unit}`
      )}(${percent}%)</span></li>`;
    })
    .join("");

  const tableRows = slices
    .map(
      (d) =>
        `<tr><td>${escapeHtmlText(d.label)}</td><td>${escapeHtmlText(
          `${d.value}${unit}`
        )}</td></tr>`
    )
    .join("");

  const sourceHtml = source
    ? `<figcaption class="chart-source">出典: ${
        sourceUrl
          ? `<a href="${escapeHtmlText(
              sourceUrl
            )}" target="_blank" rel="nofollow noopener noreferrer">${escapeHtmlText(
              source
            )}</a>`
          : escapeHtmlText(source)
      }</figcaption>`
    : "";

  return `<figure class="article-chart article-donut-chart"><figcaption class="chart-title">${escapeHtmlText(
    title
  )}</figcaption><div class="donut-chart-layout"><svg viewBox="0 0 ${size} ${size}" class="donut-svg" role="img" aria-label="${escapeHtmlText(
    title
  )}">${arcs}</svg><ul class="donut-legend">${legend}</ul></div><details class="chart-table-toggle"><summary>データを表で見る</summary><table class="chart-table"><thead><tr><th>項目</th><th>値</th></tr></thead><tbody>${tableRows}</tbody></table></details>${sourceHtml}</figure>`;
}

// frontmatterのcharts(type: "prosCons")から、メリット/デメリットの
// 2カラム比較ブロックを組み立てる。GFMの表(| |)でも比較は書けるが、
// メリット/デメリットは色分けした専用レイアウトの方が一目で伝わるため
// 別枠で用意している。
function renderProsConsHtml(chart) {
  const { title, pros, cons } = chart;
  const prosItems = (Array.isArray(pros) ? pros : [])
    .map((p) => `<li>${escapeHtmlText(p)}</li>`)
    .join("");
  const consItems = (Array.isArray(cons) ? cons : [])
    .map((c) => `<li>${escapeHtmlText(c)}</li>`)
    .join("");
  const titleHtml = title
    ? `<figcaption class="chart-title">${escapeHtmlText(title)}</figcaption>`
    : "";

  return `<figure class="pros-cons-block">${titleHtml}<div class="pros-cons-grid"><div class="pros-cons-col pros-cons-pros"><p class="pros-cons-head">◎ メリット</p><ul>${prosItems}</ul></div><div class="pros-cons-col pros-cons-cons"><p class="pros-cons-head">△ デメリット</p><ul>${consItems}</ul></div></div></figure>`;
}

// frontmatterのcharts(type: "quadrant")から、2軸(縦軸・横軸)上に複数の項目を
// 位置づける散布図(ポジショニングマップ)をSVGで組み立てる。数値の大小比較ではなく
// 「洗浄力は高いが摩擦は起きやすい」のような2つの性質の組み合わせを一目で見せたい
// 比較記事向け(例: クレンジングのタイプ別比較)。dataの各項目のx/yは0〜100の目安値。
// 0〜100の目安値を「高い/中程度/低い」の3段階の言葉に丸めて表示するための補助関数。
// quadrantチャートのフォールバック表は、方法論の裏付けがない座標値をそのまま
// 数値で見せると測定値であるかのような誤解を招くため、相対的な位置づけの
// 目安として質的な表現に変換する(2026-08-11、quadrant判定B対応)。
// 以前は◎/○/△の記号を使っていたが、◎(良い)△(悪い)という評価の含意を
// 持つため、軸の向きによっては「値が高い=悪い」の場合に誤読を招く
// (2026-08-13、ネイルサロン記事の「費用感」軸でサロンに◎がつき「費用が
// 優れている(安い)」と誤読される問題が発覚)。評価を含まない中立的な
// 高低表現に置き換えた。個々のdata項目に`xNote`/`yNote`(記事の実際の
// 記述に即した具体的な文言、例:「長め(約3〜4週間)」)が指定されている
// 場合はそちらを優先し、この関数によるおおまかな高低表現は指定がない
// 場合のフォールバックとする。
function scoreToMagnitudeWord(n) {
  const v = Math.max(0, Math.min(100, Number(n) || 0));
  if (v >= 67) return "高い";
  if (v >= 34) return "中程度";
  return "低い";
}

function renderQuadrantChartHtml(chart) {
  const { title, xLabel, yLabel, data, source, sourceUrl, note } = chart;
  if (!Array.isArray(data) || data.length === 0) return "";

  const size = 320;
  const margin = 36;
  const plot = size - margin * 2;
  const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));

  const coords = data.map((d) => ({
    x: margin + (clamp(d.x) / 100) * plot,
    // SVGのy座標は下向きが正のため、上に行くほど値が大きくなるよう反転する
    y: margin + (1 - clamp(d.y) / 100) * plot,
  }));
  // ラベル衝突回避(2026-08-17、項目35が「枕カバー」記事のquadrantチャートで
  // 近接する2点(シルクx=40,y=55/抗菌加工素材x=55,y=50)のラベル同士の衝突を
  // 検出したため導入。quadrantはdata項目の座標を記事側で自由に指定する散布図
  // であり、近接データは他の記事でも起こり得るため記事個別対応ではなく
  // コンポーネント側で汎用対応する。単純な「点同士の距離が近ければ下にずらす」
  // 方式では、ずらした後の絶対位置が別ラベルの位置とたまたま再び近接する
  // ケースを防げないことが実測(項目35)で判明したため、ラベルの推定矩形
  // (文字数×フォント単位)を実際に組み立てながら、既に確定した他ラベルの
  // 推定矩形と重ならない候補(上/下×中央/左寄せ/右寄せ、計6パターン)を
  // 順に試す貪欲法に置き換えた。
  const LABEL_FONT_UNIT = 11 * (size / 325);
  const LABEL_H = 13;
  const labelDy = [];
  const labelDx = [];
  const labelAnchor = [];
  const placedRects = [];
  const CANDIDATES = [
    { dy: -12, dx: 0, anchor: "middle" },
    { dy: 24, dx: 0, anchor: "middle" },
    { dy: -12, dx: 8, anchor: "start" },
    { dy: -12, dx: -8, anchor: "end" },
    { dy: 24, dx: 8, anchor: "start" },
    { dy: 24, dx: -8, anchor: "end" },
    { dy: -30, dx: 0, anchor: "middle" },
    { dy: 42, dx: 0, anchor: "middle" },
  ];
  const estimateRect = (cx, cy, cand, text) => {
    const w = Math.max(1, Array.from(String(text)).length) * LABEL_FONT_UNIT;
    let left;
    if (cand.anchor === "start") left = cx + cand.dx;
    else if (cand.anchor === "end") left = cx + cand.dx - w;
    else left = cx + cand.dx - w / 2;
    const top = cy + cand.dy - LABEL_H;
    return { left, right: left + w, top, bottom: top + LABEL_H };
  };
  const rectsOverlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  data.forEach((d, i) => {
    const { x, y } = coords[i];
    let chosen = CANDIDATES[0];
    let chosenRect = estimateRect(x, y, chosen, d.label);
    for (const cand of CANDIDATES) {
      const rect = estimateRect(x, y, cand, d.label);
      if (!placedRects.some((r) => rectsOverlap(rect, r))) {
        chosen = cand;
        chosenRect = rect;
        break;
      }
    }
    placedRects.push(chosenRect);
    labelDy[i] = chosen.dy;
    labelDx[i] = chosen.dx;
    labelAnchor[i] = chosen.anchor;
  });

  const points = data
    .map((d, i) => {
      const { x, y } = coords[i];
      const label = escapeHtmlText(d.label);
      const color = DONUT_PALETTE[i % DONUT_PALETTE.length];
      return `<g><circle cx="${x}" cy="${y}" r="7" fill="${color}"><title>${label}</title></circle><text x="${
        x + labelDx[i]
      }" y="${y + labelDy[i]}" text-anchor="${labelAnchor[i]}" class="quadrant-point-label">${label}</text></g>`;
    })
    .join("");

  const tableRows = data
    .map((d) => {
      const xCell = d.xNote
        ? escapeHtmlText(String(d.xNote))
        : note
        ? scoreToMagnitudeWord(d.x)
        : escapeHtmlText(String(d.x));
      const yCell = d.yNote
        ? escapeHtmlText(String(d.yNote))
        : note
        ? scoreToMagnitudeWord(d.y)
        : escapeHtmlText(String(d.y));
      return `<tr><td>${escapeHtmlText(
        d.label
      )}</td><td>${xCell}</td><td>${yCell}</td></tr>`;
    })
    .join("");

  const noteHtml = note
    ? `<p class="chart-quadrant-note">${escapeHtmlText(note)}</p>`
    : "";

  const sourceHtml = source
    ? `<figcaption class="chart-source">出典: ${
        sourceUrl
          ? `<a href="${escapeHtmlText(
              sourceUrl
            )}" target="_blank" rel="nofollow noopener noreferrer">${escapeHtmlText(
              source
            )}</a>`
          : escapeHtmlText(source)
      }</figcaption>`
    : "";

  return `<figure class="article-chart article-quadrant-chart"><figcaption class="chart-title">${escapeHtmlText(
    title || ""
  )}</figcaption><svg viewBox="0 0 ${size} ${size}" class="quadrant-svg" role="img" aria-label="${escapeHtmlText(
    title || ""
  )}"><line x1="${margin}" y1="${margin}" x2="${margin}" y2="${
    size - margin
  }" class="quadrant-axis" /><line x1="${margin}" y1="${
    size - margin
  }" x2="${size - margin}" y2="${
    size - margin
  }" class="quadrant-axis" />${points}<text x="${size / 2}" y="${
    size - 8
  }" text-anchor="middle" class="quadrant-axis-label">${escapeHtmlText(
    xLabel || ""
  )} →</text><text x="12" y="${
    size / 2
  }" text-anchor="middle" class="quadrant-axis-label" transform="rotate(-90 12 ${
    size / 2
  })">${escapeHtmlText(
    yLabel || ""
  )} →</text></svg><details class="chart-table-toggle"><summary>データを表で見る</summary><table class="chart-table"><thead><tr><th>項目</th><th>${escapeHtmlText(
    xLabel || "横軸"
  )}</th><th>${escapeHtmlText(
    yLabel || "縦軸"
  )}</th></tr></thead><tbody>${tableRows}</tbody></table></details>${noteHtml}${sourceHtml}</figure>`;
}

// 「ファンデーション崩れタイプ別比較」記事専用: 顔のシルエット上に
// 崩れやすいパーツをタイプ別に色分け表示する図解(chart type: "faceMap")。
// zones の area は "tZone"(額・鼻・小鼻) / "cheeks"(両頬) /
// "eyeMouth"(目元・口元) / "boundary"(フェイスライン=部位の境目) のいずれか。
// 座標は顔シルエットSVG(200x240の顔楕円)にあらかじめ合わせた固定値。
const FACE_MAP_AREA_GEOM = {
  tZone: [{ cx: 100, cy: 95, rx: 26, ry: 46 }],
  cheeks: [
    { cx: 62, cy: 130, rx: 22, ry: 26 },
    { cx: 138, cy: 130, rx: 22, ry: 26 },
  ],
  eyeMouth: [
    { cx: 72, cy: 92, rx: 14, ry: 8 },
    { cx: 128, cy: 92, rx: 14, ry: 8 },
    { cx: 100, cy: 168, rx: 18, ry: 8 },
  ],
  boundary: [
    { cx: 45, cy: 165, rx: 12, ry: 30 },
    { cx: 155, cy: 165, rx: 12, ry: 30 },
  ],
};

function renderFaceMapHtml(chart) {
  const { title, zones } = chart;
  if (!Array.isArray(zones) || zones.length === 0) return "";

  const shapes = zones
    .flatMap((zone) => {
      const geoms = FACE_MAP_AREA_GEOM[zone.area] || [];
      const label = escapeHtmlText(`${zone.type}: ${zone.label}`);
      return geoms.map(
        (g) =>
          `<ellipse cx="${g.cx}" cy="${g.cy}" rx="${g.rx}" ry="${g.ry}" fill="${escapeHtmlText(
            zone.color
          )}" fill-opacity="0.55" stroke="${escapeHtmlText(
            zone.color
          )}" stroke-width="2"><title>${label}</title></ellipse>`
      );
    })
    .join("");

  const legend = zones
    .map(
      (zone) =>
        `<li><span class="donut-swatch" style="background:${escapeHtmlText(
          zone.color
        )}"></span><span class="donut-legend-label">${escapeHtmlText(
          zone.type
        )}</span><span class="donut-legend-value">${escapeHtmlText(zone.label)}</span></li>`
    )
    .join("");

  return `<figure class="article-chart article-facemap-chart"><figcaption class="chart-title">${escapeHtmlText(
    title || ""
  )}</figcaption><div class="donut-chart-layout"><svg viewBox="0 0 200 240" class="facemap-svg" role="img" aria-label="${escapeHtmlText(
    title || "顔のパーツ別崩れやすさマップ"
  )}"><ellipse cx="100" cy="120" rx="70" ry="95" fill="#FDF8F3" stroke="#B08968" stroke-width="2" aria-hidden="true" /><g aria-hidden="true"><circle cx="72" cy="90" r="5" fill="#B08968" /><circle cx="128" cy="90" r="5" fill="#B08968" /><path d="M92,150 Q100,158 108,150" stroke="#B08968" stroke-width="2" fill="none" /></g>${shapes}</svg><ul class="donut-legend">${legend}</ul></div></figure>`;
}

// outcomesの各answersが全問「はい」/「いいえ」の二択になっているかどうかを判定する。
// この形の場合、質問は「Aタイプの特徴に当てはまるか」を1問ずつ独立に聞いている
// だけであり、複数の質問に同時に「はい」が付くケース(例: 老人性色素斑と肝斑が
// 併発している)を排除できない。にもかかわらず「Q1でいいえなら次の質問へ」という
// 消去法の1本道(決定木)として描画すると、実際には複数該当し得るのに
// 1タイプにしか当てはまらないかのような誤った印象(語弊)を与えてしまう
// (2026-08-09、ユーザー指摘により決定木案を撤回)。そのため下記
// renderSelfCheckListHtmlでは、4問を独立したチェック項目として並べ、
// 「複数該当することもある」ことが伝わる一覧形式にする。
function isBinaryDecisionFlowchart(chart) {
  const { questions, outcomes } = chart || {};
  if (!Array.isArray(questions) || questions.length === 0) return false;
  if (!Array.isArray(outcomes) || outcomes.length === 0) return false;
  return outcomes.every(
    (o) =>
      Array.isArray(o.answers) &&
      o.answers.length === questions.length &&
      o.answers.every((a) => a === "はい" || a === "いいえ")
  );
}

// 質問を独立したチェック項目として縦一列に並べ、それぞれ「はいの場合→該当タイプ」
// を示すセルフチェックリストとして描画する(横スワイプなし、質問の重複表示なし、
// かつ複数項目に「はい」が当てはまっても矛盾しない)。
function renderSelfCheckListHtml(chart) {
  const { title, questions, outcomes } = chart;

  const items = questions
    .map((q, i) => {
      const matched = outcomes.find((o) => o.answers[i] === "はい");
      const badge = matched
        ? `<span class="flowchart-selfcheck-badge" style="background:${escapeHtmlText(
            matched.color || "#B08968"
          )}">${escapeHtmlText(matched.label)}</span>`
        : "";
      return `<li class="flowchart-selfcheck-item"><p class="flowchart-selfcheck-question">Q${
        i + 1
      }. ${escapeHtmlText(q)}</p><p class="flowchart-selfcheck-result">はいの場合 → ${badge}</p></li>`;
    })
    .join("");

  return `<figure class="article-chart article-flowchart-chart" role="img" aria-label="${escapeHtmlText(
    title || "セルフチェックリスト"
  )}"><figcaption class="chart-title">${escapeHtmlText(
    title || ""
  )}</figcaption><ul class="flowchart-selfcheck-list">${items}</ul><p class="flowchart-selfcheck-note">※4つの質問はそれぞれ独立したチェック項目です。複数の項目が「はい」に当てはまる場合、複数のタイプが同時に当てはまっている可能性があります。</p></figure>`;
}

// 「何時ごろ崩れる?」「どこから崩れる?」「触るとテカる/粉っぽい?」の3問で
// 3タイプ(皮脂崩れ・乾燥崩れ・混合ヨレ)いずれかに分岐する自己診断図
// (chart type: "flowchart")。厳密な分岐グラフではなく、outcomes(結果タイプ)ごとに
// 3つの質問への回答を縦に並べた3カラムのカード型フローとして可視化し、
// 読者が自分の回答に近い列を目で追えるようにする。
// (回答が「はい/いいえ」の二択で1問1タイプに対応する場合は、上記の
// renderSelfCheckListHtmlに委譲する)
function renderFlowchartHtml(chart) {
  const { title, questions, outcomes } = chart;
  if (!Array.isArray(outcomes) || outcomes.length === 0) return "";
  if (isBinaryDecisionFlowchart(chart)) return renderSelfCheckListHtml(chart);
  const qs = Array.isArray(questions) ? questions : [];

  const columns = outcomes
    .map((outcome) => {
      const rows = qs
        .map((q, i) => {
          const answer = (outcome.answers && outcome.answers[i]) || "";
          // 最後の質問の直後にも「↓」矢印が無条件で出力されており、何にも
          // つながらない矢印が各カラムの末尾に浮いて見えていた。最後の質問の
          // 場合は矢印を出さないようにする(2026-08-10修正)。
          const arrow =
            i < qs.length - 1 ? `<div class="flowchart-arrow" aria-hidden="true">↓</div>` : "";
          return `<div class="flowchart-step"><p class="flowchart-question">Q${
            i + 1
          }. ${escapeHtmlText(q)}</p><p class="flowchart-answer">→ ${escapeHtmlText(
            answer
          )}</p></div>${arrow}`;
        })
        .join("");
      return `<div class="flowchart-column"><div class="flowchart-badge" style="background:${escapeHtmlText(
        outcome.color || "#B08968"
      )}">${escapeHtmlText(outcome.label)}</div>${rows}</div>`;
    })
    .join("");

  return `<figure class="article-chart article-flowchart-chart" role="img" aria-label="${escapeHtmlText(
    title || "崩れタイプ診断フローチャート"
  )}"><figcaption class="chart-title">${escapeHtmlText(
    title || ""
  )}</figcaption><div class="flowchart-grid">${columns}</div></figure>`;
}

// 塗布後の時間経過(0h/3h/5h/8h等)でタイプ別に崩れ度合いがどう変化するかを
// 示す折れ線グラフ(chart type: "lineChart")。実測データではなく傾向を示す
// イメージ図であることをfigcaptionに明記する。
const LINE_CHART_COLORS = ["#eb6834", "#2a78d6", "#1baf7a"];

function renderLineChartHtml(chart) {
  const { title, unit = "", xLabels, series, note } = chart;
  if (!Array.isArray(series) || series.length === 0) return "";
  const labels = Array.isArray(xLabels) ? xLabels : [];

  const width = 320;
  const margin = 32;
  // x軸ラベルが4つ以上あると、末尾付近の長いラベル同士が接触しやすい
  // (PMS記事の「1〜2日前」と「開始後3日」で余裕4%)。4つ以上のときだけ
  // 奇数番目を1段上げて段違いに配置し、その分の高さをラベル帯として追加する。
  // プロット領域の寸法は変えないため、3つ以下の図の描画は従来どおり(2026-08-25)。
  const staggerLabels = labels.length >= 4;
  const labelBand = staggerLabels ? 16 : 0;
  const height = 200 + labelBand;
  const plotW = width - margin * 2;
  const plotH = height - margin * 2 - labelBand;
  const axisY = margin + plotH;
  const maxPoints = Math.max(...series.map((s) => s.points.length), 1);
  const maxValue = Math.max(...series.flatMap((s) => s.points.map((v) => Number(v) || 0)), 1);

  const xAt = (i) => margin + (maxPoints > 1 ? (i / (maxPoints - 1)) * plotW : 0);
  const yAt = (v) => margin + plotH - (Number(v) / maxValue) * plotH;

  const axisLabels = labels
    .map((label, i) => {
      const anchor = i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle";
      const labelY = height - 8 - (staggerLabels && i % 2 === 1 ? 16 : 0);
      return `<text x="${xAt(i)}" y="${labelY}" text-anchor="${anchor}" class="chart-cat-label">${escapeHtmlText(label)}</text>`;
    })
    .join("");

  const lines = series
    .map((s, si) => {
      const color = s.color || LINE_CHART_COLORS[si % LINE_CHART_COLORS.length];
      const pts = s.points
        .map((v, i) => `${xAt(i)},${yAt(v)}`)
        .join(" ");
      const dots = s.points
        .map(
          (v, i) =>
            `<circle cx="${xAt(i)}" cy="${yAt(v)}" r="4" fill="${color}"><title>${escapeHtmlText(
              s.label
            )} ${labels[i] || ""}: ${escapeHtmlText(`${v}${unit}`)}</title></circle>`
        )
        .join("");
      return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" />${dots}`;
    })
    .join("");

  const legend = series
    .map((s, si) => {
      const color = s.color || LINE_CHART_COLORS[si % LINE_CHART_COLORS.length];
      return `<li><span class="donut-swatch" style="background:${color}"></span><span class="donut-legend-label">${escapeHtmlText(
        s.label
      )}</span></li>`;
    })
    .join("");

  const tableRows = series
    .map(
      (s) =>
        `<tr><td>${escapeHtmlText(s.label)}</td>${s.points
          .map((v) => `<td>${escapeHtmlText(`${v}${unit}`)}</td>`)
          .join("")}</tr>`
    )
    .join("");
  const tableHead = `<tr><th>タイプ</th>${labels
    .map((l) => `<th>${escapeHtmlText(l)}</th>`)
    .join("")}</tr>`;

  const noteHtml = note
    ? `<figcaption class="chart-source">${escapeHtmlText(note)}</figcaption>`
    : "";

  return `<figure class="article-chart article-line-chart"><figcaption class="chart-title">${escapeHtmlText(
    title || ""
  )}</figcaption><div class="donut-chart-layout"><svg viewBox="0 0 ${width} ${height}" class="linechart-svg" role="img" aria-label="${escapeHtmlText(
    title || ""
  )}"><line x1="${margin}" y1="${margin}" x2="${margin}" y2="${axisY}" class="quadrant-axis" /><line x1="${margin}" y1="${axisY}" x2="${width - margin}" y2="${axisY}" class="quadrant-axis" />${axisLabels}${lines}</svg><ul class="donut-legend">${legend}</ul></div><details class="chart-table-toggle"><summary>データを表で見る</summary><table class="chart-table"><thead>${tableHead}</thead><tbody>${tableRows}</tbody></table></details>${noteHtml}</figure>`;
}

// ==== 汎用4type(steps/checklist/summaryCard/compareCards) ====
// asemo/pore/kusumi/hairType等の記事ごとの専用widgetファイルで同じ形の実装が
// 繰り返されていたため、2026-08-08に共通実装として追加。新規記事はこちらのtypeを
// 使う想定で、既存記事側の専用実装(renderCareStepsHtml等)は移行せずそのまま残す。
// 関数名は既存の bare importと衝突しないよう Generic を付けている
// (renderChecklistHtml/renderCareStepsHtml/renderCompareCardsHtmlは他記事のimportで
// 既に使用済みのため)。

// 手順図(chart type: "steps")。items: [{step, note}]
// note/step双方のテキスト折り返し(2026-08-17、項目35が「寝つきが悪い夜の
// ナイトルーティン」「睡眠の質を上げる寝具と寝室環境」の2記事でnote/step文言の
// はみ出し・画面外はみ出しを検出したため導入。renderGenericStepsHtmlは
// 「steps」type使用箇所すべてに影響する共通コンポーネントであり、記事個別の
// ハードコードではないため、ここでの修正で両記事同時に解消する
// 〔bar chart等と同じCHAR_UNIT=12.5*(width/325)の推定式・splitLabelForWrap
// を再利用し、値は2行までの折り返しに対応〕。
function renderGenericStepsHtml(chart) {
  const { title, items } = chart || {};
  if (!Array.isArray(items) || items.length === 0) return "";

  const width = 300;
  const textX = 44;
  // 1文字あたりの見積もり幅。以前は 12.5 * (width / 325) = 11.54 としていたが、
  // 実測では全角1文字が約12ユーザー単位あり、1行21文字で描画幅が viewBox を
  // わずかに超える記事があった(フォントが数%太いCI環境でoverflow検出)。
  // 13.3 に引き上げて1行18文字とし、フォントが1割強太っても収まる余裕を持たせる。
  // viewBox幅の拡張ではなく係数側で吸収するのは、幅を広げると図全体が縮小し
  // 320px幅での注釈が8px台まで小さくなり可読性を損なうため(2026-08-25)。
  const CHAR_UNIT = 13.3;
  const MAX_LINE_CHARS = Math.max(8, Math.floor((width - textX - 10) / CHAR_UNIT));
  const LINE_H = 19;
  const TOP_OFFSET = 13;
  const GAP_AFTER_STEP = 4;
  const BOTTOM_PAD = 10;

  const stepLinesList = items.map((it) => splitLabelForWrap(it.step, MAX_LINE_CHARS));
  const noteLinesList = items.map((it) => splitLabelForWrap(it.note, MAX_LINE_CHARS));
  const rowHeights = items.map((_, i) => {
    const n1 = stepLinesList[i].length;
    const n2 = noteLinesList[i].length;
    return TOP_OFFSET + n1 * LINE_H + GAP_AFTER_STEP + n2 * LINE_H + BOTTOM_PAD;
  });
  const rowTops = [];
  let acc = 10;
  rowHeights.forEach((h) => {
    rowTops.push(acc);
    acc += h;
  });
  const height = acc + 6;

  const rows = items
    .map((it, i) => {
      const y = rowTops[i];
      const stepLines = stepLinesList[i];
      const noteLines = noteLinesList[i];
      const circleCy = y + 17;
      const stepText = stepLines
        .map((line, li) => `<text x="${textX}" y="${y + TOP_OFFSET + li * LINE_H}" class="chart-step-text">${escapeHtmlText(line)}</text>`)
        .join("");
      const noteTop = y + TOP_OFFSET + stepLines.length * LINE_H + GAP_AFTER_STEP;
      const noteText = noteLines
        .map((line, li) => `<text x="${textX}" y="${noteTop + li * LINE_H}" class="chart-step-note">${escapeHtmlText(line)}</text>`)
        .join("");
      return `<g>
        <circle cx="20" cy="${circleCy}" r="14" class="chart-step-circle" />
        <text x="20" y="${circleCy + 5}" text-anchor="middle" class="chart-step-num">${i + 1}</text>
        ${stepText}
        ${noteText}
      </g>`;
    })
    .join("");

  const alt = `${items.length}ステップ: ${items
    .map((it, i) => `${i + 1}. ${it.step}(${it.note})`)
    .join("、")}`;

  return `<figure class="article-chart chart-steps-figure">
    <figcaption class="chart-title">${escapeHtmlText(title || "手順")}</figcaption>
    <svg viewBox="0 0 ${width} ${height}" class="chart-steps-svg" role="img" aria-label="${escapeHtmlText(
    alt
  )}"><title>${escapeHtmlText(alt)}</title>${rows}</svg>
  </figure>`;
}

// 断面/構造図型(chart type: "crossSection")。層・部位を色分けした図形+
// 引き出し線ラベルで「体の中の仕組み」を説明する図解。steps型・checklist型は
// 「テキストの整形」であり、イラスト+文字説明が一体化した「図」ではないと
// ユーザー判定を受けたため新設(2026-08-13)。parts(ellipse/circle/path)と
// leaders(引き出し線+ラベル)を記事側のfrontmatterで指定するデータ駆動型。
// 座標は viewBox の生座標(既定 300x320)。肌の層・毛根・爪の構造等、記事ごとに
// 異なる形状を都度frontmatterで指定する(汎用の自動レイアウトは持たない)。
function renderPartShapeHtml(part) {
  const fill = escapeHtmlText(part.fill || "var(--diagram-skin, #f4e4d0)");
  const stroke = escapeHtmlText(part.stroke || "var(--diagram-line, #3a332c)");
  const strokeWidth = part.strokeWidth || 2;
  if (part.shape === "circle") {
    return `<circle cx="${Number(part.cx) || 0}" cy="${Number(part.cy) || 0}" r="${
      Number(part.r) || 0
    }" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
  }
  if (part.shape === "path") {
    return `<path d="${escapeHtmlText(part.d || "")}" fill="${
      part.fill ? fill : "none"
    }" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
  }
  // 既定: ellipse
  return `<ellipse cx="${Number(part.cx) || 0}" cy="${Number(part.cy) || 0}" rx="${
    Number(part.rx) || 0
  }" ry="${Number(part.ry) || 0}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
}

function renderCrossSectionDiagramHtml(chart, debugSlug) {
  const {
    title,
    note,
    parts,
    leaders,
    guideLine,
    viewBoxWidth,
    viewBoxHeight,
    viewBoxMinX,
    viewBoxMinY,
  } = chart || {};
  if (!Array.isArray(parts) || parts.length === 0) return "";

  const width = Number(viewBoxWidth) || 300;
  const minX = Number(viewBoxMinX) || 0;
  const maxX = minX + width;
  // viewBoxMinX(左右余白、白髪ぼかし記事で確立)のy軸版。上段のleaderラベルが
  // canvas上端(y=0)を超えて見切れる場合に、上方向へキャンバスを拡張して余白を
  // 確保する(2026-08-14、日焼け止め白浮き対策塗り方のtoY=15付近のラベル上端
  // 見切れが実機で発覚。座標の微調整だけでは根本解決にならないため導入)。
  const authoredMinY = Number(viewBoxMinY) || 0;
  // 上端余白の自動拡張(2026-08-17、項目35〔実測レンダリング検査〕がバッチ3の
  // 6記事で「viewBoxMinYを著者が指定していても、labelMainの実際のascentが
  // わずかに上端を超える」ことを実測で検出したため導入。記事側でviewBoxMinYを
  // 都度調整するのではなく、コンポーネント側でleaders[].toYの最小値から
  // 必要な余白を自動計算し、著者指定のviewBoxMinYより上方向に必要であれば
  // 自動的に広げる(著者指定の方が既に十分広ければそちらを優先し、余計に
  // 広げない)。安全マージンは`GENERIC_LABEL_FONT_PX`相当(12.5px)を
  // 汎用SVGスキャナ・item35と同じ考え方でviewBox単位に換算し、実測で確認された
  // 数px程度の不足に対して十分な余裕(16px相当)を持たせた値とする。
  const LEADER_TOP_SAFETY_PX = 16;
  const topSafetyUnits = LEADER_TOP_SAFETY_PX * (width / 325);
  const leaderTops = (Array.isArray(leaders) ? leaders : [])
    .map((l) => Number(l.toY))
    .filter((y) => Number.isFinite(y));
  const autoMinY =
    leaderTops.length > 0 ? Math.min(...leaderTops) - 6 - topSafetyUnits : authoredMinY;
  const minY = Math.min(authoredMinY, autoMinY);
  // minYを上方向(より負の値)に自動拡張した分だけ、下端(minY+height)が
  // 元の位置からずれないようheightにも同量を加算する(自動拡張は「上に余白を
  // 足す」ものであり、下端の図形・ラベル配置に影響を与えてはならない)。
  const extraTopMargin = authoredMinY - minY;
  const height = Number(viewBoxHeight) + extraTopMargin || 320;

  const partsHtml = parts.map(renderPartShapeHtml).join("");

  const guideLineHtml = guideLine
    ? `<line x1="${minX + 20}" y1="${guideLine.y}" x2="${maxX - 20}" y2="${
        guideLine.y
      }" stroke="var(--diagram-line, #3a332c)" stroke-width="1.5" stroke-dasharray="2 3" /><text x="${
        minX + 24
      }" y="${
        Number(guideLine.y) - 8
      }" class="chart-diagram-caption">${escapeHtmlText(guideLine.label || "")}</text>`
    : "";

  // ラベルの伸長方向(text-anchor)は、alignが明示されていればそれに従い、
  // 未指定の場合はtoXがviewBox中央より右側にあるときは自動的に左伸長
  // (anchor=end)にする。中央より右側の点で右伸長のままだと、viewBox右端を
  // 超えてラベルがクリップされる(白髪ぼかし記事のメラノサイト/毛幹ラベルで
  // 2026-08-14に実機で発覚。SVGはUAスタイルシートの既定でoverflow:hiddenの
  // ためviewBox外の描画は見切れる)。
  // leadersのラベルは labelMain/labelSub の2フィールド規約(白髪ぼかし記事で確立)のみ
  // 対応する。廃止フィールド label(単一文字列)を指定しても無視され、
  // 引き出し線・ドットだけが描画されテキストは空文字になる(2026-08-14、
  // 肌質別/白浮きの2記事でサイレント発生・実機指摘で発覚)。この失敗を
  // ビルド時に必ず可視化する(常にconsole.warn。NEVORA_VERIFY_RENDER_MATCH
  // 設定時はscripts/verify-declared-vs-rendered.jsが拾える診断行も出す)。
  (Array.isArray(leaders) ? leaders : []).forEach((l, i) => {
    if (!l.labelMain && !l.labelSub) {
      const deprecatedLabel = l.label;
      console.warn(
        `[crossSection] ${debugSlug || "(unknown slug)"}: leaders[${i}]にlabelMain/labelSubが無いため、ラベルが空文字で描画されます。${
          deprecatedLabel
            ? `廃止フィールドlabel(値: ${JSON.stringify(
                deprecatedLabel
              )})が指定されていますが使用されません。labelMain/labelSubに分割してください。`
            : ""
        }`
      );
      if (process.env.NEVORA_VERIFY_RENDER_MATCH) {
        console.error(
          `[EMPTY_LEADER_LABEL] ${debugSlug || "(unknown slug)"}\tleaderIndex=${i}\tdeprecatedLabel=${JSON.stringify(
            deprecatedLabel || null
          )}`
        );
      }
    }
  });

  const leadersHtml = (Array.isArray(leaders) ? leaders : [])
    .map((l) => {
      const growLeft = l.align === "left" || (!l.align && Number(l.toX) > minX + width / 2);
      const align = growLeft ? "end" : "start";
      const labelX = growLeft ? l.toX - 6 : l.toX + 6;
      // labelMain/labelSubの縦間隔(2026-08-17、項目35がバッチ4「エイジングケアが
      // 気になり始めたら」記事のcrossSectionで、labelMainとlabelSub(21字の長い
      // labelSub)がwidth=412のみで衝突することを実測で検出。旧-6/+10(合計16単位)
      // は他の恒久修正(bar chart/processContrastキャプション)と同様に境界幅で
      // 詰まっていたため、-7/+13(合計20単位)に拡大。
      // leaders[].allowOverlap: true のとき、そのラベルを item35 の
      // text-shape-overlap 検査の対象から外す(2026-08-25 新設)。
      // 使ってよいのは「図形とラベルが重なる配置そのものが意図的な設計」の場合に限る。
      // 具体例: 線が意図的にラベル領域を通る図、パネルの外へラベルを出す配置。
      // 偶発的に重なっているだけのものは座標調整で解消すること。迷う場合は付けない。
      // 未指定時の出力は従来と完全に同一(属性を足さない)。
      const allowAttr = l.allowOverlap ? " data-allow-overlap" : "";
      return `<line x1="${l.fromX}" y1="${l.fromY}" x2="${l.toX}" y2="${l.toY}" class="chart-diagram-leader" /><circle cx="${l.toX}" cy="${l.toY}" r="2.4" class="chart-diagram-leader-dot" /><text x="${labelX}" y="${
        Number(l.toY) - 7
      }" text-anchor="${align}" class="chart-diagram-label-strong"${allowAttr}>${escapeHtmlText(
        l.labelMain || ""
      )}</text><text x="${labelX}" y="${
        Number(l.toY) + 13
      }" text-anchor="${align}" class="chart-diagram-label"${allowAttr}>${escapeHtmlText(l.labelSub || "")}</text>`;
    })
    .join("");

  const noteHtml = note
    ? `<p class="chart-diagram-note">${escapeHtmlText(note)}</p>`
    : "";

  return `<figure class="article-chart article-diagram-chart"><figcaption class="chart-title">${escapeHtmlText(
    title || ""
  )}</figcaption><svg viewBox="${minX} ${minY} ${width} ${height}" class="chart-diagram-svg" role="img" aria-label="${escapeHtmlText(
    title || ""
  )}">${guideLineHtml}${partsHtml}${leadersHtml}</svg>${noteHtml}</figure>`;
}

// 深さ/到達範囲比較型(chart type: "depthComparison")。複数の方式・成分が
// 対象のどの深さ・範囲に働くかを1枚の断面図で対比する図解(2026-08-13新設)。
// layers(0〜100の相対深さで指定する層)と markers(同じく相対深さで指定する
// 到達点)をデータ駆動で描画する。座標は固定canvas(340x260)、layers/markersの
// depthは0(浅い・表面側)〜100(深い)の相対値。noteは実測値でないことを示す
// 打消し表示のため必須運用とする(verify-article.jsで欠落を検出)。
function renderDepthComparisonHtml(chart) {
  const { title, note, layers, markers, source, sourceUrl } = chart || {};
  if (!Array.isArray(layers) || layers.length === 0) return "";

  const baseWidth = 340;
  // markerラベル(labelMain相当、`chart-diagram-label-strong`)の右マージンを
  // 自動確保する(2026-08-17、項目35〔実測レンダリング検査〕がUVAとUVBの違い・
  // 睡眠美容習慣・朝の白湯習慣の3記事で、marker labelが固定width=340を大幅に
  // 超えて右端からはみ出す〔実測で最大39px相当〕ことを検出したため導入。
  // labelの開始位置(bandX+bandWidth+45+7=222)から、最長ラベルの推定幅
  // (汎用SVGスキャナ・renderBarChartHtmlと同じ考え方の文字幅推定式)を
  // 加えた分だけ、固定340から動的に拡張する。基準340で1回推定した後、
  // 拡張後の幅で再計算する2パス方式(文字幅推定が幅に比例するため)。
  const markerLabelStartX = 20 + 150 + 45 + 7; // bandX + bandWidth + leader長 + 余白 = 222
  const estimateWidth = (w) => {
    const charUnit = 12.5 * (w / 325);
    const maxLabelChars = Math.max(
      ...(Array.isArray(markers) ? markers : []).map((m) => Array.from(String(m.label || "")).length),
      0
    );
    return Math.max(baseWidth, Math.ceil(markerLabelStartX + maxLabelChars * charUnit + 10));
  };
  const width = estimateWidth(estimateWidth(baseWidth));
  const bandTop = 20;
  const bandHeight = 210;
  const bandX = 20;
  const bandWidth = 150;
  const depthToY = (d) => bandTop + (Math.max(0, Math.min(100, Number(d) || 0)) / 100) * bandHeight;

  const layersHtml = layers
    .map((l) => {
      const y1 = depthToY(l.from);
      const y2 = depthToY(l.to);
      return `<rect x="${bandX}" y="${y1}" width="${bandWidth}" height="${
        y2 - y1
      }" fill="${escapeHtmlText(l.fill || "#d9b58c")}" stroke="var(--diagram-line, #3a332c)" /><text x="${
        bandX + 6
      }" y="${y1 + 16}" class="chart-diagram-label">${escapeHtmlText(l.label || "")}</text>`;
    })
    .join("");

  const markersHtml = (Array.isArray(markers) ? markers : [])
    .map((m) => {
      const y = depthToY(m.depth);
      const x1 = bandX + bandWidth;
      const x2 = x1 + 45;
      return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="chart-diagram-leader" /><circle cx="${x2}" cy="${y}" r="2.4" class="chart-diagram-leader-dot" /><text x="${
        x2 + 7
      }" y="${y + 4}" class="chart-diagram-label-strong">${escapeHtmlText(m.label || "")}</text>`;
    })
    .join("");

  const noteHtml = note
    ? `<p class="chart-diagram-note">${escapeHtmlText(note)}</p>`
    : "";
  const sourceHtml = source
    ? `<figcaption class="chart-source">出典: ${
        sourceUrl
          ? `<a href="${escapeHtmlText(
              sourceUrl
            )}" target="_blank" rel="nofollow noopener noreferrer">${escapeHtmlText(source)}</a>`
          : escapeHtmlText(source)
      }</figcaption>`
    : "";

  return `<figure class="article-chart article-diagram-chart"><figcaption class="chart-title">${escapeHtmlText(
    title || ""
  )}</figcaption><svg viewBox="0 0 ${width} 260" class="chart-diagram-svg" role="img" aria-label="${escapeHtmlText(
    title || ""
  )}">${layersHtml}${markersHtml}</svg>${noteHtml}${sourceHtml}</figure>`;
}

// プロセス/対比型(chart type: "processContrast")。同じ具体的なイラスト(モチーフ)を
// 2〜3コマ並べ、コマ間で「動かない要素」の位置・色を完全に固定したまま、変化する
// 要素の色だけを変えることで状態の違いを見せる図解(2026-08-13新設)。
//
// 抽象的な縞・棒モチーフでコマ間の差を表現したRev.1/Rev.2はユーザー実機確認で
// 不合格(「ラベルを読まないと差が分からない」「要素が消えたように見える」)と
// 判定され、Rev.3で具体的なイラスト(頭頂部の分け目等)に土台を変更したところ
// 合格した。この経緯から、以下を設計原則として型に刻む。
// - モチーフは実物の簡略イラスト(頭・髪・肌・爪等)を土台にすること。抽象図形の
//   変化だけで差を表現しない
// - コマ間で「同じ場所にあり続ける要素」(例: 白髪)は、位置・色とも完全に固定する。
//   要素が消えた/移動したように見える表現は禁止(「なくなった」という誤ったメッセージに
//   なるため)
// - 2コマ(Before/After)を既定とする。3コマ目(中間コマ)を使うのは、その中間コマが
//   「過程・動作」として明確に意味を持つ場合のみとし、単に色数を増やしただけの
//   コマを挟まない(2026-08-13、白髪ぼかし記事の「ハイライト追加中」コマが
//   「色が増えただけで動作が読み取れない」と判定されたため確定したルール)
//
// motif別に土台イラストを描画する。現時点では"hairParting"(頭頂部を上から見た
// 分け目)・"hairLength"(頭部側面+前髪の長さの推移、2026-08-13追加)・
// "hairCuticleContrast"(毛髪断面のキューティクル開閉対比、2026-08-14追加、
// quadrant代用の是正で新設)の3種のみ実装。他のモチーフ(肌断面・爪等)は
// 必要になった時点で追加する(追加手順は`.claude/agents/writer.md`「新モチーフ
// 追加手順」節、モチーフ一覧は`docs/CONTRIBUTING.md`参照)。
const HAIR_PARTING_ROW_Y = [45, 66, 87, 108, 129];
const PROCESS_CONTRAST_MOTIFS = new Set([
  "hairParting",
  "hairLength",
  "hairCuticleContrast",
  "nightRoutineFaceContrast",
  "habitTrackerContrast",
  "spotTypeShapeContrast",
]);

function renderProcessContrastMotifHtml(motif, chart, panel) {
  if (motif === "hairParting") {
    const strandsHtml = (Array.isArray(panel.strands) ? panel.strands : [])
      .map((s) => {
        const rowY = HAIR_PARTING_ROW_Y[Number(s.row)];
        if (rowY === undefined) return "";
        const endX = s.side === "L" ? 17 : 129;
        const endY = rowY + 10;
        return `<line x1="73" y1="${rowY}" x2="${endX}" y2="${endY}" stroke="${escapeHtmlText(
          s.colorHex || "#3a2a1a"
        )}" stroke-width="8" stroke-linecap="round" />`;
      })
      .join("");
    return `<g transform="translate(0,4)"><circle cx="73" cy="90" r="62" fill="var(--diagram-skin, #f4e4d0)" fill-opacity="0.35" stroke="var(--diagram-line, #4a3f33)" stroke-width="1.5" /><line x1="73" y1="30" x2="73" y2="150" stroke="var(--diagram-line, #4a3f33)" stroke-width="1.5" />${strandsHtml}</g>`;
  }
  // hairLength: 頭部側面シルエット(固定)+複数の目安線(固定、全コマ共通)+
  // 前髪の長さ(コマごとに変化する唯一の要素)。時間経過による「変化」を
  // 1枚に重ねず、コマを分けて表現することで「同時に生えている毛」に見える
  // 誤読を避ける設計(2026-08-13、前髪記事のcrossSection案が誤読リスクを
  // 指摘され、processContrastへ切り替えた経緯による)。
  if (motif === "hairLength") {
    const guides = Array.isArray(chart.guides) ? chart.guides : [];
    const activeIndex = Number(panel.activeGuideIndex);
    const guidesHtml = guides
      .map((g, i) => {
        const isActive = i === activeIndex;
        const color = isActive ? "var(--chart-accent, #0b5c8a)" : "var(--diagram-line, #4a3f33)";
        return `<line x1="20" y1="${g.y}" x2="126" y2="${
          g.y
        }" stroke="${color}" stroke-width="${
          isActive ? 1.8 : 1
        }" stroke-dasharray="2 3" /><text x="130" y="${
          Number(g.y) + 4
        }" class="chart-diagram-caption" fill="${
          isActive ? color : "var(--color-text-muted, #6b7280)"
        }" font-weight="${isActive ? "700" : "400"}">${escapeHtmlText(g.label || "")}</text>`;
      })
      .join("");
    const targetY = guides[activeIndex] ? Number(guides[activeIndex].y) : 40;
    return `<g><circle cx="55" cy="35" r="26" fill="var(--diagram-skin, #f4e4d0)" stroke="var(--diagram-line, #4a3f33)" stroke-width="1.5" /><rect x="45" y="58" width="20" height="30" fill="var(--diagram-skin, #f4e4d0)" stroke="var(--diagram-line, #4a3f33)" stroke-width="1.5" />${guidesHtml}<path d="M40,16 Q30,${
      (16 + targetY) / 2
    } 38,${targetY}" fill="none" stroke="var(--chart-accent, #0b5c8a)" stroke-width="6" stroke-linecap="round" /></g>`;
  }
  // hairCuticleContrast: 毛髪の縦断面をシャフト(中心の帯)+左右のキューティクル
  // (鱗状のうろこ)で表現する。panel.state==="damaged"のときキューティクルの
  // うろこを外側へ大きくめくらせ(lift値を増やす)、"healthy"のときはうろこを
  // シャフトに沿って閉じたまま描く。閉じている/めくれているという輪郭線の違いが
  // ラベルなしでも伝わることを狙った設計(2026-08-14、quadrant代用の是正で新設)。
  // panel.causeLabelsが指定されている場合(damagedパネル側)、原因ラベルを
  // シャフト外側にテキストとして添える(leadersは使わずモチーフ内で完結させる)。
  if (motif === "hairCuticleContrast") {
    const isDamaged = panel.state === "damaged";
    const shaftX = 53;
    const shaftWidth = 40;
    const top = 15;
    const scaleH = 18;
    const scaleCount = 6;
    const lift = isDamaged ? 12 : 2;
    let scalesHtml = "";
    for (let i = 0; i < scaleCount; i += 1) {
      const y = top + i * scaleH;
      scalesHtml += `<path d="M${shaftX},${y} L${shaftX - lift},${y + scaleH - 4} L${shaftX},${
        y + scaleH
      } Z" fill="var(--diagram-skin, #f4e4d0)" stroke="var(--diagram-line, #4a3f33)" stroke-width="1" />`;
      scalesHtml += `<path d="M${shaftX + shaftWidth},${y} L${shaftX + shaftWidth + lift},${
        y + scaleH - 4
      } L${shaftX + shaftWidth},${
        y + scaleH
      } Z" fill="var(--diagram-skin, #f4e4d0)" stroke="var(--diagram-line, #4a3f33)" stroke-width="1" />`;
    }
    const shaftHeight = scaleCount * scaleH + 6;
    const shaftHtml = `<rect x="${shaftX}" y="${top}" width="${shaftWidth}" height="${shaftHeight}" rx="8" fill="var(--chart-accent, #0b5c8a)" fill-opacity="0.12" stroke="var(--diagram-line, #4a3f33)" stroke-width="1.5" />`;
    const causeLabels = isDamaged && Array.isArray(panel.causeLabels) ? panel.causeLabels : [];
    const causesHtml = causeLabels
      .map((label, i) => {
        const y = top + 10 + i * 28;
        const onLeft = i % 2 === 0;
        const x = onLeft ? 8 : 138;
        return `<text x="${x}" y="${y}" text-anchor="${
          onLeft ? "start" : "end"
        }" class="chart-diagram-label-strong">${escapeHtmlText(label)}</text>`;
      })
      .join("");
    return `<g>${shaftHtml}${scalesHtml}${causesHtml}</g>`;
  }
  // nightRoutineFaceContrast: 顔(目元中心)のシルエット。panel.state==="awake"の
  // ときは見開いた目+つり上がり気味の眉(スマホ・強い照明を浴びた直後の覚醒状態)、
  // "calm"のときは半分閉じた目+ゆるんだ眉(入浴・暖色照明後の落ち着いた状態)を描く。
  // 目・眉の開閉と角度だけで「覚醒⇄リラックス」が伝わることを狙った設計
  // (2026-08-16、quadrant〔寝つきが悪い夜のナイトルーティン〕代用の是正で新設)。
  if (motif === "nightRoutineFaceContrast") {
    const isAwake = panel.state === "awake";
    const faceHtml = `<circle cx="73" cy="95" r="52" fill="var(--diagram-skin, #f4e4d0)" stroke="var(--diagram-line, #4a3f33)" stroke-width="1.5" />`;
    let eyesHtml;
    let browsHtml;
    if (isAwake) {
      eyesHtml =
        `<circle cx="52" cy="90" r="9" fill="#fff" stroke="var(--diagram-line, #4a3f33)" stroke-width="1.5" /><circle cx="52" cy="90" r="4" fill="var(--diagram-line, #4a3f33)" />` +
        `<circle cx="94" cy="90" r="9" fill="#fff" stroke="var(--diagram-line, #4a3f33)" stroke-width="1.5" /><circle cx="94" cy="90" r="4" fill="var(--diagram-line, #4a3f33)" />`;
      browsHtml =
        `<path d="M42,72 L62,66" stroke="var(--diagram-line, #4a3f33)" stroke-width="3" stroke-linecap="round" />` +
        `<path d="M84,66 L104,72" stroke="var(--diagram-line, #4a3f33)" stroke-width="3" stroke-linecap="round" />`;
    } else {
      eyesHtml =
        `<path d="M44,90 Q52,96 60,90" stroke="var(--diagram-line, #4a3f33)" stroke-width="2.5" fill="none" stroke-linecap="round" />` +
        `<path d="M86,90 Q94,96 102,90" stroke="var(--diagram-line, #4a3f33)" stroke-width="2.5" fill="none" stroke-linecap="round" />`;
      browsHtml =
        `<path d="M43,76 Q52,73 61,77" stroke="var(--diagram-line, #4a3f33)" stroke-width="2.5" fill="none" stroke-linecap="round" />` +
        `<path d="M85,77 Q94,73 103,76" stroke="var(--diagram-line, #4a3f33)" stroke-width="2.5" fill="none" stroke-linecap="round" />`;
    }
    const mouthHtml = isAwake
      ? `<path d="M60,120 L86,120" stroke="var(--diagram-line, #4a3f33)" stroke-width="2" stroke-linecap="round" />`
      : `<path d="M60,118 Q73,124 86,118" stroke="var(--diagram-line, #4a3f33)" stroke-width="2" fill="none" stroke-linecap="round" />`;
    return `<g>${faceHtml}${browsHtml}${eyesHtml}${mouthHtml}</g>`;
  }
  // habitTrackerContrast: カレンダー/習慣トラッカーのマス目。panel.state==="sparse"
  // のときはマスの一部だけが埋まった状態(挫折パターン)、"dense"のときは大部分の
  // マスが埋まった状態(7割ルールでの継続)を描く。マスの密度差だけで
  // 「続いていない⇄続いている」が伝わることを狙った設計(2026-08-16、
  // quadrant〔続く美容習慣の作り方〕代用の是正で新設)。
  if (motif === "habitTrackerContrast") {
    const isDense = panel.state === "dense";
    // 7列×3行=21マス(約3週間分)。denseは概ね7割(15/21)、sparseは4マス(約2割)を
    // 塗りつぶす固定パターン(データ駆動にはせず、対比の分かりやすさを優先)。
    // 2026-08-16、監査指示(B-3)によりsparse側を6→4マスへ削減し、塗り色も
    // グレー系(未達成・低調な印象)に変更した。dense側はアクセント色(達成・
    // 好調な印象)のまま据え置き、「要素数」と「色」の両方で差を表現することで、
    // writer.mdのBefore/After対比セルフチェック(要素数・色の両方に差があるか)
    // を満たす設計にした。
    const sparseFilled = new Set([3, 9, 14, 19]);
    const denseFilled = new Set([0, 1, 2, 3, 5, 6, 7, 8, 9, 11, 12, 13, 15, 16, 18]);
    const filled = isDense ? denseFilled : sparseFilled;
    const filledColor = isDense ? "var(--chart-accent, #0b5c8a)" : "var(--color-text-faint, #9ca3af)";
    const cellSize = 16;
    const gap = 4;
    const cols = 7;
    const startX = 13;
    const startY = 22;
    let cellsHtml = "";
    for (let i = 0; i < 21; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cellSize + gap);
      const y = startY + row * (cellSize + gap);
      const isFilled = filled.has(i);
      cellsHtml += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="3" fill="${
        isFilled ? filledColor : "var(--color-surface, #fff)"
      }" fill-opacity="${isFilled ? "0.85" : "1"}" stroke="var(--diagram-line, #4a3f33)" stroke-width="1" />`;
      if (isFilled) {
        cellsHtml += `<path d="M${x + 3},${y + 8} L${x + 6.5},${y + 12} L${x + 13},${
          y + 4
        }" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
      }
    }
    return `<g><rect x="8" y="12" width="130" height="72" rx="6" fill="none" stroke="var(--diagram-line, #4a3f33)" stroke-width="1.5" />${cellsHtml}</g>`;
  }
  // spotTypeShapeContrast: シミの「見た目そのもの」を4状態(輪郭くっきり/
  // 輪郭ぼんやり/小さな点の集合/不定形)で描き分ける。顔のどこにできるかという
  // 位置情報に依存せず形状だけで判別できるようにするため、位置が人によって
  // 一定しない炎症後色素沈着タイプも自然に扱える設計(2026-08-17、J1決裁・
  // 「シミの種類と見分け方」記事の案B採用により新設)。panel.state:
  // "clearEdge"(老人性色素斑)/"blurredEdge"(肝斑)/"scattered"(そばかす)/
  // "irregular"(炎症後色素沈着)。色は象限記号のような優劣を含意しないよう、
  // 記事側のcompareCards配色(#8b5e3c/#6b7fd7/#c9a227/#a85751)に揃える。
  if (motif === "spotTypeShapeContrast") {
    const state = panel.state;
    const cx = 73;
    const cy = 90;
    if (state === "clearEdge") {
      return `<circle cx="${cx}" cy="${cy}" r="34" fill="#8b5e3c" fill-opacity="0.82" stroke="#5c3d24" stroke-width="2" />`;
    }
    if (state === "blurredEdge") {
      const rings = [
        { r: 40, op: 0.12 },
        { r: 32, op: 0.22 },
        { r: 24, op: 0.34 },
        { r: 16, op: 0.5 },
      ];
      const ringsHtml = rings
        .map((rg) => `<circle cx="${cx}" cy="${cy}" r="${rg.r}" fill="#6b7fd7" fill-opacity="${rg.op}" />`)
        .join("");
      return `<g>${ringsHtml}</g>`;
    }
    if (state === "scattered") {
      const dots = [
        [55, 72], [66, 65], [78, 70], [90, 66], [60, 88], [86, 90],
        [70, 100], [50, 100], [96, 78], [62, 76],
      ];
      const dotsHtml = dots
        .map(([dx, dy]) => `<circle cx="${dx}" cy="${dy}" r="3.2" fill="#c9a227" fill-opacity="0.85" />`)
        .join("");
      return `<g>${dotsHtml}</g>`;
    }
    if (state === "irregular") {
      return `<path d="M50,80 Q45,65 62,62 Q78,58 86,68 Q98,74 92,88 Q98,100 82,106 Q64,112 54,100 Q42,94 50,80 Z" fill="#a85751" fill-opacity="0.8" stroke="#7a3d38" stroke-width="1.5" />`;
    }
    return null;
  }
  return null;
}

function renderProcessContrastHtml(chart) {
  const { title, note, motif, panels } = chart || {};
  if (!Array.isArray(panels) || panels.length === 0) return "";
  if (!PROCESS_CONTRAST_MOTIFS.has(motif)) return "";

  const panelWidth = 146;
  const panelHeight = 190;
  const gap = 16;
  const totalWidth = panels.length * panelWidth + (panels.length - 1) * gap + 20;
  // パネルキャプションの自動2行折り返し(2026-08-16、項目35〔実測レンダリング検査〕の
  // 実機検出で発覚した「キャプションがパネル幅を超えて隣のパネルまではみ出し、
  // 兄弟パネルのキャプションと衝突する」不具合の恒久対策。特定記事専用ではなく
  // processContrast全体(パネル+キャプション構造)に適用する。文字幅の推定単位は
  // scripts/verify-declared-vs-rendered.jsの汎用SVGスキャナと同じ考え方
  // (12.5px相当のフォントをtotalWidthの表示比率でviewBox単位に換算)で計算し、
  // パネル内側の余白(左右合計24単位)を差し引いた幅に収まる文字数を1行の上限とする。
  const CAPTION_CHAR_UNIT = 12.5 * (totalWidth / 325);
  const captionMaxLineChars = Math.max(4, Math.floor((panelWidth - 24) / CAPTION_CHAR_UNIT));

  const panelsHtml = panels
    .map((p, i) => {
      const x = 10 + i * (panelWidth + gap);
      const motifHtml = renderProcessContrastMotifHtml(motif, chart, p);
      const captionLines = splitLabelForWrap(p.caption || "", captionMaxLineChars);
      const captionHtml =
        captionLines.length > 1
          ? `<text x="${panelWidth / 2}" y="166" text-anchor="middle" class="chart-diagram-label-strong">${escapeHtmlText(
              captionLines[0]
            )}</text><text x="${panelWidth / 2}" y="185" text-anchor="middle" class="chart-diagram-label-strong">${escapeHtmlText(
              captionLines[1]
            )}</text>`
          : `<text x="${panelWidth / 2}" y="180" text-anchor="middle" class="chart-diagram-label-strong">${escapeHtmlText(
              captionLines[0]
            )}</text>`;
      return `<g transform="translate(${x},10)"><rect x="0" y="0" width="${panelWidth}" height="${panelHeight}" rx="10" fill="var(--color-surface, #fff)" stroke="var(--color-border, #ececec)" />${motifHtml}${captionHtml}</g>`;
    })
    .join("");

  const noteHtml = note
    ? `<p class="chart-diagram-note">${escapeHtmlText(note)}</p>`
    : "";

  return `<figure class="article-chart article-diagram-chart"><figcaption class="chart-title">${escapeHtmlText(
    title || ""
  )}</figcaption><svg viewBox="0 0 ${totalWidth} 210" class="chart-diagram-svg" role="img" aria-label="${escapeHtmlText(
    title || ""
  )}">${panelsHtml}</svg>${noteHtml}</figure>`;
}

// チェックリスト(chart type: "checklist")。items: string[] または
// {question, resultLabel, resultColor, readMoreHeading?, readMoreLabel?}[]
// (診断用、2026-08-09追加)。後者は「該当タイプ：〇〇」のバッジ付き項目として
// 描画する。複数の項目に同時に該当してもよいセルフチェック(旧flowchart型の
// renderSelfCheckListHtmlと同じ用途)を、新しいchart.typeを増やさずに表現する
// ための拡張。
// - note: 文字列を渡すと項目一覧の下に注記を出せる。診断item(question付き)が
//   1つ以上ある場合、note省略時は「複数の項目が同時に当てはまる場合、それら
//   すべてが影響している可能性があります。」を既定文言として自動付与する
//   (記事ごとの書き忘れによるブレを防ぐため。2026-08-09、型改修で追加)。
// - readMoreHeading: 本文のH2/H3見出しテキストと完全一致させると、該当タイプの
//   項目に「詳しく見る」リンクを追加できる(afterHeadingと同じ突合方式。toc引数
//   で見出しid一覧を受け取り解決する)。一致する見出しが無い場合はforceOutcome
//   と同様にビルド時エラーで検出する。readMoreLabelでリンク文言を上書きできる
//   (省略時は resultLabel から自動生成)。2026-08-09、型改修で機構のみ追加。
//   どの記事に値を入れるかは記事側の見出し構成が整ってから判断する。
function renderGenericChecklistHtml(chart, toc) {
  const { title = "今日からできるチェックリスト", items, note } = chart || {};
  const itemList = Array.isArray(items) ? items : [];
  const hasDiagnosticItem = itemList.some(
    (item) => item && typeof item === "object" && item.question
  );

  const headingIdByText = new Map(
    (Array.isArray(toc) ? toc : []).map((h) => [h.text, h.id])
  );

  const list = itemList
    .map((item) => {
      if (item && typeof item === "object" && item.question) {
        const badge = item.resultLabel
          ? `<span class="chart-checklist-diagnostic-badge" style="background:${escapeHtmlText(
              item.resultColor || "var(--chart-accent)"
            )}">${escapeHtmlText(item.resultLabel)}</span>`
          : "";

        let readMoreHtml = "";
        if (item.readMoreHeading) {
          const headingId = headingIdByText.get(item.readMoreHeading);
          if (!headingId) {
            throw new Error(
              `renderGenericChecklistHtml: readMoreHeadingの参照先が本文に存在しません(item.question="${item.question}", readMoreHeading="${item.readMoreHeading}")`
            );
          }
          const label =
            item.readMoreLabel ||
            (item.resultLabel ? `${item.resultLabel}について詳しく見る` : "詳しく見る");
          readMoreHtml = ` <a href="#${escapeHtmlText(
            headingId
          )}" class="chart-checklist-diagnostic-readmore">${escapeHtmlText(label)} →</a>`;
        }

        return `<li class="chart-checklist-diagnostic-item"><p class="chart-checklist-diagnostic-question">${escapeHtmlText(
          item.question
        )}</p><p class="chart-checklist-diagnostic-result">該当タイプ：${badge}${readMoreHtml}</p></li>`;
      }
      return `<li>${escapeHtmlText(item)}</li>`;
    })
    .join("");

  const defaultNote = hasDiagnosticItem
    ? "複数の項目が同時に当てはまる場合、それらすべてが影響している可能性があります。"
    : "";
  const noteText = note || defaultNote;
  const noteHtml = noteText
    ? `<p class="chart-checklist-note">${escapeHtmlText(noteText)}</p>`
    : "";

  return `<div class="chart-checklist">
    <p class="chart-checklist-title">✅ ${escapeHtmlText(title)}</p>
    <ul class="${hasDiagnosticItem ? "chart-checklist-list-diagnostic" : ""}">${list}</ul>${noteHtml}
  </div>`;
}

// セルフ診断ウィザード(chart type: "diagnosis")。2つのresolution方式を持つ。
// - "score"(既定・省略可): questions[].choices[].scoreの合計をoutcomes[].minScore/
//   maxScoreと比較して1つに定める(2026-08-09第1弾で新設)。
// - "pattern": 質問ごとの回答の組み合わせで1つに定める。outcomes[].answersは
//   {質問id: 選んだ回答のlabel}のオブジェクト(配列の並び順に依存させないため
//   questions[].idをキーにする、2026-08-09第2弾で新設)。完全一致するoutcomeが
//   無い場合は「質問ごとの回答一致数が最も多いoutcome」を採用する(最多一致方式)。
//   一致数が同数の場合はoutcomes配列の定義順で先に出てくる方を採用する。
//   choices[].forceOutcomeにoutcomeのlabelを指定すると、その選択肢が選ばれた
//   時点で一致数計算を待たずそのoutcomeに確定する(医療系トリアージ記事等、
//   「懸念サインが1つでもあれば安全側の判定に倒す」必要がある場合に使う)。
//   複数のforceOutcomeが同時に発火した場合もoutcomes配列の定義順で先勝ち。
// 質問・選択肢・全outcome一覧をすべて静的HTMLとして出力するため、JS無効時でも
// 質問文・結果文はそのまま読める。JS有効時のみ components/diagnosisWidget.js が
// この静的HTMLを1問ずつ進めるウィザードUIにプログレッシブエンハンスメントする
// (2026-08-09、記事専用ReactコンポーネントDrySkinSelfCheck.jsを置き換えて新設)。
function renderDiagnosisHtml(chart) {
  const { title, questions, outcomes, note, resolution } = chart || {};
  if (!Array.isArray(questions) || questions.length === 0) return "";
  if (!Array.isArray(outcomes) || outcomes.length === 0) return "";

  // choices[].forceOutcomeの参照先が実在するoutcomeのlabelと一致しているかを
  // ビルド時に検証する(タイプミス等でforceOutcomeがどのoutcomeにも一致しない
  // まま出荷されると、診断結果が常に最多一致側に流れてしまい安全側に倒す設計が
  // 機能しなくなるため、ビルドを止めて検出する。2026-08-09追加)。
  const outcomeLabels = new Set(outcomes.map((o) => o.label));
  questions.forEach((q, qi) => {
    (Array.isArray(q.choices) ? q.choices : []).forEach((c, ci) => {
      if (c.forceOutcome && !outcomeLabels.has(c.forceOutcome)) {
        throw new Error(
          `renderDiagnosisHtml: forceOutcomeの参照先が存在しません(chart.title="${title}", questions[${qi}].id="${q.id}", choices[${ci}].label="${c.label}", forceOutcome="${c.forceOutcome}")`
        );
      }
    });
  });

  const questionsHtml = questions
    .map((q, qi) => {
      const choices = Array.isArray(q.choices) ? q.choices : [];
      const choicesHtml = choices
        .map(
          (c, ci) =>
            `<button type="button" class="chart-diagnosis-choice" data-choice-index="${ci}">${escapeHtmlText(
              c.label
            )}</button>`
        )
        .join("");
      return `<div class="chart-diagnosis-question" data-q-index="${qi}"><p class="chart-diagnosis-question-text">Q${
        qi + 1
      }. ${escapeHtmlText(q.text)}</p><div class="chart-diagnosis-choices">${choicesHtml}</div></div>`;
    })
    .join("");

  const outcomesHtml = outcomes
    .map((o) => {
      const badge = `<span class="chart-diagnosis-outcome-badge" style="background:${escapeHtmlText(
        o.color || "var(--chart-accent)"
      )}">${escapeHtmlText(o.label)}</span>`;
      const desc = o.desc
        ? `<span class="chart-diagnosis-outcome-desc">${escapeHtmlText(o.desc)}</span>`
        : "";
      return `<li class="chart-diagnosis-outcome-item">${badge}${desc}</li>`;
    })
    .join("");

  const noteHtml = note
    ? `<p class="chart-diagnosis-note">${escapeHtmlText(note)}</p>`
    : "";

  const dataPayload = escapeHtmlText(JSON.stringify({ resolution, questions, outcomes }));

  return `<div class="chart-diagnosis" data-diagnosis="${dataPayload}"><p class="chart-title">${escapeHtmlText(
    title || ""
  )}</p><div class="chart-diagnosis-questions">${questionsHtml}</div><div class="chart-diagnosis-outcomes"><p class="chart-diagnosis-outcomes-title">診断結果タイプ一覧</p><ul class="chart-diagnosis-outcomes-list">${outcomesHtml}</ul></div>${noteHtml}</div>`;
}

// 記事末の「まとめカード」(chart type: "summaryCard")。
// conclusion: string[] / nextStep: string / links: [{label, url}]。
// 見出し文言(結論はこの3つ/今日の次の一歩/あわせて読みたい記事)は固定とし、
// 上書き用キーは設けない(2026-08-08承認の設計方針)。
function renderGenericSummaryCardHtml(chart) {
  const { conclusion, nextStep, links } = chart || {};
  const conclusionItems = (Array.isArray(conclusion) ? conclusion : [])
    .map((c) => `<li>${escapeHtmlText(c)}</li>`)
    .join("");
  const linkItems = (Array.isArray(links) ? links : [])
    .map(
      (l) =>
        `<li><a class="chart-summary-card-link" href="${escapeHtmlText(l.url)}">${escapeHtmlText(
          l.label
        )}</a></li>`
    )
    .join("");

  return `<div class="chart-summary-card">
    <h3>結論はこの3つ</h3>
    <ul>${conclusionItems}</ul>
    ${nextStep ? `<h3>今日の次の一歩</h3><p>${escapeHtmlText(nextStep)}</p>` : ""}
    ${linkItems ? `<h3>あわせて読みたい記事</h3><ul>${linkItems}</ul>` : ""}
  </div>`;
}

// 見分け方・比較カード(横スクロール、chart type: "compareCards")。
// rows: [{label, color, cause, appearance, itch, spot}]。キー構成は現行の
// asemoCompareCardsと同じ固定4項目のまま(fields配列への一般化は今回行わない)。
// colorのみrows側で直接指定できるようにし、記事ごとのラベル→色決め打ちマップを廃止する。
function renderGenericCompareCardsHtml(chart) {
  const { title, rows } = chart || {};
  if (!Array.isArray(rows) || rows.length === 0) return "";

  const cards = rows
    .map((r) => {
      const color = escapeHtmlText(r.color || "var(--chart-accent)");
      return `<div class="chart-compare-card" style="border-top-color:${color}">
        <p class="chart-compare-card-title" style="color:${color}">${escapeHtmlText(r.label)}</p>
        <dl class="chart-compare-card-list">
          <dt>できる原因</dt><dd>${escapeHtmlText(r.cause)}</dd>
          <dt>見た目</dt><dd>${escapeHtmlText(r.appearance)}</dd>
          <dt>かゆみ・痛み</dt><dd>${escapeHtmlText(r.itch)}</dd>
          <dt>できやすい部位</dt><dd>${escapeHtmlText(r.spot)}</dd>
        </dl>
      </div>`;
    })
    .join("");

  return `<figure class="chart-compare-cards-figure">
    <figcaption class="chart-title">${escapeHtmlText(title || "比較")}</figcaption>
    <p class="chart-scroll-hint">→ 横にスクロールできます</p>
    <div class="chart-compare-cards-wrap">${cards}</div>
  </figure>`;
}

// 横スクロール比較(汎用版、chart type: "compareScroll"、2026-08-13追加)。
// compareCards(固定4項目)を一般化し、記事ごとに異なる比較項目(fields)を
// 定義できるようにしたもの。CSSは既存の.chart-compare-cards-*系を流用する。
// fields: [{key, label}]、rows: [{label, color, [field.keyごとの値]}]
function renderCompareScrollHtml(chart) {
  const { title, fields, rows } = chart || {};
  if (!Array.isArray(fields) || fields.length === 0) return "";
  if (!Array.isArray(rows) || rows.length === 0) return "";

  const cards = rows
    .map((r) => {
      const color = escapeHtmlText(r.color || "var(--chart-accent)");
      const items = fields
        .map((f) => `<dt>${escapeHtmlText(f.label)}</dt><dd>${escapeHtmlText(r[f.key])}</dd>`)
        .join("");
      return `<div class="chart-compare-card" style="border-top-color:${color}">
        <p class="chart-compare-card-title" style="color:${color}">${escapeHtmlText(r.label)}</p>
        <dl class="chart-compare-card-list">${items}</dl>
      </div>`;
    })
    .join("");

  return `<figure class="chart-compare-cards-figure">
    <figcaption class="chart-title">${escapeHtmlText(title || "比較")}</figcaption>
    <p class="chart-scroll-hint">→ 横にスクロールできます</p>
    <div class="chart-compare-cards-wrap">${cards}</div>
  </figure>`;
}

function renderChartHtml(chart, toc, debugSlug) {
  if (chart.type === "stat") return renderStatTileHtml(chart);
  if (chart.type === "pie" || chart.type === "donut")
    return renderDonutChartHtml(chart);
  if (chart.type === "prosCons") return renderProsConsHtml(chart);
  if (chart.type === "quadrant") return renderQuadrantChartHtml(chart);
  if (chart.type === "crossSection") return renderCrossSectionDiagramHtml(chart, debugSlug);
  if (chart.type === "depthComparison") return renderDepthComparisonHtml(chart);
  if (chart.type === "processContrast") return renderProcessContrastHtml(chart);
  if (chart.type === "faceMap") return renderFaceMapHtml(chart);
  if (chart.type === "flowchart") return renderFlowchartHtml(chart);
  if (chart.type === "lineChart") return renderLineChartHtml(chart);
  if (chart.type === "steps") return renderGenericStepsHtml(chart);
  if (chart.type === "checklist") return renderGenericChecklistHtml(chart, toc);
  if (chart.type === "summaryCard") return renderGenericSummaryCardHtml(chart);
  if (chart.type === "compareCards") return renderGenericCompareCardsHtml(chart);
  if (chart.type === "compareScroll") return renderCompareScrollHtml(chart);
  // セルフ診断ウィザード。詳細は renderDiagnosisHtml のコメント参照。
  if (chart.type === "diagnosis") return renderDiagnosisHtml(chart);
  return renderBarChartHtml(chart);
}

// frontmatterのaccordions([{afterHeading, summary, content}])から、開閉式の
// 折りたたみブロックを組み立てる。記事本文に生HTML(<details>等)を直書きさせず、
// サイト側でHTML生成することで、remark-htmlのサニタイズ設定(生HTML不許可)を
// 緩めずに済む(セキュリティ上、記事Markdown中の生HTMLは許可しない方針を維持するため)。
// contentはMarkdown文字列として別途remarkで変換し、太字・リンク等の記法を使える。
async function renderAccordionHtml(accordion) {
  const { summary, content } = accordion;
  const processedContent = await remark()
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkHtml)
    .process(content || "");
  const innerHtml = applyInlineMarkup(processedContent.toString());

  return `<details class="article-accordion"><summary class="article-accordion-summary">${escapeHtmlText(
    summary
  )}</summary><div class="article-accordion-body">${innerHtml}</div></details>`;
}

// frontmatterのaccordionsを、afterHeadingのテキストと完全一致する見出しブロックの
// 直後に挿入する(embedChartsと同じマッチング方式)。一致する見出しが無い場合は
// 黙って挿入されない(呼び出し側で見出しテキストの表記ゆれに注意する)。

// frontmatterのaccordionsを、afterHeadingのテキストと完全一致する見出しブロックの
// 直後に挿入する(embedChartsと同じマッチング方式)。一致する見出しが無い場合は
// 黙って挿入されない(呼び出し側で見出しテキストの表記ゆれに注意する)。
async function embedAccordions(html, accordions, debugSlug) {
  if (!Array.isArray(accordions) || accordions.length === 0) return html;

  const blocks = splitHtmlBlocks(html);
  const used = new Array(accordions.length).fill(false);
  const outBlocks = [];

  for (const block of blocks) {
    outBlocks.push(block);
    const headingMatch = block.match(/^<h[23][^>]*>([\s\S]*?)<\/h[23]>/);
    if (!headingMatch) continue;
    const headingText = stripTags(headingMatch[1]);

    for (let i = 0; i < accordions.length; i += 1) {
      const accordion = accordions[i];
      if (used[i] || !accordion.afterHeading) continue;
      if (stripTags(accordion.afterHeading) === headingText) {
        used[i] = true;
        outBlocks.push(await renderAccordionHtml(accordion));
      }
    }
  }

  // item33(宣言vs実描画の突き合わせ、scripts/verify-declared-vs-rendered.js)用のフック。
  // 通常ビルドでは未設定のため何もしない。2026-08-14、splitHtmlBlocksの単一div境界
  // バグ(afterHeadingは一致するのにHTML分割の都合で挿入が失敗する)がfrontmatter
  // だけを見るverify-article.jsでは検出できなかった教訓から、実際のレンダリング
  // パイプラインを通した後の「使われなかった宣言」を検出できるようにしている。
  if (process.env.NEVORA_VERIFY_RENDER_MATCH) {
    accordions.forEach((accordion, i) => {
      if (!used[i]) {
        console.error(
          `[UNMATCHED_ACCORDION] ${debugSlug}\tafterHeading=${JSON.stringify(
            accordion.afterHeading
          )}`
        );
      }
    });
  }

  return outBlocks.join("");
}

// frontmatterのcharts([{type, afterHeading, title/label, unit, data, source, sourceUrl}])を、
// afterHeadingのテキストと完全一致する見出しブロックの直後に挿入する。
// 一致する見出しが無いchartは挿入されない(黙って消える不具合を避けるため、
// 呼び出し側で見出しテキストの表記ゆれに注意する)。
// tip/ポイント系chart(💡NEVORAポイント相当)は、見出し直後ではなく
// 該当セクション末尾(次のH2/H3見出しの直前、または本文末尾)に描画する
// (2026-08-17、writer.mdルール改訂・項目36〔計測モード〕対応の第1段階。
// 「本文・手順・図を補足する」性質のコールアウトが、読者がまだ読んでいない
// 内容を見出し直後で先取りしてしまう配置バグの恒久対策)。対象はNEVORAポイント
// 相当の2type("tip"=lib/microneedleExtras.js等の共通実装、"skincareTip"=
// lib/skincareBasicsExtras.js)のみ。注意喚起型(warning系)・要約型
// (summaryCard/finalSummary系)は現行通り見出し直後の先頭配置を維持する
// (writer.md改訂ルールの「要約型のみ先頭配置可」と整合)。
const END_OF_SECTION_CHART_TYPES = new Set(["tip", "skincareTip"]);

function embedCharts(html, charts, toc, debugSlug) {
  if (!Array.isArray(charts) || charts.length === 0) return html;

  const blocks = splitHtmlBlocks(html);
  const used = new Array(charts.length).fill(false);
  const outBlocks = [];
  let pendingEndOfSection = [];

  const flushPending = () => {
    pendingEndOfSection.forEach((renderedHtml) => outBlocks.push(renderedHtml));
    pendingEndOfSection = [];
  };

  for (const block of blocks) {
    const headingMatch = block.match(/^<h[23][^>]*>([\s\S]*?)<\/h[23]>/);
    if (headingMatch) {
      // 新しい見出しに入る前に、直前セクションの「セクション末尾」チャートを確定させる
      flushPending();
    }
    outBlocks.push(block);
    if (!headingMatch) continue;
    const headingText = stripTags(headingMatch[1]);

    charts.forEach((chart, i) => {
      if (used[i] || !chart.afterHeading) return;
      if (stripTags(chart.afterHeading) === headingText) {
        used[i] = true;
        const renderedHtml = renderChartHtml(chart, toc, debugSlug);
        // 見出しの一致(used[i])とレンダリングの成否は別物である。必須フィールドの
        // キー名を取り違えると各レンダラは空文字を返し、図が丸ごと消えたまま
        // ビルドが通ってしまう(2026-08-25、type:"steps" の項目キーを items ではなく
        // steps と書いた28記事で図が2日以上表示されていなかった)。項目33で拾えるよう
        // 診断行を出す。[EMPTY_LEADER_LABEL]と同じ運用(28節)。
        if (process.env.NEVORA_VERIFY_RENDER_MATCH && !String(renderedHtml || "").trim()) {
          console.error(
            `[EMPTY_CHART] ${debugSlug}	type=${chart.type}	afterHeading=${JSON.stringify(
              chart.afterHeading || ""
            )}`
          );
        }
        if (END_OF_SECTION_CHART_TYPES.has(chart.type)) {
          pendingEndOfSection.push(renderedHtml);
        } else {
          outBlocks.push(renderedHtml);
        }
      }
    });
  }
  flushPending(); // 本文最後のセクション分

  if (process.env.NEVORA_VERIFY_RENDER_MATCH) {
    charts.forEach((chart, i) => {
      if (!used[i]) {
        console.error(
          `[UNMATCHED_CHART] ${debugSlug}\ttype=${chart.type}\tafterHeading=${JSON.stringify(
            chart.afterHeading
          )}`
        );
      }
    });
  }

  return outBlocks.join("");
}

// H2・H3見出しごとに本文を<section>で囲み、背景を白⇔淡色⇔罫線カードの3種で交互に
// 変える汎用実装(chart typeの仕組みとは別軸)。frontmatterで sectionAlternate: true
// を指定した記事にのみ適用される(2026-08-08追加)。既存12記事はwrapAsemoSections等の
// 記事ごとの個別実装(このファイル冒頭のimport経由)を使い続けており、この関数は
// それらを置き換えない。色は styles/globals.css の --chart-tint-bg / --chart-card-border
// で制御し、記事側で上書きしなければサイト共通の既定色になる。
// H2だけでなくH3でも区切る(2026-08-08修正): H2配下にH3が複数ぶら下がるセクションは
// 文字量が他の2〜3倍に膨らみ、背景色が変わらないまま長く続いてしまうため。H3は
// タイプ別解説など元々ひとまとまりの話題単位として使われることが多く、H3ごとに
// 背景を切り替えても「同じH2の中の話題」という意味的なまとまりは見出し自体で
// 読み取れる(SKILL.mdでもH3が3個以上連続する箇所は絵文字で視覚的に区切る運用)。
// H3は必ず id="..." 付きのものだけを区切りに使う(addHeadingIdsAndBuildTocが本文の
// 見出しにのみidを振るのがembedChartsより前工程のため)。summaryCard等のchart
// widgetが内部で使う<h3>(結論はこの3つ 等)にはidが無く、これらは本文見出しではなく
// ウィジェット内部の装飾なので区切りに使うとカードが分断されてしまう。
function wrapArticleSections(html) {
  const parts = html.split(/(?=<h2[ >]|<h3 id=)/);
  if (parts.length <= 1) return html;

  const bgClasses = ["article-section-plain", "article-section-tint", "article-section-card"];
  let sectionIndex = 0;

  const wrapped = parts.map((part) => {
    if (!/^(<h2[ >]|<h3 id=)/.test(part)) return part;
    const cls = bgClasses[sectionIndex % bgClasses.length];
    sectionIndex += 1;
    return `<section class="article-section ${cls}">${part}</section>`;
  });

  return wrapped.join("");
}

// remarkHtmlが出力するHTMLエンティティ(&amp; 等)を、見出しIDの生成やTOC表示用の
// プレーンテキストとして扱うために元の文字に戻す。JSXのテキストノードとして
// そのまま描画すると再エスケープされるため、二重エスケープ(&amp;amp;)を防ぐ。
function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

// 見出しテキストからアンカーリンク用のid属性を組み立てる(rehype-slug相当の
// 処理を正規表現ベースで代替)。半角/全角の記号・空白はハイフンに置換し、
// 日本語(かな・漢字)自体はそのまま残す(id属性・URLフラグメントとして
// 有効なため変換不要)。同名見出しが複数ある場合はusedIdsで連番を振って
// 一意にする。
function slugifyHeadingId(text, usedIds) {
  const base =
    text
      .replace(
        /[!-/:-@[-`{-~！-／：-＠［-｀｛-～、。・「」『』【】\s]+/g,
        "-"
      )
      .replace(/^-+|-+$/g, "") || "section";

  let id = base;
  let i = 2;
  while (usedIds.has(id)) {
    id = `${base}-${i}`;
    i += 1;
  }
  usedIds.add(id);
  return id;
}

// 目次(TOC)機能のため、本文HTML中のH2/H3見出しにid属性を付与しつつ
// (rehype-slug非導入のため独自実装)、目次表示に使う見出し一覧を組み立てる。
// 見出しに既にid属性が付いている場合(将来手動指定するケースを想定)は
// 上書きせずそのまま尊重する。
function addHeadingIdsAndBuildToc(html) {
  const usedIds = new Set();
  const toc = [];

  const htmlWithIds = html.replace(
    /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/g,
    (match, level, attrs, inner) => {
      const text = decodeHtmlEntities(stripTags(inner));
      const existingIdMatch = attrs.match(/\sid="([^"]+)"/);
      let id = existingIdMatch ? existingIdMatch[1] : "";
      let nextAttrs = attrs;

      if (id) {
        usedIds.add(id);
      } else {
        id = slugifyHeadingId(text, usedIds);
        nextAttrs = `${attrs} id="${id}"`;
      }

      if (text) {
        toc.push({ level: Number(level), id, text });
      }

      return `<h${level}${nextAttrs}>${inner}</h${level}>`;
    }
  );

  return { html: htmlWithIds, toc };
}

const SOURCE_TYPES = new Set(["primary", "secondary", "editorial"]);

// URLのpathnameが空/"/"のみ(トップページ相当)かどうかを判定する。
// 「一次情報だがトップページURLしか貼っていない」という
// フェーズ0監査の観点3(出典が弱い記事)の再発をビルド時に検知するための簡易チェック。
function isShallowUrl(url) {
  try {
    const { pathname } = new URL(url);
    return pathname === "" || pathname === "/";
  } catch {
    return false;
  }
}

// frontmatterのsources([{label, url, type}])を検証・正規化する。
// type: "primary"(一次情報)/"secondary"(二次情報)/"editorial"(編集部調査)。
// editorialの場合のみsurveyN/surveyMethod/surveyDateを必須とする
// (フェーズ1指示7項: 編集部調査は「正直に独自データとして明記する」方針)。
// 必須項目の欠落はビルドを止めず、console.warnで警告するに留める
// (記事データはCMSではなくMarkdownで人手管理のため、軽微な入力漏れで
// ビルド全体を失敗させるとむしろ運用の障害になる)。
function normalizeSources(rawSources, slug) {
  if (!Array.isArray(rawSources)) return [];
  return rawSources.map((s, i) => {
    const ref = `[sources] ${slug}: sources[${i}]`;
    const label = s?.label || "";
    if (!label) console.warn(`${ref} に label がありません。`);

    const type = SOURCE_TYPES.has(s?.type) ? s.type : "secondary";
    if (!SOURCE_TYPES.has(s?.type)) {
      console.warn(`${ref} の type が不正または未指定です(primary/secondary/editorialのいずれか)。secondaryとして扱います。`);
    }

    if (type === "editorial") {
      if (!s?.surveyN) console.warn(`${ref}(editorial) に surveyN(n数)がありません。`);
      if (!s?.surveyMethod) console.warn(`${ref}(editorial) に surveyMethod(調査方法)がありません。`);
      if (!s?.surveyDate) console.warn(`${ref}(editorial) に surveyDate(実施時期)がありません。`);
      return {
        label,
        type,
        surveyN: s?.surveyN || "",
        surveyMethod: s?.surveyMethod || "",
        surveyDate: s?.surveyDate || "",
      };
    }

    const url = s?.url || "";
    if (!url) {
      console.warn(`${ref}(${type}) に url がありません。`);
    } else if (isShallowUrl(url)) {
      console.warn(`${ref} の url がトップページ相当(浅いURL)です。該当ページの深いURLを指定してください: ${url}`);
    }
    return { label, type, url };
  });
}

function normalizeFrontmatter(data, slug) {
  return {
    title: data.title || slug,
    description: data.description || "",
    category: data.category || "未分類",
    tags: Array.isArray(data.tags) ? data.tags : [],
    worry: Array.isArray(data.worry) ? data.worry : [],
    affiliateLinks: normalizeAffiliateLinks(data.affiliateLinks),
    date: data.date || null,
    updatedDate: data.updatedDate || data.updated || null,
    // ファイル名に `%` を含む記事(例: 「…75%時代の備え方」)でも壊れないよう、
    // 画像パスはここでパーセントエンコードして配る(lib/urls.js 参照)。
    thumbnail: encodePath(data.thumbnail || ""),
    // 記事ページ上部のヒーロー画像(16:9固定表示)専用の差し替え画像(任意)。
    // 未指定の場合はthumbnailがヒーローにも使われる(従来通り)。カード表示
    // (ホーム・カテゴリ・関連記事等、正方形/横長カード)は常にthumbnailを使う。
    // 2026-08-16、UVAとUVBの違い記事で「サムネ(3:2)をそのままヒーロー(16:9)に
    // object-fit:coverすると下部の焼き込みテキストがクロップされる」不具合が
    // 発覚し、ヒーロー専用のクロップ済み画像を分離するために新設した
    // (`docs/CONTRIBUTING.md`のセーフゾーン規則も参照)。
    heroImage: encodePath(data.heroImage || ""),
    // ホームの「注目記事」「人気記事」セクション用の手動ピックフラグ。
    // アクセス解析導入までの暫定運用で、編集判断で個別記事に付与する。
    featured: data.featured === true,
    popular: data.popular === true,
    // カテゴリ担当マスコットの一言コメント(ライターが記事内容に即して設定)。
    // 未指定ならlib/categoryMascot.jsの既定コメントから自動で選ばれる。
    mascotComment: data.mascotComment || "",
    // 記事ページ上部の要約表示用(任意)。記事の内容に応じて手動設定する。
    summaryPoints: Array.isArray(data.summaryPoints) ? data.summaryPoints : [],
    targetReader: data.targetReader || "",
    comparisonCriteria: Array.isArray(data.comparisonCriteria) ? data.comparisonCriteria : [],
    // 金融免責表示のopt-outフラグ。既定は全記事表示で、"none"の場合のみ非表示にする
    // (FinancialDisclaimer.js参照)。
    disclaimer: data.disclaimer || "",
    // 出典(データ駆動方式、docs/citation-format.md参照)。未指定の記事は
    // 従来通り本文中の「## 出典」セクションがそのまま表示される(後方互換)。
    sources: normalizeSources(data.sources, slug),
  };
}

// frontmatterのaccordions([{afterHeading, summary, content}])はgetAllPostsMeta等の
// 軽量な一覧表示では使わないため、normalizeFrontmatterには含めず本文変換時のみ扱う。
function normalizeAccordions(accordions) {
  if (!Array.isArray(accordions)) return [];
  return accordions
    .filter((a) => a && a.afterHeading && a.summary && a.content)
    .map((a) => ({
      afterHeading: String(a.afterHeading),
      summary: String(a.summary),
      content: String(a.content),
    }));
}

// 目次から「まとめ」等の結論に該当する見出しを推定し、アンカーリンク先を返す。
// 該当語を含む見出しがなければ最後のh2を結論とみなす。frontmatterでの
// 手動指定は不要で、既存のtoc生成結果のみから導出する。
function findConclusionAnchor(toc) {
  if (!Array.isArray(toc) || toc.length === 0) return null;
  const conclusionKeywords = ["まとめ", "結論", "総括"];
  const matched = toc.find((item) =>
    conclusionKeywords.some((kw) => item.text.includes(kw))
  );
  if (matched) return matched;
  const h2s = toc.filter((item) => item.level === 2);
  return h2s.length > 0 ? h2s[h2s.length - 1] : null;
}

// 本文の文字数から読了目安時間(分)を概算する。日本語は1分あたり
// 400〜600文字程度が読了速度の目安とされるため、中間値の500文字/分を採用。
// 端数切り上げで「1分未満」表示を避け、最低1分は表示する。
function estimateReadTimeMinutes(html) {
  const textLength = stripTags(html).replace(/\s+/g, "").length;
  return Math.max(1, Math.ceil(textLength / 500));
}

// Markdown記法(リンク・見出し記号等)を取り除いたプレーンテキストを作る。
// 一覧用の抜粋(excerpt)・検索用の全文インデックス(searchText)の両方で使う共通処理。
function buildPlainText(content) {
  return stripTags(stripHtmlComments(content))
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*`>\-\[\]!]/g, "")
    .trim();
}

// frontmatterのdate(時刻を含めば時刻まで)を新しい順に比較する。
// ファイル名の文字列比較だと同日公開の記事が日本語の文字コード順になり
// 実際の公開順とズレるため使わない。dateが同値/不正な場合はslugを補助キーにする。
function sortByDateDesc(posts) {
  return posts.sort((a, b) => {
    const diff = new Date(b.date || 0) - new Date(a.date || 0);
    if (!Number.isNaN(diff) && diff !== 0) return diff;
    return a.slug < b.slug ? 1 : -1;
  });
}

/**
 * 一覧表示用のメタ情報のみを持つ記事一覧(本文全文は含まない・軽量)
 * 新着順(公開日降順)にソートして返す
 */
export function getAllPostsMeta() {
  const files = readArticleFiles();

  const posts = files.map((filename) => {
    const slug = slugFromFilename(filename);
    const fullPath = path.join(ARTICLES_DIR, filename);
    const fileContents = fs.readFileSync(fullPath, "utf8");
    const { data, content } = matter(fileContents);
    const meta = normalizeFrontmatter(data, slug);

    return {
      slug,
      ...meta,
      // 一覧カード用に本文の先頭のみプレーンテキストで保持(重すぎない範囲)
      excerpt: buildPlainText(content).slice(0, 400),
    };
  });

  return sortByDateDesc(posts);
}

/**
 * 検索ページ専用の記事一覧。getAllPostsMeta の内容に加え、本文全文の
 * プレーンテキスト(body)を持たせる。タイトル・抜粋・カテゴリ・タグだけでなく
 * 本文まで検索対象に含めるためのもので、他ページ(一覧・カテゴリ等)の
 * propsを不必要に大きくしないよう getAllPostsMeta とは分離している。
 */
export function getAllPostsForSearch() {
  const files = readArticleFiles();

  const posts = files.map((filename) => {
    const slug = slugFromFilename(filename);
    const fullPath = path.join(ARTICLES_DIR, filename);
    const fileContents = fs.readFileSync(fullPath, "utf8");
    const { data, content } = matter(fileContents);
    const meta = normalizeFrontmatter(data, slug);
    const plainText = buildPlainText(content);

    return {
      slug,
      ...meta,
      excerpt: plainText.slice(0, 400),
      body: plainText,
    };
  });

  return sortByDateDesc(posts);
}

/**
 * 指定slugの記事本文をHTMLに変換して返す
 */
export async function getPostBySlug(slug) {
  const fullPath = path.join(ARTICLES_DIR, `${slug}.md`);
  if (!fs.existsSync(fullPath)) return null;

  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);
  const meta = normalizeFrontmatter(data, slug);

  // frontmatterのsourcesと本文の「## 出典」見出しが両方存在すると、出典が
  // 二重表示される(B1のsummaryPoints/⏱30秒でわかるボックスと同じ構造の不具合)。
  // 本文側を自動で取り除くのは正規表現によるHTML分割(splitHtmlBlocks等)と
  // 同種のリスクを伴うため行わず、ビルド時の警告に留めて手動での削除を促す。
  if (meta.sources.length > 0 && /^#{2,3}\s*出典/m.test(content)) {
    console.warn(
      `[sources] ${slug}: frontmatterのsourcesと本文の「## 出典」見出しが両方存在します。出典が二重表示されるため、本文側の出典見出しを削除してください。`
    );
  }

  const processedContent = await remark()
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkHtml)
    .process(stripHtmlComments(content));
  const rawHtml = enhanceAnnotationBlockquotes(applyInlineMarkup(processedContent.toString()));
  // 目次(TOC)表示・アンカーリンクのため、H2/H3見出しにid属性を付与する。
  // charts/アフィリエイトバナーの挿入(段落単位の分割・再結合)より前に行う
  // (挿入処理は開始タグの属性追加に影響されず、見出しブロック判定の
  // 正規表現も[^>]*で属性を許容しているため安全)。
  const { html: htmlWithHeadingIds, toc } = addHeadingIdsAndBuildToc(rawHtml);
  const charts = Array.isArray(data.charts) ? data.charts : [];
  const htmlWithCharts = embedCharts(htmlWithHeadingIds, charts, toc, slug);
  const accordions = normalizeAccordions(data.accordions);
  const htmlWithAccordions = await embedAccordions(htmlWithCharts, accordions, slug);
  const { html: htmlWithAffiliateBanners, unplaced } = embedAffiliateBanners(
    htmlWithAccordions,
    meta.affiliateLinks
  );
  const mascot = getCategoryMascot(meta.category, slug, meta.mascotComment);
  let contentHtml = insertMascotComment(htmlWithAffiliateBanners, mascot, slug);

  // frontmatterに sectionAlternate: true を指定するだけで、H2見出し単位の
  // セクション背景交互化(汎用CSSクラス.article-section-*)を適用できる。
  if (data.sectionAlternate === true) {
    contentHtml = wrapArticleSections(contentHtml);
  }

  return {
    slug,
    ...meta,
    contentHtml,
    toc,
    // 上記のrenderXTocHtml/insertXToc呼び出しでcontentHtml冒頭に専用目次を
    // 埋め込み済みのslugでは、pages/posts/[slug].js側の共通<ArticleToc>を
    // 重ねて表示すると目次が2つ並んでしまう(2026-08-09判明)。
    // ここで検出してページ側の共通目次を出し分ける。
    hasEmbeddedToc: SLUGS_WITH_EMBEDDED_TOC.has(slug),
    conclusionAnchor: findConclusionAnchor(toc),
    readTimeMinutes: estimateReadTimeMinutes(contentHtml),
    // 本文中に紐づく言及が見つからなかったアフィリエイトリンク(あれば)。
    // 記事末尾にフォールバックとしてのみ表示する。
    unplacedAffiliateLinks: unplaced,
  };
}

export function getAllSlugs() {
  return readArticleFiles().map((filename) => slugFromFilename(filename));
}

export function getAllCategories() {
  const posts = getAllPostsMeta();
  const categories = new Map();

  for (const post of posts) {
    categories.set(post.category, (categories.get(post.category) || 0) + 1);
  }

  return Array.from(categories.entries()).map(([name, count]) => ({
    name,
    count,
  }));
}

/**
 * ホームページの「カテゴリで探す」等で常時表示する一覧。
 * 大カテゴリ12種は記事が0件でも表示順どおりに含め(準備中として表示するため)、
 * それ以外に実際に使われているカテゴリ(旧カテゴリ名など)は記事数の多い順で末尾に追加する。
 */
export function getAllMajorCategories() {
  const counts = new Map();
  for (const { name, count } of getAllCategories()) {
    counts.set(name, count);
  }

  const majors = MAJOR_CATEGORIES.map((name) => ({
    name,
    count: counts.get(name) || 0,
  }));

  const extras = Array.from(counts.entries())
    .filter(([name]) => !MAJOR_CATEGORIES.includes(name))
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return [...majors, ...extras];
}

export function getPostsByCategory(category) {
  return getAllPostsMeta().filter((post) => post.category === category);
}

export function getNextPost(slug) {
  const all = getAllPostsMeta();
  const current = all.find((p) => p.slug === slug);
  if (!current) return null;

  // 公開日の古い順(この配列上でのindexの大小がそのまま新旧の順序になる)
  const chronological = [...all].reverse();
  const sameCategory = chronological.filter((p) => p.category === current.category);
  const index = sameCategory.findIndex((p) => p.slug === slug);

  if (index !== -1) {
    if (index < sameCategory.length - 1) {
      // 1. 同一カテゴリ内で自分より新しい記事のうち最も近いもの
      return sameCategory[index + 1];
    }
    if (index > 0) {
      // 2. なければ同一カテゴリ内で自分より古い記事のうち最も近いもの
      return sameCategory[index - 1];
    }
  }

  // 3. 同一カテゴリに他の記事が1件もない場合、悩みタグが一致する記事を新着順で探す
  if (Array.isArray(current.worry) && current.worry.length > 0) {
    const worryMatch = all.find(
      (p) =>
        p.slug !== slug &&
        Array.isArray(p.worry) &&
        p.worry.some((w) => current.worry.includes(w))
    );
    if (worryMatch) return worryMatch;
  }

  // 4. 該当なし
  return null;
}
