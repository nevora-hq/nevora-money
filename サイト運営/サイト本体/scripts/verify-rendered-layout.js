// 項目35: 実測レンダリング検査(2026-08-16新設)。
//
// 従来のscripts/verify-declared-vs-rendered.jsの汎用SVGテキストスキャナ
// (NEVORA_SCAN_SVG_TEXT=1)は、静的HTML文字列を正規表現でパースし、
// フォント幅を「12.5px相当を表示幅325pxとviewBox幅の比率で換算する」という
// 固定式で推定する簡易ツールだった。この推定式自体の誤差(全角/半角を
// 区別しない均等割り、325px固定の前提)が、実際のブラウザ描画とどれだけ
// 乖離しているかを検証する手段が無かった。
//
// 本スクリプトはPlaywright(playwright-core、Chromiumは既存のms-playwright
// キャッシュを利用)で`next start`したページを実際のブラウザに描画させ、
// getBoundingClientRect()で実測した座標をもとに、
//   (1) 親コンテナ(SVG本体・図解パネル・コールアウトボックス)からのはみ出し
//   (2) 兄弟テキスト同士の重なり
//   (3) viewport幅を超える描画(画面外への切れ)
// を判定する。旧スキャナは本スクリプトの高速な事前フィルタ(opt-in診断)に
// 位置づけを下げ、最終判定は本スクリプト(項目35)を正とする
// (2026-08-16、監査指示により新設)。
//
// 使い方:
//   node scripts/verify-rendered-layout.js <slug1> <slug2> ... [--strict]
//   --strict: 1件でも検出があればexit 1(対象記事へのブロッキング適用時に使用)
//   省略時はexit 0(全量opt-in診断、後日ブロッキング昇格を決裁する運用)
//
// 前提: 事前に`npm run build`済みであること(このスクリプト自体はbuildを実行しない。
// verify-declared-vs-rendered.jsとは異なり、`next start`で実サーバーを起動して
// 実ブラウザから見るため、prebuild(sync-content)の反映有無は呼び出し側で
// `npm run build`を先に実行しておくことで保証する)。

const { spawn, execSync } = require("child_process");
const path = require("path");

// Windowsでは`spawn(..., {shell:true})`で起動した子プロセスに対する`.kill()`は
// シェル(cmd.exe)だけを止め、その配下で実際にポートをlistenしているnode/next
// プロセスは残り続ける(2026-08-16、これが原因で「ソースを修正してnpm run buildを
// 再実行しても、item35が古いビルド内容のまま検査してしまう」という重大な不具合を
// 自己発見した。stale serverが前回ポートを掴んだままだと、新しいnext startの
// bindが暗黙に失敗し古いプロセスが応答し続けるため、検証結果が信用できなくなる)。
// このため、起動前に対象ポートを掴んでいるプロセスを`taskkill /F /T`で確実に
// 終了させ、終了後もプロセスをexecSyncで確実にkillする。
// netstat/findstr/taskkillはWindows専用のため、Linux(GitHub Actionsの
// ubuntu-latest)ではそのまま実行すると`findstr: not found`が繰り返し出る
// (2026-08-25、CI実行#3のログで判明)。処理自体は「残留プロセスがあれば
// 落とす」保険で、CIでは毎回まっさらなため実害は無かったが、ログが汚れて
// 本来の検出が埋もれるためプラットフォーム別に分岐する。
function killPort(port) {
  const pids = new Set();
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
      out.split("\n").forEach((line) => {
        const m = line.trim().match(/LISTENING\s+(\d+)\s*$/);
        if (m) pids.add(m[1]);
      });
    } else {
      // lsofが無い環境もあるため、無ければssにフォールバックする
      let out = "";
      try {
        out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      } catch (e) {
        try {
          out = execSync(`ss -lptnH "sport = :${port}"`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
        } catch (e2) {
          out = "";
        }
      }
      out.split("\n").forEach((line) => {
        const t = line.trim();
        if (/^\d+$/.test(t)) pids.add(t);
        const m = t.match(/pid=(\d+)/);
        if (m) pids.add(m[1]);
      });
    }
  } catch (e) {
    // ヒットしない(該当プロセス無し)場合は非ゼロ終了になるだけなので無視
  }
  pids.forEach((pid) => {
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
      } else {
        process.kill(Number(pid), "SIGKILL");
      }
      console.log(`[item35] ポート${port}を掴んでいた残留プロセス(PID ${pid})を終了しました。`);
    } catch (e) {
      // 既に終了している等は無視
    }
  });
}

