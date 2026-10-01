// 「自分の AI に聞く」用のプロンプトを組み立てる（純粋関数）
// - アプリの設定（地域・寒がり度）は端末内にしかなく AI からは見えないので、プロンプトに書き込む
// - 天気もアプリが取得済みのデータを書き込む。Open-Meteo の API は robots.txt で自動取得を断っているため、
//   AI（claude.ai など）は自分では取りに行けない。AI が取りに行くのは説明書（llms.txt）だけにする
// - 説明書は GitHub Pages ではなくリポジトリ直接の URL（claude.ai で確実に読めた方）

export const LLMS_URL = "https://raw.githubusercontent.com/ssoranaoki/weather-outfit-app/main/llms.txt";

/** 地域の書き方。「現在地」で登録した場合は名前に意味がないので、丸めた緯度経度を書く */
export function placeText(place) {
  if (!place) return "（地域が未設定）";
  if (place.name === "現在地") return `北緯${place.latitude.toFixed(2)}・東経${place.longitude.toFixed(2)}の地点`;
  return place.name;
}

const md = (dateKey) => {
  const [, m, d] = dateKey.split("-").map(Number);
  return `${m}/${d}`;
};
const num = (v) => (v === null || v === undefined ? "-" : String(Math.round(v * 10) / 10));
const series = (rows, key) => rows.map((r) => `${r.hour}時 ${num(r[key])}`).join(", ");

/**
 * 天気データの欄（AI が判定に使う生の値）
 * @param {{ fetchedAt: Date, target: string, day: object[], night?: object[], lastNight?: object[] }} w
 *   day: 対象日 7〜18 時の行 / night: 対象日の朝に終わる夜（前日 22 時〜当日 6 時）/ lastNight: その前の夜
 */
export function weatherBlock(w) {
  const t = w.fetchedAt;
  const lines = [
    `【天気データ】Open-Meteo.com（CC BY 4.0）、${t.getMonth() + 1}/${t.getDate()} ${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")} 取得`,
    `${md(w.target)} 日中 体感気温(℃): ${series(w.day, "apparent")}`,
    `${md(w.target)} 日中 湿度(%): ${series(w.day, "humidity")}`,
    `${md(w.target)} 日中 降水確率(%): ${series(w.day, "precipProb")}`,
  ];
  if (w.night?.length) {
    lines.push(`今夜 気温(℃): ${series(w.night, "temp")}`, `今夜 湿度(%): ${series(w.night, "humidity")}`);
  }
  if (w.lastNight?.length) {
    lines.push(`昨夜の最低気温(℃): ${num(Math.min(...w.lastNight.map((r) => r.temp)))}`);
  }
  return lines.join("\n");
}

/**
 * 着せ替えの頼み方（服の画像と一緒に共有するときに、プロンプトの後ろに付ける）
 * @param {{ hasPhoto: boolean, itemLabels: string[], hasOuter?: boolean }} p itemLabels は添付する服の順（上着→トップス→ボトムス）
 */
export function buildTryOnPrompt({ hasPhoto, itemLabels, hasOuter = false }) {
  const clothes = itemLabels.join("・");
  const head = hasPhoto
    ? `【着せ替え】1枚目は私の全身写真、2枚目以降は判定した服（${clothes}）の画像です。1枚目の人物に、これらの服を着せた全身の画像を作ってください。`
    : `【着せ替え】添付は判定した服（${clothes}）の画像です。このあと私の全身写真を送るので、その人物にこれらの服を着せた全身の画像を作ってください。`;
  return [
    head,
    "・顔、髪型、体型、ポーズ、背景は変えないでください",
    "・服の色、形、素材は画像のとおりにしてください",
    ...(hasOuter ? ["・上着は、ほかの服の上に羽織らせてください"] : []),
    "・画像を作れない場合は、着こなしの説明だけで構いません",
  ].join("\n");
}

/**
 * @param {{ place: object, sensitivityLabel: string, mode: "day" | "night", weather?: object }} p
 */
export function buildAiPrompt({ place, sensitivityLabel, mode, weather }) {
  const where = placeText(place);
  const ask =
    mode === "night"
      ? `明日の${where}の服装と、今夜の寝間着を教えてください。`
      : `今日の${where}の服装を教えてください。`;
  const lines = [
    `次の説明書を読んで、その手順で${ask}`,
    `説明書: ${LLMS_URL}`,
    `私の寒がり度は「${sensitivityLabel}」です。`,
  ];
  if (weather) lines.push("天気は自分で調べず、下の天気データを使ってください。", "", weatherBlock(weather));
  return lines.join("\n");
}
