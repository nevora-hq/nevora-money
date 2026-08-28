#!/usr/bin/env node
"use strict";

/**
 * nevora-pipeline-verifier用の機械的検証スクリプト。
 *
 * 使い方: node scripts/verify-article.js <記事Markdownファイルパス>
 *
 * 設計方針:
 * - サイト本体(lib/posts.js)のレンダリングロジックは一切import・改修しない。
 *   検証専用の独立した軽量パーサーをこのファイル内に持つ(意図的な重複。
 *   理由はagents/nevora-pipeline-verifier.mdおよび2026-08-08の設計合意を参照)。
 * - frontmatterのYAML解析のみ、既にnode_modulesにある汎用ライブラリgray-matterを使う
 *   (サイト本体コードへの依存ではないため)。
 * - 出力はJSON1本(stdout)。人間可読な整形はnevora-pipeline-verifierエージェント側で行う。
 *
 * 項目10〜18(2026-08-11、フェーズ6追加): docs/CONTRIBUTING.md・docs/citation-format.mdの
 * 禁止事項・スキーマ要件をコードで機械的に検出する。プロンプト指示(自然言語)だけに頼ると
 * writer.mdの矛盾指示(87行目「一人称の実体験ベースで」)のように「AIが読み飛ばす・解釈で
 * 緩める」リスクがあるため、正規表現の検出は再現性のあるコードで行う方針(2026-08-11ユーザー指示)。
 * 項目10〜16は違反があれば`result: "No"`とし、nevora-pipeline-verifierはこれを
 * publisherへの受け渡しを止めるハードエラーとして扱うこと(警告として流さない)。
 * 検出パターンはdocs/CONTRIBUTING.md 3節・5節、docs/citation-format.mdと同期させること
 * (パターンを変更したら両方のドキュメントを更新する)。
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

// ---------------------------------------------------------------------------
// 定数(2026-08-08 定義確定分)
// ---------------------------------------------------------------------------

// 感情表現用絵文字の固定リスト。
// 公開済み記事38本(サイト運営/記事データ/公開済み)の「地の文」
// (見出し/リスト/表/ボックスを除く段落)での実使用頻度調査に基づく。
// SKILL.mdの例示(😓😳💦🥹✨)に加え、実際に地の文で頻出していた
// 感情・反応系の絵文字(😅🙆🙌😢😌)を採用した。
// 話題アイコン的な絵文字(💡🔍📊🧴等、主に見出し・ボックスで使用)は
// 「感情表現」ではないため対象外。
const EMOTION_EMOJI = ["😓", "😳", "💦", "🥹", "✨", "😅", "🙆", "🙌", "😢", "😌"];

const DECORATION_TOTAL_MIN = 6; // 項目4: 装飾要素の合計使用数の下限
const NEVORA_POINT_MAX_CHARS = 80; // 項目5: NEVORAポイント本文の上限(全角換算)
const PLAIN_TEXT_MAX_CHARS = 200; // 項目7: 連続プレーンテキストの上限(全角換算)
const ACCORDION_DUP_PREFIX_LEN = 30; // 項目2: 重複判定に使う先頭文字数

// ---------------------------------------------------------------------------
// 共通ユーティリティ
// ---------------------------------------------------------------------------

// ライターが本文に残す内部向けメモ(HTMLコメント)を除去する。
// 行番号がズレないよう、コメント内の改行数と同じ数の改行を残す。
function stripHtmlCommentsPreserveLines(text) {
  return text.replace(/<!--[\s\S]*?-->/g, (m) => {
    const newlines = (m.match(/\n/g) || []).length;
    return "\n".repeat(newlines);
  });
}

// East Asian Width的な半角/全角判定(全角=1、半角=0.5)。
// 依存追加を避けるため、代表的なUnicode範囲による自前判定とする。
function isFullWidthChar(ch) {
  const code = ch.codePointAt(0);
  return (
    (code >= 0x1100 && code <= 0x115f) || // ハングルジャモ
    (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) || // CJK部首〜イ文字
    (code >= 0xac00 && code <= 0xd7a3) || // ハングル音節
    (code >= 0xf900 && code <= 0xfaff) || // CJK互換漢字
    (code >= 0xfe30 && code <= 0xfe4f) || // CJK互換形
    (code >= 0xff00 && code <= 0xff60) || // 全角形
    (code >= 0xffe0 && code <= 0xffe6)
  );
}

function zenkakuLength(text) {
  let total = 0;
  for (const ch of Array.from(text)) {
    total += isFullWidthChar(ch) ? 1 : 0.5;
  }
  return total;
}

// 表示テキストへの変換: 装飾記法の記号自体は文字数に含めない
// (==語句== / ++語句++ / ^^語句^^ / %%語句%% / **語句** → 語句、
//  [text](url) → text)。項目5の文字数カウント対象を「表示テキストのみ」
// とする2026-08-08の定義確定に基づく。
function toDisplayText(text) {
  return text
    .replace(/==((?:(?!==)[^\n])+?)==/g, "$1")
    .replace(/(?<!\+)\+\+(?!\+)([^\n]+?)(?<!\+)\+\+(?!\+)/g, "$1")
    .replace(/\^\^((?:(?!\^\^)[^\n])+?)\^\^/g, "$1")
    .replace(/%%((?:(?!%%)[^\n])+?)%%/g, "$1")
    .replace(/\*\*([^\n]+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function findNearestHeading(target, headings) {
  if (headings.length === 0) return null;
  let best = null;
  let bestDist = Infinity;
  for (const h of headings) {
    const d = levenshtein(target, h.text);
    if (d < bestDist) {
      bestDist = d;
      best = h;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// 行分類(独自の軽量パーサー。remark等のASTは使わずライン単位で判定)
// ---------------------------------------------------------------------------

const RE_HEADING = /^\s{0,3}(#{1,6})\s+(.+?)\s*$/;
const RE_HR = /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/;
const RE_LIST = /^\s*([-*+]\s+|\d+\.\s+)/;
const RE_TABLE = /^\s*\|/;
const RE_BLOCKQUOTE = /^\s*>/;
const RE_IMAGE_ONLY = /^\s*!\[[^\]]*\]\([^)]*\)\s*$/;
const RE_BLANK = /^\s*$/;

function classifyLine(line) {
  if (RE_BLANK.test(line)) return "blank";
  if (RE_HEADING.test(line)) return "heading";
  if (RE_HR.test(line)) return "hr";
  if (RE_IMAGE_ONLY.test(line)) return "image";
  if (RE_TABLE.test(line)) return "table";
  if (RE_BLOCKQUOTE.test(line)) return "blockquote";
  if (RE_LIST.test(line)) return "list";
  return "text";
}

// 構造行(見出し/リスト/表/ボックス/区切り線/画像)かどうか。
// 項目4の絵文字・「……」カウントを「地の文」に限定するために使う。
function isStructuralType(type) {
  return type !== "text" && type !== "blank";
}

function extractHeadings(lines) {
  const headings = [];
  lines.forEach((line, idx) => {
    const m = line.match(RE_HEADING);
    if (m) {
      headings.push({
        level: m[1].length,
        text: m[2].trim(),
        line: idx + 1, // 1-indexed, body内の行番号(呼び出し側で絶対行番号に変換する)
      });
    }
  });
  return headings;
}

// ---------------------------------------------------------------------------
// ファイル読み込み・frontmatter分離
// ---------------------------------------------------------------------------

function loadArticle(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const bodyStartIndex = raw.indexOf(parsed.content);
  const bodyStartLine =
    bodyStartIndex >= 0 ? raw.slice(0, bodyStartIndex).split("\n").length : 1;

  const bodyRawLines = parsed.content.split("\n");
  const bodyCleanedText = stripHtmlCommentsPreserveLines(parsed.content);
  const bodyCleanedLines = bodyCleanedText.split("\n");

  return {
    frontmatter: parsed.data || {},
    bodyRawLines, // HTMLコメント除去前(項目3のコメント検出等に使う)
    bodyLines: bodyCleanedLines, // HTMLコメント除去後(通常の検証はこちらを使う)
    bodyStartLine, // 元ファイルにおけるbody 1行目の絶対行番号
  };
}

function toAbsoluteLine(bodyStartLine, bodyLineIndex1based) {
  return bodyStartLine + bodyLineIndex1based - 1;
}

// ---------------------------------------------------------------------------
// 項目1: afterHeadingの見出し一致
// ---------------------------------------------------------------------------

function checkItem1(ctx) {
  const headings = extractHeadings(ctx.bodyLines).filter((h) => h.level === 2 || h.level === 3);
  const headingTexts = new Set(headings.map((h) => h.text));

  const entries = [];
  const charts = Array.isArray(ctx.frontmatter.charts) ? ctx.frontmatter.charts : [];
  const accordions = Array.isArray(ctx.frontmatter.accordions) ? ctx.frontmatter.accordions : [];
  charts.forEach((c, i) => entries.push({ source: `charts[${i}]`, afterHeading: (c.afterHeading || "").trim() }));
  accordions.forEach((a, i) =>
    entries.push({ source: `accordions[${i}]`, afterHeading: (a.afterHeading || "").trim() })
  );

  const violations = [];
  for (const entry of entries) {
    if (!entry.afterHeading) continue;
    if (!headingTexts.has(entry.afterHeading)) {
      const nearest = findNearestHeading(entry.afterHeading, headings);
      violations.push({
        source: entry.source,
        afterHeading: entry.afterHeading,
        nearestHeading: nearest
          ? { text: nearest.text, line: toAbsoluteLine(ctx.bodyStartLine, nearest.line) }
          : null,
      });
    }
  }

  return {
    id: 1,
    name: "afterHeadingの見出し一致",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
  };
}

// ---------------------------------------------------------------------------
// 項目2: アコーディオンの本文重複(候補提示のみ。完全一致以外は人間判断)
// ---------------------------------------------------------------------------

function normalizeForDupCheck(text) {
  return toDisplayText(text).replace(/\s+/g, "");
}

function checkItem2(ctx) {
  const accordions = Array.isArray(ctx.frontmatter.accordions) ? ctx.frontmatter.accordions : [];
  const bodyPlainLines = ctx.bodyLines.map((line, idx) => ({
    line: idx + 1,
    normalized: classifyLine(line) === "text" || classifyLine(line) === "blockquote"
      ? normalizeForDupCheck(line)
      : "",
  }));
  // 段落(空行区切り)単位でも連結して検索できるよう、行を跨ぐ結合テキストも作る
  const combined = bodyPlainLines.map((l) => l.normalized).join("\n");

  const violations = [];
  accordions.forEach((a, i) => {
    const content = String(a.content || "");
    const snippet = normalizeForDupCheck(content).slice(0, ACCORDION_DUP_PREFIX_LEN);
    if (!snippet) return;
    const idx = combined.indexOf(snippet);
    if (idx >= 0) {
      // idxが何行目にあたるかを求める
      let acc = 0;
      let hitLine = null;
      for (const l of bodyPlainLines) {
        const lineLenWithNewline = l.normalized.length + 1;
        if (idx < acc + lineLenWithNewline) {
          hitLine = l.line;
          break;
        }
        acc += lineLenWithNewline;
      }
      violations.push({
        accordionIndex: i,
        afterHeading: a.afterHeading || "",
        matchedBodyLine: hitLine ? toAbsoluteLine(ctx.bodyStartLine, hitLine) : null,
        matchedSnippet: snippet,
      });
    }
  });

  return {
    id: 2,
    name: "アコーディオンの本文重複",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
    note:
      "完全一致(先頭" +
      ACCORDION_DUP_PREFIX_LEN +
      "字)の候補提示のみ。表現を変えた言い換えによる重複はこのスクリプトでは検出できないため、最終判断は人間が行うこと。",
  };
}

// ---------------------------------------------------------------------------
// 項目3: chartsの数
// ---------------------------------------------------------------------------

function checkItem3(ctx) {
  const charts = Array.isArray(ctx.frontmatter.charts) ? ctx.frontmatter.charts : [];
  const rawBody = ctx.bodyRawLines.join("\n");
  const commentMatch = rawBody.match(/<!--\s*charts:[\s\S]*?-->/);

  return {
    id: 3,
    name: "chartsの数",
    result: charts.length >= 2 ? "Yes" : "No",
    count: charts.length,
    exemptionComment: commentMatch ? commentMatch[0].trim() : null,
    note: commentMatch
      ? "コメントによる申し送りあり。妥当性の判断はこのスクリプト/検証エージェントでは行わず、編集長に委ねる。"
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// 項目4: 装飾要素の合計使用数
// ---------------------------------------------------------------------------

function checkItem4(ctx) {
  const fullText = ctx.bodyLines.join("\n");

  const highlightMatches = fullText.match(/==((?:(?!==)[^\n])+?)==/g) || [];
  const emotionMarkMatches = fullText.match(/\^\^((?:(?!\^\^)[^\n])+?)\^\^/g) || [];

  // 絵文字・「……」は「地の文」(見出し/リスト/表/ボックス/区切り線を除く行)のみを対象にする
  const plainTextLines = ctx.bodyLines.filter((line) => !isStructuralType(classifyLine(line)));
  const plainText = plainTextLines.join("\n");

  const emojiPattern = new RegExp(EMOTION_EMOJI.join("|"), "g");
  const emojiMatches = plainText.match(emojiPattern) || [];
  const ellipsisMatches = plainText.match(/…+/g) || []; // U+2026(…)の1回以上連続を1件とカウント

  const breakdown = {
    highlight: highlightMatches.length,
    emotion: emotionMarkMatches.length,
    emoji: emojiMatches.length,
    ellipsis: ellipsisMatches.length,
  };
  const total = breakdown.highlight + breakdown.emotion + breakdown.emoji + breakdown.ellipsis;

  return {
    id: 4,
    name: "装飾要素の合計使用数",
    result: total >= DECORATION_TOTAL_MIN ? "Yes" : "No",
    count: total,
    breakdown,
  };
}

// ---------------------------------------------------------------------------
// NEVORAポイントブロック抽出(項目5・6で共用)
// ---------------------------------------------------------------------------

const RE_NEVORA_LABEL = /^\s*>\s*💡\s*NEVORAポイント\s*$/;

function findNevoraPointBlocks(bodyLines) {
  const blocks = [];
  let i = 0;
  while (i < bodyLines.length) {
    if (RE_NEVORA_LABEL.test(bodyLines[i])) {
      const startLine = i + 1;
      let j = i + 1;
      const contentLines = [];
      while (j < bodyLines.length && RE_BLOCKQUOTE.test(bodyLines[j]) && !RE_NEVORA_LABEL.test(bodyLines[j])) {
        contentLines.push(bodyLines[j].replace(/^\s*>\s?/, ""));
        j++;
      }
      blocks.push({
        startLine,
        endLine: j, // 1-indexed, exclusive相当(最後の本文行の行番号)
        rawContent: contentLines.join(" ").trim(),
      });
      i = j;
    } else {
      i++;
    }
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// 項目5: NEVORAポイントの文字数(表示テキストで全角換算)
// ---------------------------------------------------------------------------

function checkItem5(ctx) {
  const blocks = findNevoraPointBlocks(ctx.bodyLines);
  if (blocks.length === 0) {
    return { id: 5, name: "NEVORAポイントの文字数", result: "Yes", blocks: [], note: "NEVORAポイントなし(該当なし)" };
  }

  const violations = [];
  const details = blocks.map((b) => {
    const displayText = toDisplayText(b.rawContent);
    const len = zenkakuLength(displayText);
    const over = len > NEVORA_POINT_MAX_CHARS;
    if (over) {
      violations.push({
        startLine: toAbsoluteLine(ctx.bodyStartLine, b.startLine),
        endLine: toAbsoluteLine(ctx.bodyStartLine, b.endLine),
        charCount: Math.round(len * 10) / 10,
      });
    }
    return { startLine: toAbsoluteLine(ctx.bodyStartLine, b.startLine), charCount: Math.round(len * 10) / 10 };
  });

  return {
    id: 5,
    name: "NEVORAポイントの文字数",
    result: violations.length === 0 ? "Yes" : "No",
    blocks: details,
    violations,
  };
}

// ---------------------------------------------------------------------------
// 項目6: NEVORAポイント内のハイライト
// ---------------------------------------------------------------------------

function checkItem6(ctx) {
  const blocks = findNevoraPointBlocks(ctx.bodyLines);
  if (blocks.length === 0) {
    return { id: 6, name: "NEVORAポイント内のハイライト", result: "Yes", violations: [], note: "NEVORAポイントなし(該当なし)" };
  }

  const violations = [];
  for (const b of blocks) {
    const hasHighlight = /==((?:(?!==)[^\n])+?)==/.test(b.rawContent);
    if (!hasHighlight) {
      violations.push({
        startLine: toAbsoluteLine(ctx.bodyStartLine, b.startLine),
        endLine: toAbsoluteLine(ctx.bodyStartLine, b.endLine),
      });
    }
  }

  return {
    id: 6,
    name: "NEVORAポイント内のハイライト",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
  };
}

// ---------------------------------------------------------------------------
// 項目7: 連続プレーンテキストの上限(200字[全角換算]) — 廃止済み・永久欠番
//
// 2026-08-14、ユーザー決裁により廃止(G1決裁・案ii)。地の文連続の基準は
// item23(300字ルール。リセット対象=画像/チャート/表/アコーディオン/
// コールアウトのみ)に完全一本化する。200〜299字帯の地の文連続は
// item23が意図的に許容している範囲であり、違反として扱わない。
//
// 経緯: 廃止提案 → 下書き9記事のitem7違反(公開済み・確定稿は0件)を理由に
// 安全ゲートで一旦停止 → item7とitem23を突き合わせた結果、下書き9記事中
// 6記事でitem7のみが検出する箇所(item23はPass)を確認し、当初「item7は
// 300字ルールが意図的に許容する範囲を検出する別基準の項目」と暫定判定
// (docs/project-state.md 17.1.1節に記録) → ユーザー決裁により
// 「200〜299字帯は300字ルールが意図的に許容する範囲であり違反ではない」と
// 確定し、廃止に至った(項目自体は履歴整合のため永久欠番として残す。
// 番号の振り直しはしない)。
//
// 旧・リセット対象定義(廃止済み、参考として保持):
//   含める: 見出し(H2〜H6)、区切り線(---)、画像、chart/accordionの挿入位置、
//           表、リスト、ボックス(> で始まる引用)、装飾記法(== ++ ^^)
//   含めない: %%注記%%(地の文の一部としてそのまま加算する)
// ---------------------------------------------------------------------------

function checkItem7() {
  return {
    id: 7,
    name: "連続プレーンテキストの上限(200字) — 2026-08-14廃止・永久欠番。300字ルール(項目23)に一本化",
    result: "Yes",
    violations: [],
  };
}

// ---------------------------------------------------------------------------
// 項目8: H2セクションごとの視覚要素
// ---------------------------------------------------------------------------

function checkItem8(ctx) {
  const headings = extractHeadings(ctx.bodyLines);
  const h2s = headings.filter((h) => h.level === 2);

  const charts = Array.isArray(ctx.frontmatter.charts) ? ctx.frontmatter.charts : [];
  const accordions = Array.isArray(ctx.frontmatter.accordions) ? ctx.frontmatter.accordions : [];
  const afterHeadingTargets = new Set(
    [...charts, ...accordions].map((x) => (x.afterHeading || "").trim()).filter(Boolean)
  );

  // frontmatterにsummaryPointsがある記事は、pages/posts/[slug].jsが本文の直前
  // (最初のH2より前)に「この記事で分かること」ボックスを自動描画する
  // (summaryPoints由来、bodyLinesの範囲外)。このボックスは実質的にリード文
  // セクションの視覚要素として機能するため、文書内で最初のH2セクションに限り、
  // summaryPointsの存在をもって視覚要素ありとみなす。本文側で同内容の要約ボックスを
  // 重ねて作る必要がないようにするための調整(2026-08-11、SPF・PA記事のテスト生成で
  // 要約の二重化が指摘されたことに基づく)。
  const hasSummaryPointsBox =
    Array.isArray(ctx.frontmatter.summaryPoints) && ctx.frontmatter.summaryPoints.length > 0;

  const violations = [];
  h2s.forEach((h2, i) => {
    const rangeStart = h2.line + 1;
    const rangeEnd = i + 1 < h2s.length ? h2s[i + 1].line - 1 : ctx.bodyLines.length;
    // H2見出し自身の直後にchart/accordionが挿入されるケース(見出しテキスト自体が
    // afterHeadingの対象になっている場合)も視覚要素ありとして扱う
    let hasVisual = afterHeadingTargets.has(h2.text) || (i === 0 && hasSummaryPointsBox);

    for (let ln = rangeStart; ln <= rangeEnd && !hasVisual; ln++) {
      const line = ctx.bodyLines[ln - 1];
      if (line === undefined) continue;
      const type = classifyLine(line);
      if (type === "image" || type === "table" || type === "list" || type === "blockquote") {
        hasVisual = true;
        break;
      }
      if (type === "heading") {
        const headingText = line.match(RE_HEADING)[2].trim();
        if (afterHeadingTargets.has(headingText)) {
          hasVisual = true;
          break;
        }
      }
    }

    if (!hasVisual) {
      violations.push({
        heading: h2.text,
        startLine: toAbsoluteLine(ctx.bodyStartLine, h2.line),
      });
    }
  });

  return {
    id: 8,
    name: "H2セクションごとの視覚要素",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
  };
}

// ---------------------------------------------------------------------------
// 項目9: 未変換の装飾記号
//
// lib/posts.jsのapplyInlineMarkupと同一の正規表現(2026-08-09修正版、
// ==/^^/%%を「2文字連続」の区切りとして扱う先読み方式)で正しくペアになった
// 装飾記法を除去したうえで、地の文に==/^^/%%が生記号のまま残っていないかを
// 判定する。残っている場合、対応する閉じ記号が見つからず変換に失敗し、
// 読者には記号がそのまま表示される(2026-08-09に実際に発生した不具合と
// 同種の問題)。
// ---------------------------------------------------------------------------

function checkItem9(ctx) {
  const fullText = ctx.bodyLines.join("\n");
  // Markdownリンクの出典URL(例: base64パディングの"=="を含むURL)を装飾記号の
  // 残骸と誤検知しないよう、リンク先URLは表示テキストへの変換時点で除く
  // ([text](url) → text。toDisplayTextと同じ扱い)。
  const linkStripped = fullText.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  const stripped = linkStripped
    .replace(/==((?:(?!==)[^\n])+?)==/g, "")
    .replace(/(?<!\+)\+\+(?!\+)([^\n]+?)(?<!\+)\+\+(?!\+)/g, "")
    .replace(/\^\^((?:(?!\^\^)[^\n])+?)\^\^/g, "")
    .replace(/%%((?:(?!%%)[^\n])+?)%%/g, "");
  const strippedLines = stripped.split("\n");

  const violations = [];
  strippedLines.forEach((line, idx) => {
    const symbols = [];
    if (line.includes("==")) symbols.push("==");
    // "++++"(3個以上連続の+)は装飾記法ではなく意図的な表記(PA++++等)として許容し、
    // 正しくペアになった"++"装飾が変換されずに残っている場合のみ検出する
    // (2026-08-12、PA++++表記の誤検知を避けるための調整)。
    if (/(?<!\+)\+\+(?!\+)/.test(line)) symbols.push("++");
    if (line.includes("^^")) symbols.push("^^");
    if (line.includes("%%")) symbols.push("%%");
    if (symbols.length > 0) {
      violations.push({
        line: toAbsoluteLine(ctx.bodyStartLine, idx + 1),
        symbols,
        text: (ctx.bodyLines[idx] || "").trim(),
      });
    }
  });

  return {
    id: 9,
    name: "未変換の装飾記号",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
  };
}

// ---------------------------------------------------------------------------
// frontmatter構造化コンテンツ(accordions/charts/checklists/conclusionCards/
// quickSummaryCard/summaryPoints/description)内のテキストを抽出する。
//
// 項目10・11・12・18・19はbodyLinesのみを検査対象にしていたため、accordionの
// content/summaryやchartのtext/pros/cons/items等に書かれた表現は機械検査を
// すり抜けていた(2026-08-12、PMS体重増加むくみ対策記事・肩こり首こり記事で、
// accordion内に明確なB5違反〔架空の一人称体験談〕が残っていたことが実地で
// 発覚したための恒久対応)。mascotComment(マスコット発言)はCONTRIBUTING.md
// 3節で明示的にB5対象外と定義されているため、この抽出対象に含めない。
// ---------------------------------------------------------------------------

function extractStructuredTextBlocks(fm) {
  const blocks = [];
  const push = (source, text, isHeadingLike) => {
    if (text === undefined || text === null) return;
    const s = String(text);
    if (!s.trim()) return;
    blocks.push({ source, text: s, isHeadingLike: !!isHeadingLike });
  };

  push("frontmatter.description", fm.description);
  push("frontmatter.disclaimer", fm.disclaimer);
  (Array.isArray(fm.summaryPoints) ? fm.summaryPoints : []).forEach((t, i) =>
    push(`frontmatter.summaryPoints[${i}]`, t)
  );
  (Array.isArray(fm.accordions) ? fm.accordions : []).forEach((a, i) => {
    push(`accordions[${i}].summary`, a.summary, true);
    push(`accordions[${i}].content`, a.content);
  });
  (Array.isArray(fm.charts) ? fm.charts : []).forEach((c, i) => {
    push(`charts[${i}].title`, c.title, true);
    push(`charts[${i}].text`, c.text);
    push(`charts[${i}].note`, c.note);
    (Array.isArray(c.pros) ? c.pros : []).forEach((t, j) => push(`charts[${i}].pros[${j}]`, t));
    (Array.isArray(c.cons) ? c.cons : []).forEach((t, j) => push(`charts[${i}].cons[${j}]`, t));
    (Array.isArray(c.items) ? c.items : []).forEach((it, j) => {
      if (typeof it === "string") {
        push(`charts[${i}].items[${j}]`, it);
      } else if (it && typeof it === "object") {
        push(`charts[${i}].items[${j}].step`, it.step);
        push(`charts[${i}].items[${j}].note`, it.note);
      }
    });
  });
  (Array.isArray(fm.checklists) ? fm.checklists : []).forEach((cl, i) => {
    push(`checklists[${i}].title`, cl.title, true);
    (Array.isArray(cl.items) ? cl.items : []).forEach((t, j) => push(`checklists[${i}].items[${j}]`, t));
    push(`checklists[${i}].note`, cl.note);
  });
  (Array.isArray(fm.conclusionCards) ? fm.conclusionCards : []).forEach((cc, i) => {
    (Array.isArray(cc.conclusions) ? cc.conclusions : []).forEach((t, j) =>
      push(`conclusionCards[${i}].conclusions[${j}]`, t)
    );
    push(`conclusionCards[${i}].nextStep`, cc.nextStep);
  });
  if (fm.quickSummaryCard) {
    (Array.isArray(fm.quickSummaryCard.conclusions) ? fm.quickSummaryCard.conclusions : []).forEach((t, j) =>
      push(`quickSummaryCard.conclusions[${j}]`, t)
    );
    (Array.isArray(fm.quickSummaryCard.targets) ? fm.quickSummaryCard.targets : []).forEach((t, j) =>
      push(`quickSummaryCard.targets[${j}]`, t)
    );
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// 項目10: B5違反表現(一人称・虚偽の実体験申告・架空の第三者/専門家証言)
// docs/CONTRIBUTING.md 3節に対応。
// ---------------------------------------------------------------------------

// 「私自身」は「私は/私が/私の」のいずれの助詞パターンにも一致しないため見落とされていた
// (2026-08-12、ファンデーション崩れタイプ別比較記事で実際にこのパターンのB5違反が
// 機械検出をすり抜けていたため追加)。
const RE_B5_FIRST_PERSON = /私自身|私(は|が|の)|筆者(は|が|の)/;
const RE_B5_FAKE_EXPERIENCE = /編集部で(試し|使っ|検証し)|実際に使ってみた|使ってみたところ|実体験に基づ|使用体験に基づ/;
// frontmatter(description/summaryPoints/accordion.summary/disclaimer等)で「体験談を交えて
// 解説します」のように体験の掲載を予告・約束する表現は、本文側のB5違反(一人称マーカー等)
// とは文型が異なるため上記の既存パターンに一致せず機械検査をすり抜けていた(2026-08-13、
// 16時間断食記事のdescriptionで実際に発覚)。「〜たい/〜たいという」で終わる読者の意向表現
// (例:「効果を実感したい」「試してみたい」)は体験の約束ではないため否定先読みで除外する。
const RE_B5_EXPERIENCE_PROMISE = /体験談を(交えて|踏まえ)|実体験を交えて|効果を(感じた|実感した)(?!い)|検証してみた(?!い)|試してみた(?!い)結果/;
const RE_B5_THIRD_PARTY = /友人(に|が|は)|知人(に|が|は)/;
// 「美容師さんに相談してみる」のような一般的な受診・相談の勧めは誤検知になるため対象外とし、
// 「美容師さんに〜と言われた/聞いた」「美容師さんによると」のような実在しない専門家発言の
// 引用パターンのみを検出する(2026-08-11、ヘアアイロン記事の誤検知を確認し修正)。
const RE_B5_FAKE_EXPERT = /美容師さん(に|が|は)[^。\n]{0,20}(言われ|聞いた|話して)|美容師さんによると|薬剤師さん(に|が|は)[^。\n]{0,20}(言われ|聞いた|話して)|薬剤師さんによると/;
const RE_B5_HEADING_EXPERIENCE = /してみた|した話/;

// 参考リンクの箇条書き(例: 「- [外部記事タイトル](URL)」)は、リンク先ページの
// タイトルをそのまま引用しているだけで自サイトの主張ではないため対象外とする
// (2026-08-11、毛穴ケア比較の出典リンク行での誤検知を確認し修正)。
const RE_REFERENCE_LINK_LINE = /^\s*[-*+]\s+\[[^\]]+\]\(https?:\/\/[^)]+\)\s*$/;

function checkItem10(ctx) {
  const violations = [];
  ctx.bodyLines.forEach((line, idx) => {
    if (RE_REFERENCE_LINK_LINE.test(line)) return;
    const type = classifyLine(line);
    const lineNo = toAbsoluteLine(ctx.bodyStartLine, idx + 1);
    const patterns = [
      { re: RE_B5_FIRST_PERSON, kind: "一人称マーカー" },
      { re: RE_B5_FAKE_EXPERIENCE, kind: "虚偽の実体験申告" },
      { re: RE_B5_EXPERIENCE_PROMISE, kind: "体験の予告・約束表現" },
      { re: RE_B5_THIRD_PARTY, kind: "架空の第三者証言" },
      { re: RE_B5_FAKE_EXPERT, kind: "架空の専門家証言" },
    ];
    for (const p of patterns) {
      if (p.re.test(line)) {
        violations.push({ line: lineNo, kind: p.kind, text: line.trim() });
      }
    }
    if (type === "heading" && RE_B5_HEADING_EXPERIENCE.test(line)) {
      violations.push({ line: lineNo, kind: "見出しの体験談風表現", text: line.trim() });
    }
  });

  const patterns = [
    { re: RE_B5_FIRST_PERSON, kind: "一人称マーカー" },
    { re: RE_B5_FAKE_EXPERIENCE, kind: "虚偽の実体験申告" },
    { re: RE_B5_THIRD_PARTY, kind: "架空の第三者証言" },
    { re: RE_B5_FAKE_EXPERT, kind: "架空の専門家証言" },
  ];
  extractStructuredTextBlocks(ctx.frontmatter).forEach((b) => {
    for (const p of patterns) {
      if (p.re.test(b.text)) {
        violations.push({ line: null, source: b.source, kind: p.kind, text: b.text.trim().slice(0, 200) });
      }
    }
    if (b.isHeadingLike && RE_B5_HEADING_EXPERIENCE.test(b.text)) {
      violations.push({ line: null, source: b.source, kind: "見出し相当の体験談風表現", text: b.text.trim() });
    }
  });

  return {
    id: 10,
    name: "B5違反表現(一人称・体験証言・虚偽の実体験申告)",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
  };
}

// ---------------------------------------------------------------------------
// 項目11: 出典紐付けのない伝聞表現
// docs/CONTRIBUTING.md 3節「出典で裏付けられた内容は、伝聞にせず言い切ること」に対応。
// 同一文中に丸括弧の出典表記(例:「(日本皮膚科学会 皮膚科Q&A)」)またはMarkdownリンクが
// あれば「出典紐付けあり」として許容し、なければ違反として検出する。
// ---------------------------------------------------------------------------

// 「と説明されています」「という考え方があります/背景にあります」は、誰による説明・考え方かを
// 明示しないまま出典を伴わずに主張を帰属させる婉曲的な伝聞表現であり、「と言われています」等と
// 同じ問題を持つ(2026-08-11、SPF・PA記事のテスト生成でreviewerが正規表現をすり抜ける変種として
// 検出したものを機械側に還元)。
const RE_HEARSAY = /と言われて|とされて|ようです|そうです|らしいです|との指摘|と説明されて|という考え方が(あります|背景にあります)/g;
const RE_HAS_CITATION_MARK = /[((][^))]*[))]|\[[^\]]+\]\([^)]*\)/;

function splitIntoSentences(text) {
  // 「。」で分割しつつ、区切り文字自体は前の文に残す(単純な日本語文分割)
  const parts = text.split(/(?<=。)/);
  return parts.filter((s) => s.trim().length > 0);
}

function checkItem11(ctx) {
  const violations = [];
  ctx.bodyLines.forEach((line, idx) => {
    const type = classifyLine(line);
    if (type === "heading") return; // 見出しは対象外
    const lineNo = toAbsoluteLine(ctx.bodyStartLine, idx + 1);
    const sentences = splitIntoSentences(line);
    for (const sentence of sentences) {
      RE_HEARSAY.lastIndex = 0;
      if (RE_HEARSAY.test(sentence) && !RE_HAS_CITATION_MARK.test(sentence)) {
        violations.push({ line: lineNo, text: sentence.trim() });
      }
    }
  });

  extractStructuredTextBlocks(ctx.frontmatter).forEach((b) => {
    const sentences = splitIntoSentences(b.text);
    for (const sentence of sentences) {
      RE_HEARSAY.lastIndex = 0;
      if (RE_HEARSAY.test(sentence) && !RE_HAS_CITATION_MARK.test(sentence)) {
        violations.push({ line: null, source: b.source, text: sentence.trim() });
      }
    }
  });

  return {
    id: 11,
    name: "出典紐付けのない伝聞表現",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
  };
}

// ---------------------------------------------------------------------------
// 項目12: 頻度断定・社会的証明表現(出典の有無に関わらず禁止)
// docs/CONTRIBUTING.md 3節「禁止パターンの明文化」に対応。
// ---------------------------------------------------------------------------

// 「よくある質問」「よく聞かれる質問」はFAQセクションの定型見出し・導入文であり、
// CONTRIBUTING.md 3節が禁止する「出典なき頻度・多数派の断定」とは別物のため除外する
// (2026-08-11、くせ毛タイプ別シャンプー比較でのテスト実行時に誤検知を確認し修正)。
// 「少なくなります/少なくなる」(減少する、の意)は「少なくない」(頻度断定)と
// 語幹が同じで誤検知しやすいため、「い」で終わる禁止形のみを対象にする
// (2026-08-11、脱毛サロン記事での誤検知を確認し修正)。
// 「〜人は多くありません/〜人がほとんどです」は、出典なく多数派・少数派を推測する
// 頻度断定の裏返し表現(2026-08-11、SPF・PA記事のテスト生成でreviewerが検出したものを
// 機械側に還元)。
const RE_FREQUENCY_ASSERTION = /珍しくない|珍しいことではあり|少なくない|よくある(?!質問)|よく聞かれ(?!る質問)|少なくありません|人は多くありません|人がほとんどです/;

function checkItem12(ctx) {
  const violations = [];
  ctx.bodyLines.forEach((line, idx) => {
    if (classifyLine(line) === "heading") return;
    if (RE_FREQUENCY_ASSERTION.test(line)) {
      violations.push({ line: toAbsoluteLine(ctx.bodyStartLine, idx + 1), text: line.trim() });
    }
  });

  extractStructuredTextBlocks(ctx.frontmatter).forEach((b) => {
    if (RE_FREQUENCY_ASSERTION.test(b.text)) {
      violations.push({ line: null, source: b.source, text: b.text.trim() });
    }
  });

  return {
    id: 12,
    name: "頻度断定・社会的証明表現",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
  };
}

// ---------------------------------------------------------------------------
// 項目13: アフィリエイトリンクの残存(全カット方針、CONTRIBUTING.md 2節-10)
// ---------------------------------------------------------------------------

const RE_AFFILIATE_DOMAIN = /a8\.net|valuecommerce\.com|moshimo\.com|af\.moshimo|rpx\.a8\.net|amzn\.to|linksynergy\.com|accesstrade\.net/;

function checkItem13(ctx) {
  const violations = [];
  const affiliateLinks = Array.isArray(ctx.frontmatter.affiliateLinks) ? ctx.frontmatter.affiliateLinks : [];
  if (affiliateLinks.length > 0) {
    violations.push({ source: "frontmatter.affiliateLinks", count: affiliateLinks.length });
  }
  ctx.bodyLines.forEach((line, idx) => {
    if (RE_AFFILIATE_DOMAIN.test(line)) {
      violations.push({ line: toAbsoluteLine(ctx.bodyStartLine, idx + 1), text: line.trim() });
    }
  });

  return {
    id: 13,
    name: "アフィリエイトリンクの残存",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
  };
}

// ---------------------------------------------------------------------------
// 項目14: 「まとめ」二重表示(H2見出し直後にブロック引用が続く構造)
// ---------------------------------------------------------------------------

function checkItem14(ctx) {
  const headings = extractHeadings(ctx.bodyLines);
  const violations = [];
  headings.forEach((h) => {
    if (h.level !== 2 || !h.text.includes("まとめ")) return;
    // 見出し直後、空行を挟んだ最初の非空行を見る
    let ln = h.line; // 1-indexed、見出し自体の行
    let next = null;
    for (let i = ln; i < ctx.bodyLines.length; i++) {
      const line = ctx.bodyLines[i];
      if (RE_BLANK.test(line)) continue;
      next = { line: i + 1, text: line };
      break;
    }
    if (next && classifyLine(next.text) === "blockquote") {
      violations.push({
        headingLine: toAbsoluteLine(ctx.bodyStartLine, h.line),
        heading: h.text,
        blockquoteLine: toAbsoluteLine(ctx.bodyStartLine, next.line),
        text: next.text.trim(),
      });
    }
  });

  return {
    id: 14,
    name: "「まとめ」二重表示",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
  };
}

// ---------------------------------------------------------------------------
// 項目15: quadrantチャートのnote/source欠落
// ---------------------------------------------------------------------------

function checkItem15(ctx) {
  const charts = Array.isArray(ctx.frontmatter.charts) ? ctx.frontmatter.charts : [];
  const violations = [];
  charts.forEach((c, i) => {
    if (c.type !== "quadrant") return;
    if (!c.note && !c.source) {
      violations.push({ chartIndex: i, title: c.title || "" });
    }
  });

  return {
    id: 15,
    name: "quadrantチャートのnote/source欠落",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
  };
}

// ---------------------------------------------------------------------------
// 項目16: frontmatter必須項目
// ---------------------------------------------------------------------------

function checkItem16(ctx) {
  const fm = ctx.frontmatter;
  const violations = [];
  ["title", "description", "category", "date"].forEach((key) => {
    if (!fm[key] || String(fm[key]).trim() === "") {
      violations.push({ field: key, issue: "空または未設定" });
    }
  });
  if (!Array.isArray(fm.summaryPoints) || fm.summaryPoints.length === 0) {
    violations.push({ field: "summaryPoints", issue: "空または未設定" });
  }
  // thumbnailは記事一覧カード・記事ページ上部・OGP画像に使われる確定稿の必須項目
  // (editor-in-chief.mdの確認項目と同期。2026-08-11、SPF・PA記事のテスト生成で
  // サムネイル未設定のまま検証をすり抜けた事例を受けて機械検査に追加)。
  if (!fm.thumbnail || String(fm.thumbnail).trim() === "") {
    violations.push({ field: "thumbnail", issue: "空または未設定" });
  }

  return {
    id: 16,
    name: "frontmatter必須項目",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
  };
}

// ---------------------------------------------------------------------------
// 項目17: sourcesのURL形式・editorial必須項目(docs/citation-format.md準拠)
// sourcesフィールド自体が存在しない記事は、既存記事の移行任意方針(citation-format.md
// 「既存記事との関係」節)によりこの項目では失格にしない(sourcesMissing:trueで報告のみ)。
// 新規記事(フェーズ6以降)ではsources必須のため、nevora-pipeline-verifier側で
// 「新規記事かどうか」を踏まえてsourcesMissingの扱いを判断すること。
// ---------------------------------------------------------------------------

function isShallowUrl(url) {
  try {
    const u = new URL(url);
    const isRootPath = u.pathname === "" || u.pathname === "/";
    // ルートパスでも、ページ内アンカー(#section等)が付与されている場合は
    // 単一ページ構成の公式ブランドサイト(例: oct.lion.co.jp)内の該当セクションを
    // 指している可能性があるため「浅い」扱いにしない(2026-08-12、
    // 頭皮かゆみフケシャンプー比較のオクト公式サイトで実際に該当するケースを確認)。
    if (isRootPath && u.hash && u.hash !== "#") return false;
    return isRootPath;
  } catch {
    return true; // URLとして解釈できない場合も浅い(不正)扱い
  }
}

function checkItem17(ctx) {
  const sources = ctx.frontmatter.sources;
  if (!Array.isArray(sources) || sources.length === 0) {
    return {
      id: 17,
      name: "sourcesのURL形式・editorial必須項目",
      result: "Yes",
      violations: [],
      sourcesMissing: true,
      note: "sourcesフィールドなし。既存記事は移行任意、新規記事(フェーズ6以降)は原則必須(呼び出し側で判断)。",
    };
  }

  const violations = [];
  sources.forEach((s, i) => {
    if (!s.label || String(s.label).trim() === "") {
      violations.push({ sourceIndex: i, issue: "labelが空" });
    }
    const type = s.type;
    if (!["primary", "secondary", "editorial"].includes(type)) {
      violations.push({ sourceIndex: i, issue: `typeが不正(${type})` });
      return;
    }
    if (type === "primary" || type === "secondary") {
      if (!s.url || String(s.url).trim() === "" || isShallowUrl(s.url)) {
        violations.push({ sourceIndex: i, issue: "urlが空またはトップページ相当(浅いURL)" });
      }
    }
    if (type === "editorial") {
      ["surveyN", "surveyMethod", "surveyDate"].forEach((key) => {
        if (!s[key] || String(s[key]).trim() === "") {
          violations.push({ sourceIndex: i, issue: `editorialだが${key}が空` });
        }
      });
    }
  });

  return {
    id: 17,
    name: "sourcesのURL形式・editorial必須項目",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
    sourcesMissing: false,
  };
}

// ---------------------------------------------------------------------------
// 項目18: 商品名の実在確認(完全自動化不可のため参考情報・非ブロッキング)
// docs/CONTRIBUTING.md 5節の検証義務はメーカー公式ページとの突合が必要で機械判定できないため、
// ここでは「価格・円等の数値と隣接するカタカナ商品名らしき語」を抽出し、
// 同じ段落内にsources/URLへの言及が見当たらないものを"要確認"候補として列挙するのみ。
// このスクリプトの他項目と異なり、resultはNo/Yesを返さず候補一覧のみ返す(ブロックしない)。
// ---------------------------------------------------------------------------

function checkItem18(ctx) {
  const candidates = [];
  const RE_PRICE_CONTEXT = /[ァ-ヶー]{3,}[^。\n]{0,15}円/;
  ctx.bodyLines.forEach((line, idx) => {
    if (classifyLine(line) === "heading") return;
    const m = line.match(RE_PRICE_CONTEXT);
    if (m) {
      candidates.push({ line: toAbsoluteLine(ctx.bodyStartLine, idx + 1), text: line.trim() });
    }
  });

  extractStructuredTextBlocks(ctx.frontmatter).forEach((b) => {
    if (RE_PRICE_CONTEXT.test(b.text)) {
      candidates.push({ line: null, source: b.source, text: b.text.trim().slice(0, 200) });
    }
  });

  return {
    id: 18,
    name: "商品名の実在確認(参考情報・非ブロッキング)",
    result: "N/A",
    candidates,
    note: "完全自動化不可。sources掲載済みURLと突合していない候補一覧のみ。人手でメーカー公式ページと照合すること。",
  };
}

// ---------------------------------------------------------------------------
// 項目19: 主語省略の一人称体験談(参考情報・非ブロッキング、要目視確認警告)
//
// 項目10は「私は/私が/編集部で試し」等、明示的な一人称マーカーのみを検出する。
// しかし「棚の前で30分近く迷って、結局その場では決められず、なんとなく安い方の
// クリームを買って帰りました」のように、主語(私・筆者)を省略したまま過去形の
// 行動描写が連続する日記調の文章は、正規表現による機械判定が原理的に困難
// (通常の物語調の説明文と区別がつかない)。そのため「警告」として候補を提示し、
// 最終判断は人間が行う(2026-08-12、ボディクリームとボディオイルの違い記事で
// 実際にこのパターンのB5違反〔項目10未検出〕が発覚したため新設)。
// ---------------------------------------------------------------------------

const RE_DIARY_VERB_ENDING = /(買って帰りました|買ってみました|試してみました|使ってみました|決められず|迷って|驚きました|感じました|わかったんです|んですね|買って帰った|でした[。]?$)/;

function checkItem19(ctx) {
  const candidates = [];
  ctx.bodyLines.forEach((line, idx) => {
    const type = classifyLine(line);
    if (type === "heading") return;
    if (RE_REFERENCE_LINK_LINE.test(line)) return;
    if (RE_DIARY_VERB_ENDING.test(line)) {
      candidates.push({ line: toAbsoluteLine(ctx.bodyStartLine, idx + 1), text: line.trim() });
    }
  });

  extractStructuredTextBlocks(ctx.frontmatter).forEach((b) => {
    if (RE_DIARY_VERB_ENDING.test(b.text)) {
      candidates.push({ line: null, source: b.source, text: b.text.trim().slice(0, 200) });
    }
  });

  return {
    id: 19,
    name: "主語省略の一人称体験談(参考情報・非ブロッキング・要目視確認)",
    result: "N/A",
    candidates,
    note: "正規表現では一人称マーカーの有無まで判定できないため警告のみ。該当箇所は目視で主語省略の体験談になっていないか確認すること。",
  };
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 台帳整合性チェック(--audit-updated-dateモード、2026-08-11追加)
//
// frontmatterにupdatedDateが設定されているのに、B5違反表現(項目10)・
// 出典紐付けのない伝聞表現(項目11)・頻度断定表現(項目12)のいずれかが
// 残っている記事は、「実質修正を経ずにupdatedDateだけが付与された」
// 台帳の矛盾である可能性が高い(2026-08-11、39記事の一括付与で3件の
// 混入が発覚した事例に基づく恒久チェック機能)。
//
// 使い方: node scripts/verify-article.js --audit-updated-date <ディレクトリ1> [<ディレクトリ2> ...]
// ---------------------------------------------------------------------------

function runAuditUpdatedDate(dirs) {
  const results = [];
  for (const dir of dirs) {
    const resolved = path.resolve(dir);
    if (!fs.existsSync(resolved)) continue;
    const files = fs.readdirSync(resolved).filter((f) => f.endsWith(".md"));
    for (const f of files) {
      const filePath = path.join(resolved, f);
      const ctx = loadArticle(filePath);
      if (!ctx.frontmatter.updatedDate) continue;
      const it10 = checkItem10(ctx);
      const it11 = checkItem11(ctx);
      const it12 = checkItem12(ctx);
      const hasViolation = [it10, it11, it12].some((it) => it.result === "No");
      if (hasViolation) {
        results.push({
          file: path.relative(process.cwd(), filePath),
          updatedDate: ctx.frontmatter.updatedDate,
          b5Violations: it10.violations.length,
          hearsayViolations: it11.violations.length,
          frequencyViolations: it12.violations.length,
        });
      }
    }
  }
  console.log(
    JSON.stringify(
      {
        mode: "audit-updated-date",
        inconsistentCount: results.length,
        inconsistentFiles: results,
        note:
          "updatedDateが設定されているのにB5/伝聞/頻度断定の違反が残っている記事一覧。" +
          "実質修正を経ずにupdatedDateだけが付与された疑いがある(docs/CONTRIBUTING.md 8節参照)。",
      },
      null,
      2
    )
  );
}

// ---------------------------------------------------------------------------
// 項目20: チャート数値と本文/summaryPoints/description内の近傍数値の整合性
// (参考情報・非ブロッキング、要目視確認警告)
//
// 2026-08-12、「肌のターンオーバーの仕組みと周期」記事で、charts[].dataの
// 年代別日数を28/40/50/75の4区分に修正したにもかかわらず、本文の箇条書き・
// まとめ・summaryPoints・descriptionには旧来の3区分(「30〜40代:約45日」)が
// 残ったまま食い違っていた事例が本番確認で発覚(PA++++バグと同種の
// 「機械検査通過後に実物で見つかる」再発パターン)。数値を1箇所修正しても
// 記事内の他の重複箇所を見落とすリスクが構造的にあるため、chartsのdata値と
// 単位が一致する本文中の数値を突き合わせ、chartsに存在しない近傍値(=修正漏れの
// 可能性が高い、丸め・平均化された古い値)を警告として検出する。
// 完全な意味理解はできないため、あくまで人間の目視確認を促す非ブロッキングの
// 参考情報とする。
// ---------------------------------------------------------------------------

function extractChartNumericSets(fm) {
  // unit(例: "日") ごとに、chartsのdata配列から実際に使われている数値の集合を作る
  const byUnit = new Map();
  (Array.isArray(fm.charts) ? fm.charts : []).forEach((c) => {
    if (!Array.isArray(c.data) || !c.unit) return;
    const unit = String(c.unit);
    if (!byUnit.has(unit)) byUnit.set(unit, new Set());
    c.data.forEach((d) => {
      const v = Number(d && d.value);
      if (Number.isFinite(v)) byUnit.get(unit).add(v);
    });
  });
  return byUnit;
}

function checkItem20(ctx) {
  const candidates = [];
  const byUnit = extractChartNumericSets(ctx.frontmatter);
  if (byUnit.size === 0) {
    return {
      id: 20,
      name: "チャート数値と本文中の近傍数値の整合性(参考情報・非ブロッキング・要目視確認)",
      result: "N/A",
      candidates,
      note: "data配列を持つchartsがないため対象外。",
    };
  }

  const textSources = [
    { source: "body", text: ctx.bodyLines.join("\n") },
    ...extractStructuredTextBlocks(ctx.frontmatter)
      .filter((b) => b.source.startsWith("frontmatter.description") || b.source.startsWith("frontmatter.summaryPoints"))
      .map((b) => ({ source: b.source, text: b.text })),
  ];

  for (const [unit, values] of byUnit.entries()) {
    if (values.size < 2) continue; // 比較対象が1点のみなら近傍値の判定ができない
    const min = Math.min(...values);
    const max = Math.max(...values);
    const escapedUnit = unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${escapedUnit}`, "g");
    textSources.forEach(({ source, text }) => {
      let m;
      while ((m = re.exec(text))) {
        const n = Number(m[1]);
        if (values.has(n)) continue; // chartの実値と完全一致なら問題なし
        if (n >= min && n <= max) {
          // chartの値の範囲内にあるのにどの値とも一致しない
          // → 古い区分の平均値等、修正漏れの可能性がある近傍値として警告
          candidates.push({
            source,
            unit,
            value: n,
            chartValues: Array.from(values).sort((a, b) => a - b),
            text: m[0],
          });
        }
      }
    });
  }

  return {
    id: 20,
    name: "チャート数値と本文中の近傍数値の整合性(参考情報・非ブロッキング・要目視確認)",
    result: "N/A",
    candidates,
    note:
      "chartsのdata値と単位が一致する本文中の数値のうち、chartの値の範囲内にありながらどの値とも一致しないものを警告として列挙する。" +
      "数値を修正した際、記事内の他の重複箇所(本文・summaryPoints・description・まとめ等)の修正漏れがないか目視で確認すること。",
  };
}

// ---------------------------------------------------------------------------
// 項目21: タイトル約束語の実体照合(ブロッキング)
//
// 「〇〇の仕組みを図解でやさしく解説」のようにタイトルが視覚要素・出典の
// 存在を約束しているのに、実体が存在しない(または実装バグでレンダリングされない)
// まま公開されるケースを機械的に検出する(2026-08-13、白髪ぼかしハイライト記事で
// quadrantチャートのdata配列をitemsという誤ったキー名で書いてしまい、
// 「図解で解説」というタイトルの約束に反して図解が非表示のまま公開・パイプライン
// 全工程を通過していたことが発覚したため新設)。
// ---------------------------------------------------------------------------

const DIAGRAM_CHART_TYPES = new Set(["quadrant", "facemap", "linechart", "steps"]);

function checkItem21(ctx) {
  const title = String(ctx.frontmatter.title || "");
  const charts = Array.isArray(ctx.frontmatter.charts) ? ctx.frontmatter.charts : [];
  const violations = [];

  const hasRenderableDiagram = charts.some((c) => {
    if (!DIAGRAM_CHART_TYPES.has(c.type)) return false;
    if (c.type === "facemap") return true; // facemapは固定座標のためdata必須ではない
    return Array.isArray(c.data) && c.data.length > 0;
  });
  const hasRenderableGraph = charts.some((c) => {
    // typeなし(棒グラフ)・donutもグラフ扱い。data配列が実際に存在することを必須とする
    if (c.type && !["quadrant", "facemap", "linechart", "steps", "donut"].includes(c.type) && c.type !== undefined) {
      // prosCons/checklist/tip等は「グラフ」の約束を満たさない
    }
    const isGraphType = !c.type || ["donut", "quadrant", "facemap", "linechart", "steps"].includes(c.type);
    return isGraphType && Array.isArray(c.data) && c.data.length > 0;
  });
  const hasChecklistChart =
    charts.some((c) => c.type === "checklist" && Array.isArray(c.items) && c.items.length > 0) ||
    ctx.bodyLines.some((l) => /^\s*-\s*\[ \]/.test(l));
  const hasMarkdownTable = ctx.bodyLines.some((l) => /^\s*\|.*\|\s*$/.test(l));

  if (/図解/.test(title) && !hasRenderableDiagram) {
    violations.push({
      word: "図解",
      reason:
        "quadrant/facemap/linechart/steps型のchartで、実際にdata配列(1件以上)を持つものが見つからない(フィールド名の誤りでdataが空になっていないか確認)",
    });
  }
  if (/グラフ/.test(title) && !hasRenderableGraph) {
    violations.push({ word: "グラフ", reason: "data配列(1件以上)を持つグラフ系chartが見つからない" });
  }
  if (/チェックリスト/.test(title) && !hasChecklistChart) {
    violations.push({ word: "チェックリスト", reason: "checklist型chartまたは本文中の`- [ ]`が見つからない" });
  }
  if (/(表で|一覧表)/.test(title) && !hasMarkdownTable && !hasRenderableDiagram) {
    violations.push({ word: "表", reason: "本文中にMarkdownテーブルが見つからない" });
  }

  return {
    id: 21,
    name: "タイトル約束語と実体の一致",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
  };
}

// ---------------------------------------------------------------------------
// 項目22: 検証済み出典(要人手確認でないもの)が最低1件あるか(ブロッキング)
//
// sourcesが全件「(要人手確認)」付きのまま公開されると、出典の内容が
// 誰にも一次確認されていない状態で読者に提示されることになる。
// 公開ゲートの条件として、type: primaryかつラベルに「要人手確認」を
// 含まない出典が最低1件あることを機械的に要求する
// (2026-08-13、白髪ぼかしハイライト記事の5件全出典が要人手確認のまま
// 公開されていたことが発覚したため新設)。
// ---------------------------------------------------------------------------

function checkItem22(ctx) {
  const sources = Array.isArray(ctx.frontmatter.sources) ? ctx.frontmatter.sources : [];
  if (sources.length === 0) {
    return {
      id: 22,
      name: "検証済み出典(要人手確認でないもの)1件以上",
      result: "N/A",
      note: "sourcesフィールド自体を持たない記事(旧形式の出典一覧セクションのみ)は対象外。",
    };
  }
  const verifiedCount = sources.filter(
    (s) => !/要人手確認/.test(String(s.label || ""))
  ).length;
  return {
    id: 22,
    name: "検証済み出典(要人手確認でないもの)1件以上",
    result: verifiedCount >= 1 ? "Yes" : "No",
    verifiedCount,
    totalCount: sources.length,
  };
}

// ---------------------------------------------------------------------------
// 項目23〜25: 可読性・視覚品質基準(2026-08-13、ビジョン4の検査可能化)
//
// 新規5記事のうち3記事(前髪/家庭用美顔器/白髪ぼかしハイライト)が
// 「1見出しに文字が詰まり、文章が長く、読者が離脱する」水準とユーザー評価で
// 判定されたことを受けて追加。項目7(連続200字ルール)・項目8(H2ごと視覚要素
// 1つ以上)は「視覚要素が皆無」は防げるが、(1)小さな視覚要素を刻みで挟みつつ
// 文章量そのものは多い、(2)視覚要素はあるが表・注意ボックスだけで質が低い、
// という2つの抜け道を検出できないため、これを補う3項目を追加する。
// ---------------------------------------------------------------------------

const CONTINUOUS_TEXT_MAX_CHARS = 300; // 2026-08-13、400字でも詰まりが体感で解消されないとの実機判定によりユーザー指示で300字へ再改訂

// lib/posts.jsのEND_OF_SECTION_CHART_TYPES(embedChartsでセクション末尾に描画する
// chart type)と同じ値を、verify-article.js側でも保持する(このスクリプトは
// lib/posts.jsをimportしない設計〔frontmatter/Markdownのみの高速静的検査〕のため、
// 値は手動で同期する。値を変更する場合は両ファイルを同時に更新すること)。
const END_OF_SECTION_CHART_TYPES_VERIFY = new Set(["tip", "skincareTip"]);
const CONSECUTIVE_PARAGRAPH_MAX = 3;

// 視覚要素の質分類(2026-08-13再定義版)。
// 「図」の定義(2026-08-13ユーザー確定): 概念・仕組み・変化を、イラスト+文字の説明の
// セットで見せるもの。steps型・checklist型・番号付きリストは「テキストの整形」であり、
// 図ではない(「間」対応の第一弾がsteps/checklistの追加にとどまり、ユーザー実機確認で
// 不合格と判定されたため、item24のHIGH判定からsteps・checklistのタイトル救済〔旧
// CHECKLIST_UPGRADE_PATTERN〕を撤回した)。
// HIGH: イラスト+文字説明が一体化した図解(crossSection/depthComparison/processContrast)、
//       および空間的な位置づけを視覚エンコードする実チャート(quadrant/faceMap/lineChart)
// NEUTRAL: 数値の視覚化・自己診断ツールとして機能し得るが「イラストで説明する図」とは
//          言い切れないもの。「低評価要素のみ」の判定からは除外するが、HIGH要件の
//          カウントにも含めない。flowchart/diagnosisは対話的なテキストUIであり
//          イラストを伴わないためneutralに分類(2026-08-13、図の定義再修正に伴い
//          high→neutralへ変更)
// LOW: 単純な表・ポイントボックス・注意ボックス・steps・checklistのみで、
//      文章の代替(テキストの整形)にしかなっていないもの
// レガシー記事専用type(HIGH_VALUE_NAME_PATTERNの命名規則に合致しないもの)は、
// 個別にrendererソース(lib/*Widgets.js)を確認し、実際に多要素・ラベル付きの
// SVG図解を描画すると確認できたものだけをここへ個別追加する(2026-08-14)。
// skincareDiagnosisMatrix/skincareAmountDiagram(lib/skincareBasicsWidgets.js)・
// pyramid(lib/perfectSkinWidgets.js)・skinLayerDiagram/barrierDiagram(乾燥肌の
// 角質層比較)/dryCycleLoop(乾燥スパイラル図、いずれもlib/hyaluWidgets.js・
// lib/drySkinWidgets.js)は、ソースを直接確認し多要素SVG図解であることを確認済み。
// 2026-08-14、レガシー型56種を全量精読した第2弾で以下3種を追加確認:
// azelaicMechanism(lib/azelaicAcidWidgets.js、15要素の機序図)・
// skincareRoleDiagram(lib/skincareBasicsWidgets.js、化粧水/美容液/乳液の
// 3層役割図)・mkskorderCompatMatrix(lib/makeupSkincareOrderWidgets.js、
// 水性×油性の2×2相性マトリクス、quadrant相当の構造)。
// 残り約27種(tempDial・needleScale・poreTextureDial等のゲージ/アイコン系、
// azelaicTimeline・calendarBand・makeupTimeline等のタイムライン/カーブ系)は
// SVGはあるが「概念・仕組み・変化をイラスト+文字で見せる図」に該当するか
// 判断が割れるため、今回はHIGH化を保留し「要実機確認」として
// docs/project-state.md 18節に一覧を記録している。
const HIGH_VALUE_CHART_TYPES = new Set([
  "quadrant",
  "faceMap",
  "lineChart",
  "crossSection",
  "depthComparison",
  "processContrast",
  "skincareDiagnosisMatrix",
  "skincareAmountDiagram",
  "pyramid",
  "skinLayerDiagram",
  "barrierDiagram",
  "dryCycleLoop",
  "azelaicMechanism",
  "skincareRoleDiagram",
  "mkskorderCompatMatrix",
]);
const HIGH_VALUE_NAME_PATTERN = /CrossSection|DiagnosisFlow|Silhouette|FlowDiagram/i;
const NEUTRAL_CHART_TYPES = new Set(["stat", "compareCards", "compareScroll", "pie", "donut", "flowchart", "diagnosis"]);
const LOW_CHART_TYPES = new Set(["prosCons", "tip", "warning", "memo", "summaryCard", "checklist", "steps"]);

function classifyChartValue(chart) {
  const type = chart.type; // undefined = 棒グラフ(bar)
  if (!type || type === "bar") return "low";
  if (HIGH_VALUE_CHART_TYPES.has(type)) return "high";
  if (LOW_CHART_TYPES.has(type)) return "low";
  if (NEUTRAL_CHART_TYPES.has(type)) return "neutral";
  if (HIGH_VALUE_NAME_PATTERN.test(type)) return "high";
  return "neutral"; // 未分類の記事固有図解型は誤って「低」に倒さないよう中立扱い
}

// ---------------------------------------------------------------------------
// 項目23: 400字ルール(ブロッキング、2026-08-13再改訂・リセット条件厳格化)
//
// 旧実装は「H2/H3見出しをまたぐと自動的にリセットする」設計だったため、
// 家庭用美顔器記事のEMS/RF/イオン導入/超音波という4連続H3(見出し自体には
// 図解が紐づいていない)が、個々のH3内ではそれぞれ400字未満(329/224/351/295字)
// に収まり、合計1,199字の壁が検出をすり抜けた。また「リストがあればリセットする」
// 設計だったため、白髪ぼかしハイライト記事で箇条書き(2項目のみの短いリスト)を
// 挟んだだけで壁が「解消」扱いになり、実際には385字の壁が残ったまま合格していた。
//
// ユーザー実機確認により、リセット条件を以下の4種のみに厳格化する
// (2026-08-13再改訂)。
// リセットする: 画像・チャート/アコーディオン(見出しに紐づくもの)・表・
//               コールアウトボックス(blockquote)
// リセットしない: 見出し自体(図解等が紐づいていない場合。ただの太字テキストで
//                視覚的休憩にならないため)・箇条書き(テキストの整形であり、
//                項目の文字も地の文としてカウントに含める)・区切り線(hr。
//                視覚的な間として弱く、「まとめ」直前の壁分割に使えないと
//                実機で判明したため2026-08-13にリセット対象から除外。
//                CONTRIBUTING.md 25節(a)(e)参照。この除外は§25(e)追記時に
//                文書化されたのみでコード反映が漏れていたため、300字改訂と
//                同時に修正した)
// この結果、runChars(連続文字数)は見出しをまたいで持ち越されることがある
// (見出しに図解・アコーディオンが紐づいていない場合)。
// ---------------------------------------------------------------------------

// Markdownリンク記法 [表示テキスト](URL) のうち、URL・角括弧・丸括弧を
// カウント対象から除外し、表示テキストのみを地の文としてカウントする
// (2026-08-15、L1決裁)。内部リンクのスラッグ(日本語含む)がそのまま
// カウントされ、300字ルール違反の一因になっていたため修正した。
function stripMarkdownLinkSyntax(line) {
  return line.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

function checkItem23(ctx) {
  const charts = Array.isArray(ctx.frontmatter.charts) ? ctx.frontmatter.charts : [];
  const accordions = Array.isArray(ctx.frontmatter.accordions) ? ctx.frontmatter.accordions : [];

  // 見出しごとの「先頭位置でリセットする要素」と「セクション末尾でのみリセットする
  // 要素」を分ける(2026-08-17、embedChartsのtip/skincareTip型セクション末尾
  // 描画化に伴う修正)。従来は「見出しにchart/accordionが1つでも紐づいていれば
  // 見出し直後でリセット」という、charts/accordionsは常に見出し先頭に挿入される
  // という旧仕様を前提にしたモデルだった。tip/skincareTip型は`lib/posts.js`の
  // `embedCharts`修正によりセクション末尾描画に変わったため、その見出しの
  // リセットが「見出し直後」ではなく「次の見出しの直前(=セクション末尾)」に
  // 実際には発生するよう、判定側もモデルを合わせる。見出しに他の(先頭位置の)
  // chart/accordionが1つでもあれば、従来通り見出し直後でリセットする(実際に
  // 先頭にも視覚要素が描画されるため)。
  const topResetHeadingSet = new Set();
  const endOnlyResetHeadingSet = new Set();
  [...charts, ...accordions].forEach((x) => {
    const h = (x.afterHeading || "").trim();
    if (!h) return;
    const isEndOfSectionChart = Array.isArray(charts) && charts.includes(x) && END_OF_SECTION_CHART_TYPES_VERIFY.has(x.type);
    if (isEndOfSectionChart) {
      endOnlyResetHeadingSet.add(h);
    } else {
      topResetHeadingSet.add(h);
    }
  });
  // 同じ見出しに先頭位置の要素も1つでもあれば、そちらを優先する(先頭リセットで十分)
  endOnlyResetHeadingSet.forEach((h) => {
    if (topResetHeadingSet.has(h)) endOnlyResetHeadingSet.delete(h);
  });

  const violations = [];
  let runChars = 0;
  let runStartLine = null;
  let runStartHeading = null;
  let flaggedForCurrentRun = false;
  let currentHeadingText = null;
  let pendingEndOfSectionReset = false;

  function reset() {
    runChars = 0;
    runStartLine = null;
    runStartHeading = null;
    flaggedForCurrentRun = false;
  }

  ctx.bodyLines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const type = classifyLine(line);

    if (type === "heading") {
      const m = line.match(RE_HEADING);
      const level = m ? m[1].length : 0;
      const headingText = m ? m[2].trim() : "";
      // 直前セクションがセクション末尾リセット対象だった場合、そのリセットは
      // 「次の見出しの直前」で実際に発生するため、次の見出しに入る直前(=ここ)で反映する
      if (pendingEndOfSectionReset) {
        reset();
        pendingEndOfSectionReset = false;
      }
      if (level === 2 || level === 3) currentHeadingText = headingText;
      if (topResetHeadingSet.has(headingText)) reset(); // 図解・アコーディオンが紐づく見出しのみリセット
      if (endOnlyResetHeadingSet.has(headingText)) pendingEndOfSectionReset = true;
      return;
    }
    if (type === "image" || type === "table" || type === "blockquote") {
      reset();
      return;
    }
    if (type === "blank" || type === "hr") return;

    // type === "text" または "list"(箇条書きも地の文としてカウントする)
    if (runStartLine === null) {
      runStartLine = lineNo;
      runStartHeading = currentHeadingText;
    }
    runChars += zenkakuLength(stripMarkdownLinkSyntax(line));
    if (runChars >= CONTINUOUS_TEXT_MAX_CHARS && !flaggedForCurrentRun) {
      violations.push({
        heading: runStartHeading,
        endHeading: currentHeadingText,
        startLine: toAbsoluteLine(ctx.bodyStartLine, runStartLine),
        endLine: toAbsoluteLine(ctx.bodyStartLine, lineNo),
        charCount: Math.round(runChars * 10) / 10,
      });
      flaggedForCurrentRun = true;
    }
  });

  return {
    id: 23,
    name: "地の文の連続文字数(400字ルール)",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
    note: `画像・チャート(図解含む)/アコーディオン・表・コールアウトボックスのいずれにも当たらないまま、地の文(箇条書き含む)が${CONTINUOUS_TEXT_MAX_CHARS}字以上連続する箇所を検出する。見出し自体(図解等が紐づいていない場合)・箇条書き自体・区切り線(hr)はリセット条件に含めない。Markdownリンク[表示テキスト](URL)はURL・角括弧・丸括弧を除いた表示テキストのみをカウントする(2026-08-15、L1決裁)。解消手段は説明内容の図解化を優先する(docs/CONTRIBUTING.md 24〜25節参照)。`,
  };
}

function checkItem24(ctx) {
  const charts = Array.isArray(ctx.frontmatter.charts) ? ctx.frontmatter.charts : [];
  const classified = charts.map((c, i) => ({
    index: i,
    type: c.type || "(bar)",
    afterHeading: c.afterHeading,
    value: classifyChartValue(c),
  }));
  const hasHigh = classified.some((c) => c.value === "high");
  return {
    id: 24,
    name: "視覚要素の質スコア(記事全体でHIGH型1つ以上)",
    result: hasHigh ? "Yes" : "No",
    charts: classified,
  };
}

function checkItem25(ctx) {
  const candidates = [];
  let paragraphCount = 0;
  let inParagraph = false;
  let startLine = null;
  let lastTextLine = null;

  function flush(endAbsLine) {
    if (paragraphCount >= CONSECUTIVE_PARAGRAPH_MAX) {
      candidates.push({
        startLine: toAbsoluteLine(ctx.bodyStartLine, startLine),
        endLine: endAbsLine,
        paragraphCount,
      });
    }
    paragraphCount = 0;
    inParagraph = false;
    startLine = null;
  }

  ctx.bodyLines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const type = classifyLine(line);
    if (type === "text") {
      if (!inParagraph) {
        paragraphCount += 1;
        if (paragraphCount === 1) startLine = lineNo;
        inParagraph = true;
      }
      lastTextLine = lineNo;
    } else if (type === "blank") {
      inParagraph = false;
    } else {
      flush(toAbsoluteLine(ctx.bodyStartLine, lastTextLine || lineNo));
    }
  });
  flush(toAbsoluteLine(ctx.bodyStartLine, lastTextLine || ctx.bodyLines.length));

  return {
    id: 25,
    name: "連続段落数の上限(参考情報・非ブロッキング・要目視確認)",
    result: "N/A",
    candidates,
    note: `視覚要素(画像・表・チャート・アコーディオン・区切り線)を挟まず段落が${CONSECUTIVE_PARAGRAPH_MAX}個以上連続する箇所を候補として提示する。`,
  };
}

// ---------------------------------------------------------------------------
// 項目26: 図表への虚偽参照の検出(ブロッキング、2026-08-13新設)
//
// 「詳しくは上の図をご覧ください」のように本文が図・図表の存在を参照していながら、
// 実際にはその見出しセクションに図(HIGH型chartまたは画像)が存在しない虚偽参照を
// 機械的に検出する。白髪ぼかしハイライト記事・前髪記事で、steps型を「上の図」と
// 参照する虚偽記述が2件発生していたことが発端(2026-08-13)。
//
// 判定方法: 参照語(上の図/下の図/上記の図表 等)が出現する行の直前の見出し
// (H2/H3)を特定し、そのafterHeadingに紐づくchartsのうちHIGH型(図として
// 承認された型: quadrant/faceMap/lineChart/crossSection/depthComparison/
// processContrast)が1つ以上あるか、同一見出しセクション内に画像行が1つ以上
// あるかを確認する。どちらも無ければ虚偽参照として指摘する。
// ---------------------------------------------------------------------------

const RE_FIGURE_REFERENCE = /(上記?|下記?|次)の?(図解?|図表)/;

function checkItem26(ctx) {
  const violations = [];
  const headings = extractHeadings(ctx.bodyLines);
  const charts = Array.isArray(ctx.frontmatter.charts) ? ctx.frontmatter.charts : [];

  ctx.bodyLines.forEach((line, idx) => {
    if (classifyLine(line) === "heading") return;
    const m = line.match(RE_FIGURE_REFERENCE);
    if (!m) return;

    const lineNo = idx + 1;
    // 直前の見出し(H2/H3)を特定する
    let currentHeading = null;
    for (let i = headings.length - 1; i >= 0; i--) {
      if (headings[i].line < lineNo) {
        currentHeading = headings[i];
        break;
      }
    }
    if (!currentHeading) {
      violations.push({
        line: toAbsoluteLine(ctx.bodyStartLine, lineNo),
        text: line.trim(),
        reason: "参照語より前に見出しが存在しない",
      });
      return;
    }

    const sectionCharts = charts.filter(
      (c) => c.afterHeading && String(c.afterHeading).trim() === currentHeading.text
    );
    const hasHighChart = sectionCharts.some((c) => classifyChartValue(c) === "high");

    // 同一見出しセクション内(次のH2/H3見出しの手前まで)に画像行があるか確認する
    const sectionEnd = (() => {
      const idxInHeadings = headings.findIndex((h) => h === currentHeading);
      for (let i = idxInHeadings + 1; i < headings.length; i++) {
        if (headings[i].level <= currentHeading.level) return headings[i].line;
      }
      return ctx.bodyLines.length;
    })();
    let hasImage = false;
    for (let ln = currentHeading.line + 1; ln <= sectionEnd; ln++) {
      const l = ctx.bodyLines[ln - 1];
      if (l !== undefined && classifyLine(l) === "image") {
        hasImage = true;
        break;
      }
    }

    if (!hasHighChart && !hasImage) {
      violations.push({
        line: toAbsoluteLine(ctx.bodyStartLine, lineNo),
        text: line.trim(),
        heading: currentHeading.text,
        reason: "参照先の見出しセクションにHIGH型chart(図)・画像のいずれも存在しない",
      });
    }
  });

  return {
    id: 26,
    name: "図表への虚偽参照の検出",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
  };
}

// ---------------------------------------------------------------------------
// 項目27: 視覚要素の連続配置(団子)の検出(ブロッキング、2026-08-13再改訂)
//
// 初版は「HIGH型chart→写真」のみを検出する設計だったため、白髪ぼかし
// ハイライト記事で同一見出しにprocessContrast(HIGH)とquadrant(HIGH)の
// 2つのchartが本文を挟まず連続配置されるパターン(chart→chart)を検出できず、
// ユーザー実機確認で見逃しが発覚した。ユーザー判定により、視覚要素の種類を
// 問わず、本文(text型の地の文)を挟まない視覚要素の連続配置をすべて検出する
// ようスコープを拡張した。
//
// 【最終仕様(2026-08-13再改訂)】視覚要素の連続配置そのものは禁止しない。
// 連続していても、対の関係・補完関係にあり読者に違和感なく流れるなら問題ない。
// 問題になるのは「脈絡のない連続」による違和感のみであり、これは機械では
// 判定できない。そのためitem27は**非ブロッキングの候補提示**とし、
// 良し悪しの判定はeditor-in-chiefの目視項目(判定基準:「対・補完の関係として
// 自然に流れるか、脈絡がなく違和感があるか」)→最終的にユーザーが判定する
// (`docs/CONTRIBUTING.md` 25節(e)参照)。個数制限(FAQ等)も設けない。
//
// 「視覚要素」の定義: 見出しに紐づくchart・accordion(1見出しに複数あれば
// それぞれ1つとして数える)/画像/表(連続する表行は1ブロック)/
// コールアウトボックス(blockquote、連続する引用行は1ブロック)。
// 箇条書き(list)は「本文」側として扱い、視覚要素の連続を断ち切る
// (item23の地の文カウントには含めるが、item27の連続判定上は文章の一種として扱う)。
// ---------------------------------------------------------------------------

function checkItem27(ctx) {
  const violations = [];
  const charts = Array.isArray(ctx.frontmatter.charts) ? ctx.frontmatter.charts : [];
  const accordions = Array.isArray(ctx.frontmatter.accordions) ? ctx.frontmatter.accordions : [];

  const tokens = []; // {visual: boolean, kind, line}

  ctx.bodyLines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const type = classifyLine(line);
    const prevType = idx > 0 ? classifyLine(ctx.bodyLines[idx - 1]) : null;

    if (type === "heading") {
      const m = line.match(RE_HEADING);
      const headingText = m ? m[2].trim() : "";
      charts
        .filter((c) => c.afterHeading && String(c.afterHeading).trim() === headingText)
        .forEach((c) => {
          tokens.push({ visual: true, kind: `chart:${c.type || "(bar)"}`, line: lineNo });
        });
      accordions
        .filter((a) => a.afterHeading && String(a.afterHeading).trim() === headingText)
        .forEach(() => {
          tokens.push({ visual: true, kind: "accordion", line: lineNo });
        });
      return;
    }
    if (type === "image") {
      tokens.push({ visual: true, kind: "image", line: lineNo });
      return;
    }
    if (type === "table") {
      if (prevType !== "table") tokens.push({ visual: true, kind: "table", line: lineNo });
      return;
    }
    if (type === "blockquote") {
      if (prevType !== "blockquote") tokens.push({ visual: true, kind: "callout", line: lineNo });
      return;
    }
    if (type === "text" || type === "list") {
      tokens.push({ visual: false, kind: type, line: lineNo });
      return;
    }
    // blank/hr はどちらの側にも属さないため、トークン化しない(前後の隣接判定に影響させない)
  });

  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i].visual && tokens[i - 1].visual) {
      violations.push({
        first: { kind: tokens[i - 1].kind, line: toAbsoluteLine(ctx.bodyStartLine, tokens[i - 1].line) },
        second: { kind: tokens[i].kind, line: toAbsoluteLine(ctx.bodyStartLine, tokens[i].line) },
      });
    }
  }

  return {
    id: 27,
    name: "視覚要素の連続配置(参考情報・非ブロッキング・要目視確認)",
    result: "N/A",
    candidates: violations,
    note: "本文(地の文)を挟まず視覚要素(chart/accordion/画像/表/コールアウトボックス)が連続する箇所を候補として提示する。連続配置そのものは禁止しない(対・補完の関係で自然に流れるなら問題ない)。違和感の有無はeditor-in-chiefが一次判定し、最終判断はユーザーが行う(docs/CONTRIBUTING.md 25節(e)参照)。",
  };
}

// ---------------------------------------------------------------------------
// 項目28: charts配列への誤ったアコーディオン混入検出(2026-08-13新設)
//
// 2026-08-13、前髪記事で新規アコーディオンをfrontmatterの`charts:`配列に
// summary/content付き・type/dataなしの形で追加してしまい、embedAccordions()は
// `accordions:`配列しか見ないため何も挿入されず、かつembedCharts()側は
// type未指定→renderBarChartHtml()にフォールバックしdataが無いため空文字列を
// 返す、という二重の理由で「本文に何も挿入されないままused扱いになる」
// 事故が発生し、本番で長期間気づかれなかった(項目1のafterHeading一致検査は
// 見出しの存在しか見ておらず、この事故を検出できない)。
// このパターン(chart側にtypeが無く、summary/contentがあり、dataが無い)を
// 機械的に検出し、ブロッキングで差し戻す。
// ---------------------------------------------------------------------------

function checkItem28(ctx) {
  const charts = Array.isArray(ctx.frontmatter.charts) ? ctx.frontmatter.charts : [];
  const violations = [];
  charts.forEach((c, i) => {
    const looksLikeAccordion = !c.type && (c.summary !== undefined || c.content !== undefined) && !Array.isArray(c.data);
    if (looksLikeAccordion) {
      violations.push({ index: i, afterHeading: c.afterHeading || null, summary: c.summary || null });
    }
  });
  return {
    id: 28,
    name: "chartsへのアコーディオン誤混入検出",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
    note: "frontmatterのcharts配列内に、type未指定かつsummary/content(アコーディオンの形)を持ちdataを持たない項目がある場合に検出する。この形のchart項目はembedCharts()で空文字列にフォールバックし、embedAccordions()の対象(accordions配列)にも含まれないため、本文に何も挿入されないまま検証をすり抜ける。該当項目はcharts配列からaccordions配列へ移すこと。",
  };
}

// ---------------------------------------------------------------------------
// 項目29: crossSection leaderの指示先実体チェック(2026-08-14新設、ブロッキング)
//
// 白髪ぼかしハイライト記事で、crossSection図の「毛幹」leaderの起点(fromX/fromY)が
// partsに描画されていない座標(表皮より上、どの図形の範囲にも入らない空白)を
// 指したまま本番まで気づかれなかった事故の再発防止。leaders[].fromX/fromY
// (図形側の起点。toX/toYはラベル側の終点で図形から離れているのが正常な設計)が
// partsのいずれかの図形のバウンディングボックス(±許容マージン)内にあるかを
// 機械検査する。
// ---------------------------------------------------------------------------

const LEADER_TARGET_MARGIN = 15; // viewBox単位。leaderの点は図形の輪郭のすぐ外側に置かれることが多いための許容誤差

function getPartBBox(part) {
  if (!part || typeof part !== "object") return null;
  if (part.shape === "circle") {
    const cx = Number(part.cx) || 0;
    const cy = Number(part.cy) || 0;
    const r = Number(part.r) || 0;
    return { minX: cx - r, maxX: cx + r, minY: cy - r, maxY: cy + r };
  }
  if (part.shape === "path") {
    // d文字列中の全数値をx,yの交互ペアとみなし、その最小・最大値を近似バウンディング
    // ボックスとする(M/L/Qの制御点はいずれも交互のx,y座標のため、この近似は実際の
    // 描画範囲を包含する superset になる。三角関数を使うA/C(円弧)コマンドは
    // 本プロジェクトのpath利用では使用しないため未対応)。
    const d = String(part.d || "");
    const nums = (d.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    if (nums.length < 2) return null;
    const xs = [];
    const ys = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      xs.push(nums[i]);
      ys.push(nums[i + 1]);
    }
    if (xs.length === 0) return null;
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  // 既定: ellipse
  const cx = Number(part.cx) || 0;
  const cy = Number(part.cy) || 0;
  const rx = Number(part.rx) || 0;
  const ry = Number(part.ry) || 0;
  return { minX: cx - rx, maxX: cx + rx, minY: cy - ry, maxY: cy + ry };
}

function checkItem29(ctx) {
  const charts = Array.isArray(ctx.frontmatter.charts) ? ctx.frontmatter.charts : [];
  const violations = [];
  charts.forEach((c, ci) => {
    if (c.type !== "crossSection") return;
    const parts = Array.isArray(c.parts) ? c.parts : [];
    const bboxes = parts.map(getPartBBox).filter(Boolean);
    const leaders = Array.isArray(c.leaders) ? c.leaders : [];
    leaders.forEach((l, li) => {
      const fromX = Number(l.fromX);
      const fromY = Number(l.fromY);
      const hit = bboxes.some(
        (b) =>
          fromX >= b.minX - LEADER_TARGET_MARGIN &&
          fromX <= b.maxX + LEADER_TARGET_MARGIN &&
          fromY >= b.minY - LEADER_TARGET_MARGIN &&
          fromY <= b.maxY + LEADER_TARGET_MARGIN
      );
      if (!hit) {
        violations.push({
          chartIndex: ci,
          afterHeading: c.afterHeading || null,
          leaderIndex: li,
          labelMain: l.labelMain || null,
          fromX,
          fromY,
        });
      }
    });
  });
  return {
    id: 29,
    name: "crossSection leaderの指示先実体チェック",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
    note: `leaders[].fromX/fromY(図形側の起点)が、partsのいずれかの図形の描画範囲(±${LEADER_TARGET_MARGIN}単位の許容マージン)内にあるかを検査する。範囲外の場合、指示線が実体のない座標を起点にしている。shape:"path"はd文字列中の数値をx,y交互ペアとみなした近似バウンディングボックスで判定する(A/C(円弧)コマンドを使うpathは非対応)。`,
  };
}

// ---------------------------------------------------------------------------
// 項目30: SVGラベルの推定占有幅チェック(2026-08-14新設、警告・非ブロッキング)
//
// 白髪ぼかしハイライト記事のcrossSection図で、align未指定のleaderラベルが
// viewBox右端を超えて実機で見切れていた事故の再発防止。SVGはUAスタイルシート
// の既定でoverflow:hiddenのため、viewBox外にはみ出た文字は描画上クリップされる。
// 正確な文字幅計測はできないため概算とし、警告(非ブロッキング)にとどめる。
// ---------------------------------------------------------------------------

const LABEL_WARN_RENDERED_WIDTH_PX = 325; // .chart-diagram-svgのmax-width:360pxより狭い実機幅を保守的に想定
const LABEL_STRONG_FONT_PX = 12.5; // styles/globals.css .chart-diagram-label-strong
const LABEL_FONT_PX = 11.5; // styles/globals.css .chart-diagram-label

function estimateLabelWidthUnits(text, fontPx, viewBoxWidth) {
  const unitsPerCssPx = viewBoxWidth / LABEL_WARN_RENDERED_WIDTH_PX;
  const emUnits = fontPx * unitsPerCssPx;
  return [...String(text || "")].length * emUnits; // 全角文字の字送り≒1emと仮定した概算
}

// CJKフォントの実測に近い概算値(明朝・ゴシック系で概ね共通)。全角文字の
// グリフはemボックスの大部分を占めるため、上方向(ascent)はフォントサイズに
// ほぼ等しく、下方向(descent)はその1/4程度と概算する。2026-08-14、白浮き
// 記事のtoY=15付近のラベル上端が実機で見切れた事故を受けて追加(項目30の
// x方向はみ出しチェックのy軸版)。
const LABEL_ASCENT_RATIO = 0.88;
const LABEL_DESCENT_RATIO = 0.2;

function checkItem30(ctx) {
  const charts = Array.isArray(ctx.frontmatter.charts) ? ctx.frontmatter.charts : [];
  const warnings = [];
  charts.forEach((c, ci) => {
    if (c.type !== "crossSection") return;
    const width = Number(c.viewBoxWidth) || 300;
    const height = Number(c.viewBoxHeight) || 320;
    const minX = Number(c.viewBoxMinX) || 0;
    const maxX = minX + width;
    const minY = Number(c.viewBoxMinY) || 0;
    const maxY = minY + height;
    const unitsPerCssPx = width / LABEL_WARN_RENDERED_WIDTH_PX;
    const leaders = Array.isArray(c.leaders) ? c.leaders : [];
    leaders.forEach((l, li) => {
      const growLeft = l.align === "left" || (!l.align && Number(l.toX) > minX + width / 2);
      const labelX = growLeft ? Number(l.toX) - 6 : Number(l.toX) + 6;
      const room = growLeft ? labelX - minX : maxX - labelX;
      [
        { text: l.labelMain, fontPx: LABEL_STRONG_FONT_PX, field: "labelMain" },
        { text: l.labelSub, fontPx: LABEL_FONT_PX, field: "labelSub" },
      ].forEach(({ text, fontPx, field }) => {
        if (!text) return;
        const estWidth = estimateLabelWidthUnits(text, fontPx, width);
        if (estWidth > room) {
          warnings.push({
            chartIndex: ci,
            afterHeading: c.afterHeading || null,
            leaderIndex: li,
            field,
            text,
            estimatedWidth: Math.round(estWidth),
            availableRoom: Math.round(room),
          });
        }
      });
      // y方向のviewBoxはみ出しチェック(labelMainは toY-6 がベースライン、
      // labelSubは toY+10 がベースライン。lib/posts.jsのrenderCrossSectionDiagramHtml
      // と同じオフセット値を使う)。
      const emUnits = LABEL_STRONG_FONT_PX * unitsPerCssPx;
      const subEmUnits = LABEL_FONT_PX * unitsPerCssPx;
      const topEdge = Number(l.toY) - 6 - emUnits * LABEL_ASCENT_RATIO;
      const bottomEdge = Number(l.toY) + 10 + subEmUnits * LABEL_DESCENT_RATIO;
      if (topEdge < minY) {
        warnings.push({
          chartIndex: ci,
          afterHeading: c.afterHeading || null,
          leaderIndex: li,
          field: "labelMain(y上端)",
          text: l.labelMain,
          estimatedTopEdge: Math.round(topEdge),
          viewBoxMinY: minY,
        });
      }
      if (bottomEdge > maxY) {
        warnings.push({
          chartIndex: ci,
          afterHeading: c.afterHeading || null,
          leaderIndex: li,
          field: "labelSub(y下端)",
          text: l.labelSub,
          estimatedBottomEdge: Math.round(bottomEdge),
          viewBoxMaxY: maxY,
        });
      }
    });
  });
  return {
    id: 30,
    name: "SVGラベルの推定占有幅チェック(警告・非ブロッキング)",
    result: "N/A",
    warnings,
    note: `x方向: 実機幅を保守的に${LABEL_WARN_RENDERED_WIDTH_PX}px、全角1文字をfont-size×(viewBoxWidth/${LABEL_WARN_RENDERED_WIDTH_PX})の概算幅として、anchor方向の残り余白と比較する。y方向(2026-08-14追加): ascentをフォントサイズの${LABEL_ASCENT_RATIO}倍、descentを${LABEL_DESCENT_RATIO}倍と概算し、viewBoxMinY/viewBoxHeightの範囲を超えないか比較する。誤検知があり得るため警告のみでブロッキングしない。crossSection型のleadersのみ対象。`,
  };
}

// ---------------------------------------------------------------------------
// 項目34: crossSection leaderラベル同士の衝突検出(2026-08-14新設、ブロッキング)
//
// 白浮き・肌質別の2記事で「中央2断面のtoXが近接しているのに、ラベルを各断面の
// 真上に水平配置したため、中央の2ラベルが互いに向かって伸びて重なる」実機不具合が
// 発覚した(項目29のleader実体チェック・項目30のviewBox内収まりチェックはいずれも
// 単一leader単位の判定のため、leader同士の衝突は検出できなかった)。
// labelMain/labelSubそれぞれの推定バウンディングボックス(x範囲は項目30と同じ
// growLeft/幅推定式、y範囲はtoYを中心にlabelMainは上、labelSubは下のオフセットに
// 概算フォント高さの半分を加減した範囲)を全leaderペアで比較し、x・y両方の範囲が
// 重なるペアを衝突として検出する。誤検知リスク: leaderは「ラベルを図形から離して
// 配置する」ためのものであり、ラベル同士が意図的に重なる設計は想定されない
// (項目29と同様、幾何的な不具合は原則としてブロッキング扱いが妥当と判断)。
// ---------------------------------------------------------------------------

function estimateLabelBoxes(leader, width, minX, maxX) {
  const growLeft =
    leader.align === "left" || (!leader.align && Number(leader.toX) > minX + width / 2);
  const labelX = growLeft ? Number(leader.toX) - 6 : Number(leader.toX) + 6;
  const unitsPerCssPx = width / LABEL_WARN_RENDERED_WIDTH_PX;
  const mainW = estimateLabelWidthUnits(leader.labelMain, LABEL_STRONG_FONT_PX, width);
  const subW = estimateLabelWidthUnits(leader.labelSub, LABEL_FONT_PX, width);
  const maxW = Math.max(mainW, subW);
  const xRange = growLeft ? [labelX - maxW, labelX] : [labelX, labelX + maxW];
  const mainH = LABEL_STRONG_FONT_PX * unitsPerCssPx;
  const subH = LABEL_FONT_PX * unitsPerCssPx;
  // レンダラー(lib/posts.js renderCrossSectionDiagramHtml)のy座標式: labelMainは
  // toY-6、labelSubはtoY+10(いずれもtext-anchorのベースライン)。上端はlabelMainの
  // フォント高さ半分上、下端はlabelSubのフォント高さ半分下とする。
  const yRange = [Number(leader.toY) - 6 - mainH / 2, Number(leader.toY) + 10 + subH / 2];
  return { xRange, yRange };
}

function rangesOverlap(a, b) {
  return a[0] < b[1] && b[0] < a[1];
}

function checkItem34(ctx) {
  const charts = Array.isArray(ctx.frontmatter.charts) ? ctx.frontmatter.charts : [];
  const collisions = [];
  charts.forEach((c, ci) => {
    if (c.type !== "crossSection") return;
    const width = Number(c.viewBoxWidth) || 300;
    const minX = Number(c.viewBoxMinX) || 0;
    const maxX = minX + width;
    const leaders = Array.isArray(c.leaders) ? c.leaders : [];
    const boxes = leaders.map((l) => estimateLabelBoxes(l, width, minX, maxX));
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        if (rangesOverlap(boxes[i].xRange, boxes[j].xRange) && rangesOverlap(boxes[i].yRange, boxes[j].yRange)) {
          collisions.push({
            chartIndex: ci,
            afterHeading: c.afterHeading || null,
            leaderIndexA: i,
            leaderIndexB: j,
            labelA: `${leaders[i].labelMain || ""}${leaders[i].labelSub ? "/" + leaders[i].labelSub : ""}`,
            labelB: `${leaders[j].labelMain || ""}${leaders[j].labelSub ? "/" + leaders[j].labelSub : ""}`,
            xRangeA: boxes[i].xRange.map((n) => Math.round(n)),
            xRangeB: boxes[j].xRange.map((n) => Math.round(n)),
            yRangeA: boxes[i].yRange.map((n) => Math.round(n)),
            yRangeB: boxes[j].yRange.map((n) => Math.round(n)),
          });
        }
      }
    }
  });
  return {
    id: 34,
    name: "crossSection leaderラベル同士の衝突検出",
    result: collisions.length === 0 ? "Yes" : "No",
    collisions,
    note: `labelMain/labelSubの推定バウンディングボックス(x範囲: 項目30と同じgrowLeft/幅推定式、y範囲: toYを中心とした概算フォント高さ)が、同一chart内の他のleaderと重なるペアを検出する。crossSection型のleadersのみ対象。1件でもあれば差し戻す。`,
  };
}

// ---------------------------------------------------------------------------
// 項目36: tip/ポイント系コールアウトの見出し先頭配置検出(2026-08-17新設、
// 計測モード・非ブロッキング。ブロッキング化はユーザー決裁後)
//
// writer.mdの改訂(「tip/ポイント系コールアウト〔NEVORAポイント含む〕は、
// それが補足する本文・手順・図の後に配置する。見出し直後の先頭配置が
// 許されるのは要約型〔結論先出し・この節でわかること〕のみ」)を機械検査
// できるようにした計測ツール。
//
// 2026-08-17追記(第1段階対応): 従来は(a)chartsのtype:"tip"が見出しに
// 紐づいている場合を「chart/accordionは常に見出し直下に強制挿入されるため」
// という理由で機械的に検出していたが、`lib/posts.js`の`embedCharts`を
// 改修し、tip/ポイント系chart(type:"tip"/"skincareTip"、
// END_OF_SECTION_CHART_TYPES)は見出し直後ではなく該当セクション末尾に
// 描画するよう恒久修正した。これにより(a)のパターンは構造的に発生しなく
// なったため、chart由来の検出を廃止し、本文側のblockquote(`> `)が
// 見出し直後の最初の実質ブロックであり、アイコンが tip/ポイント系
// (💡/💬/⏱/📌)である場合(旧(b))のみを検出する。
// 除外(検出しない): 要約型(🔍/📝/✅等、結論先出し)・注意喚起型(⚠️)。
// 判定はあくまで「見出し直後という位置」のみに基づく機械的なものであり、
// そのコールアウトが実際に「本文・手順・図を補足する」性質か「要約」性質かの
// 意味的判断(=そのコールアウトの文面が本当に前方の内容を要約しているか)は
// 行っていない。アイコン(💡等)を手がかりにした簡易分類のため、
// 誤検知(実は要約的内容なのに💡アイコンを使っているケース)・
// 見逃し(tip的内容なのに🔍アイコンを誤用しているケース)の余地がある。
// ---------------------------------------------------------------------------

const RE_TIP_BLOCKQUOTE_ICON = /^\s*>\s*(💡|💬|⏱|📌)/u;
const RE_EXCLUDED_BLOCKQUOTE_ICON = /^\s*>\s*(🔍|📝|✅|＝)/u;

function checkItem36(ctx) {
  const violations = [];
  const headings = extractHeadings(ctx.bodyLines);
  const charts = Array.isArray(ctx.frontmatter.charts) ? ctx.frontmatter.charts : [];
  // 見出しに、セクション末尾描画(tip/skincareTip)以外のchartが1つでも紐づいている場合、
  // 実際のレンダリングではその見出し直後にそのchartが先に描画されるため、本文markdown上で
  // 見出し直後に見えるblockquoteは実際には2番目以降の要素になる。このケースを誤検知しない。
  const headingsWithTopChart = new Set(
    charts
      .filter((c) => c && !END_OF_SECTION_CHART_TYPES_VERIFY.has(c.type))
      .map((c) => c.afterHeading)
  );

  headings.forEach((h, idx) => {
    if (headingsWithTopChart.has(h.text)) return;
    const sectionEnd = headings[idx + 1] ? headings[idx + 1].line : ctx.bodyLines.length + 1;
    for (let ln = h.line + 1; ln < sectionEnd; ln += 1) {
      const line = ctx.bodyLines[ln - 1];
      if (line === undefined) break;
      const type = classifyLine(line);
      if (type === "blank" || type === "hr") continue;
      if (type === "blockquote") {
        if (RE_TIP_BLOCKQUOTE_ICON.test(line) && !RE_EXCLUDED_BLOCKQUOTE_ICON.test(line)) {
          violations.push({
            heading: h.text,
            kind: "body-blockquote",
            text: line.trim().slice(0, 40),
            line: toAbsoluteLine(ctx.bodyStartLine, ln),
          });
        }
      }
      break; // 見出し直後の最初の実質ブロックのみ判定する
    }
  });

  return {
    id: 36,
    name: "tip/ポイント系コールアウトの見出し先頭配置",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
    note: "H2/H3見出し直後の最初の実質ブロックが、本文側のtip/ポイント系コールアウト(💡NEVORAポイント等のアイコン)である箇所を検出する。chart type:\"tip\"/\"skincareTip\"は2026-08-17の`embedCharts`恒久修正によりセクション末尾描画に変更済みのため検出対象から除外(構造的に発生しない)。要約型(🔍/📝/✅等)・注意喚起型(⚠️)は除外。アイコンベースの機械判定のため、コールアウトの文面が実際に前方内容の要約か補足かという意味的判断は行っておらず、誤検知・見逃しの余地がある(詳細はdocs/reports参照)。2026-08-18にブロッキング化(§13遡及検証済み、公開済み・確定稿131本は検出0件)。下書きフォルダの非参照重複ファイルで検出される既知1件は、下書き自体が本番未反映かつ7-5浄化工程の対象のため、この項目のブロッキング化の障壁とはしない。",
  };
}

// ---------------------------------------------------------------------------
// 項目31: 自己参照の誘導文検出(2026-08-14新設、ブロッキング)
//
// 家庭用美顔器記事で「(詳しくは上のアコーディオンから読めます)」型の、
// ページ内UI要素の存在を地の文で説明するだけの一文が4箇所に入っていた事例の
// 再発防止。図への内容的な参照(「上の図のように〜」等、item26の対象)は
// 誤検知しないよう、対象をアコーディオン/チェックリストの自己言及パターンに限定する。
// ---------------------------------------------------------------------------

const RE_SELF_REFERENCE_UI = /(上|下)の?(アコーディオン|チェックリスト)(から|で)(読めます|確認できます|わかります|見られます)/;

function checkItem31(ctx) {
  const violations = [];
  ctx.bodyLines.forEach((line, idx) => {
    if (classifyLine(line) !== "text") return;
    const m = line.match(RE_SELF_REFERENCE_UI);
    if (m) {
      violations.push({
        line: toAbsoluteLine(ctx.bodyStartLine, idx + 1),
        matched: m[0],
        text: line.trim().slice(0, 120),
      });
    }
  });
  return {
    id: 31,
    name: "自己参照の誘導文検出(ページ内UI要素への言及)",
    result: violations.length === 0 ? "Yes" : "No",
    violations,
    note: "「(詳しくは上のアコーディオンから読めます)」等、見出し直下に自動挿入される要素の存在を地の文で説明するだけの一文を検出する。図への内容的な参照(item26の対象)と混同しないよう、対象をアコーディオン/チェックリストへの自己言及パターンに限定している。",
  };
}

// ---------------------------------------------------------------------------
// 項目32: 装飾密度の後半失速検出(2026-08-14新設、警告・非ブロッキング)
//
// 直近3記事の実機確認で「冒頭2〜3見出しに絵文字・==・^^・コールアウトが
// 集中し、後半(まとめ含む)がほぼゼロになる」という装飾密度の偏りが判明した。
// H2見出しごとに装飾スコア(絵文字+==ペア+^^ペア+コールアウト数)を算出し、
// 記事後半の平均スコアが前半の平均スコアに対して大きく落ち込んでいないかを
// 警告する(非ブロッキング。「意味のある装飾か」は機械判定できないため、
// item27と同じく候補提示に留める)。絵文字の定義は項目4と同じEMOTION_EMOJI
// (見出し内・コールアウトのアイコン絵文字は対象外、地の文・箇条書きのみ)。
// ---------------------------------------------------------------------------

const DECORATION_SCORE_MIN_SECTION_CHARS = 100; // この文字数未満のH2セクションはスコア算出対象から除外
const DECORATION_BACK_HALF_RATIO_THRESHOLD = 0.3; // 後半平均が前半平均のこの比率未満なら警告

function checkItem32(ctx) {
  const headings = extractHeadings(ctx.bodyLines);
  const h2s = headings.filter((h) => h.level === 2);
  const emojiPattern = new RegExp(EMOTION_EMOJI.join("|"), "g");

  const sections = h2s.map((h2, i) => {
    const rangeStart = h2.line + 1;
    const rangeEnd = i + 1 < h2s.length ? h2s[i + 1].line - 1 : ctx.bodyLines.length;

    let chars = 0;
    let emojiCount = 0;
    let highlightCount = 0;
    let emotionCount = 0;
    let calloutCount = 0;
    let prevType = null;

    for (let ln = rangeStart; ln <= rangeEnd; ln++) {
      const line = ctx.bodyLines[ln - 1];
      if (line === undefined) continue;
      const type = classifyLine(line);
      if (type === "text" || type === "list") {
        chars += zenkakuLength(line);
        emojiCount += (line.match(emojiPattern) || []).length;
        highlightCount += (line.match(/==((?:(?!==)[^\n])+?)==/g) || []).length;
        emotionCount += (line.match(/\^\^((?:(?!\^\^)[^\n])+?)\^\^/g) || []).length;
      } else if (type === "blockquote") {
        if (prevType !== "blockquote") calloutCount += 1;
      }
      if (type !== "blank") prevType = type;
    }

    const score = emojiCount + highlightCount + emotionCount + calloutCount;
    return {
      heading: h2.text,
      line: toAbsoluteLine(ctx.bodyStartLine, h2.line),
      chars: Math.round(chars * 10) / 10,
      score,
      breakdown: { emoji: emojiCount, highlight: highlightCount, emotion: emotionCount, callout: calloutCount },
    };
  });

  const scored = sections.filter((s) => s.chars >= DECORATION_SCORE_MIN_SECTION_CHARS);
  const zeroScoreSections = scored
    .filter((s) => s.score === 0)
    .map((s) => ({ heading: s.heading, line: s.line, chars: s.chars }));

  let backHalfSlowdown = null;
  if (scored.length >= 2) {
    const mid = Math.ceil(scored.length / 2);
    const front = scored.slice(0, mid);
    const back = scored.slice(mid);
    const avg = (arr) => arr.reduce((sum, s) => sum + s.score, 0) / arr.length;
    const frontAvg = avg(front);
    const backAvg = back.length > 0 ? avg(back) : 0;
    const flagged = frontAvg > 0 && backAvg < frontAvg * DECORATION_BACK_HALF_RATIO_THRESHOLD;
    backHalfSlowdown = {
      frontAvg: Math.round(frontAvg * 100) / 100,
      backAvg: Math.round(backAvg * 100) / 100,
      flagged,
    };
  }

  return {
    id: 32,
    name: "装飾密度の後半失速検出(警告・非ブロッキング)",
    result: "N/A",
    sections,
    zeroScoreSections,
    backHalfSlowdown,
    note: `H2見出しごとに(絵文字+==ペア+^^ペア+コールアウト数)を装飾スコアとして算出する。本文${DECORATION_SCORE_MIN_SECTION_CHARS}字未満のH2はスコア対象外(前後半分割・zeroScoreSections集計いずれからも除外)。スコア対象H2を文書順で前半/後半に2分し、後半平均が前半平均の${Math.round(DECORATION_BACK_HALF_RATIO_THRESHOLD * 100)}%未満ならbackHalfSlowdown.flagged=trueとする。誤検知があり得るため警告のみでブロッキングしない。詳細な密度基準はdocs/CONTRIBUTING.md 25節・writer.md「装飾密度ルール」節を参照。`,
  };
}

function main() {
  if (process.argv[2] === "--audit-updated-date") {
    const dirs = process.argv.slice(3);
    if (dirs.length === 0) {
      console.error(
        JSON.stringify({
          error: "使い方: node scripts/verify-article.js --audit-updated-date <ディレクトリ1> [<ディレクトリ2> ...]",
        })
      );
      process.exit(1);
    }
    runAuditUpdatedDate(dirs);
    return;
  }

  const filePath = process.argv[2];
  if (!filePath) {
    console.error(JSON.stringify({ error: "使い方: node scripts/verify-article.js <記事Markdownファイルパス>" }));
    process.exit(1);
  }
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.log(JSON.stringify({ error: `File does not exist: ${filePath}` }, null, 2));
    process.exit(1);
  }

  const ctx = loadArticle(resolved);
  const items = [
    checkItem1(ctx),
    checkItem2(ctx),
    checkItem3(ctx),
    checkItem4(ctx),
    checkItem5(ctx),
    checkItem6(ctx),
    checkItem7(), // 2026-08-14廃止・永久欠番(ユーザー決裁)。常にresult: "Yes"を返すスタブで、ブロッキング・非ブロッキングいずれの集計にも実質影響しない。地の文連続の基準は項目23〔300字ルール〕に一本化
    checkItem8(ctx),
    checkItem9(ctx),
    checkItem10(ctx),
    checkItem11(ctx),
    checkItem12(ctx),
    checkItem13(ctx),
    checkItem14(ctx),
    checkItem15(ctx),
    checkItem16(ctx),
    checkItem17(ctx),
    checkItem18(ctx), // result: "N/A"、非ブロッキング(overall判定には含めない)
    checkItem19(ctx), // result: "N/A"、非ブロッキング(overall判定には含めない)
    checkItem20(ctx), // result: "N/A"、非ブロッキング(overall判定には含めない)
    checkItem21(ctx),
    checkItem22(ctx),
    checkItem23(ctx), // 2026-08-13、400字ルールへ改訂しブロッキング化
    checkItem24(ctx),
    checkItem25(ctx), // result: "N/A"、非ブロッキング(overall判定には含めない)
    checkItem26(ctx),
    checkItem27(ctx), // result: "N/A"、非ブロッキング(2026-08-13再改訂、候補提示のみ・overall判定には含めない)
    checkItem28(ctx), // 2026-08-13新設、ブロッキング(chartsへのアコーディオン誤混入検出)
    checkItem29(ctx), // 2026-08-14新設、ブロッキング(crossSection leaderの指示先実体チェック)
    checkItem30(ctx), // result: "N/A"、非ブロッキング(2026-08-14新設、SVGラベルの推定占有幅・警告)
    checkItem31(ctx), // 2026-08-14新設、ブロッキング(自己参照の誘導文検出)
    checkItem32(ctx), // result: "N/A"、非ブロッキング(2026-08-14新設、装飾密度の後半失速検出・警告)
    checkItem34(ctx), // 2026-08-14新設、ブロッキング(crossSection leaderラベル同士の衝突検出。項目33はscripts/verify-declared-vs-rendered.jsの独立スクリプトのためここには存在しない)
    checkItem36(ctx), // 2026-08-17新設(計測モード)→2026-08-18ブロッキング化。tip/ポイント系コールアウトの見出し先頭配置検出。項目35はscripts/verify-rendered-layout.jsの独立スクリプトのためここには存在しない
  ];
  const blockingItems = items.filter((it) => it.result !== "N/A");
  const overall = blockingItems.every((it) => it.result === "Yes") ? "Yes" : "No";

  console.log(JSON.stringify({ file: filePath, items, overall }, null, 2));
}

main();
