// 画面の組み立て。判定は rules.js、データ取得は weather.js に任せる
import { dayAdvice, pajamaAdvice, decideMode, addDays } from "./rules.js";
import { fetchForecast, searchPlaces, currentPlace, daytimeRows, nightRows } from "./weather.js";
import { loadSettings, saveSettings, SENSITIVITY_CHOICES } from "./settings.js";

const app = document.getElementById("app");
const dialog = document.getElementById("settings");
let settings = loadSettings();

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

const itemsHtml = (items) =>
  `<div class="coord">${items.map((i) => `<div class="item">${i.icon}<small>${esc(i.label)}</small></div>`).join("")}</div>`;

const notesHtml = (notes) => (notes.length ? `<ul class="notes">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : "");

const statsHtml = (cells) =>
  `<div class="stats">${cells.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("")}</div>`;

const topHtml = (dateText) => `
  <div class="top">
    <span>📍 ${esc(settings.place.name)}</span>
    <span class="date">${dateText}</span>
    <button class="gear" id="open-settings" aria-label="設定">⚙</button>
  </div>`;

const credit = `<p class="credit">天気データ: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>（CC BY 4.0）</p>`;

function renderDay(rows, target) {
  const a = dayAdvice(daytimeRows(rows, target), settings.sensitivity);
  return `
    ${topHtml(formatDate(target))}
    <div class="label">今日の服装</div>
    <div class="big">${esc(a.headline)}</div>
    ${itemsHtml(a.items)}
    ${statsHtml([["体感 最高", `${a.stats.max}℃`], ["体感 最低", `${a.stats.min}℃`], ["湿度", `${a.stats.humidity}%`]])}
    ${notesHtml(a.notes)}`;
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
    <div class="big">${p.icon} ${esc(p.headline)}</div>
    ${notesHtml([`明け方は ${p.min}℃ まで下がります`, ...p.notes])}
    <div class="sep"></div>
    <div class="label">明日の服装</div>
    <div class="big sub">${esc(a.headline)}</div>
    ${itemsHtml(a.items)}
    ${statsHtml(cells)}
    ${notesHtml(a.notes)}`;
}

async function render() {
  if (!settings.place) {
    app.innerHTML = `<p class="loading">はじめに、お住まいの地域を設定してください。</p>`;
    openSettings();
    return;
  }
  const { mode, target } = decideMode(now());
  document.body.className = mode;
  try {
    const rows = await fetchForecast(settings.place.latitude, settings.place.longitude);
    const html = mode === "day" ? renderDay(rows, target) : renderNight(rows, target);
    app.innerHTML = html + credit;
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
  if (!dialog.open) dialog.showModal();
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
