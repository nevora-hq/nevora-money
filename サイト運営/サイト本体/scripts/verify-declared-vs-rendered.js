/**
 * item33: frontmatter宣言(charts/accordions)vs 実際のレンダリング結果の突き合わせチェック。
 *
 * 背景: 2026-08-14、lib/posts.jsのsplitHtmlBlocksに「⏱30秒でわかる/🔍結論だけ知りたい人へ/
 * 🎯まとめカードの3種の単一divボックス直後の見出しへのchart/accordion挿入がサイレント失敗する」
 * バグが発覚した(fix: splitHtmlBlocksの単一div境界対応)。このバグはafterHeadingの
 * テキスト自体は本文の見出しと一致しており、verify-article.js(frontmatterと本文Markdown
 * ソースのみを見る、レンダリングパイプラインを一切importしない設計)の既存項目1〜32
 * ではどれも検出できなかった。
 *
 * verify-article.jsは「lib/posts.jsのレンダリングロジックは一切import・改修しない」という
 * 設計方針(同ファイル冒頭コメント参照、1記事あたり高速に判定するための意図的な制約)を
 * 持つため、このitem33はverify-article.js本体には統合せず、実際のNext.jsビルドパイプライン
 * (lib/posts.js)を通した後の結果を検証する別スクリプトとして位置づける。
 *
 * 実行方法: npm run verify:rendered (package.jsonにエイリアス登録)
 * 内部で `NEVORA_VERIFY_RENDER_MATCH=1 next build` を実行し、lib/posts.jsのembedCharts/
 * embedAccordionsが出力する [UNMATCHED_CHART] / [UNMATCHED_ACCORDION]、および
 * renderCrossSectionDiagramHtmlが出力する [EMPTY_LEADER_LABEL](leadersが廃止フィールド
 * labelのみで書かれておりlabelMain/labelSubが無く、ラベルが空文字で描画される規約違反。
 * 2026-08-14、肌質別/白浮きの2記事で実機指摘により発覚)という診断行
 * (console.error、NEVORA_VERIFY_RENDER_MATCH環境変数がセットされている時のみ出力)を
 * 収集して集計する。1件でもあればexit 1(ブロッキング)。
 *
 * 運用: docs/CONTRIBUTING.md §13の遡及検証義務に従い、lib/posts.jsのレンダリング
 * ロジック(embedCharts/embedAccordions/splitHtmlBlocks等)を変更した際は、記事を
 * 1本も追加・削除していなくても全記事に対して本スクリプトを実行すること。
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// 汎用SVGテキスト検出(2026-08-15新設、警告・非ブロッキング)
//
// 背景: item30(はみ出し)・item34(衝突)は`crossSection`型の`leaders`
// (frontmatterのlabelMain/labelSub)のみを対象にしており、それ以外の
// SVGレンダラー(頭皮かゆみ記事のkssScalpCrossSection/kssDiagnosisFlow等、
// 記事専用のハードコードされたウィジェット群)は検査対象外だった。
// 2026-08-15、頭皮断面比較図のラベル重なり・診断フローチャートの文字
// はみ出しが実機指摘で発覚したが、いずれもfrontmatterに構造化データを
// 持たない(SVG文字列がJSコード内に直接埋め込まれている)ため、
// item30/34と同じfrontmatter駆動の検査を拡張することができない。
//
// 対応方針: frontmatter側ではなく、ビルド後の実HTML(.next/server/pages)
// を対象に、<svg viewBox="..."> ブロック内の <text x= y= text-anchor=>
// 要素を正規表現で抽出し、(a) viewBox境界からのはみ出し (b) 同一svg内での
// テキスト同士の推定バウンディングボックス衝突 を汎用的に検出する。
// レンダラーごとの実装差異(hardcoded SVG vs データ駆動)を問わず、
// 最終的に出力されるHTMLは同じ<svg><text>構造になるため、この段階で
// 検査すれば全chart型を横断的にカバーできる。
// フォントサイズはCSSクラスごとに異なり実行時に取得できないため、
// item30と同じ保守的な概算(全角1文字あたりfont-size相当の幅、
// ascent0.88倍・descent0.2倍)を、代表的なラベル系フォントサイズ
// (11.5〜13px、styles/globals.cssの各種kss-*/chart-diagram-*クラスの
// 実測レンジ)の中央値12.5pxで一律概算する。誤検知があり得るため
// 警告のみ(非ブロッキング)とする。
// ---------------------------------------------------------------------------
const GENERIC_LABEL_FONT_PX = 12.5;
const GENERIC_LABEL_ASCENT_RATIO = 0.88;
const GENERIC_LABEL_DESCENT_RATIO = 0.2;
const GENERIC_RENDERED_WIDTH_PX = 325;

