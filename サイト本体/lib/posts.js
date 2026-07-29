import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import { getCategoryMascot } from "./categoryMascot";

// npm run sync-content (predev/prebuild) によって
// サイト運営/記事データ/確定稿 から自動コピーされるディレクトリ
const ARTICLES_DIR = path.join(process.cwd(), "content", "articles");

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
function applyInlineMarkup(html) {
  return html
    .replace(/==([^=\n]+?)==/g, '<mark class="hl">$1</mark>')
    .replace(/\+\+([^\n]+?)\+\+/g, '<u class="u-accent">$1</u>')
    .replace(/\^\^([^\^\n]+?)\^\^/g, '<span class="emotion-emphasis">$1</span>')
    .replace(/%%([^%\n]+?)%%/g, '<span class="article-note">$1</span>');
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

// マスコットキャラクターの「一言コメント」をHTML文字列として組み立てる。
// components/Mascot.jsの吹き出し表示(.mascot-comment)と見た目を揃えている。
function renderMascotCommentHtml(mascot) {
  const name = escapeHtmlText(mascot.name);
  const comment = escapeHtmlText(mascot.comment);
  return `<div class="mascot-comment mascot-comment-inline"><img src="${escapeHtmlText(
    mascot.researchImage
  )}" alt="${name}" width="56" height="56" class="mascot-comment-img" loading="lazy" /><div class="mascot-comment-bubble"><span class="mascot-comment-name">${name}</span><p class="mascot-comment-text">${comment}</p></div></div>`;
}

// 本文が長文になるほど読みづらく感じられるため、本文中盤にマスコットの
// ひとことコメントを差し込み、読み疲れを和らげる「息抜き」にする。
// 挿入位置はH2見出しの直前(セクションの切れ目)に限定する。段落・リスト単位
// (splitHtmlBlocks)で区切ると、比較ブロック(メリット/デメリット等の<figure>)の
// 内部で使われる</p></ul>にも反応して分割されてしまい、独自レイアウトの
// 途中にマスコットが挟まる不具合が過去にあったため、必ず記事の大きな
// セクション区切りであるH2見出しの直前にのみ挿入する。
// H2が少ない(短文)記事では不自然になるため2つ未満の場合は挿入しない。
function insertMascotComment(html, mascot) {
  if (!mascot) return html;

  const headingPositions = [];
  const headingRe = /<h2[ >]/g;
  let match;
  while ((match = headingRe.exec(html))) {
    headingPositions.push(match.index);
  }
  if (headingPositions.length < 2) return html;

  const insertAt = headingPositions[Math.floor(headingPositions.length / 2)];
  return html.slice(0, insertAt) + renderMascotCommentHtml(mascot) + html.slice(insertAt);
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
  return html.split(
    /(?<=<\/(?:p|ul|ol|blockquote|h1|h2|h3|h4|h5|h6|pre|table)>)\n*(?=<)/
  );
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
function renderBarChartHtml(chart) {
  const { title, unit = "", data, source, sourceUrl } = chart;
  if (!Array.isArray(data) || data.length === 0) return "";

  const values = data.map((d) => Number(d.value) || 0);
  const max = Math.max(...values, 1);
  const barHeight = 30;
  const barGap = 16;
  const chartWidth = 560;
  const labelWidth = 140;
  const plotWidth = chartWidth - labelWidth - 70;
  const height = data.length * (barHeight + barGap) + barGap;

  const bars = data
    .map((d, i) => {
      const value = Number(d.value) || 0;
      const y = barGap + i * (barHeight + barGap);
      const barWidth = Math.max((value / max) * plotWidth, 2);
      const label = escapeHtmlText(d.label);
      const valueText = escapeHtmlText(`${d.value}${unit}`);
      return `<g><title>${label}: ${valueText}</title><text x="${
        labelWidth - 10
      }" y="${
        y + barHeight / 2
      }" text-anchor="end" dominant-baseline="middle" class="chart-cat-label">${label}</text><rect x="${labelWidth}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" class="chart-bar" /><text x="${
        labelWidth + barWidth + 8
      }" y="${
        y + barHeight / 2
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

function renderChartHtml(chart) {
  if (chart.type === "stat") return renderStatTileHtml(chart);
  if (chart.type === "pie" || chart.type === "donut")
    return renderDonutChartHtml(chart);
  if (chart.type === "prosCons") return renderProsConsHtml(chart);
  return renderBarChartHtml(chart);
}

// frontmatterのcharts([{type, afterHeading, title/label, unit, data, source, sourceUrl}])を、
// afterHeadingのテキストと完全一致する見出しブロックの直後に挿入する。
// 一致する見出しが無いchartは挿入されない(黙って消える不具合を避けるため、
// 呼び出し側で見出しテキストの表記ゆれに注意する)。
function embedCharts(html, charts) {
  if (!Array.isArray(charts) || charts.length === 0) return html;

  const blocks = splitHtmlBlocks(html);
  const used = new Array(charts.length).fill(false);
  const outBlocks = [];

  for (const block of blocks) {
    outBlocks.push(block);
    const headingMatch = block.match(/^<h[23][^>]*>([\s\S]*?)<\/h[23]>/);
    if (!headingMatch) continue;
    const headingText = stripTags(headingMatch[1]);

    charts.forEach((chart, i) => {
      if (used[i] || !chart.afterHeading) return;
      if (stripTags(chart.afterHeading) === headingText) {
        used[i] = true;
        outBlocks.push(renderChartHtml(chart));
      }
    });
  }

  return outBlocks.join("");
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

function normalizeFrontmatter(data, slug) {
  return {
    title: data.title || slug,
    description: data.description || "",
    category: data.category || "未分類",
    tags: Array.isArray(data.tags) ? data.tags : [],
    affiliateLinks: normalizeAffiliateLinks(data.affiliateLinks),
    date: data.date || null,
    updatedDate: data.updatedDate || data.updated || null,
    thumbnail: data.thumbnail || "",
    mascotComment: data.mascotComment || "",
  };
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
  return stripHtmlComments(content)
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

  const processedContent = await remark()
    .use(remarkGfm)
    .use(remarkHtml)
    .process(stripHtmlComments(content));
  const rawHtml = applyInlineMarkup(processedContent.toString());
  // 目次(TOC)表示・アンカーリンクのため、H2/H3見出しにid属性を付与する。
  // charts/アフィリエイトバナーの挿入(段落単位の分割・再結合)より前に行う
  // (挿入処理は開始タグの属性追加に影響されず、見出しブロック判定の
  // 正規表現も[^>]*で属性を許容しているため安全)。
  const { html: htmlWithHeadingIds, toc } = addHeadingIdsAndBuildToc(rawHtml);
  const charts = Array.isArray(data.charts) ? data.charts : [];
  const htmlWithCharts = embedCharts(htmlWithHeadingIds, charts);
  const { html: htmlWithAffiliateBanners, unplaced } = embedAffiliateBanners(
    htmlWithCharts,
    meta.affiliateLinks
  );
  const mascot = getCategoryMascot(meta.category, slug, meta.mascotComment);
  const contentHtml = insertMascotComment(htmlWithAffiliateBanners, mascot);

  return {
    slug,
    ...meta,
    contentHtml,
    toc,
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

export function getPostsByCategory(category) {
  return getAllPostsMeta().filter((post) => post.category === category);
}

/**
 * 「次の記事」ボタン用に、指定slugの次に読む記事を返す。
 * 公開日の古い順に並べたとき現在の記事より1つ新しい記事を返し、
 * 現在の記事が最新(公開順の末尾)の場合は一番古い記事(先頭)に戻る。
 * 記事が1件以下の場合はnullを返す。
 */
export function getNextPost(slug) {
  const chronological = [...getAllPostsMeta()].reverse(); // 公開日の古い順
  if (chronological.length < 2) return null;

  const index = chronological.findIndex((p) => p.slug === slug);
  if (index === -1) return null;

  const nextIndex = (index + 1) % chronological.length;
  return chronological[nextIndex];
}
