import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAiPrompt, placeText, weatherBlock, LLMS_URL } from "../js/ai-prompt.js";
import { dayAdvice, pajamaAdvice } from "../js/rules.js";

const yoro = { name: "岐阜県養老町鷲巣", latitude: 35.286, longitude: 136.56 };

// Open-Meteo と同じく小数 1 桁の値
const day = Array.from({ length: 12 }, (_, i) => ({
  hour: 7 + i, apparent: [14.3, 15.1, 16.8, 18.2, 19.6, 20.9, 21.4, 21.0, 20.2, 19.1, 17.7, 16.5][i],
  humidity: 60 + i, precipProb: i >= 6 ? 55 : 10, temp: 0,
}));
const night = [22, 23, 0, 1, 2, 3, 4, 5, 6].map((hour, i) => ({ hour, temp: 16.4 - i * 0.4, humidity: 70 }));
const lastNight = night.map((r) => ({ ...r, temp: r.temp + 6 }));
const weather = { fetchedAt: new Date(2026, 9, 1, 21, 6), target: "2026-10-02", day, night, lastNight };

test("説明書はリポジトリ直接の URL だけ（GitHub Pages の URL は入れない）", () => {
  const p = buildAiPrompt({ place: yoro, sensitivityLabel: "ふつう", mode: "night", weather });
  assert.ok(p.includes(`説明書: ${LLMS_URL}`));
  assert.match(LLMS_URL, /^https:\/\/raw\.githubusercontent\.com\//);
  assert.doesNotMatch(p, /github\.io/);
});

test("夜は明日の服装と今夜の寝間着。地域・寒がり度・天気データ・出典が入る", () => {
  const p = buildAiPrompt({ place: yoro, sensitivityLabel: "少し寒がり", mode: "night", weather });
  assert.match(p, /^次の説明書を読んで、その手順で明日の岐阜県養老町鷲巣の服装と、今夜の寝間着を教えてください。/);
  assert.match(p, /私の寒がり度は「少し寒がり」です。/);
  assert.match(p, /天気は自分で調べず、下の天気データを使ってください。/);
  assert.match(p, /【天気データ】Open-Meteo\.com（CC BY 4\.0）、10\/1 21:06 取得/);
  assert.match(p, /10\/2 日中 体感気温\(℃\): 7時 14\.3, 8時 15\.1/);
  assert.match(p, /今夜 気温\(℃\): 22時 16\.4/);
  assert.match(p, /昨夜の最低気温\(℃\): 19/);
});

test("朝は今日の服装だけ（寝間着と夜のデータは入れない）", () => {
  const p = buildAiPrompt({ place: yoro, sensitivityLabel: "ふつう", mode: "day", weather: { ...weather, night: [], lastNight: [] } });
  assert.match(p, /今日の岐阜県養老町鷲巣の服装を教えてください。/);
  assert.doesNotMatch(p, /寝間着|今夜/);
});

// プロンプトの文字から数値を読み戻す（AI が読むのと同じ情報だけを使う）
function parseSeries(block, label) {
  const line = block.split("\n").find((l) => l.includes(label));
  return [...line.split(": ")[1].matchAll(/(\d+)時 (-?[\d.]+)/g)].map((m) => ({ hour: +m[1], v: +m[2] }));
}

test("天気データだけで判定し直しても、アプリと同じ結論になる（情報が欠けていない）", () => {
  const block = weatherBlock(weather);
  const ap = parseSeries(block, "日中 体感気温");
  const hu = parseSeries(block, "日中 湿度");
  const pp = parseSeries(block, "日中 降水確率");
  const rebuilt = ap.map((a, i) => ({ hour: a.hour, apparent: a.v, humidity: hu[i].v, precipProb: pp[i].v }));
  const nt = parseSeries(block, "今夜 気温");
  const nh = parseSeries(block, "今夜 湿度");
  const rebuiltNight = nt.map((t, i) => ({ temp: t.v, humidity: nh[i].v }));
  const lastMin = +block.match(/昨夜の最低気温\(℃\): (-?[\d.]+)/)[1];
  for (const s of [-2, -1, 0, 1, 2]) {
    assert.deepEqual(dayAdvice(rebuilt, s), dayAdvice(day, s), `日中 寒がり度 ${s}`);
    assert.deepEqual(pajamaAdvice(rebuiltNight, [{ temp: lastMin }], s), pajamaAdvice(night, lastNight, s), `夜 寒がり度 ${s}`);
  }
});

test("「現在地」で登録した場合は、丸めた緯度経度を書く", () => {
  assert.equal(placeText({ name: "現在地", latitude: 35.29, longitude: 136.56 }), "北緯35.29・東経136.56の地点");
});

test("説明書（llms.txt）に【天気データ】の使い方が書いてある", () => {
  const txt = readFileSync(new URL("../llms.txt", import.meta.url), "utf8");
  assert.match(txt, /利用者の文に「【天気データ】」があれば/);
  assert.ok(txt.includes(LLMS_URL)); // 予備の取得先として載っている
});

import { buildTryOnPrompt } from "../js/ai-prompt.js";

test("着せ替え: 写真ありは「1枚目は全身写真」、服の名前が順に入る", () => {
  const p = buildTryOnPrompt({ hasPhoto: true, itemLabels: ["うすい上着", "半袖", "薄手のボトムス"], hasOuter: true });
  assert.match(p, /^【着せ替え】1枚目は私の全身写真、2枚目以降は判定した服（うすい上着・半袖・薄手のボトムス）の画像です。/);
  assert.match(p, /顔、髪型、体型、ポーズ、背景は変えないでください/);
});

test("着せ替え: 写真なしは「このあと全身写真を送る」", () => {
  const p = buildTryOnPrompt({ hasPhoto: false, itemLabels: ["半袖", "薄手のボトムス"] });
  assert.match(p, /このあと私の全身写真を送るので/);
  assert.doesNotMatch(p, /1枚目は私の全身写真/);
});

test("着せ替え: 上着がない日は「羽織らせて」を入れない", () => {
  assert.match(buildTryOnPrompt({ hasPhoto: true, itemLabels: ["うすい上着", "半袖"], hasOuter: true }), /羽織らせて/);
  assert.doesNotMatch(buildTryOnPrompt({ hasPhoto: true, itemLabels: ["半袖", "薄手のボトムス"] }), /羽織らせて/);
});