function estimateCharWidthUnits(viewBoxWidth) {
  return GENERIC_LABEL_FONT_PX * (viewBoxWidth / GENERIC_RENDERED_WIDTH_PX);
}

function scanSvgTextOverflowAndCollision(buildDir) {
  const postsDir = path.join(buildDir, "server", "pages", "posts");
  if (!fs.existsSync(postsDir)) return [];
  const files = fs.readdirSync(postsDir).filter((f) => f.endsWith(".html"));
  const warnings = [];

  const svgRe = /<svg viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"[^>]*>([\s\S]*?)<\/svg>/g;
  const textRe = /<text x="([-\d.]+)" y="([-\d.]+)"(?:[^>]*text-anchor="(\w+)")?[^>]*>([^<]*)<\/text>/g;

  for (const file of files) {
    const html = fs.readFileSync(path.join(postsDir, file), "utf8");
    let svgMatch;
    svgRe.lastIndex = 0;
    let svgIndex = 0;
    while ((svgMatch = svgRe.exec(html))) {
      svgIndex += 1;
      const [, minXs, minYs, widths, heights, inner] = svgMatch;
      const minX = parseFloat(minXs), minY = parseFloat(minYs);
      const width = parseFloat(widths), height = parseFloat(heights);
      const maxX = minX + width, maxY = minY + height;
      const emUnits = estimateCharWidthUnits(width);

      const boxes = [];
      let textMatch;
      textRe.lastIndex = 0;
      while ((textMatch = textRe.exec(inner))) {
        const [, xs, ys, anchor, rawText] = textMatch;
        const text = rawText.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        if (!text.trim()) continue;
        const x = parseFloat(xs), y = parseFloat(ys);
        const charLen = Array.from(text).length;
        const textWidth = charLen * emUnits;
        // SVGの既定値はtext-anchor="start"(未指定の場合はstart扱いにする。
        // 「middle」を誤って既定にすると、start属性を省略している大量の
        // レンダラーで的外れなはみ出し警告が出る〔2026-08-15自己発覚〕)。
        let xMin, xMax;
        if (anchor === "end") { xMax = x; xMin = x - textWidth; }
        else if (anchor === "middle") { xMin = x - textWidth / 2; xMax = x + textWidth / 2; }
        else { xMin = x; xMax = x + textWidth; }
        const yMin = y - emUnits * GENERIC_LABEL_ASCENT_RATIO;
        const yMax = y + emUnits * GENERIC_LABEL_DESCENT_RATIO;

        if (xMin < minX - 1 || xMax > maxX + 1 || yMin < minY - 1 || yMax > maxY + 1) {
          warnings.push({
            file,
            svgIndex,
            text,
            type: "overflow",
            estimatedBox: [Math.round(xMin), Math.round(xMax), Math.round(yMin), Math.round(yMax)],
            viewBox: [minX, minY, width, height],
          });
        }
        // 数字1〜2文字の短いテキスト(手順番号アイコン等)は、円形バッジの
        // 中に収まる装飾要素であることが大半で、隣接する本文ラベルとの
        // 「衝突」判定が構造的に誤検知になりやすいため除外する。
        if (charLen <= 2 && /^[0-9０-９]+$/.test(text.trim())) continue;
        boxes.push({ text, xMin, xMax, yMin, yMax });
      }

      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i], b = boxes[j];
          const xOverlap = a.xMin < b.xMax && b.xMin < a.xMax;
          const yOverlap = a.yMin < b.yMax && b.yMin < a.yMax;
          // 既知の誤検知除外(2026-08-16、28.9節トリアージで発覚): crossSectionの
          // labelMain/labelSubは同一leaderの意図した2段スタック表示であり、
          // 同じ基準点x(labelX)・同じtext-anchorにtoY-6/toY+10で縦に並べて
          // 描画される(lib/posts.jsのrenderCrossSectionDiagramHtml)。文字数が
          // 異なるためxMin/xMaxは完全一致しないが、text-anchorの基準側
          // (anchor="end"ならxMax、それ以外ならxMin)は必ず一致し、かつ
          // 縦方向にtoY-6/toY+10(16単位差)前後で隣接する。これを
          // 「別ラベル同士の衝突」ではなく「同一leaderの意図した2段表示」として
          // 除外する。基準辺が一致していても縦の隣接性が無い場合(=別leaderが
          // たまたま同じx位置に来た場合)は除外しない。
          const anchorEdgeMatches =
            Math.abs(a.xMax - b.xMax) < 1 || Math.abs(a.xMin - b.xMin) < 1;
          const aCenterY = (a.yMin + a.yMax) / 2;
          const bCenterY = (b.yMin + b.yMax) / 2;
          const verticallyStacked = Math.abs(aCenterY - bCenterY) <= emUnits * 1.6;
          const sameLeaderPair = anchorEdgeMatches && verticallyStacked;
          if (xOverlap && yOverlap && !sameLeaderPair) {
            warnings.push({
              file,
              svgIndex,
              type: "collision",
              textA: a.text,
              textB: b.text,
            });
          }
        }
      }
    }
  }
  return warnings;
}

