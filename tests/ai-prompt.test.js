import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAiPrompt, placeText, LLMS_URL, LLMS_RAW_URL } from "../js/ai-prompt.js";
import { BASE_URL } from "../tools/build-llms.mjs";

const yoro = { name: "岐阜県養老町鷲巣", latitude: 35.286, longitude: 136.56 };

test("夜は「明日の服装と今夜の寝間着」、地域と寒がり度が入る", () => {
  const p = buildAiPrompt({ place: yoro, sensitivityLabel: "少し寒がり", mode: "night" });
  assert.equal(
    p,
    [
      "次の説明書を読んで、その手順で明日の岐阜県養老町鷲巣の服装と、今夜の寝間着を教えてください。",
      `説明書: ${LLMS_URL}`,
      `（読めない場合はこちら: ${LLMS_RAW_URL}）`,
      "私の寒がり度は「少し寒がり」です。",
    ].join("\n"),
  );
});

test("朝は「今日の服装」だけ", () => {
  const p = buildAiPrompt({ place: yoro, sensitivityLabel: "ふつう", mode: "day" });
  assert.match(p, /今日の岐阜県養老町鷲巣の服装を教えてください。/);
  assert.doesNotMatch(p, /寝間着/);
});

test("「現在地」で登録した場合は、丸めた緯度経度を書く", () => {
  assert.equal(placeText({ name: "現在地", latitude: 35.29, longitude: 136.56 }), "北緯35.29・東経136.56の地点");
});

test("プロンプトの URL が、実際に公開している llms.txt の場所と一致する", () => {
  assert.equal(LLMS_URL, `${BASE_URL}llms.txt`);
  assert.ok(readFileSync(new URL("../llms.txt", import.meta.url), "utf8").includes(LLMS_RAW_URL));
});
