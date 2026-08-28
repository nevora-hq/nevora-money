// frontmatterのchart type "diagnosis"(lib/posts.js renderDiagnosisHtml)が出力した
// 静的HTML(質問・選択肢・全結果タイプ一覧が最初からすべて存在するHTML)を、
// JS有効時のみ1問ずつ進めるウィザードUIにプログレッシブエンハンスメントする。
// 記事ごとの専用Reactコンポーネントは持たず、data-diagnosis属性を持つ要素であれば
// どの記事でも同じロジックで動く(2026-08-09、DrySkinSelfCheck.js置き換えのため新設)。
export function initDiagnosisWidgets(root = document) {
  const widgets = root.querySelectorAll(".chart-diagnosis[data-diagnosis]");
  widgets.forEach((el) => {
    if (el.dataset.diagnosisReady) return;
    el.dataset.diagnosisReady = "1";
    enhanceDiagnosisWidget(el);
  });
}

function enhanceDiagnosisWidget(el) {
  let data;
  try {
    data = JSON.parse(el.dataset.diagnosis);
  } catch {
    return;
  }

  const resolution = data.resolution === "pattern" ? "pattern" : "score";
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const outcomes = Array.isArray(data.outcomes) ? data.outcomes : [];
  const questionEls = Array.from(el.querySelectorAll(".chart-diagnosis-question"));
  if (questions.length === 0 || questionEls.length !== questions.length) return;

  const questionsWrap = el.querySelector(".chart-diagnosis-questions");
  if (!questionsWrap) return;

  el.classList.add("chart-diagnosis-js");

  const progressEl = document.createElement("p");
  progressEl.className = "chart-diagnosis-progress";
  questionsWrap.before(progressEl);

  const resultEl = document.createElement("div");
  resultEl.className = "chart-diagnosis-result";
  resultEl.hidden = true;
  questionsWrap.after(resultEl);

  let total = 0; // resolution: "score"のみ使用
  let answers = {}; // resolution: "pattern"のみ使用(質問id → 選んだ選択肢のlabel)
  let forcedOutcomeLabels = new Set(); // pattern方式でforceOutcomeが発火したoutcomeのlabel集合

  // スコア方式: 合計点がminScore〜maxScoreに収まるoutcomeを返す
  function findOutcomeByScore() {
    return outcomes.find(
      (o) =>
        (o.minScore === undefined || o.minScore === null || total >= o.minScore) &&
        (o.maxScore === undefined || o.maxScore === null || total <= o.maxScore)
    );
  }

  // パターン方式: forceOutcomeが1件でも発火していればそれを優先する(「懸念サインが
  // 1つでもあれば安全側の判定に倒す」ための仕組み)。発火が無ければ、質問ごとの
  // 回答一致数が最も多いoutcomeを採用する(最多一致方式)。一致数が同数の場合、
  // および複数のforceOutcomeが同時に発火した場合は、いずれもoutcomes配列の
  // 定義順で先に出てくる方を優先する(matches > bestMatchesという厳密な不等号で
  // 判定し、>=にしないことで先勝ちを保証している)。
  function findOutcomeByPattern() {
    if (forcedOutcomeLabels.size > 0) {
      const forced = outcomes.find((o) => forcedOutcomeLabels.has(o.label));
      if (forced) return forced;
    }
    let best = null;
    let bestMatches = -1;
    for (const outcome of outcomes) {
      let matches = 0;
      for (const q of questions) {
        if (q.id !== undefined && outcome.answers && outcome.answers[q.id] === answers[q.id]) {
          matches++;
        }
      }
      if (matches > bestMatches) {
        bestMatches = matches;
        best = outcome;
      }
    }
    return best;
  }

  function showStep(i) {
    questionEls.forEach((qEl, idx) => {
      qEl.hidden = idx !== i;
    });
    progressEl.hidden = false;
    progressEl.textContent = `セルフ診断 ${i + 1} / ${questionEls.length}`;
    resultEl.hidden = true;
  }

  function showResult() {
    questionEls.forEach((qEl) => {
      qEl.hidden = true;
    });
    progressEl.hidden = true;

    const outcome = resolution === "pattern" ? findOutcomeByPattern() : findOutcomeByScore();
    resultEl.textContent = "";

    if (outcome) {
      const badge = document.createElement("p");
      badge.className = "chart-diagnosis-result-badge";
      if (outcome.color) badge.style.background = outcome.color;
      badge.textContent = outcome.label || "";
      resultEl.appendChild(badge);

      if (outcome.desc) {
        const desc = document.createElement("p");
        desc.className = "chart-diagnosis-result-desc";
        desc.textContent = outcome.desc;
        resultEl.appendChild(desc);
      }
    }

    const restart = document.createElement("button");
    restart.type = "button";
    restart.className = "chart-diagnosis-restart";
    restart.textContent = "もう一度診断する";
    restart.addEventListener("click", () => {
      total = 0;
      answers = {};
      forcedOutcomeLabels = new Set();
      showStep(0);
    });
    resultEl.appendChild(restart);
    resultEl.hidden = false;
  }

  el.addEventListener("click", (event) => {
    const button = event.target.closest(".chart-diagnosis-choice");
    if (!button || !el.contains(button)) return;

    const questionEl = button.closest(".chart-diagnosis-question");
    const qIndex = Number(questionEl?.dataset.qIndex);
    const choiceIndex = Number(button.dataset.choiceIndex);
    const question = questions[qIndex];
    const choice = question?.choices?.[choiceIndex];

    if (resolution === "pattern") {
      if (question?.id !== undefined) answers[question.id] = choice?.label;
      if (choice?.forceOutcome) forcedOutcomeLabels.add(choice.forceOutcome);
    } else {
      total += Number(choice?.score) || 0;
    }

    const nextStep = qIndex + 1;
    if (nextStep >= questionEls.length) {
      showResult();
    } else {
      showStep(nextStep);
    }
  });

  showStep(0);
}
