/**
 * 公開スケジュール(どの曜日に出すか・何時に出すか)の生成ロジック。
 *
 * - 公開は1日1本まで(同日に複数本は出さない)
 * - 公開日はカレンダー週(月〜日)ごとに weeklyMin〜weeklyMax 日(乱数)
 * - 基準曜日は火・金。3日目は月・土から1日選ぶ
 * - 公開時刻は 7:00〜22:00 の間で乱数
 * - 休載日は上記の裏返しで週4〜5日になる。週の大半が休載になる前提のため、
 *   旧実装にあった「休載3日以上連続の禁止」制約は設けない
 */
const { addDays, weekdayIndexMonday, randInt } = require("./queue-lib");

const HOUR_MIN = 7;
const HOUR_MAX = 22;

// 週の公開曜日の軸(0=月 .. 6=日)。編集部の定期更新らしさを出すため火・金を固定にする
const BASE_WEEKDAYS = [1, 4];
// 3日目の候補。火・金と隣接しない曜日から選ぶ。
// 水曜(2)は候補から外している。週1本の「編集部集計記事」を水曜に手動公開する
// 運用のため、キューが水曜を使わないようにして同日重複を曜日レベルで防ぐ。
const EXTRA_WEEKDAYS = [0, 5];

/** その週に公開する曜日インデックスを選ぶ(昇順) */
function pickPublishWeekdays(weeklyMin, weeklyMax) {
  const count = randInt(weeklyMin, weeklyMax);
  const days = new Set(BASE_WEEKDAYS.slice(0, Math.min(count, BASE_WEEKDAYS.length)));
  const extras = [...EXTRA_WEEKDAYS];
  while (days.size < count && extras.length > 0) {
    days.add(extras.splice(randInt(0, extras.length - 1), 1)[0]);
  }
  return [...days].sort((a, b) => a - b);
}

/** 1本ぶんの公開時刻(分単位) */
function pickTime() {
  return randInt(HOUR_MIN, HOUR_MAX - 1) * 60 + randInt(0, 59);
}

/**
 * startDate から、count 本ぶんの公開日時を組み立てる。
 * @param {Date} startDate 割り当てを開始する日(この日を含む)
 * @param {number} count 割り当てる本数
 * @param {{weeklyMin:number, weeklyMax:number}} opts
 * @returns {{date:Date, hour:number, minute:number}[]} 昇順
 */
function buildSchedule(startDate, count, opts) {
  const { weeklyMin, weeklyMax } = opts;
  const result = [];
  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  let guardWeeks = 0;

  while (result.length < count && guardWeeks++ < 520) {
    // 初回は週の途中から始まりうるため、cursorの曜日より前の公開曜日は飛ばす
    const offset = weekdayIndexMonday(cursor);
    for (const wd of pickPublishWeekdays(weeklyMin, weeklyMax)) {
      if (result.length >= count) break;
      if (wd < offset) continue;
      const minutes = pickTime();
      result.push({
        date: addDays(cursor, wd - offset),
        hour: Math.floor(minutes / 60),
        minute: minutes % 60,
      });
    }
    cursor = addDays(cursor, 7 - offset); // 次の週の月曜へ
  }

  return result;
}

module.exports = { buildSchedule, HOUR_MIN, HOUR_MAX };