// NEVORA_ITEM35_WIDTHSで一時的に幅セットを差し替え可能(カンマ区切り、例: "320,360,375,390,412,768")。
// 既定は320/375/768の3幅(通常運用)。
const VIEWPORT_WIDTHS = process.env.NEVORA_ITEM35_WIDTHS
  ? process.env.NEVORA_ITEM35_WIDTHS.split(",").map((n) => Number(n.trim())).filter(Boolean)
  : [320, 375, 768];
const PORT = 4319;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function waitForServer(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryFetch = () => {
      const http = require("http");
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("server did not become ready in time"));
        } else {
          setTimeout(tryFetch, 500);
        }
      });
      req.setTimeout(2000, () => req.destroy());
    };
    tryFetch();
  });
}

// 図解SVG(棒グラフ・crossSection/depthComparison/processContrast等)と
// コールアウトボックスの両方を対象に、実測座標での判定を行う。
async function measurePage(page, slug) {
  const findings = await page.evaluate(() => {
    const results = [];
    const TOLERANCE_PX = 1;

    function rectsOverlap(a, b) {
      return a.left < b.right - TOLERANCE_PX && b.left < a.right - TOLERANCE_PX && a.top < b.bottom - TOLERANCE_PX && b.top < a.bottom - TOLERANCE_PX;
    }
    function containsFully(outer, inner) {
      return (
        inner.left >= outer.left - TOLERANCE_PX &&
        inner.right <= outer.right + TOLERANCE_PX &&
        inner.top >= outer.top - TOLERANCE_PX &&
        inner.bottom <= outer.bottom + TOLERANCE_PX
      );
    }

    // ---- テキスト×図形の重なり検出用(2026-08-24追加、§AF) ----
    // 既存の衝突検出(rectsOverlap)はテキスト同士のみを対象としており、
    // 「ラベルが図形(散布図の点・毛束の曲線等)の上に乗る」不具合を検出できなかった
    // (2026-08-24、ヘアスタイル10記事の図解を実描画で目視した際に3件発見:
    // quadrantのヘアミルクラベルがヘアオイルの点に重なる/crossSectionの
    // 「冷めてから外す」「形が変わる」ラベルが毛束のpathに重なる)。
    // 誤検知を避けるため、判定はバウンディングボックスの「部分的なまたぎ」に限定する。
    const SHAPE_OVERLAP_TOLERANCE_PX = 3; // 許容マージン(調整用の定数)

    function rectsOverlapTol(a, b, tol) {
      return a.left < b.right - tol && b.left < a.right - tol && a.top < b.bottom - tol && b.top < a.bottom - tol;
    }
    function containsFullyTol(outer, inner, tol) {
      return (
        inner.left >= outer.left - tol &&
        inner.right <= outer.right + tol &&
        inner.top >= outer.top - tol &&
        inner.bottom <= outer.bottom + tol
      );
    }
    // 例外的に重なりを許可したい要素のスキップ(自身または祖先にdata-allow-overlap)
    function hasAllowOverlap(el) {
      let node = el;
      while (node && node.getAttribute) {
        if (node.hasAttribute && node.hasAttribute("data-allow-overlap")) return true;
        node = node.parentElement;
      }
      return false;
    }
    // 同一の<g>グループ内にある(=セットで配置されたラベルと図形)かどうか
    function sharesGroup(textEl, shapeEl) {
      const g = shapeEl.closest && shapeEl.closest("g");
      if (g && g.contains(textEl)) return true;
      const g2 = textEl.closest && textEl.closest("g");
      if (g2 && g2.contains(shapeEl)) return true;
      return false;
    }
    // 引き出し線とその先端ドットは、そのラベルと対で配置される設計要素のため除外する
    function isLeaderDecoration(el) {
      const c = (el.getAttribute && el.getAttribute("class")) || "";
      return /chart-diagram-leader/.test(c);
    }
    // getBoundingClientRect()はSVG図形の線幅(stroke)を含まないため、
    // 見た目のインク(太い曲線等)に重なっていても矩形上はほとんど重ならない。
    // 実際に読者が「重なって見える」のは描画されたstrokeを含む領域なので、
    // strokeを持つ図形は線幅の半分だけ矩形を外側へ広げてから判定する
    // (2026-08-24、湿気記事の「形が変わる」ラベルが実測0.9pxしか重ならず
    // 検出漏れになった事象への対応)。
    function inflatedShapeRect(el) {
      const r = el.getBoundingClientRect();
      let pad = 0;
      try {
        const cs = getComputedStyle(el);
        const sw = parseFloat(cs.strokeWidth);
        if (cs.stroke && cs.stroke !== "none" && Number.isFinite(sw) && sw > 0) {
          const ctm = el.getScreenCTM && el.getScreenCTM();
          const scale = ctm ? Math.sqrt(Math.abs(ctm.a * ctm.d - ctm.b * ctm.c)) : 1;
          pad = (sw * (Number.isFinite(scale) && scale > 0 ? scale : 1)) / 2;
        }
      } catch (e) {
        pad = 0;
      }
      return {
        left: r.left - pad,
        top: r.top - pad,
        right: r.right + pad,
        bottom: r.bottom + pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      };
    }
    function describeShape(el) {
      const tag = el.tagName ? el.tagName.toLowerCase() : "?";
      const id = el.id ? "#" + el.id : "";
      const cls = (el.getAttribute && el.getAttribute("class")) || "";
      return tag + id + (cls ? "." + cls.trim().split(/\s+/).join(".") : "");
    }

    // 意図的な設計による除外(2026-08-17、§AE追加)。「意図的設計の除外リスト」
    // (docs/CONTRIBUTING.md参照)の1つ。overflow-x: auto/scrollの横スクロール
    // コンテナは、ユーザーがスクロールして末尾要素を見ることを前提にした設計
    // であり得るため、これ自体を無条件でクリッピング/画面外はみ出しとして
    // 検出すると、意図的な設計を誤検知する。ただし「スクロールできることが
    // 案内されていない」横スクロールコンテナは、単なる見切れ事故である可能性が
    // 高いため除外しない。除外の条件は次の両方を満たす場合のみ:
    //   (1) 祖先要素にoverflow-x: auto または scroll が指定されている
    //   (2) その祖先の直近の意味的なまとまり(closest("figure")、無ければ
    //       祖先自身)のテキストに「スクロール」という案内文言が含まれる
    // (2026-08-16、基礎化粧品の基本知識と肌質診断の`.sc101-scroll-wrap`
    // 〔「→ 横にスクロールできます」の案内文付き〕で誤検知していたことが判明、
    // ユーザー決裁により導入)。
    function findScrollHintExclusion(el) {
      let node = el.parentElement;
      while (node && node !== document.body.parentElement) {
        const cs = getComputedStyle(node);
        if (cs.overflowX === "auto" || cs.overflowX === "scroll") {
          const scope = node.closest("figure") || node.parentElement || node;
          const hasHint = /スクロール/.test((scope && scope.textContent) || "");
          if (hasHint) return node;
        }
        node = node.parentElement;
      }
      return null;
    }

    // 最近接のクリッピング祖先(overflowがvisible以外の要素)を根まで辿り、
    // それらの可視領域(getBoundingClientRectの交差)を求める(2026-08-17、
    // §H追加)。従来はSVG自身の矩形とだけ比較していたため、「SVGの外側の
    // 祖先要素(figure/フィギュアラッパー等)がoverflow:hiddenかつ実際の
    // コンテンツより低い高さになっている」ケースを検出できない盲点があった。
    // 2026-08-17(§AE): スクロール案内文付きの横スクロールコンテナ自身は
    // クリッピング祖先の集計から除外する(そのコンテナより外側の祖先は従来通り
    // 集計対象。あくまで「意図的にスクロールで見せる」コンテナ自身のみ除外)。
    function visibleRegion(el) {
      let region = null;
      let node = el.parentElement;
      while (node && node !== document.body.parentElement) {
        const cs = getComputedStyle(node);
        const isExcludedScrollHint =
          (cs.overflowX === "auto" || cs.overflowX === "scroll") &&
          /スクロール/.test(((node.closest("figure") || node.parentElement || node).textContent) || "");
        if (!isExcludedScrollHint && (cs.overflow !== "visible" || cs.overflowX !== "visible" || cs.overflowY !== "visible")) {
          const r = node.getBoundingClientRect();
          region = region
            ? {
                left: Math.max(region.left, r.left),
                top: Math.max(region.top, r.top),
                right: Math.min(region.right, r.right),
                bottom: Math.min(region.bottom, r.bottom),
              }
            : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        }
        node = node.parentElement;
      }
      return region;
    }
    function clippedByRegion(rect, region, tol) {
      if (!region) return false;
      return (
        rect.left < region.left - tol ||
        rect.right > region.right + tol ||
        rect.top < region.top - tol ||
        rect.bottom > region.bottom + tol
      );
    }

    // (A) SVG図解: 特定クラス(chart-svg/chart-diagram-svg)に限定せず、
    // 記事本文内の全<svg>(記事専用ハードコードウィジェットのSVGを含む)を
    // 対象にする(2026-08-17、§Hでセレクタを拡張。従来はwriter.mdが定義する
    // 汎用type由来の2クラスのみを見ており、`lib/*Widgets.js`等の記事専用
    // ハードコードSVGは検査対象から漏れていた)。
    // テキスト×図形の候補(矩形近似で拾い、最後に実インク判定で確定させる)
    const textShapeCandidates = [];
    const svgs = document.querySelectorAll(".article-body svg, .worry-body svg");
    svgs.forEach((svg, svgIndex) => {
      const svgRect = svg.getBoundingClientRect();
      const region = visibleRegion(svg);
      const texts = Array.from(svg.querySelectorAll("text")).filter((t) => t.textContent.trim());
      const boxes = texts.map((t) => ({ el: t, text: t.textContent, rect: t.getBoundingClientRect() }));

      // SVG自体がクリッピング祖先(overflow:hidden等)に囲まれ、SVG自身の
      // 矩形が可視領域より大きい(=SVGごと下端等が切れている)場合も検出する。
      if (clippedByRegion(svgRect, region, TOLERANCE_PX)) {
        results.push({
          type: "ancestor-clip",
          svgIndex,
          elRect: [Math.round(svgRect.left), Math.round(svgRect.top), Math.round(svgRect.right), Math.round(svgRect.bottom)],
          regionRect: region
            ? [Math.round(region.left), Math.round(region.top), Math.round(region.right), Math.round(region.bottom)]
            : null,
        });
      }

      boxes.forEach((b) => {
        if (!containsFully(svgRect, b.rect)) {
          results.push({
            type: "overflow",
            svgIndex,
            text: b.text,
            elRect: [Math.round(b.rect.left), Math.round(b.rect.top), Math.round(b.rect.right), Math.round(b.rect.bottom)],
            containerRect: [Math.round(svgRect.left), Math.round(svgRect.top), Math.round(svgRect.right), Math.round(svgRect.bottom)],
          });
        }
        if (clippedByRegion(b.rect, region, TOLERANCE_PX)) {
          results.push({
            type: "ancestor-clip-text",
            svgIndex,
            text: b.text,
            elRect: [Math.round(b.rect.left), Math.round(b.rect.top), Math.round(b.rect.right), Math.round(b.rect.bottom)],
            regionRect: region
              ? [Math.round(region.left), Math.round(region.top), Math.round(region.right), Math.round(region.bottom)]
              : null,
          });
        }
        if (
          (b.rect.right > document.documentElement.clientWidth + TOLERANCE_PX || b.rect.left < -TOLERANCE_PX) &&
          !findScrollHintExclusion(b.el)
        ) {
          results.push({ type: "offscreen", svgIndex, text: b.text, elRect: [Math.round(b.rect.left), Math.round(b.rect.right)] });
        }
      });

      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          if (rectsOverlap(boxes[i].rect, boxes[j].rect)) {
            results.push({ type: "collision", svgIndex, textA: boxes[i].text, textB: boxes[j].text });
          }
        }
      }

      // (A3) テキスト×図形の重なり(2026-08-24追加)。既存のテキスト同士の判定
      // (上記)には一切手を入れず、別種別`text-shape-overlap`として追加する。
      const shapeCandidates = Array.from(
        svg.querySelectorAll("rect, circle, ellipse, polygon, polyline, path, line, image")
      ).concat(Array.from(document.querySelectorAll(".article-body img, .worry-body img")));
      const shapes = shapeCandidates
        .map((el) => ({ el, rect: inflatedShapeRect(el) }))
        .filter((sh) => sh.rect.width > 0 && sh.rect.height > 0);

      boxes.forEach((b) => {
        if (hasAllowOverlap(b.el)) return;
        shapes.forEach((sh) => {
          if (hasAllowOverlap(sh.el)) return;
          if (isLeaderDecoration(sh.el)) return;
          if (sharesGroup(b.el, sh.el)) return;
          if (!rectsOverlapTol(b.rect, sh.rect, SHAPE_OVERLAP_TOLERANCE_PX)) return;
          // 図形の矩形にテキストが完全に収まっている場合は「箱の中のラベル」として除外
          if (containsFullyTol(sh.rect, b.rect, SHAPE_OVERLAP_TOLERANCE_PX)) return;
          const overlapX = Math.min(b.rect.right, sh.rect.right) - Math.max(b.rect.left, sh.rect.left);
          const overlapY = Math.min(b.rect.bottom, sh.rect.bottom) - Math.max(b.rect.top, sh.rect.top);
          textShapeCandidates.push({
            textEl: b.el,
            shapeEl: sh.el,
            finding: {
              type: "text-shape-overlap",
              svgIndex,
              text: b.text.trim().slice(0, 20),
              shape: describeShape(sh.el),
              overlapX: Math.round(overlapX * 10) / 10,
              overlapY: Math.round(overlapY * 10) / 10,
              textRect: [Math.round(b.rect.left), Math.round(b.rect.top), Math.round(b.rect.right), Math.round(b.rect.bottom)],
              shapeRect: [Math.round(sh.rect.left), Math.round(sh.rect.top), Math.round(sh.rect.right), Math.round(sh.rect.bottom)],
            },
          });
        });
      });
    });

    // (A2) 画像のobject-fit:coverによるクロップ検出(2026-08-17、§S追加)。
    // ラスター画像は文字がピクセルに焼き込まれているため、何がクロップで
    // 失われたかを機械的に判定すること自体は原理的に不可能(OCR等が必要)。
    // ただし「naturalWidth/Heightの比率と、表示コンテナ(aspect-ratio指定時は
    // その比率、無指定時はgetBoundingClientRectの比率)がどれだけ乖離しており、
    // object-fit:coverによって何%相当が切り落とされているか」は構造的に検出
    // できる。これを「クロップ発生リスク」として報告する(実際に重要な内容が
    // 切れているかどうかまでは保証しない、機械検出の限界の範囲内での警告)。
    const CROP_RISK_THRESHOLD_PCT = 5; // これを超える切り落としを「要確認」とする
    // 検出対象はヒーロー画像(.article-hero-image)のみに限定する(2026-08-17、§W)。
    // カードサムネ(.post-card-thumb・.related-post-thumb・.article-next-post-thumb等)は
    // 設計上どの記事の画像でもクロップされる前提のUIパターンであり、「クロップ発生=不具合」
    // という判定基準が成立しない。カード用の判定基準(セーフゾーン規則)は
    // `docs/CONTRIBUTING.md`のセーフゾーン規則導入後に別途設計する(§X参照)。
    document.querySelectorAll("img.article-hero-image").forEach((img, imgIndex) => {
      if (!img.complete || !img.naturalWidth || !img.naturalHeight) return;
      const cs = getComputedStyle(img);
      if (cs.objectFit !== "cover") return;
      const rect = img.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const naturalRatio = img.naturalWidth / img.naturalHeight;
      const displayRatio = rect.width / rect.height;
      // naturalRatio > displayRatio: 元画像の方が横長→左右がクロップされる
      // naturalRatio < displayRatio: 元画像の方が縦長(=表示枠より背が高い)→上下がクロップされる
      let cropPct;
      if (naturalRatio > displayRatio) {
        const visibleWidthAtFullHeight = img.naturalHeight * displayRatio;
        cropPct = (1 - visibleWidthAtFullHeight / img.naturalWidth) * 100;
      } else {
        const visibleHeightAtFullWidth = img.naturalWidth / displayRatio;
        cropPct = (1 - visibleHeightAtFullWidth / img.naturalHeight) * 100;
      }
      if (cropPct > CROP_RISK_THRESHOLD_PCT) {
        results.push({
          type: "image-crop-risk",
          imgIndex,
          src: img.currentSrc || img.src,
          cropAxis: naturalRatio > displayRatio ? "horizontal" : "vertical",
          cropPct: Math.round(cropPct * 10) / 10,
          naturalSize: [img.naturalWidth, img.naturalHeight],
          displaySize: [Math.round(rect.width), Math.round(rect.height)],
        });
      }
    });

    // (B) コールアウトボックス(NEVORAポイント/注意/30秒でわかる/結論だけ知りたい人へ/まとめカード)。
    // 通常はCSSでテキスト折り返しされるため発生しにくいが、scrollWidth>clientWidthで
    // 実際に横方向のオーバーフローが起きていないかを確認する。
    const calloutSelectors = [
      ".nevora-point-box",
      ".warning-box",
      ".quick-summary-box",
      ".quick-conclusion-box",
      ".azelaic-summary-card",
    ];
    document.querySelectorAll(calloutSelectors.join(",")).forEach((box, boxIndex) => {
      box.querySelectorAll("p").forEach((p) => {
        // 折り返し行末の句読点(「」等)の禁則処理(kinsoku shori)による
        // サブピクセル単位の丸め差が、正常な折り返しでもscrollWidthを2px前後
        // 押し上げることを実測で確認した(2026-08-16、当初TOLERANCE_PX=1で
        // 「.nevora-point-box」等に4件の誤検知が出たが、実測ではscrollWidth-clientWidth
        // が2px程度に留まり視覚的なはみ出しは無かった)。コールアウトのテキスト
        // 折り返しはCSSの通常フローに任せているため、これより大きな閾値
        // (CALLOUT_TOLERANCE_PX=6px)を明確な水平オーバーフローの目安とする。
        const CALLOUT_TOLERANCE_PX = 6;
        if (p.scrollWidth > p.clientWidth + CALLOUT_TOLERANCE_PX) {
          results.push({
            type: "callout-overflow",
            boxIndex,
            className: box.className,
            text: p.textContent.slice(0, 40),
          });
        }
      });
    });

    // (A3-2) 実インク確認パス。矩形近似はpathや円の「角」で誤検知するため
    // (曲線のバウンディングボックスだけが重なり、実際の線は離れているケース)、
    // 候補ごとに図形を画面内へスクロールし、重なり矩形上をサンプリングして
    // elementsFromPointのスタックに当該図形が現れるかで確定させる。
    // 既存の検査はすべてこの時点で測定済みのため、ここでのスクロールは影響しない。
    const INK_SAMPLE_STEPS = 7;
    function confirmInkOverlap(textEl, shapeEl) {
      try {
        shapeEl.scrollIntoView({ block: "center", inline: "center" });
      } catch (e) {
        /* noop */
      }
      const tr = textEl.getBoundingClientRect();
      const sr = inflatedShapeRect(shapeEl);
      const left = Math.max(tr.left, sr.left);
      const right = Math.min(tr.right, sr.right);
      const top = Math.max(tr.top, sr.top);
      const bottom = Math.min(tr.bottom, sr.bottom);
      if (right <= left || bottom <= top) return false;
      for (let i = 0; i <= INK_SAMPLE_STEPS; i += 1) {
        for (let j = 0; j <= INK_SAMPLE_STEPS; j += 1) {
          const x = left + ((right - left) * i) / INK_SAMPLE_STEPS;
          const y = top + ((bottom - top) * j) / INK_SAMPLE_STEPS;
          if (x < 0 || y < 0 || x > document.documentElement.clientWidth || y > window.innerHeight) continue;
          const stack = document.elementsFromPoint(x, y);
          if (stack && stack.indexOf(shapeEl) !== -1) return true;
        }
      }
      return false;
    }
    textShapeCandidates.forEach((c) => {
      if (confirmInkOverlap(c.textEl, c.shapeEl)) results.push(c.finding);
    });

    return results;
  });
  return findings.map((f) => ({ ...f, slug }));
}

