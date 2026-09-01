import { useState } from "react";
import Link from "next/link";
import { getWorryItemBySlug } from "../lib/worryTopics";
import { postHref } from "../lib/urls";

// セルフ診断ウィザードの汎用コンポーネント。
// 質問・結果はすべて lib/diagnosisTopics.js のデータから受け取り、
// このコンポーネント自体はジャンルに依存しない(表示ロジックのみ)。
function calculateResult(answers, results, defaultType) {
  const totals = {};
  Object.keys(results).forEach((type) => {
    totals[type] = 0;
  });
  answers.forEach((choice) => {
    Object.entries(choice.score || {}).forEach(([type, point]) => {
      totals[type] = (totals[type] || 0) + point;
    });
  });

  let bestType = defaultType || Object.keys(results)[0];
  let bestScore = -Infinity;
  Object.entries(totals).forEach(([type, score]) => {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  });
  return bestType;
}

export default function DiagnosisQuiz({ questions = [], results = {}, defaultType, disclaimer }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);

  if (questions.length === 0) return null;

  const isFinished = step >= questions.length;
  const resultType = isFinished ? calculateResult(answers, results, defaultType) : null;
  const result = resultType ? results[resultType] : null;

  const handleAnswer = (choice) => {
    setAnswers((prev) => [...prev, choice]);
    setStep((prev) => prev + 1);
  };

  const handleRestart = () => {
    setStep(0);
    setAnswers([]);
  };

  if (isFinished && result) {
    const worrySlugs = Array.isArray(result.worrySlugs) ? result.worrySlugs : [];
    return (
      <div className="skin-quiz-result">
        {result.emoji && (
          <p className="skin-quiz-result-emoji" aria-hidden="true">
            {result.emoji}
          </p>
        )}
        <h2 className="skin-quiz-result-title">あなたは「{result.title}」の可能性があります</h2>
        <p className="skin-quiz-result-desc">{result.description}</p>
        {disclaimer && <p className="skin-quiz-note">{disclaimer}</p>}
        <div className="skin-quiz-actions">
          {result.slug && (
            <Link href={postHref(result.slug)} className="skin-quiz-cta">
              {result.title.replace("タイプ", "")}について詳しく見る →
            </Link>
          )}
          {worrySlugs.map((worrySlug) => {
            const worryItem = getWorryItemBySlug(worrySlug);
            if (!worryItem) return null;
            return (
              <Link
                key={worrySlug}
                href={`/worry/${worrySlug}`}
                className="skin-quiz-cta skin-quiz-cta-secondary"
              >
                「{worryItem.label}」の悩みページを見る →
              </Link>
            );
          })}
          <button type="button" className="skin-quiz-restart" onClick={handleRestart}>
            もう一度診断する
          </button>
        </div>
      </div>
    );
  }

  const question = questions[step];

  return (
    <div className="skin-quiz">
      <p className="skin-quiz-progress">
        質問 {step + 1} / {questions.length}
      </p>
      <h2 className="skin-quiz-question">{question.text}</h2>
      <div className="skin-quiz-choices">
        {question.choices.map((choice, i) => (
          <button
            key={i}
            type="button"
            className="skin-quiz-choice"
            onClick={() => handleAnswer(choice)}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}
