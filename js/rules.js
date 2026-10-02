// 服装・寝間着の判定ルール（純粋関数のみ。画面にも将来の MCP 窓口にも依存しない）
// 数値はすべて仮。母親に使ってもらいながら調整する（設計書 7 章）。

export const DAY_START_HOUR = 7;   // 日中判定の開始（含む）
export const DAY_END_HOUR = 18;    // 日中判定の終了（含む）
export const NIGHT_START_HOUR = 22; // 夜間判定の開始（前日 22 時）
export const NIGHT_END_HOUR = 6;    // 夜間判定の終了（当日 6 時、含む）
export const NIGHT_MODE_FROM = 18;  // この時刻以降は就寝前モード
export const NIGHT_MODE_UNTIL = 4;  // この時刻より前も就寝前モード（深夜に開いた場合）

export const SENSITIVITY_STEP = 2; // 寒がり度 1 段階あたり何℃ずらすか

// 寒がり度（+ で寒がり）を反映した「本人の感じる温度」
export function adjustForSensitivity(temp, sensitivity) {
  return temp - sensitivity * SENSITIVITY_STEP;
}

// ---- 日中の服装 ----

// 服カタログ。id は画像ファイル名（img/clothes/<id>.jpg）。icon は画像を読めなかったときの代わり
export const CLOTHES = {
  "top-short": { id: "top-short", label: "半袖", icon: "👕" },
  "top-long": { id: "top-long", label: "長袖", icon: "👚" },
  "top-sweater": { id: "top-sweater", label: "セーター", icon: "🧶" },
  "top-thick-sweater": { id: "top-thick-sweater", label: "厚手のセーター", icon: "🧶" },
  "bottom-light": { id: "bottom-light", label: "薄手のボトムス", icon: "🩳" },
  "bottom-pants": { id: "bottom-pants", label: "長ズボン", icon: "👖" },
  "bottom-thick": { id: "bottom-thick", label: "厚手のズボン", icon: "👖" },
  "outer-light": { id: "outer-light", label: "うすい上着", icon: "🧥" },
  "outer-jacket": { id: "outer-jacket", label: "ジャケット", icon: "🧥" },
  "outer-coat": { id: "outer-coat", label: "コート", icon: "🧥" },
  "outer-thick-coat": { id: "outer-thick-coat", label: "厚手のコート", icon: "🧥" },
  "acc-winter": { id: "acc-winter", label: "手袋・マフラー", icon: "🧣" },
  "pj-short": { id: "pj-short", label: "半袖の寝間着", icon: "👕" },
  "pj-long": { id: "pj-long", label: "長袖の寝間着", icon: "👚" },
  "pj-warm": { id: "pj-warm", label: "厚手の寝間着と靴下", icon: "🧦" },
};
const C = CLOTHES;

// 中に着る服（時間帯の最高で決める）
export function innerWear(maxTemp) {
  if (maxTemp >= 25) return { top: C["top-short"], bottom: C["bottom-light"] };
  if (maxTemp >= 16) return { top: C["top-long"], bottom: C["bottom-pants"] };
  if (maxTemp >= 8) return { top: C["top-sweater"], bottom: C["bottom-pants"] };
  return { top: C["top-thick-sweater"], bottom: C["bottom-thick"] };
}

// 上着（時間帯の最低で決める）。不要なら null
export function outerWear(minTemp) {
  if (minTemp >= 20) return null;
  if (minTemp >= 16) return C["outer-light"];
  if (minTemp >= 12) return C["outer-jacket"];
  if (minTemp >= 8) return C["outer-coat"];
  return { ...C["outer-thick-coat"], extra: C["acc-winter"] };
}

// 注意書き・補足のしきい値（llms.txt と catalog.json もここから自動生成する）
export const NOTE_RULES = {
  wideRange: 8, // 日中の寒暖差がこれ以上で「昼は脱いでOK」と寒暖差の注意
  rainProb: 50, // 日中の降水確率がこれ以上の時刻があれば傘の注意
  humidHotMax: 25, // 体感最高がこれ以上 かつ
  humidHotHumidity: 70, // 日中の平均湿度がこれ以上で「蒸し暑い日」
  colderThanLastNight: 5, // 昨夜の最低よりこれ以上低いと「昨夜より○℃冷えます」
  dryMaxTemp: 14, // 夜の最低がこれ以下 かつ
  dryHumidity: 40, // 夜の最小湿度がこれ以下で「乾燥します」
  muggyNightMin: 20, // 夜の最低がこれ以上 かつ
  muggyNightHumidity: 80, // 夜の平均湿度がこれ以上で「蒸し暑い夜」
};
const N = NOTE_RULES;