async function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const slugs = args.filter((a) => a !== "--strict");
  if (slugs.length === 0) {
    console.error("[item35] 対象slugを1件以上指定してください。例: node scripts/verify-rendered-layout.js 2026-08-09_続く美容習慣の作り方");
    process.exit(1);
  }

  let playwright;
  try {
    playwright = require("playwright-core");
  } catch (e) {
    console.error("[item35] playwright-coreが見つかりません。npm installを確認してください。", e.message);
    process.exit(1);
  }

  killPort(PORT);
  console.log(`[item35] next start をポート${PORT}で起動します(事前に npm run build 済みであること)...`);
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: process.cwd(),
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  server.stdout.on("data", (d) => (serverOutput += d.toString()));
  server.stderr.on("data", (d) => (serverOutput += d.toString()));

  try {
    await waitForServer(BASE_URL, 30000);
  } catch (e) {
    console.error("[item35] next start の起動に失敗しました。");
    console.error(serverOutput.slice(-2000));
    killPort(PORT);
    process.exit(1);
  }

  const browser = await playwright.chromium.launch();
  const allFindings = [];

  try {
    for (const slug of slugs) {
      for (const width of VIEWPORT_WIDTHS) {
        const page = await browser.newPage({ viewport: { width, height: 1200 } });
        const url = `${BASE_URL}/posts/${encodeURIComponent(slug)}`;
        const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 20000 }).catch((e) => null);
        if (!resp || !resp.ok()) {
          console.error(`[item35] ページ取得失敗: ${url} (status=${resp ? resp.status() : "no response"})`);
          await page.close();
          continue;
        }
        const findings = await measurePage(page, slug);
        findings.forEach((f) => allFindings.push({ ...f, width }));
        await page.close();
      }
    }
  } finally {
    await browser.close();
    killPort(PORT);
  }

  const overflow = allFindings.filter((f) => f.type === "overflow");
  const collision = allFindings.filter((f) => f.type === "collision");
  const offscreen = allFindings.filter((f) => f.type === "offscreen");
  const calloutOverflow = allFindings.filter((f) => f.type === "callout-overflow");
  const ancestorClip = allFindings.filter((f) => f.type === "ancestor-clip");
  const ancestorClipText = allFindings.filter((f) => f.type === "ancestor-clip-text");
  const imageCropRisk = allFindings.filter((f) => f.type === "image-crop-risk");
  const textShapeOverlap = allFindings.filter((f) => f.type === "text-shape-overlap");

  console.log(
    `[item35] 実測レンダリング検査: 対象${slugs.length}記事×幅${VIEWPORT_WIDTHS.join("/")}px、はみ出し${overflow.length}件・衝突${collision.length}件・画面外${offscreen.length}件・コールアウトはみ出し${calloutOverflow.length}件・祖先クリッピング(SVG)${ancestorClip.length}件・祖先クリッピング(テキスト)${ancestorClipText.length}件・画像クロップリスク${imageCropRisk.length}件・テキスト×図形の重なり${textShapeOverlap.length}件`
  );
  for (const f of overflow) {
    console.log(`[ITEM35_OVERFLOW] ${f.slug}\twidth=${f.width}\tsvg#${f.svgIndex}\ttext=${JSON.stringify(f.text)}\telRect=${JSON.stringify(f.elRect)}\tcontainerRect=${JSON.stringify(f.containerRect)}`);
  }
  for (const f of collision) {
    console.log(`[ITEM35_COLLISION] ${f.slug}\twidth=${f.width}\tsvg#${f.svgIndex}\ttextA=${JSON.stringify(f.textA)}\ttextB=${JSON.stringify(f.textB)}`);
  }
  for (const f of offscreen) {
    console.log(`[ITEM35_OFFSCREEN] ${f.slug}\twidth=${f.width}\tsvg#${f.svgIndex}\ttext=${JSON.stringify(f.text)}\trect=${JSON.stringify(f.elRect)}`);
  }
  for (const f of calloutOverflow) {
    console.log(`[ITEM35_CALLOUT_OVERFLOW] ${f.slug}\twidth=${f.width}\tclass=${JSON.stringify(f.className)}\ttext=${JSON.stringify(f.text)}`);
  }
  for (const f of ancestorClip) {
    console.log(`[ITEM35_ANCESTOR_CLIP] ${f.slug}\twidth=${f.width}\tsvg#${f.svgIndex}\telRect=${JSON.stringify(f.elRect)}\tregionRect=${JSON.stringify(f.regionRect)}`);
  }
  for (const f of ancestorClipText) {
    console.log(`[ITEM35_ANCESTOR_CLIP_TEXT] ${f.slug}\twidth=${f.width}\tsvg#${f.svgIndex}\ttext=${JSON.stringify(f.text)}\telRect=${JSON.stringify(f.elRect)}\tregionRect=${JSON.stringify(f.regionRect)}`);
  }

  for (const f of imageCropRisk) {
    console.log(`[ITEM35_IMAGE_CROP_RISK] ${f.slug}\twidth=${f.width}\tsrc=${JSON.stringify(f.src)}\taxis=${f.cropAxis}\tcropPct=${f.cropPct}\tnaturalSize=${JSON.stringify(f.naturalSize)}\tdisplaySize=${JSON.stringify(f.displaySize)}`);
  }

  for (const f of textShapeOverlap) {
    console.log(`[ITEM35_TEXT_SHAPE_OVERLAP] ${f.slug}	width=${f.width}	svg#${f.svgIndex}	text=${JSON.stringify(f.text)}	shape=${JSON.stringify(f.shape)}	overlap=${f.overlapX}x${f.overlapY}px	textRect=${JSON.stringify(f.textRect)}	shapeRect=${JSON.stringify(f.shapeRect)}`);
  }

  // text-shape-overlapは新設当初、既存記事への遡及影響を避けるため
  // NEVORA_ITEM35_SHAPE_STRICT=1 のときだけ--strictに算入していたが、
  // 2026-08-25に全195記事で検出0件に到達したため、この暫定分岐は廃止し
  // 他の検出と同じ扱い(--strict時にFail)にした(docs/CONTRIBUTING.md 32節)。
  const total =
    textShapeOverlap.length +
    overflow.length +
    collision.length +
    offscreen.length +
    calloutOverflow.length +
    ancestorClip.length +
    ancestorClipText.length +
    imageCropRisk.length;
  if (strict && total > 0) {
    console.error(`[item35] --strict指定のため、検出${total}件をFailとして扱います。`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("[item35] 実行中にエラーが発生しました。", e);
  process.exit(1);
});
