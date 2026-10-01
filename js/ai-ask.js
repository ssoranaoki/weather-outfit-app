// 「🤖 自分の AI に聞く」欄（app.js から分離）
// - プロンプト（地域・寒がり度・天気データ入り）をコピー／共有
// - 着せ替え: 全身写真（任意）と今日の服の画像を、プロンプトと一緒に AI アプリへ共有
//   写真はこの端末の中だけで扱い、保存も送信もしない（端末 → AI アプリへ直接渡るだけ）

import { dayAdvice, addDays } from "./rules.js";
import { daytimeRows, nightRows } from "./weather.js";
import { SENSITIVITY_CHOICES } from "./settings.js";
import { buildAiPrompt, buildTryOnPrompt } from "./ai-prompt.js";
import { esc } from "./html.js";

let currentPrompt = "";
let currentItems = []; // 今日（夜は明日）の服。上着→トップス→ボトムスの順
let clothesFiles = null; // 共有用に先読みした服の画像（File）。準備中は null
let photoFile = null; // 選ばれた全身写真。メモリ上だけに持ち、保存しない
let preloadKey = "";

// 画像ファイルを共有できる端末か（Web Share API Level 2）
function canShareImages() {
  try {
    const probe = new File([new Uint8Array(1)], "probe.jpg", { type: "image/jpeg" });
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

// 共有はボタンを押した直後でないとブロックされるので、服の画像は表示した時点で先に読み込んでおく
function preloadClothes(items) {
  const key = items.map((i) => i.id).join(",");
  if (key === preloadKey) return;
  preloadKey = key;
  clothesFiles = null;
  Promise.all(
    items.map(async (i) => {
      const res = await fetch(`img/clothes/${i.id}.jpg`);
      if (!res.ok) throw new Error(i.id);
      return new File([await res.blob()], `${i.id}.jpg`, { type: "image/jpeg" });
    }),
  )
    .then((files) => {
      if (preloadKey === key) clothesFiles = files;
    })
    .catch(() => {
      /* 読めなかったら送るときに案内する */
    });
}

/**
 * @param {{ mode: "day"|"night", rows: object[], target: string, savedAt: number, settings: object }} p
 */
export function aiAskHtml({ mode, rows, target, savedAt, settings }) {
  const label = SENSITIVITY_CHOICES.find((c) => c.value === settings.sensitivity)?.label ?? "ふつう";
  // アプリが取得済みの天気をそのまま渡す（AI は Open-Meteo を自分では取得できないため）
  const weather = {
    fetchedAt: new Date(savedAt),
    target,
    day: daytimeRows(rows, target),
    night: mode === "night" ? nightRows(rows, target) : [],
    lastNight: mode === "night" ? nightRows(rows, addDays(target, -1)) : [],
  };
  currentPrompt = buildAiPrompt({ place: settings.place, sensitivityLabel: label, mode, weather });
  currentItems = dayAdvice(weather.day, settings.sensitivity).items;

  const canShare = typeof navigator.share === "function";
  const canShareFiles = canShareImages();
  if (canShareFiles) preloadClothes(currentItems);

  const tryOn = canShareFiles
    ? `
      <div class="tryon">
        <div class="tryon-title">👕 着せ替え（画像を作れる AI 向け）</div>
        <label class="ai-btn photo-pick">📷 全身写真を選ぶ（なくても可）
          <input type="file" accept="image/*" class="photo-input" hidden>
        </label>
        <p class="photo-status">${photoFile ? `選択中: ${esc(photoFile.name)}` : "写真なしで送ると、あとで AI のチャットで添付できます"}</p>
        <button type="button" class="ai-btn ai-btn-main" data-action="share-tryon">👕 服の画像とまとめて送る</button>
        <p class="ai-note">送る服: ${currentItems.map((i) => esc(i.label)).join("・")}。写真はこの端末から AI アプリへ直接渡ります。このアプリには保存も送信もしません。</p>
      </div>`
    : `<p class="ai-note">この端末では画像をまとめて送れません。服の画像を長押しで保存し、AI のチャットに添付してください。</p>`;

  return `
    <div class="sep"></div>
    <section class="ai-ask" aria-labelledby="ai-ask-title">
      <div class="label" id="ai-ask-title">🤖 自分の AI に聞く</div>
      <p class="ai-ask-sub">ChatGPT や Claude に送ると、同じ判定で答えてくれます。</p>
      <textarea class="ai-prompt" readonly rows="8" aria-label="AI に送る文">${esc(currentPrompt)}</textarea>
      <div class="ai-actions">
        <button type="button" class="ai-btn" data-action="copy-prompt">📋 コピー</button>
        ${canShare ? `<button type="button" class="ai-btn" data-action="share-prompt">📤 AI アプリに送る</button>` : ""}
      </div>
      <p class="ai-note">地域名・寒がり度・天気データが文に入ります。</p>
      ${tryOn}
      <p class="ai-status" role="status"></p>
    </section>`;
}

async function copyText(app, text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // クリップボードが使えない環境: 文を選択状態にして、手でコピーしてもらう
    const ta = app.querySelector(".ai-prompt");
    ta?.focus();
    ta?.select();
    return false;
  }
}

async function onAction(app, e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn || !["copy-prompt", "share-prompt", "share-tryon"].includes(btn.dataset.action)) return;
  const status = app.querySelector(".ai-status");
  const say = (t) => status && (status.textContent = t);

  if (btn.dataset.action === "copy-prompt") {
    say((await copyText(app, currentPrompt)) ? "コピーしました。AI のチャットに貼り付けてください" : "文を選択しました。長押しでコピーしてください");
    return;
  }

  if (btn.dataset.action === "share-prompt") {
    try {
      await navigator.share({ text: currentPrompt });
      say("送りました");
    } catch (err) {
      if (err.name !== "AbortError") say("送れませんでした。コピーを使ってください");
    }
    return;
  }

  // share-tryon
  if (!clothesFiles) {
    say("服の画像を準備中です。少し待ってからもう一度押してください");
    return;
  }
  const text = `${currentPrompt}\n\n${buildTryOnPrompt({
    hasPhoto: Boolean(photoFile),
    itemLabels: currentItems.map((i) => i.label),
    hasOuter: currentItems.some((i) => i.id.startsWith("outer-")),
  })}`;
  const files = photoFile ? [photoFile, ...clothesFiles] : clothesFiles;
  // アプリによっては画像と一緒だと文字が届かないので、同時にコピーしておく（待たずに共有を始める）
  navigator.clipboard?.writeText(text).catch(() => {});
  try {
    await navigator.share({ files, text });
    say("送りました。文が届いていなければ、チャットに貼り付けてください（コピー済み）");
  } catch (err) {
    if (err.name === "AbortError") return;
    say("送れませんでした。写真が大きすぎる場合は、小さい写真で試してください");
  }
}

function onPhotoChange(app, e) {
  if (!e.target.matches?.(".photo-input")) return;
  photoFile = e.target.files?.[0] ?? null;
  const s = app.querySelector(".photo-status");
  if (s) s.textContent = photoFile ? `選択中: ${photoFile.name}` : "写真なしで送ると、あとで AI のチャットで添付できます";
}

/** app（画面のルート要素）にイベントをつなぐ。1 回だけ呼ぶ */
export function attachAiAsk(app) {
  app.addEventListener("click", (e) => onAction(app, e));
  app.addEventListener("change", (e) => onPhotoChange(app, e));
}
