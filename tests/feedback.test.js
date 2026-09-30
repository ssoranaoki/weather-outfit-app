import { test } from "node:test";
import assert from "node:assert/strict";
import { upsertRecord, findRecord, toCsv } from "../js/feedback.js";

const rec = (date, kind, rating, extra = {}) => ({
  date, kind, rating, headline: "長袖にジャケットを。昼は脱いでOK", max: 21, min: 12, humidity: 60, sensitivity: 0, ...extra,
});

test("同じ日・同じ種類は上書きされる（押し直しできる）", () => {
  let list = upsertRecord([], rec("2026-10-01", "day", "cold"));
  list = upsertRecord(list, rec("2026-10-01", "day", "ok"));
  assert.equal(list.length, 1);
  assert.equal(findRecord(list, "2026-10-01", "day").rating, "ok");
});

test("服装と寝間着は同じ日でも別々に記録される", () => {
  let list = upsertRecord([], rec("2026-10-01", "day", "ok"));
  list = upsertRecord(list, rec("2026-10-01", "night", "cold", { max: null, humidity: null }));
  assert.equal(list.length, 2);
});

test("記録は日付順に並ぶ", () => {
  let list = upsertRecord([], rec("2026-10-03", "day", "ok"));
  list = upsertRecord(list, rec("2026-10-01", "day", "hot"));
  assert.deepEqual(list.map((r) => r.date), ["2026-10-01", "2026-10-03"]);
});

test("CSV: 日本語ラベルに変換し、カンマを含む値は引用符で囲む", () => {
  const csv = toCsv([rec("2026-10-01", "day", "cold", { headline: 'A,B "C"' })]);
  const [header, row] = csv.split("\n");
  assert.equal(header, "日付,種類,評価,アドバイス,最高(体感),最低,湿度,寒がり度");
  assert.equal(row, '2026-10-01,服装,寒かった,"A,B ""C""",21,12,60,0');
});

test("CSV: 寝間着の記録は空欄を空のまま出す", () => {
  const csv = toCsv([rec("2026-10-01", "night", "ok", { headline: "長袖で寝てください", max: null, humidity: null, min: 14 })]);
  assert.equal(csv.split("\n")[1], "2026-10-01,寝間着,ちょうどよい,長袖で寝てください,,14,,0");
});
