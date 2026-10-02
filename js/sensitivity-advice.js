// 「どうだった？」の記録を利用者の AI に分析してもらい、寒がり度の提案を受け取る（純粋関数）
// - buildSensitivityPrompt: AI に渡す文（記録の CSV・今の寒がり度・判断の目安・返答の形）
// - parseSensitivityAnswer: AI の返答から【寒がり度の提案】〜【ここまで】を探して読み取る
// AI の返答は何が書かれているか分からないので、決まった 5 段階の言葉に一致したときだけ受け入れる。
// 採用するかどうかは必ず利用者本人が決める（アプリ側で自動では変えない）。

import { SENSITIVITY_CHOICES } from "./settings.js";
import { SENSITIVITY_STEP } from "./rules.js";
import { toCsv } from "./feedback.js";

export const BLOCK_START = "【寒がり度の提案】";
export const BLOCK_END = "【ここまで】";
export const CONFIDENCES = ["高", "中", "低"];
export const MIN_RECORDS = 3; // これより少ないと判断材料にならないので、ボタンを出さない
const REASON_MAX = 200;

const labelOf = (v) => SENSITIVITY_CHOICES.find((c) => c.value === v)?.label ?? "ふつう";

/**
 * @param {{ records: object[], currentValue: number }} p records は feedback.js の記録
 */
export function buildSensitivityPrompt({ records, currentValue }) {
  const choices = SENSITIVITY_CHOICES.map((c) => `${c.label}（${c.value > 0 ? "+" : ""}${c.value}）`).join("・");
  return [
    "天気から服装を決めるアプリの「どうだった？」の記録です。この人の「寒がり度」がいまの設定で合っているか判断してください。",
    "",
    "## アプリの仕組み",
    `- 寒がり度は5段階: ${choices}。1段階につき ${SENSITIVITY_STEP}℃、寒がりほど低い気温として服装を判定します`,
    "- 服装は 7〜18 時の体感気温で判定（中に着る服は最高、上着は最低で決める）。寝間着は夜の最低気温で判定",
    "- 記録の「寒がり度」列は、その日にアプリが使っていた設定の値です",
    `- いまの設定: ${labelOf(currentValue)}（${currentValue}）`,
    "",
    "## 判断の目安",
    "- 「寒かった」が多く、気温帯をまたいで寒さ側に偏っている → 1段階寒がり側へ",
    "- 「暑かった」が多く、暑さ側に偏っている → 1段階暑がり側へ",
    "- 「ちょうどよい」が多い、偏りがない、記録が少ない（5件未満）→ 変更なし（いまの設定をそのまま書く）",
    "- 特定の気温帯だけで外れる場合は寒がり度の問題ではないので、変更なしにして理由にそう書く",
    "- 一度に変えるのは原則1段階まで",
    "",
    "## 返答の形",
    "人が読む説明は短くしてください。最後に必ず、次の形を**そのまま**書いてください（アプリが読み取ります）。",
    "「提案」は次の言葉から1つだけ: " + SENSITIVITY_CHOICES.map((c) => c.label).join("・"),
    "「確信度」は 高・中・低 のどれか。「理由」は1行で。",
    "",
    BLOCK_START,
    "提案: （5段階の言葉）",
    "理由: （1行）",
    "確信度: （高・中・低）",
    BLOCK_END,
    "",
    "## 記録（CSV）",
    toCsv(records),
  ].join("\n");
}

// 1 行から「項目: 値」を取り出す。全角コロン・太字記号・前後の空白・箇条書き記号を許す
function field(lines, name) {
  for (const raw of lines) {
    const line = raw.replace(/\*\*/g, "").replace(/^[\s>*\-・]+/, "").trim();
    const m = line.match(new RegExp(`^${name}\\s*[:：]\\s*(.*)$`));
    if (m) return m[1].trim();
  }
  return null;
}

/**
 * AI の返答を読み取る
 * @returns {{ ok: true, value: number, label: string, reason: string, confidence: string|null }
 *          | { ok: false, error: string }}
 */
export function parseSensitivityAnswer(text) {
  const s = String(text ?? "");
  const start = s.lastIndexOf(BLOCK_START); // 例として同じ形を先に書く AI もいるので、最後のものを使う
  if (start < 0) return { ok: false, error: `「${BLOCK_START}」が見つかりません。AI の返事を最後まで貼り付けてください` };
  const after = s.slice(start + BLOCK_START.length);
  const end = after.indexOf(BLOCK_END);
  const body = (end < 0 ? after : after.slice(0, end)).split(/\r?\n/);

  const suggestion = field(body, "提案");
  if (!suggestion) return { ok: false, error: "「提案:」の行が見つかりません" };
  // 「少し寒がり（+1）」のような書き方も受け付ける。長い言葉から照合（「寒がり」が「かなり寒がり」に誤一致しないように）
  const word = suggestion.replace(/[（(].*$/, "").replace(/[「」『』"]/g, "").trim();
  const choice = [...SENSITIVITY_CHOICES].sort((a, b) => b.label.length - a.label.length).find((c) => c.label === word);
  if (!choice) {
    return { ok: false, error: `「${suggestion.slice(0, 20)}」は寒がり度の選択肢にありません（${SENSITIVITY_CHOICES.map((c) => c.label).join("・")}）` };
  }

  const reason = (field(body, "理由") ?? "").slice(0, REASON_MAX);
  const conf = field(body, "確信度");
  const confidence = conf && CONFIDENCES.includes(conf.slice(0, 1)) ? conf.slice(0, 1) : null;
  return { ok: true, value: choice.value, label: choice.label, reason, confidence };
}
