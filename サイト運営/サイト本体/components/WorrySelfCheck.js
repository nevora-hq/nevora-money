import { useState } from "react";

// 記事のdiagnosis型チャート(lib/posts.js renderDiagnosisHtml +
// components/diagnosisWidget.js)と見た目を揃えるため、.chart-diagnosis* の
// 既存CSSクラスをそのまま再利用する(新規CSSは追加していない)。
// ロジックはdiagnosisWidget.js(バニラJSによる静的HTMLの後付け拡張)とは
// 独立したReact実装で、5問固定・選択肢は「あてはまる/あてはまらない」の
// 2択(1点/0点)のみを扱う。
export default function WorrySelfCheck({ title = "セルフチェック", items, judgements }) {
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  if (!Array.isArray(items) || items.length === 0) return null;
  if (!Array.isArray(judgements) || judgements.length === 0) return null;

  function handleChoice(points) {
    const nextScore = score + points;
    const nextStep = step + 1;
    setScore(nextScore);
    if (nextStep >= items.length) {
      setDone(true);
    } else {
      setStep(nextStep);
    }
  }

  function restart() {
    setStep(0);
    setScore(0);
    setDone(false);
  }

  const outcome = done
    ? judgements.find(
        (j) =>
          (j.min === undefined || j.min === null || score >= j.min) &&
          (j.max === undefined || j.max === null || score <= j.max)
      )
    : null;

  return (
    <div className="chart-diagnosis">
      <p className="chart-title">{title}</p>

      {!done && (
        <>
          <p className="chart-diagnosis-progress">
            セルフチェック {step + 1} / {items.length}
          </p>
          <div className="chart-diagnosis-questions">
            <div className="chart-diagnosis-question">
              <p className="chart-diagnosis-question-text">
                Q{step + 1}. {items[step]}
              </p>
              <div className="chart-diagnosis-choices">
                <button
                  type="button"
                  className="chart-diagnosis-choice"
                  onClick={() => handleChoice(1)}
                >
                  あてはまる
                </button>
                <button
                  type="button"
                  className="chart-diagnosis-choice"
                  onClick={() => handleChoice(0)}
                >
                  あてはまらない
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {done && outcome && (
        <div className="chart-diagnosis-result">
          <p
            className="chart-diagnosis-result-badge"
            style={{ background: outcome.color || "var(--chart-accent)" }}
          >
            {outcome.label}
          </p>
          <p className="chart-diagnosis-result-desc">{outcome.desc}</p>
          <button type="button" className="chart-diagnosis-restart" onClick={restart}>
            もう一度診断する
          </button>
        </div>
      )}

      <div className="chart-diagnosis-outcomes">
        <p className="chart-diagnosis-outcomes-title">診断結果タイプ一覧</p>
        <ul className="chart-diagnosis-outcomes-list">
          {judgements.map((j, i) => (
            <li key={i} className="chart-diagnosis-outcome-item">
              <span
                className="chart-diagnosis-outcome-badge"
                style={{ background: j.color || "var(--chart-accent)" }}
              >
                {j.label}
              </span>
              <span className="chart-diagnosis-outcome-desc">{j.desc}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
