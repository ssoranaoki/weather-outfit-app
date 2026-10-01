// 「自分の AI に聞く」用のプロンプトを組み立てる（純粋関数）
// アプリの設定（地域・寒がり度）は端末内にしかなく AI からは見えないので、プロンプトに書き込んで渡す。

export const LLMS_URL = "https://ssoranaoki.github.io/weather-outfit-app/llms.txt";
// GitHub Pages が読めない AI 向けの予備（claude.ai ではこちらで読めた）
export const LLMS_RAW_URL = "https://raw.githubusercontent.com/ssoranaoki/weather-outfit-app/main/llms.txt";

/** 地域の書き方。「現在地」で登録した場合は名前に意味がないので、丸めた緯度経度を書く */
export function placeText(place) {
  if (!place) return "（地域が未設定）";
  if (place.name === "現在地") return `北緯${place.latitude.toFixed(2)}・東経${place.longitude.toFixed(2)}の地点`;
  return place.name;
}

/**
 * @param {{ place: object, sensitivityLabel: string, mode: "day" | "night" }} p
 */
export function buildAiPrompt({ place, sensitivityLabel, mode }) {
  const where = placeText(place);
  const ask =
    mode === "night"
      ? `明日の${where}の服装と、今夜の寝間着を教えてください。`
      : `今日の${where}の服装を教えてください。`;
  return [
    `次の説明書を読んで、その手順で${ask}`,
    `説明書: ${LLMS_URL}`,
    `（読めない場合はこちら: ${LLMS_RAW_URL}）`,
    `私の寒がり度は「${sensitivityLabel}」です。`,
  ].join("\n");
}
