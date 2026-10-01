import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCatalog, buildLlmsTxt, bands } from "../tools/build-llms.mjs";
import { CLOTHES, innerWear, outerWear, pajamaBand, SENSITIVITY_STEP } from "../js/rules.js";
import { SENSITIVITY_CHOICES } from "../js/settings.js";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const regen = "rules.js から作り直してください: node tools/build-llms.mjs";

test("コミット済みの llms.txt が rules.js と一致している", () => {
  assert.equal(read("llms.txt"), buildLlmsTxt(), regen);
});

test("コミット済みの catalog.json が rules.js と一致している", () => {
  assert.deepEqual(JSON.parse(read("catalog.json")), buildCatalog(), regen);
});

test("llms.txt は仕様どおり H1 で始まり、要約の引用ブロックがある", () => {
  const lines = read("llms.txt").split("\n");
  assert.match(lines[0], /^# \S/);
  assert.ok(lines.some((l) => l.startsWith("> ")));
});

test("区分表: 区分の境目が判定関数の切り替わりと一致する", () => {
  for (const [fn, key] of [
    [innerWear, (v) => v.top.id],
    [outerWear, (v) => v?.id ?? "none"],
    [pajamaBand, (v) => v.headline + v.ac],
  ]) {
    const bs = bands(fn, key);
    for (let i = 1; i < bs.length; i++) {
      const edge = bs[i].min;
      assert.notEqual(key(fn(edge - 1)), key(fn(edge)), `${edge}℃ が境目のはず`);
    }
  }
});

test("catalog.json の服は全部、公開 URL の画像を指す", () => {
  const c = buildCatalog();
  assert.equal(c.items.length, Object.keys(CLOTHES).length);
  for (const i of c.items) assert.match(i.image, /^https:\/\/ssoranaoki\.github\.io\/weather-outfit-app\/img\/clothes\/[a-z-]+\.jpg$/);
});

test("寒がり度: アプリの設定画面と同じ 5 段階の言葉と、AI が利用者に聞く指示がある", () => {
  const txt = buildLlmsTxt();
  for (const c of SENSITIVITY_CHOICES) assert.ok(txt.includes(`| ${c.label} |`), `${c.label} がない`);
  assert.match(txt, /判定の前に、利用者に1回だけ聞いて/);
  assert.match(txt, /0\. \*\*寒がり度を確認する\*\*/);
});

test("catalog.json の寒がり度: 値ごとの補正が判定と同じ向き（寒がりほど低い気温で判定）", () => {
  const ch = buildCatalog().rules.sensitivityChoices;
  assert.equal(ch.length, SENSITIVITY_CHOICES.length);
  for (const c of ch) assert.equal(c.judgeShiftCelsius, -c.value * SENSITIVITY_STEP + 0); // +0 で -0 を 0 にそろえる
  assert.ok(ch.find((c) => c.label === "かなり寒がり").judgeShiftCelsius < 0);
});

import { PRECIP_BLOCKS } from "../js/rules.js";

test("llms.txt と catalog.json に、アプリと同じ降水確率の時間帯が載っている", () => {
  const txt = buildLlmsTxt();
  for (const b of PRECIP_BLOCKS) assert.ok(txt.includes(`${b.label}（${b.from}〜${b.to}時）`), `${b.label} がない`);
  assert.deepEqual(buildCatalog().rules.precipBlocks, PRECIP_BLOCKS);
});