/**
 * 日中の服装アドバイス
 * @param {Array<{hour:number, apparent:number, humidity:number, precipProb:number|null}>} hours 対象日の 7〜18 時
 * @param {number} sensitivity 寒がり度 -2〜+2
 */
export function dayAdvice(hours, sensitivity) {
  // 画面に出す値（四捨五入）と判定に使う値を揃える
  const temps = hours.map((h) => h.apparent);
  const rawMax = Math.round(Math.max(...temps));
  const rawMin = Math.round(Math.min(...temps));
  const max = adjustForSensitivity(rawMax, sensitivity);
  const min = adjustForSensitivity(rawMin, sensitivity);

  const inner = innerWear(max);
  const outer = outerWear(min);
  const range = rawMax - rawMin;

  let headline;
  if (!outer) headline = `${inner.top.label}1枚で過ごせます`;
  else if (range >= N.wideRange) headline = `${inner.top.label}に${outer.label}を。昼は脱いでOK`;
  else headline = `${inner.top.label}に${outer.label}を（1日着たままで）`;

  const items = [];
  if (outer?.extra) items.push(outer.extra);
  if (outer) items.push(outer);
  items.push(inner.top, inner.bottom);

  const humidityAvg = Math.round(hours.reduce((s, h) => s + h.humidity, 0) / hours.length);
  const notes = [];

  const rainy = hours.find((h) => h.precipProb !== null && h.precipProb >= N.rainProb);
  if (rainy) {
    const peak = Math.max(...hours.map((h) => h.precipProb ?? 0));
    notes.push(`☂ ${rainy.hour}時ごろから雨の予報（最大${peak}%）。傘を持っていきましょう`);
  }
  if (range >= N.wideRange) notes.push(`寒暖差 ${Math.round(range)}℃。脱ぎ着しやすい服で`);
  if (max >= N.humidHotMax && humidityAvg >= N.humidHotHumidity) notes.push("蒸し暑い日です。通気性のよい素材を");

  return {
    headline,
    items,
    notes,
    stats: { max: Math.round(rawMax), min: Math.round(rawMin), humidity: humidityAvg },
  };
}

// ---- 時間帯ごとの降水確率（洗濯物を外に干せるかの目安。母親の要望） ----

// 日中（7〜18 時）を 4 時間ずつに分ける。値はその時間帯の最大（「どこかで降るかも」を見落とさない）
export const PRECIP_BLOCKS = [
  { label: "朝", from: 7, to: 10 },
  { label: "昼", from: 11, to: 14 },
  { label: "夕方", from: 15, to: 18 },
];

/**
 * @param {Array<{hour:number, precipProb:number|null}>} hours 対象日の 7〜18 時
 * @returns {Array<{label:string, from:number, to:number, prob:number|null, high:boolean}>} prob が null はデータなし
 */
export function precipByBlock(hours) {
  return PRECIP_BLOCKS.map((b) => {
    const probs = hours
      .filter((h) => h.hour >= b.from && h.hour <= b.to && h.precipProb !== null && h.precipProb !== undefined)
      .map((h) => h.precipProb);
    const prob = probs.length ? Math.max(...probs) : null;
    return { ...b, prob, high: prob !== null && prob >= N.rainProb };
  });
}

// ---- 天気の種類（画面上部のアイコン用） ----
// WMO 天気コード（Open-Meteo の weather_code）: https://open-meteo.com/en/docs
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 97, 99]);
const CLOUD_CODES = new Set([2, 3, 45, 48]); // 晴れ時々くもり・くもり・霧
const WEATHER_MIN_HOURS = 2; // 雨・雪は日中に 2 時間以上あれば、その日の天気とみなす