function main() {
  console.log("[verify-declared-vs-rendered] npm run build を実行します(NEVORA_VERIFY_RENDER_MATCH=1)...");
  // 「npx next build」を直接呼ぶとpackage.jsonのprebuild(sync-content、記事データ→
  // content/articlesの同期)が発火せず、content/articles配下が古い記事内容の
  // ままビルドされてしまう(2026-08-14、本ガード機能の動作確認中に自己発覚。
  // npm lifecycle hookはnpm run経由でのみ実行される)。必ず「npm run build」を
  // 経由してprebuildを発火させること。
  const result = spawnSync("npm", ["run", "build"], {
    cwd: process.cwd(),
    env: { ...process.env, NEVORA_VERIFY_RENDER_MATCH: "1" },
    encoding: "utf8",
    shell: true,
  });

  const combined = `${result.stdout || ""}\n${result.stderr || ""}`;
  const lines = combined
    .split("\n")
    .filter(
      (l) =>
        l.includes("[UNMATCHED_CHART]") ||
        l.includes("[UNMATCHED_ACCORDION]") ||
        l.includes("[EMPTY_LEADER_LABEL]") ||
        l.includes("[EMPTY_CHART]")
    );

  if (result.status !== 0) {
    console.error("[verify-declared-vs-rendered] next build 自体が失敗しました。");
    console.error(combined.slice(-4000));
    process.exit(result.status || 1);
  }

  console.log(`[verify-declared-vs-rendered] 総不一致件数: ${lines.length}`);
  for (const line of lines) {
    console.log(line);
  }

  if (lines.length > 0) {
    console.error(
      `[verify-declared-vs-rendered] item33: NG。${lines.length}件の不一致(chart/accordionの未挿入、crossSection leaderのラベル空文字描画、またはチャートの空文字描画)を検出しました。`
    );
    process.exit(1);
  }

  console.log(
    "[verify-declared-vs-rendered] item33: OK。宣言された全chart/accordionが実際に描画され、ラベル・チャートの空文字描画もありません。"
  );

  if (!process.env.NEVORA_SCAN_SVG_TEXT) {
    console.log(
      "[verify-declared-vs-rendered] 汎用SVGテキスト検査は実験的機能のため既定では実行しません(NEVORA_SCAN_SVG_TEXT=1で有効化)。誤検知が多く目視トリアージ前提の診断ツールです。詳細はdocs/project-state.md参照。"
    );
    return;
  }
  console.log("[verify-declared-vs-rendered] 汎用SVGテキスト検査(実験的・警告のみ)を実行します...");
  const svgWarnings = scanSvgTextOverflowAndCollision(path.join(process.cwd(), ".next"));
  const overflowWarnings = svgWarnings.filter((w) => w.type === "overflow");
  const collisionWarnings = svgWarnings.filter((w) => w.type === "collision");
  console.log(
    `[verify-declared-vs-rendered] 汎用SVGテキスト検査: はみ出し疑い${overflowWarnings.length}件・衝突疑い${collisionWarnings.length}件`
  );
  for (const w of overflowWarnings) {
    console.log(
      `[SVG_TEXT_OVERFLOW] ${w.file}\tsvg#${w.svgIndex}\ttext=${JSON.stringify(w.text)}\testimatedBox=${JSON.stringify(
        w.estimatedBox
      )}\tviewBox=${JSON.stringify(w.viewBox)}`
    );
  }
  for (const w of collisionWarnings) {
    console.log(
      `[SVG_TEXT_COLLISION] ${w.file}\tsvg#${w.svgIndex}\ttextA=${JSON.stringify(w.textA)}\ttextB=${JSON.stringify(w.textB)}`
    );
  }
  console.log(
    "[verify-declared-vs-rendered] 汎用SVGテキスト検査は誤検知リスクがあるため警告のみ(exit codeに影響しない)。個別に目視確認すること。"
  );
}

main();
