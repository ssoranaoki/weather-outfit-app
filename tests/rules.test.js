import { test } from "node:test";
import assert from "node:assert/strict";
import { dayAdvice, pajamaAdvice, decideMode, addDays } from "../js/rules.js";

// 7〜18 時の 12 時間分を、最低→最高→少し下がる形で作る
function dayHours(min, max, { humidity = 50, rainFrom = null, rainProb = 70 } = {}) {
  const hours = [];
  for (let h = 7; h <= 18; h++) {
    const t = h <= 14 ? min + ((max - min) * (h - 7)) / 7 : max - (h - 14);
    hours.push({ hour: h, apparent: t, humidity, precipProb: rainFrom !== null && h >= rainFrom ? rainProb : 10 });
  }
  return hours;
}

test("寒暖差が大きい日: 長袖＋ジャケット、昼は脱いでOK", () => {
  const a = dayAdvice(dayHours(12, 21), 0);
  assert.equal(a.headline, "長袖にジャケットを。昼は脱いでOK");
  assert.deepEqual(a.stats, { max: 21, min: 12, humidity: 50 });
});

test("暑い日: 上着なし", () => {
  const a = dayAdvice(dayHours(24, 30), 0);
  assert.equal(a.headline, "半袖1枚で過ごせます");
});

test("寒暖差が小さい寒い日: 着たまま", () => {
  const a = dayAdvice(dayHours(5, 9), 0);
  assert.equal(a.headline, "セーターに厚手のコートを（1日着たままで）");
  assert.equal(a.items[0].label, "手袋・マフラー");
});

test("寒がり度 +2 は 4℃ 寒く判定する", () => {
  const normal = dayAdvice(dayHours(20, 26), 0);
  const cold = dayAdvice(dayHours(20, 26), 2);
  assert.equal(normal.headline, "半袖1枚で過ごせます");
  assert.equal(cold.headline, "長袖にうすい上着を（1日着たままで）");
});

test("雨の注意は最初に 50% を超えた時刻を出す", () => {
  const a = dayAdvice(dayHours(15, 20, { rainFrom: 13 }), 0);
  assert.ok(a.notes[0].startsWith("☂ 13時ごろから雨"));
});

test("蒸し暑い日の注意", () => {
  const a = dayAdvice(dayHours(26, 31, { humidity: 80 }), 0);
  assert.ok(a.notes.includes("蒸し暑い日です。通気性のよい素材を"));
});

const night = (min, humidity = 60) => Array.from({ length: 9 }, (_, i) => ({ temp: min + (8 - i) * 0.5, humidity }));

test("寝間着: 15〜19℃ は長袖", () => {
  assert.equal(pajamaAdvice(night(16), [], 0).headline, "長袖で寝てください");
});

test("寝間着: 昨夜より 5℃ 以上冷えると先頭で強調", () => {
  const p = pajamaAdvice(night(11), night(17), 0);
  assert.equal(p.notes[0], "⚠ 昨夜より 6℃ 冷えます");
  assert.equal(p.headline, "長袖に厚手の掛け布団で");
});

test("寝間着: 乾燥した寒い夜は加湿の注意", () => {
  const p = pajamaAdvice(night(12, 35), [], 0);
  assert.ok(p.notes.includes("空気が乾燥します。加湿と水分補給を"));
});

test("モード: 7時は朝（今日）、22時は就寝前（明日）、1時は就寝前（今日）", () => {
  assert.deepEqual(decideMode(new Date(2026, 9, 1, 7)), { mode: "day", target: "2026-10-01" });
  assert.deepEqual(decideMode(new Date(2026, 9, 1, 22)), { mode: "night", target: "2026-10-02" });
  assert.deepEqual(decideMode(new Date(2026, 9, 2, 1)), { mode: "night", target: "2026-10-02" });
});

test("日付の加算は月末をまたげる", () => {
  assert.equal(addDays("2026-09-30", 1), "2026-10-01");
});