export const WEATHER_LABELS = { clear: "晴れ", cloudy: "くもり", rain: "雨", snow: "雪" };

/**
 * 日中の天気を 1 つにまとめる。雪 > 雨 > くもり > 晴れ の順に優先
 * @param {Array<{code:number|null}>} hours 対象日の 7〜18 時
 * @returns {"clear"|"cloudy"|"rain"|"snow"|null} 天気コードがなければ null（アイコンを出さない）
 */
export function weatherKind(hours) {
  const codes = hours.map((h) => h.code).filter((c) => c !== null && c !== undefined);
  if (!codes.length) return null;
  const count = (set) => codes.filter((c) => set.has(c)).length;
  if (count(SNOW_CODES) >= WEATHER_MIN_HOURS) return "snow";
  if (count(RAIN_CODES) >= WEATHER_MIN_HOURS) return "rain";
  if (count(CLOUD_CODES) > codes.length / 2) return "cloudy";
  return "clear";
}

// ---- 寝間着 ----

export function pajamaBand(minTemp) {
  if (minTemp >= 25) return { headline: "半袖で寝てください", icon: "👕", item: C["pj-short"], ac: "タイマーが切れると暑くなります。弱めに朝までつけるのも手（熱中症に注意）" };
  if (minTemp >= 20) return { headline: "半袖で寝てください", icon: "👕", item: C["pj-short"], ac: "冷えすぎに注意。タイマーは短めで" };
  if (minTemp >= 15) return { headline: "長袖で寝てください", icon: "👚", item: C["pj-long"], ac: "冷暖房なしでも過ごしやすい夜です" };
  if (minTemp >= 10) return { headline: "長袖に厚手の掛け布団で", icon: "🛌", item: C["pj-long"], ac: "暖房が切れた明け方に冷えます" };
  return { headline: "厚手の長袖に靴下もはいて", icon: "🧦", item: C["pj-warm"], ac: "暖房で乾燥しやすいので加湿を", mentionsDryness: true };
}

/**
 * 寝間着アドバイス
 * @param {Array<{temp:number, humidity:number}>} tonight 今夜 22〜6 時
 * @param {Array<{temp:number}>} lastNight 昨夜 22〜6 時（無ければ空配列）
 */
export function pajamaAdvice(tonight, lastNight, sensitivity) {
  const rawMin = Math.round(Math.min(...tonight.map((h) => h.temp)));
  const min = adjustForSensitivity(rawMin, sensitivity);
  const band = pajamaBand(min);

  const notes = [band.ac];
  if (lastNight.length) {
    const lastMin = Math.min(...lastNight.map((h) => h.temp));
    const diff = rawMin - lastMin;
    if (diff <= -N.colderThanLastNight) notes.unshift(`⚠ 昨夜より ${Math.round(-diff)}℃ 冷えます`);
  }
  const minHumidity = Math.min(...tonight.map((h) => h.humidity));
  const avgHumidity = tonight.reduce((s, h) => s + h.humidity, 0) / tonight.length;
  if (min <= N.dryMaxTemp && minHumidity <= N.dryHumidity && !band.mentionsDryness) {
    notes.push("空気が乾燥します。加湿と水分補給を");
  }
  if (min >= N.muggyNightMin && avgHumidity >= N.muggyNightHumidity) notes.push("蒸し暑い夜です。汗を吸いやすい素材を");

  return { headline: band.headline, icon: band.icon, item: band.item, notes, min: Math.round(rawMin) };
}

// ---- モード判定 ----

/**
 * 開いた時刻から、表示モードと対象日（YYYY-MM-DD）を決める
 * 4:00〜17:59 → 朝モード（今日）／18:00〜23:59 → 就寝前（明日）／0:00〜3:59 → 就寝前（今日）
 */
export function decideMode(now) {
  const hour = now.getHours();
  const today = toDateKey(now);
  if (hour >= NIGHT_MODE_FROM) return { mode: "night", target: addDays(today, 1) };
  if (hour < NIGHT_MODE_UNTIL) return { mode: "night", target: today };
  return { mode: "day", target: today };
}

export function toDateKey(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(dateKey, n) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return toDateKey(new Date(y, m - 1, d + n));
}
