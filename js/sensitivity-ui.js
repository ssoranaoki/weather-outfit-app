// 設定画面の「🤖 AI に寒がり度を見てもらう」欄
// ① 記録と頼み方の文を AI に渡す → ② AI の返事を貼り付ける → ③ 提案を確かめて、本人が採用する

import { buildSensitivityPrompt, parseSensitivityAnswer, MIN_RECORDS } from "./sensitivity-advice.js";
import { SENSITIVITY_CHOICES } from "./settings.js";
import { esc } from "./html.js";

let prompt = "";
let proposal = null; // 読み取った提案（採用前）

const labelOf = (v) => SENSITIVITY_CHOICES.find((c) => c.value === v)?.label ?? "ふつう";

/** 設定画面を開くたびに呼ぶ。box は欄を描く要素 */
export function renderSensitivityAi(box, { records, currentValue }) {
  proposal = null;
  if (records.length < MIN_RECORDS) {
    box.innerHTML = `
      <span class="field-label">🤖 AI に寒がり度を見てもらう</span>
      <p class="current-place">「どうだった？」の記録が ${MIN_RECORDS} 件以上たまると使えます（いま ${records.length} 件）</p>`;
    return;
  }
  prompt = buildSensitivityPrompt({ records, currentValue });
  const canShare = typeof navigator.share === "function";
  box.innerHTML = `
    <span class="field-label">🤖 AI に寒がり度を見てもらう</span>
    <p class="current-place">記録 ${records.length} 件を自分の AI（ChatGPT・Claude など）に送ると、寒がり度が合っているか見てくれます。</p>
    <div class="ai-actions">
      <button type="button" data-sens="copy">① 📋 コピー</button>
      ${canShare ? `<button type="button" data-sens="share">① 📤 AI に送る</button>` : ""}
    </div>
    <label class="field-label sens-paste-label" for="sens-answer">② AI の返事を貼り付け</label>
    <textarea id="sens-answer" class="sens-answer" rows="4" placeholder="AI の返事をまるごと貼り付けてください"></textarea>
    <button type="button" data-sens="read">③ 読み取る</button>
    <div class="sens-result" role="status"></div>`;
}

/**
 * 1 回だけ呼ぶ。onAdopt(value) は採用されたときに呼ばれる（設定の保存はアプリ側で行う）
 * getCurrent() は今の寒がり度を返す
 */
export function attachSensitivityAi(box, { onAdopt, getCurrent }) {
  box.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-sens]");
    if (!btn) return;
    const result = box.querySelector(".sens-result");
    const show = (html) => (result.innerHTML = html);
    const action = btn.dataset.sens;

    if (action === "copy") {
      try {
        await navigator.clipboard.writeText(prompt);
        show(`<p class="sens-ok">コピーしました。AI のチャットに貼り付けて送ってください</p>`);
      } catch {
        show(`<p class="sens-ng">コピーできませんでした。「AI に送る」を使ってください</p>`);
      }
      return;
    }
    if (action === "share") {
      try {
        await navigator.share({ text: prompt });
      } catch (err) {
        if (err.name !== "AbortError") show(`<p class="sens-ng">送れませんでした。コピーを使ってください</p>`);
      }
      return;
    }
    if (action === "read") {
      const r = parseSensitivityAnswer(box.querySelector("#sens-answer").value);
      if (!r.ok) {
        proposal = null;
        show(`<p class="sens-ng">${esc(r.error)}</p>`);
        return;
      }
      proposal = r;
      const current = getCurrent();
      const same = r.value === current;
      show(`
        <div class="sens-proposal">
          <p class="sens-change">${same ? `いまの「${esc(labelOf(current))}」のままでよさそうです` : `「${esc(labelOf(current))}」→「${esc(r.label)}」`}</p>
          ${r.reason ? `<p>理由: ${esc(r.reason)}</p>` : ""}
          ${r.confidence ? `<p>確信度: ${esc(r.confidence)}</p>` : ""}
          ${same ? "" : `<button type="button" class="primary" data-sens="adopt">この提案を採用</button>`}
        </div>`);
      return;
    }
    if (action === "adopt" && proposal) {
      onAdopt(proposal.value);
      show(`<p class="sens-ok">寒がり度を「${esc(proposal.label)}」にしました</p>`);
      proposal = null;
    }
  });
}
