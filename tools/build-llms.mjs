// AI 向けの説明書（llms.txt）と機械可読カタログ（catalog.json）を js/rules.js から生成する
// 使い方: node tools/build-llms.mjs   （rules.js を変えたら必ず実行してコミットする。テストで差分を検出する）
// 手書きにしないのは、ルールの数値を変えたときに説明書と食い違わないようにするため。

import { writeFileSync } from "node:fs";
import {
  CLOTHES, NOTE_RULES as N, SENSITIVITY_STEP,
  DAY_START_HOUR, DAY_END_HOUR, NIGHT_START_HOUR, NIGHT_END_HOUR, NIGHT_MODE_FROM, NIGHT_MODE_UNTIL,
  innerWear, outerWear, pajamaBand, dayAdvice,
} from "../js/rules.js";

export const BASE_URL = "https://ssoranaoki.github.io/weather-outfit-app/";
const REPO_URL = "https://github.com/ssoranaoki/weather-outfit-app";
// GitHub Pages を読めない AI 向けの予備（公開直後の 404 キャッシュ等。claude.ai ではこちらで読めた）
const RAW_URL = "https://raw.githubusercontent.com/ssoranaoki/weather-outfit-app/main/";
const T_MIN = -20;
const T_MAX = 45;

/** 整数の気温ごとに fn を評価し、同じ結果が続く範囲をまとめる */
export function bands(fn, keyOf) {
  const out = [];
  for (let t = T_MIN; t <= T_MAX; t++) {
    const v = fn(t);
    const key = keyOf(v);
    const last = out.at(-1);
    if (last && last.key === key) last.to = t;
    else out.push({ key, from: t, to: t, value: v });
  }
  return out.map((b, i) => ({
    min: i === 0 ? null : b.from, // null = 下限なし
    max: i === out.length - 1 ? null : b.to, // null = 上限なし
    value: b.value,
  }));
}

const rangeText = ({ min, max }) =>
  min === null ? `${max}℃以下` : max === null ? `${min}℃以上` : `${min}〜${max}℃`;

const imageUrl = (id) => `${BASE_URL}img/clothes/${id}.jpg`;
const category = (id) => id.split("-")[0]; // top / bottom / outer / acc / pj

export function buildCatalog() {
  const inner = bands(innerWear, (v) => `${v.top.id}|${v.bottom.id}`).map((b) => ({
    min: b.min, max: b.max, top: b.value.top.id, bottom: b.value.bottom.id,
  }));
  const outer = bands(outerWear, (v) => (v ? v.id : "none")).map((b) => ({
    min: b.min, max: b.max, outer: b.value?.id ?? null, extra: b.value?.extra?.id ?? null,
  }));
  const pajama = bands(pajamaBand, (v) => v.headline + v.ac).map((b) => ({
    min: b.min, max: b.max, item: b.value.item.id, headline: b.value.headline, airConditionerTip: b.value.ac,
  }));
  return {
    name: "きょうの服装",
    description: "天気予報から服装と寝間着を判定するルールと、服カタログ画像の一覧",
    source: `${REPO_URL}/blob/main/js/rules.js`,
    units: { temperature: "℃（整数に四捨五入してから判定）" },
    items: Object.values(CLOTHES).map((c) => ({ id: c.id, label: c.label, category: category(c.id), image: imageUrl(c.id) })),
    rules: {
      hours: { dayFrom: DAY_START_HOUR, dayTo: DAY_END_HOUR, nightFrom: NIGHT_START_HOUR, nightTo: NIGHT_END_HOUR },
      mode: { nightModeFrom: NIGHT_MODE_FROM, nightModeUntil: NIGHT_MODE_UNTIL },
      sensitivityStepCelsius: SENSITIVITY_STEP,
      innerByDaytimeMaxApparent: inner,
      outerByDaytimeMinApparent: outer,
      pajamaByNightMinTemperature: pajama,
      notes: N,
    },
  };
}

