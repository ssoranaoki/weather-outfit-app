import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSensitivityPrompt, parseSensitivityAnswer, BLOCK_START, BLOCK_END } from "../js/sensitivity-advice.js";
import { SENSITIVITY_CHOICES } from "../js/settings.js";

const records = [
  { date: "2026-10-03", kind: "day", rating: "cold", headline: "長袖にうすい上着を。昼は脱いでOK", max: 24, min: 16, humidity: 60, sensitivity: 0 },
  { date: "2026-10-04", kind: "night", rating: "ok", headline: "長袖で寝てください", max: null, min: 16, humidity: null, sensitivity: 0 },
];

test("AI に渡す文: いまの設定・5段階・返答の形・記録の CSV が入る", () => {
  const p = buildSensitivityPrompt({ records, currentValue: 0 });
  assert.match(p, /いまの設定: ふつう（0）/);
  for (const c of SENSITIVITY_CHOICES) assert.ok(p.includes(c.label), c.label);
  assert.ok(p.includes(`${BLOCK_START}\n提案: （5段階の言葉）`));
  assert.ok(p.includes(BLOCK_END));
  assert.match(p, /2026-10-03,服装,寒かった,/);
});

const answer = (body) => `記録を見ると、朝晩に寒さを感じやすいようです。\n\n${BLOCK_START}\n${body}\n${BLOCK_END}\n`;

test("読み取り: 基本形", () => {
  const r = parseSensitivityAnswer(answer("提案: 少し寒がり\n理由: 最低16℃前後で寒かったが3回\n確信度: 中"));
  assert.deepEqual(r, { ok: true, value: 1, label: "少し寒がり", reason: "最低16℃前後で寒かったが3回", confidence: "中" });
});

test("読み取り: AI の揺れ（全角コロン・太字・箇条書き・値の後ろの括弧・コードブロック）に耐える", () => {
  const text = "```\n" + answer("- **提案**：かなり寒がり（+2）\n- **理由**： 全部寒かった\n- **確信度**：高め") + "```";
  const r = parseSensitivityAnswer(text);
  assert.equal(r.ok, true);
  assert.equal(r.value, 2);
  assert.equal(r.reason, "全部寒かった");
  assert.equal(r.confidence, "高");
});

test("読み取り: 例として先に同じ形を書く AI でも、最後のブロックを使う", () => {
  const text = `例:\n${BLOCK_START}\n提案: （5段階の言葉）\n${BLOCK_END}\n\n本番:\n` + answer("提案: 少し暑がり\n理由: 暑かったが多い\n確信度: 低");
  assert.equal(parseSensitivityAnswer(text).value, -1);
});

test("読み取り: 「寒がり」だけなど、選択肢にない言葉は受け付けない", () => {
  const r = parseSensitivityAnswer(answer("提案: 寒がり\n理由: x\n確信度: 中"));
  assert.equal(r.ok, false);
  assert.match(r.error, /選択肢にありません/);
});

test("読み取り: ブロックがない・提案の行がないときは、分かる言葉で断る", () => {
  assert.match(parseSensitivityAnswer("寒がりだと思います").error, /見つかりません/);
  assert.match(parseSensitivityAnswer(answer("理由: x")).error, /「提案:」の行が見つかりません/);
});

test("読み取り: 理由は長すぎたら切り、確信度が変なら null", () => {
  const r = parseSensitivityAnswer(answer(`提案: ふつう\n理由: ${"あ".repeat(500)}\n確信度: たぶん`));
  assert.equal(r.reason.length, 200);
  assert.equal(r.confidence, null);
});
