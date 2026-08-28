// 公開済み・確定稿の全記事にverify-article.jsを一括実行し、
// 記事ごとのoverall・ブロッキング違反の項目番号、フォルダ別の違反記事数
// サマリを出力する。verify-article.js自体は変更しない(1記事ずつの詳細
// 判定ロジックは唯一の正であるverify-article.jsに委ね、本スクリプトは
// それを全記事分ループして集計するだけの薄いラッパー)。
//
// 使い方: npm run verify:all (サイト運営\サイト本体 で実行)
// 新規のブロッキング項目をverify-article.jsへ追加した場合、
// docs/CONTRIBUTING.md 13節の遡及検証義務に従い、このコマンドの実行結果を
// 完了報告に必ず含めること(2026-08-14追加)。

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const VERIFY_SCRIPT = path.join(__dirname, "verify-article.js");

const FOLDERS = {
  公開済み: path.join(__dirname, "..", "..", "記事データ", "公開済み"),
  確定稿: path.join(__dirname, "..", "..", "記事データ", "確定稿"),
};

function runOne(filePath) {
  const out = execFileSync("node", [VERIFY_SCRIPT, filePath], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(out);
}

function main() {
  const perArticle = [];
  const folderSummary = {};

  for (const [folderName, dir] of Object.entries(FOLDERS)) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    let violatedCount = 0;
    const itemCounts = {};

    for (const file of files) {
      const full = path.join(dir, file);
      let result;
      try {
        result = runOne(full);
      } catch (e) {
        perArticle.push({ folder: folderName, file, error: e.message.slice(0, 300) });
        continue;
      }
      const blockingViolated = result.items
        .filter((it) => it.result === "No")
        .map((it) => it.id);

      perArticle.push({
        folder: folderName,
        file,
        overall: result.overall,
        violatedItems: blockingViolated,
      });

      if (result.overall === "No") {
        violatedCount += 1;
        blockingViolated.forEach((id) => {
          itemCounts[id] = (itemCounts[id] || 0) + 1;
        });
      }
    }

    folderSummary[folderName] = { total: files.length, violatedCount, itemCounts };
  }

  console.log("=== 記事別結果(overall=Noのみ表示。全件はJSON出力を参照) ===");
  perArticle
    .filter((a) => a.overall === "No" || a.error)
    .forEach((a) => {
      if (a.error) {
        console.log(`[${a.folder}] ${a.file}: ERROR ${a.error}`);
      } else {
        console.log(`[${a.folder}] ${a.file}: overall=No, violated items=[${a.violatedItems.join(",")}]`);
      }
    });

  console.log("");
  console.log("=== フォルダ別サマリ ===");
  for (const [folderName, s] of Object.entries(folderSummary)) {
    const itemBreakdown = Object.entries(s.itemCounts)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([id, count]) => `item${id}=${count}`)
      .join(", ");
    console.log(`${folderName}: ${s.total}記事中 ${s.violatedCount}記事がoverall=No (違反項目内訳: ${itemBreakdown || "なし"})`);
  }

  const totalArticles = Object.values(folderSummary).reduce((sum, s) => sum + s.total, 0);
  const totalViolated = Object.values(folderSummary).reduce((sum, s) => sum + s.violatedCount, 0);
  console.log("");
  console.log(`=== 全体合計: ${totalArticles}記事中 ${totalViolated}記事がoverall=No ===`);
}

main();
