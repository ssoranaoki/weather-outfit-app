// 画面の組み立て。判定は rules.js、データ取得は weather.js に任せる
import { dayAdvice, pajamaAdvice, decideMode, addDays } from "./rules.js";
import { fetchForecast, searchPlaces, currentPlace, daytimeRows, nightRows } from "./weather.js";
import { loadSettings, saveSettings, SENSITIVITY_CHOICES } from "./settings.js";
import { RATINGS, loadFeedback, saveFeedback, upsertRecord, findRecord, toCsv } from "./feedback.js";
import { openZoom } from "./zoom.js";
import { buildAiPrompt } from "./ai-prompt.js";

const app = document.getElementById("app");
const dialog = document.getElementById("settings");
let settings = loadSettings();
// 表示中の「どうだった？」に対応する記録の中身（評価だけ未定）。kind ごとに 1 つ
let pendingRecords = {};

// 動作確認用: ?hour=22 のように付けると、その時刻に開いたものとして表示する
function now() {
  const d = new Date();
  const hour = new URLSearchParams(location.search).get("hour");
  if (hour !== null && /^\d{1,2}$/.test(hour)) d.setHours(Number(hour), 0, 0, 0);
  return d;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function formatDate(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const w = "日月火水木金土"[new Date(y, m - 1, d).getDay()];
  return `${m}月${d}日（${w}）`;
}

// 服の画像。読み込めなかったときは絵文字に差し替える（icon は rules.js の固定値なので埋め込んでも安全）
const itemImg = (i) =>
  i.id
    ? `<img src="img/clothes/${i.id}.jpg" alt="" width="200" height="200" loading="lazy" onerror="this.replaceWith(document.createTextNode('${i.icon}'))">`
    : i.icon;

// 服のカードはタップで画面中央に拡大表示するボタン（処理は zoom.js）
const itemsHtml = (items) =>
  `<div class="coord">${items
    .map(
      (i) =>
        `<button type="button" class="item" aria-haspopup="dialog" aria-expanded="false">${itemImg(i)}<small>${esc(i.label)}</small></button>`,
    )
    .join("")}</div>`;

function onItemTap(e) {
  const card = e.target.closest("button.item");
  if (card) openZoom(card);
}

const notesHtml = (notes) => (notes.length ? `<ul class="notes">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : "");

const statsHtml = (cells) =>
  `<div class="stats">${cells.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("")}</div>`;

const topHtml = (dateText) => `
  <div class="top">
    <span>📍 ${esc(settings.place.name)}</span>
    <span class="date">${dateText}</span>
    <button class="gear" id="open-settings" aria-label="設定">⚙</button>
  </div>`;

// ---- 「どうだった？」カード ----

/** record: 評価以外が埋まった記録。表示用の質問文と一緒に渡す */
function feedbackHtml(question, record) {
  pendingRecords[record.kind] = record;
  const saved = findRecord(loadFeedback(), record.date, record.kind);
  const buttons = RATINGS.map(
    (r) =>
      `<button type="button" class="rate${saved?.rating === r.value ? " selected" : ""}" data-kind="${record.kind}" data-rating="${r.value}" aria-pressed="${saved?.rating === r.value}">
        <span class="rate-icon">${r.icon}</span>${r.label}</button>`,
  ).join("");
  return `
    <section class="feedback" aria-label="${esc(question)}">
      <div class="label">${esc(question)}</div>
      <p class="feedback-sub">${esc(record.headline)}</p>
      <div class="rates">${buttons}</div>
      <p class="feedback-done">${saved ? "記録しました。押し直すと変更できます" : "押すと、この端末の中だけに記録されます"}</p>
    </section>`;
}

function onRate(e) {
  const btn = e.target.closest("button.rate");
  if (!btn) return;
  const base = pendingRecords[btn.dataset.kind];
  if (!base) return;
  saveFeedback(upsertRecord(loadFeedback(), { ...base, rating: btn.dataset.rating, savedAt: new Date().toISOString() }));
  const section = btn.closest(".feedback");
  section.querySelectorAll("button.rate").forEach((b) => {
    const on = b === btn;
    b.classList.toggle("selected", on);
    b.setAttribute("aria-pressed", String(on));
  });
  section.querySelector(".feedback-done").textContent = "記録しました。押し直すと変更できます";
}

// ---- 自分の AI に聞く ----
// 端末内の設定（地域・寒がり度）を書き込んだプロンプトを、コピーまたは AI アプリへ共有で渡す
let currentPrompt = "";

function aiAskHtml(mode) {
  const label = SENSITIVITY_CHOICES.find((c) => c.value === settings.sensitivity)?.label ?? "ふつう";
  currentPrompt = buildAiPrompt({ place: settings.place, sensitivityLabel: label, mode });
  const canShare = typeof navigator.share === "function";
  return `
    <div class="sep"></div>
    <section class="ai-ask" aria-labelledby="ai-ask-title">
      <div class="label" id="ai-ask-title">🤖 自分の AI に聞く</div>
      <p class="ai-ask-sub">ChatGPT や Claude に貼り付けると、同じ判定で答えてくれます。着せ替えもできる AI なら、続けて全身写真を送ってください（写真はこのアプリには送られません）。</p>
      <textarea class="ai-prompt" readonly rows="5" aria-label="AI に送る文">${esc(currentPrompt)}</textarea>
      <div class="ai-actions">
        <button type="button" class="ai-btn" data-action="copy-prompt">📋 コピー</button>
        ${canShare ? `<button type="button" class="ai-btn" data-action="share-prompt">📤 AI アプリに送る</button>` : ""}
      </div>
      <p class="ai-status" role="status"></p>
      <p class="ai-note">地域名と寒がり度が文に入ります。</p>
    </section>`;
}

async function onAiAction(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn || !btn.dataset.action.endsWith("-prompt")) return;
  const status = app.querySelector(".ai-status");
  if (btn.dataset.action === "share-prompt") {
    try {
      await navigator.share({ text: currentPrompt });
      status.textContent = "送りました";
    } catch (err) {
      if (err.name !== "AbortError") status.textContent = "送れませんでした。コピーを使ってください";
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(currentPrompt);
    status.textContent = "コピーしました。AI のチャットに貼り付けてください";
  } catch {
    // クリップボードが使えない環境: 文を選択状態にして、手でコピーしてもらう
    const ta = app.querySelector(".ai-prompt");
    ta.focus();
    ta.select();
    status.textContent = "文を選択しました。長押しでコピーしてください";
  }
}

const credit = `<p class="credit">天気データ: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>（CC BY 4.0）<br><a href="llms.txt">AI で使う方へ（llms.txt）</a></p>`;

function renderDay(rows, target) {
  const a = dayAdvice(daytimeRows(rows, target), settings.sensitivity);
  return `
    ${topHtml(formatDate(target))}
    <div class="label">今日の服装</div>
    <div class="big">${esc(a.headline)}</div>
    ${itemsHtml(a.items)}
    ${statsHtml([["体感 最高", `${a.stats.max}℃`], ["体感 最低", `${a.stats.min}℃`], ["湿度", `${a.stats.humidity}%`]])}
    ${notesHtml(a.notes)}
    ${lastNightFeedback(rows, target)}`;
}

// 朝の画面: 今朝までの夜（前日 22 時〜今朝 6 時）の寝間着を聞く
function lastNightFeedback(rows, today) {
  const night = nightRows(rows, today);
  if (!night.length) return "";
  const p = pajamaAdvice(night, [], settings.sensitivity);
  return `<div class="sep"></div>${feedbackHtml("昨夜の寝間着はどうだった？", {
    date: today, kind: "night", headline: p.headline, max: null, min: p.min, humidity: null, sensitivity: settings.sensitivity,
  })}`;
}

// 夜の画面: 今日（明日の前日）の服装を聞く
function todayFeedback(rows, tomorrow) {
  const day = addDays(tomorrow, -1);
  const hours = daytimeRows(rows, day);
  if (!hours.length) return "";
  const a = dayAdvice(hours, settings.sensitivity);
  return `<div class="sep"></div>${feedbackHtml("今日の服装はどうだった？", {
    date: day, kind: "day", headline: a.headline, max: a.stats.max, min: a.stats.min, humidity: a.stats.humidity, sensitivity: settings.sensitivity,
  })}`;
}

function renderNight(rows, target) {
  const p = pajamaAdvice(nightRows(rows, target), nightRows(rows, addDays(target, -1)), settings.sensitivity);
  const a = dayAdvice(daytimeRows(rows, target), settings.sensitivity);
  const prevDay = daytimeRows(rows, addDays(target, -1));
  const cells = [["体感 最高", `${a.stats.max}℃`], ["体感 最低", `${a.stats.min}℃`]];
  if (prevDay.length) {
    const diff = a.stats.max - Math.round(Math.max(...prevDay.map((r) => r.apparent)));
    cells.push(["前日より", `${diff > 0 ? "+" : ""}${diff}℃`]);
  }
  return `
    ${topHtml(`明日 ${formatDate(target)}`)}
    <div class="label">今夜の寝間着</div>
    <div class="big">${esc(p.headline)}</div>
    ${itemsHtml([p.item])}
    ${notesHtml([`明け方は ${p.min}℃ まで下がります`, ...p.notes])}
    <div class="sep"></div>
    <div class="label">明日の服装</div>
    <div class="big sub">${esc(a.headline)}</div>
    ${itemsHtml(a.items)}
    ${statsHtml(cells)}
    ${notesHtml(a.notes)}
    ${todayFeedback(rows, target)}`;
}

// 電波がなく、前回取得した天気で表示しているときの案内
function staleHtml(savedAt) {
  const d = new Date(savedAt);
  const when = `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}時${String(d.getMinutes()).padStart(2, "0")}分`;
  return `<p class="stale" role="status">📡 電波がないため、${when}時点の天気で表示しています</p>`;
}

async function render() {
  if (!settings.place) {
    app.innerHTML = `<p class="loading">はじめに、お住まいの地域を設定してください。</p>`;
    openSettings();
    return;
  }
  const { mode, target } = decideMode(now());
  document.body.className = mode;
  pendingRecords = {};
  try {
    const { rows, savedAt, stale } = await fetchForecast(settings.place.latitude, settings.place.longitude);
    // 保存が古すぎて対象日の予報を含まない（何日も電波がなかった等）ときは、出せる情報がない
    if (!daytimeRows(rows, target).length) throw new Error("最新の天気を取得できませんでした");
    const html = mode === "day" ? renderDay(rows, target) : renderNight(rows, target);
    app.innerHTML = (stale ? staleHtml(savedAt) : "") + html + aiAskHtml(mode) + credit;
  } catch (e) {
    app.innerHTML = `<p class="error">${esc(e.message)}<br>電波の良いところで開き直してください。</p>`;
  }
  document.getElementById("open-settings")?.addEventListener("click", openSettings);
}

// ---- 設定画面 ----

function openSettings() {
  document.getElementById("current-place").textContent = settings.place
    ? `いまの設定: ${settings.place.name}${settings.place.area ? `（${settings.place.area}）` : ""}`
    : "まだ設定されていません";
  document.getElementById("sensitivity-choices").innerHTML = SENSITIVITY_CHOICES.map(
    (c) =>
      `<label><input type="radio" name="sensitivity" value="${c.value}" ${c.value === settings.sensitivity ? "checked" : ""}>${c.label}</label>`,
  ).join("");
  document.getElementById("place-results").innerHTML = "";
  const count = loadFeedback().length;
  document.getElementById("feedback-count").textContent = count ? `いま ${count} 件の記録があります` : "まだ記録はありません";
  document.getElementById("export-feedback").disabled = count === 0;
  document.getElementById("export-status").textContent = "";
  if (!dialog.open) dialog.showModal();
}

// 記録の書き出し: スマホは共有メニュー（LINE など）、使えなければクリップボード、最後はファイル保存
async function exportFeedback() {
  const status = document.getElementById("export-status");
  const text = toCsv(loadFeedback());
  const title = "きょうの服装 記録";
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      status.textContent = "共有しました";
      return;
    }
  } catch (e) {
    if (e.name === "AbortError") return; // 共有メニューを閉じただけ
  }
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "コピーしました。LINE やメールに貼り付けて送ってください";
    return;
  } catch {
    /* クリップボードが使えない環境はファイル保存へ */
  }
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv" })); // BOM 付きで Excel でも文字化けしない
  const a = Object.assign(document.createElement("a"), { href: url, download: "outfit-feedback.csv" });
  a.click();
  URL.revokeObjectURL(url);
  status.textContent = "ファイルに保存しました";
}

async function doSearch() {
  const q = document.getElementById("place-query").value.trim();
  const list = document.getElementById("place-results");
  if (q.length < 2) {
    list.innerHTML = `<li>2文字以上で入力してください</li>`;
    return;
  }
  list.innerHTML = `<li>検索中…</li>`;
  try {
    const places = await searchPlaces(q);
    if (!places.length) {
      list.innerHTML = `<li>見つかりませんでした。「市」「町」まで入れてみてください</li>`;
      return;
    }
    list.innerHTML = places
      .map((p, i) => `<li><button type="button" data-i="${i}">${esc(p.name)}<small>${esc(p.area)}</small></button></li>`)
      .join("");
    list.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        settings = { ...settings, place: places[Number(b.dataset.i)] };
        saveSettings(settings);
        openSettings();
      }),
    );
  } catch (e) {
    list.innerHTML = `<li>${esc(e.message)}</li>`;
  }
}

async function useLocation() {
  const btn = document.getElementById("use-location");
  const list = document.getElementById("place-results");
  btn.disabled = true;
  btn.textContent = "📍 現在地を取得中…";
  try {
    settings = { ...settings, place: await currentPlace() };
    saveSettings(settings);
    openSettings();
  } catch (e) {
    list.innerHTML = `<li>${esc(e.message)}</li>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "📍 現在地を使う";
  }
}

