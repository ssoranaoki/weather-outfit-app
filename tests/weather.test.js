import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fetchForecast } from "../js/weather.js";

// localStorage と fetch を差し替えて、ネットの有無を再現する
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
let online = true;
let calls = 0;
globalThis.fetch = async () => {
  calls++;
  if (!online) throw new TypeError("Failed to fetch");
  return {
    ok: true,
    json: async () => ({
      hourly: {
        time: ["2026-10-01T07:00"],
        temperature_2m: [18],
        apparent_temperature: [17],
        relative_humidity_2m: [60],
        precipitation_probability: [10],
        weather_code: [61],
      },
    }),
  };
};

beforeEach(() => {
  store.clear();
  online = true;
  calls = 0;
});

test("通信できるときは取得して保存する", async () => {
  const r = await fetchForecast(35.29, 136.56);
  assert.equal(r.stale, false);
  assert.equal(r.rows[0].apparent, 17);
  assert.equal(calls, 1);
});

test("30 分以内は保存を使い、通信しない", async () => {
  await fetchForecast(35.29, 136.56);
  const r = await fetchForecast(35.29, 136.56);
  assert.equal(r.stale, false);
  assert.equal(calls, 1);
});

test("通信に失敗したら、古い保存を stale として返す", async () => {
  await fetchForecast(35.29, 136.56);
  // 2 時間前に保存したことにする
  const saved = JSON.parse(store.get("wo:forecast"));
  saved.savedAt -= 2 * 60 * 60 * 1000;
  store.set("wo:forecast", JSON.stringify(saved));
  online = false;
  const r = await fetchForecast(35.29, 136.56);
  assert.equal(r.stale, true);
  assert.equal(r.savedAt, saved.savedAt);
  assert.equal(r.rows[0].apparent, 17);
});

test("保存がなく通信もできないときはエラー", async () => {
  online = false;
  await assert.rejects(fetchForecast(35.29, 136.56));
});

test("別の地点の保存は使わない", async () => {
  await fetchForecast(35.29, 136.56);
  online = false;
  await assert.rejects(fetchForecast(36.23, 137.97));
});

// 天気コードを取り始める前の保存（rows に code がない）を作る
function saveOldFormat() {
  const rows = [{ date: "2026-10-01", hour: 7, temp: 18, apparent: 17, humidity: 60, precipProb: 10 }];
  store.set("wo:forecast", JSON.stringify({ key: "35.29,136.56", savedAt: Date.now(), rows }));
}

test("天気コードのない古い形式の保存は、30 分以内でも取り直す（天気アイコンが出ないため）", async () => {
  saveOldFormat();
  const r = await fetchForecast(35.29, 136.56);
  assert.equal(calls, 1);
  assert.equal(r.rows[0].code, 61);
});

test("電波がないときは、古い形式の保存でも予備として使う", async () => {
  saveOldFormat();
  online = false;
  const r = await fetchForecast(35.29, 136.56);
  assert.equal(r.stale, true);
  assert.equal(r.rows[0].apparent, 17);
});
