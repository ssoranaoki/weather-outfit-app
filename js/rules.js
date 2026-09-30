// 服装・寝間着の判定ルール（純粋関数のみ。画面にも将来の MCP 窓口にも依存しない）
// 数値はすべて仮。母親に使ってもらいながら調整する（設計書 7 章）。

export const DAY_START_HOUR = 7;   // 日中判定の開始（含む）
export const DAY_END_HOUR = 18;    // 日中判定の終了（含む）
export const NIGHT_START_HOUR = 22; // 夜間判定の開始（前日 22 時）
export const NIGHT_END_HOUR = 6;    // 夜間判定の終了（当日 6 時、含む）
export const NIGHT_MODE_FROM = 18;  // この時刻以降は就寝前モード
export const NIGHT_MODE_UNTIL = 4;  // この時刻より前も就寝前モード（深夜に開いた場合）

const SENSITIVITY_STEP = 2; // 寒がり度 1 段階あたり何℃ずらすか

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

const WIDE_RANGE = 8; // これ以上の寒暖差で「昼は脱いでOK」

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
  else if (range >= WIDE_RANGE) headline = `${inner.top.label}に${outer.label}を。昼は脱いでOK`;
  else headline = `${inner.top.label}に${outer.label}を（1日着たままで）`;

  const items = [];
  if (outer?.extra) items.push(outer.extra);
  if (outer) items.push(outer);
  items.push(inner.top, inner.bottom);

  const humidityAvg = Math.round(hours.reduce((s, h) => s + h.humidity, 0) / hours.length);
  const notes = [];

  const rainy = hours.find((h) => h.precipProb !== null && h.precipProb >= 50);
  if (rainy) {
    const peak = Math.max(...hours.map((h) => h.precipProb ?? 0));
    notes.push(`☂ ${rainy.hour}時ごろから雨の予報（最大${peak}%）。傘を持っていきましょう`);
  }
  if (range >= WIDE_RANGE) notes.push(`寒暖差 ${Math.round(range)}℃。脱ぎ着しやすい服で`);
  if (max >= 25 && humidityAvg >= 70) notes.push("蒸し暑い日です。通気性のよい素材を");

  return {
    headline,
    items,
    notes,
    stats: { max: Math.round(rawMax), min: Math.round(rawMin), humidity: humidityAvg },
  };
}

// ---- 寝間着 ----

export function pajamaBand(minTemp) {
  if (minTemp >= 25) return { headline: "半袖で寝てください", icon: "👕", item: C["pj-short"], ac: "タイマーが切れると暑くなります。弱めに朝までつけるのも手（熱中症に注意）" };
  if (minTemp >= 20) return { headline: "半袖で寝てください", icon: "👕", item: C["pj-short"], ac: "冷えすぎに注意。タイマーは短めで" };
  if (minTemp >= 15) return { headline: "長袖で寝てください", icon: "👚", item: C["pj-long"], ac: "冷暖房なしでも過ごしやすい夜です" };
  if (minTemp >= 10) return { headline: "長袖に厚手の掛け布団で", icon: "🛌", item: C["pj-long"], ac: "暖房が切れた明け方に冷えます" };
  return { headline: "厚手の長袖に靴下もはいて", icon: "🧦", item: C["pj-warm"], ac: "暖房で乾燥しやすいので加湿を", mentionsDryness: true };
}

const COLDER_THAN_LAST_NIGHT = 5;

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
    if (diff <= -COLDER_THAN_LAST_NIGHT) notes.unshift(`⚠ 昨夜より ${Math.round(-diff)}℃ 冷えます`);
  }
  const minHumidity = Math.min(...tonight.map((h) => h.humidity));
  const avgHumidity = tonight.reduce((s, h) => s + h.humidity, 0) / tonight.length;
  if (min <= 14 && minHumidity <= 40 && !band.mentionsDryness) {
    notes.push("空気が乾燥します。加湿と水分補給を");
  }
  if (min >= 20 && avgHumidity >= 80) notes.push("蒸し暑い夜です。汗を吸いやすい素材を");

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
