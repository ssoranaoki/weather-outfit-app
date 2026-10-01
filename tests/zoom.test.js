import { test } from "node:test";
import assert from "node:assert/strict";
import { flipTransform, zoomSize } from "../js/zoom.js";

test("元カード（左上・小）から中央の拡大カードへ: 移動量と倍率", () => {
  // 画面 390x844 のスマホ。元カード 100x100 が (30, 300)、拡大カード 320x320 が中央 (35, 262)
  const from = { left: 30, top: 300, width: 100, height: 100 };
  const to = { left: 35, top: 262, width: 320, height: 320 };
  // 中心: from (80, 350) / to (195, 422) → dx=-115, dy=-72、倍率 100/320
  assert.equal(flipTransform(from, to), "translate(-115px, -72px) scale(0.3125)");
});

test("同じ位置・同じ大きさなら変形なし", () => {
  const r = { left: 10, top: 20, width: 200, height: 200 };
  assert.equal(flipTransform(r, r), "translate(0px, 0px) scale(1)");
});

test("拡大の大きさ: スマホ縦は幅の 82%、横長は高さの 60%、PC は 420px まで", () => {
  assert.equal(zoomSize(390, 844), 320); // 390*0.82=319.8
  assert.equal(zoomSize(844, 390), 234); // 390*0.6
  assert.equal(zoomSize(1440, 900), 420);
});
