import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCatalog, buildLlmsTxt, bands } from "../tools/build-llms.mjs";
import { CLOTHES, innerWear, outerWear, pajamaBand } from "../js/rules.js";

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