// 例（実際の判定関数で計算するので、ルールと食い違わない）
function example(min, max) {
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => {
    const h = DAY_START_HOUR + i;
    const t = min + ((max - min) * Math.min(i, 7)) / 7;
    return { hour: h, apparent: t, humidity: 55, precipProb: 10 };
  });
  const a = dayAdvice(hours, 0);
  return `- 体感 ${min}〜${max}℃ → 「${a.headline}」（${a.items.map((i) => i.label).join("・")}）`;
}

export function buildLlmsTxt() {
  const c = buildCatalog();
  const r = c.rules;
  const label = (id) => (id ? CLOTHES[id].label : "なし");
  const inner = r.innerByDaytimeMaxApparent.map((b) => `| ${rangeText(b)} | ${label(b.top)} | ${label(b.bottom)} |`).join("\n");
  const outer = r.outerByDaytimeMinApparent
    .map((b) => `| ${rangeText(b)} | ${label(b.outer)}${b.extra ? `＋${label(b.extra)}` : ""} |`)
    .join("\n");
  const pajama = r.pajamaByNightMinTemperature
    .map((b) => `| ${rangeText(b)} | ${b.headline} | ${label(b.item)} | ${b.airConditionerTip} |`)
    .join("\n");
  const items = c.items.map((i) => `| ${i.id} | ${i.label} | ${i.image} |`).join("\n");

  return `# きょうの服装（Weather Outfit Advisor）

> 天気予報から「今日の服装」と「今夜の寝間着」をアドバイスする、日本向けの無料 Web アプリです。この文書は、利用者のAI（ChatGPT・Claude・Gemini など）が、このアプリと同じ判定を利用者の代わりに行うための説明書です。

このサービスはAIを持っていません。判定はあなた（利用者のAI）が、以下の手順とルールで行ってください。サービス側にアカウント・APIキー・アップロード先はありません。

English summary: A free Japanese web app that recommends today's outfit and tonight's sleepwear from the weather forecast. The service itself runs no AI; the user's own AI applies the rules below. Machine-readable rules and clothing images: ${BASE_URL}catalog.json

## 手順

1. **場所を緯度経度にする**: 利用者に地域（市区町村や大字）を聞く。
   - 国土地理院 住所検索: \`https://msearch.gsi.go.jp/address-search/AddressSearch?q={住所}\`（GeoJSON。座標は [経度, 緯度] の順）
   - または Open-Meteo: \`https://geocoding-api.open-meteo.com/v1/search?name={地名}&language=ja&countryCode=JP\`
2. **予報を取る**（Open-Meteo, 無料・CC BY 4.0）:
   \`https://api.open-meteo.com/v1/forecast?latitude={緯度}&longitude={経度}&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability&timezone=Asia/Tokyo&past_days=1&forecast_days=3\`
3. **対象日を決める**: 日本時間で ${NIGHT_MODE_UNTIL}:00〜${NIGHT_MODE_FROM - 1}:59 なら「今日の服装」、${NIGHT_MODE_FROM}:00 以降は「明日の服装」と「今夜の寝間着」。利用者が日付を指定したらそれに従う。
4. **日中の服装を判定する**（下の表）:
   - 対象日の ${DAY_START_HOUR}〜${DAY_END_HOUR} 時の \`apparent_temperature\`（体感気温）の最高と最低を、整数に四捨五入する
   - 寒がり度（-2〜+2、+ が寒がり、既定 0）1 段階につき ${SENSITIVITY_STEP}℃ 低い気温として判定する（表示する気温は補正しない）
   - 中に着る服は最高で、上着は最低で決める
   - 結論の1行: 上着なし →「{トップス}1枚で過ごせます」／最高−最低が ${N.wideRange}℃ 以上 →「{トップス}に{上着}を。昼は脱いでOK」／それ以外 →「{トップス}に{上着}を（1日着たままで）」
5. **注意を添える**:
   - 降水確率 ${N.rainProb}% 以上の時刻があれば、最初のその時刻と最大値で傘の注意
   - 寒暖差 ${N.wideRange}℃ 以上なら「脱ぎ着しやすい服で」
   - 体感最高 ${N.humidHotMax}℃ 以上かつ日中平均湿度 ${N.humidHotHumidity}% 以上なら「蒸し暑い日。通気性のよい素材を」
6. **寝間着を判定する**（就寝前のみ。下の表）:
   - 前日 ${NIGHT_START_HOUR} 時〜当日 ${NIGHT_END_HOUR} 時の \`temperature_2m\`（体感ではなく気温）の最低を四捨五入し、寒がり度で補正
   - 利用者は冷暖房をタイマーで使い、切れた後の明け方を想定している
   - 昨夜の最低より ${N.colderThanLastNight}℃ 以上低ければ「昨夜より○℃冷えます」を先頭に
   - 最低 ${N.dryMaxTemp}℃ 以下かつ夜の最小湿度 ${N.dryHumidity}% 以下なら「乾燥します。加湿と水分補給を」
   - 最低 ${N.muggyNightMin}℃ 以上かつ夜の平均湿度 ${N.muggyNightHumidity}% 以上なら「蒸し暑い夜。汗を吸いやすい素材を」
7. **答え方**: 結論の1行を最初に、続けて服の一覧・体感の最高と最低・注意。最後に「天気データ: Open-Meteo.com（CC BY 4.0）」と添える。

### 中に着る服（${DAY_START_HOUR}〜${DAY_END_HOUR} 時の体感最高で判定）

| 体感最高（補正後） | トップス | ボトムス |
|---|---|---|
${inner}

### 上着（${DAY_START_HOUR}〜${DAY_END_HOUR} 時の体感最低で判定）

| 体感最低（補正後） | 上着 |
|---|---|
${outer}

### 寝間着（夜間 ${NIGHT_START_HOUR}〜${NIGHT_END_HOUR} 時の最低気温で判定）

| 最低気温（補正後） | 結論の1行 | 寝間着 | 冷暖房のひとこと |
|---|---|---|---|
${pajama}

### 判定の例（寒がり度 0）

${[[12, 21], [21, 29], [5, 9], [15, 19]].map(([a, b]) => example(a, b)).join("\n")}

## 着せ替え（画像編集ができるAIのみ）

1. 利用者が自分の全身写真を、あなた（利用者のAI）に直接渡す。**写真をこのサービスや第三者に送らないこと。** このサービスには写真の受け取り先がない。
2. 判定した服の画像を下の服カタログから取得する。取得できない場合は、利用者に画像の保存と添付を頼む。
3. 写真の人物にその服を着せた画像を作る。体型や容姿への評価的なコメントはしない。
4. 画像を作れないAIは、服の組み合わせの提案だけを行う。

### 服カタログ（白背景の商品写真風・400x400 JPEG）

| id | 服 | 画像 |
|---|---|---|
${items}

## Files

- [catalog.json](${BASE_URL}catalog.json): 判定ルールの数値と服カタログ（機械可読）
- [llms.txt の予備の取得先](${RAW_URL}llms.txt) / [catalog.json の予備](${RAW_URL}catalog.json): 上の URL が読めないとき用（GitHub のリポジトリから直接）
- [アプリ本体](${BASE_URL}): 人が使う画面（AIを持たない人も同じ判定を見られる）
- [判定ルールのソース](${REPO_URL}/blob/main/js/rules.js): この文書の生成元

## Optional

- 判定の数値は、特定の家族の感覚に合わせて調整中の仮の値です。利用者が「暑かった」「寒かった」と言ったら、寒がり度で調整してください。
- 気温の区分を変えたいなどの要望は、アプリ作者に伝えてください: ${REPO_URL}
`;
}

// コマンドとして実行されたときだけファイルを書く（テストからは関数だけ使う）
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = new URL("../", import.meta.url);
  writeFileSync(new URL("catalog.json", root), JSON.stringify(buildCatalog(), null, 2) + "\n");
  writeFileSync(new URL("llms.txt", root), buildLlmsTxt());
  console.log("catalog.json と llms.txt を生成しました");
}
