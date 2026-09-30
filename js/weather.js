// Open-Meteo（https://open-meteo.com/）から予報を取得し、ルールが使う形に切り出す
// 非商用は無料・CC BY 4.0。画面に出典表示が必要。

import { DAY_START_HOUR, DAY_END_HOUR, NIGHT_START_HOUR, NIGHT_END_HOUR, addDays } from "./rules.js";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const CACHE_KEY = "wo:forecast";
const CACHE_MINUTES = 30; // 同じ地点の予報を使い回す時間（API 呼び出し回数を抑える）

const HOURLY = ["temperature_2m", "apparent_temperature", "relative_humidity_2m", "precipitation_probability"];

/** 地名検索（日本国内のみ） */
export async function searchPlaces(name) {
  const url = new URL(GEOCODING_URL);
  url.search = new URLSearchParams({ name, count: "10", language: "ja", countryCode: "JP" });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`地名検索に失敗しました（${res.status}）`);
  const data = await res.json();
  return (data.results ?? []).map((r) => ({
    name: r.name,
    area: [r.admin1, r.admin2].filter((x) => x && x !== r.name).join(" "),
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

/** 予報を取得（前日〜2日後の 1 時間ごと）。30 分以内の同一地点はキャッシュを返す */
export async function fetchForecast(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = readCache(key);
  if (cached) return cached;

  const url = new URL(FORECAST_URL);
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: HOURLY.join(","),
    timezone: "Asia/Tokyo",
    past_days: "1",
    forecast_days: "3",
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`天気の取得に失敗しました（${res.status}）`);
  const data = await res.json();
  const h = data.hourly;
  // time は "2026-10-01T07:00" 形式（timezone 指定地点の現地時刻）
  const rows = h.time.map((t, i) => ({
    date: t.slice(0, 10),
    hour: Number(t.slice(11, 13)),
    temp: h.temperature_2m[i],
    apparent: h.apparent_temperature[i],
    humidity: h.relative_humidity_2m[i],
    precipProb: h.precipitation_probability[i],
  }));
  writeCache(key, rows);
  return rows;
}

/** 対象日の日中（7〜18 時）の行 */
export function daytimeRows(rows, dateKey) {
  return rows.filter((r) => r.date === dateKey && r.hour >= DAY_START_HOUR && r.hour <= DAY_END_HOUR && r.apparent !== null);
}

/** 対象日の朝に終わる夜（前日 22 時〜当日 6 時）の行 */
export function nightRows(rows, dateKey) {
  const prev = addDays(dateKey, -1);
  return rows.filter(
    (r) =>
      r.temp !== null &&
      ((r.date === prev && r.hour >= NIGHT_START_HOUR) || (r.date === dateKey && r.hour <= NIGHT_END_HOUR)),
  );
}

function readCache(key) {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (c && c.key === key && Date.now() - c.savedAt < CACHE_MINUTES * 60 * 1000) return c.rows;
  } catch {
    /* 壊れたキャッシュは無視して取り直す */
  }
  return null;
}

function writeCache(key, rows) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ key, savedAt: Date.now(), rows }));
  } catch {
    /* 容量不足などは無視（毎回取得になるだけ） */
  }
}