app.addEventListener("click", onRate);
app.addEventListener("click", onItemTap);
app.addEventListener("click", onAiAction);
document.getElementById("export-feedback").addEventListener("click", exportFeedback);
document.getElementById("use-location").addEventListener("click", useLocation);
document.getElementById("place-search").addEventListener("click", doSearch);
document.getElementById("place-query").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    doSearch();
  }
});
document.getElementById("sensitivity-choices").addEventListener("change", (e) => {
  settings = { ...settings, sensitivity: Number(e.target.value) };
  saveSettings(settings);
});
dialog.addEventListener("close", render);

render();

// ホーム画面のアプリは裏で開いたままになりやすい。画面に戻ってきたら作り直す
// （夜に開いたまま翌朝見たとき、寝間着の画面が残らないように。天気は 30 分以内なら保存を使う）
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !dialog.open && !document.querySelector(".zoom-layer")) render();
});

// ホーム画面に追加（PWA）用。HTTPS か localhost でのみ登録できる
if ("serviceWorker" in navigator && window.isSecureContext) {
  // すでに古い版のサービスワーカーが動いていたか（初回インストール時は読み直さないため）
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // 新しい版に切り替わったら 1 回だけ読み直して、最新の画面にする
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });

  navigator.serviceWorker
    // sw.js 自体の確認もブラウザの HTTP キャッシュを通さない
    .register("./sw.js", { updateViaCache: "none" })
    .then((reg) => {
      // ホーム画面のアプリは裏で開いたままになりやすいので、画面に戻ってきたときにも更新を確認する
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    })
    .catch(() => {
      /* 登録できなくても通常のページとして動く */
    });
}
