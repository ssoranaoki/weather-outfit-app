// 「きょうはどうだった？」の記録（この端末のブラウザ内だけに保存。サーバーには送らない）
// 1〜2 週間分たまったら書き出して、ルールの数値調整に使う。

const KEY = "wo:feedback";

export const RATINGS = [
  { value: "hot", label: "暑かった", icon: "🥵" },
  { value: "ok", label: "ちょうどよい", icon: "😊" },
  { value: "cold", label: "寒かった", icon: "🥶" },
];

/** kind: "day"（日中の服装）| "night"（寝間着） */
export function loadFeedback() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** 同じ日・同じ種類の記録は上書きする（押し直しできるように） */
export function upsertRecord(list, record) {
  const rest = list.filter((r) => !(r.date === record.date && r.kind === record.kind));
  return [...rest, record].sort((a, b) => (a.date + a.kind).localeCompare(b.date + b.kind));
}

export function saveFeedback(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function findRecord(list, date, kind) {
  return list.find((r) => r.date === date && r.kind === kind) ?? null;
}

/** 書き出し用の CSV（表計算ソフトでもそのまま開ける形） */
export function toCsv(list) {
  const header = ["日付", "種類", "評価", "アドバイス", "最高(体感)", "最低", "湿度", "寒がり度"];
  const kindLabel = { day: "服装", night: "寝間着" };
  const ratingLabel = Object.fromEntries(RATINGS.map((r) => [r.value, r.label]));
  const cell = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = list.map((r) =>
    [r.date, kindLabel[r.kind], ratingLabel[r.rating], r.headline, r.max, r.min, r.humidity, r.sensitivity].map(cell).join(","),
  );
  return [header.join(","), ...rows].join("\n");
}
