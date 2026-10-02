// ブラウザがない環境向けの画面確認スクリプト（本物の天気 API を使う）
// 使い方: node tools/ui-smoke.mjs 22   … 22 時に開いたものとして画面を組み立て、評価ボタン・書き出しまで通す
// DOM は必要最小限だけまねている。見た目（CSS）は確認できないので、実機での確認は別途必要。

const hour = process.argv[2] ?? "7";
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
globalThis.location = { search: `?hour=${hour}` };
const els = {};
const handlers = {};
const el = (id) =>
  (els[id] ??= {
    id, innerHTML: "", textContent: "", value: "", disabled: false, open: false,
    addEventListener: (t, fn) => (handlers[`${id}:${t}`] ??= []).push(fn),
    showModal() { this.open = true; },
    querySelectorAll: () => [], // Anime.js で動かす要素の検索（簡易環境では動かす対象なし）
    querySelector: () => null,
  });
// 「動きを減らす」設定なし（Anime.js を通る経路を確かめる）
globalThis.window = { matchMedia: () => ({ matches: false }), isSecureContext: false };
// Anime.js がブラウザだと判断して使う描画タイマー
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.document = { getElementById: el, body: { className: "" }, createElement: () => ({ click() {} }), addEventListener() {}, querySelector: () => null, visibilityState: "visible" };
let shared = null;
let copied = null;
Object.defineProperty(globalThis, "navigator", {
  value: { share: async (d) => { shared = d; }, canShare: (d) => Boolean(d.files), clipboard: { writeText: async (t) => { copied = t; } } },
  configurable: true,
});
// 服の画像（相対パス）はファイルから返し、天気 API などは本物のネットへ
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith("img/")) {
    const { readFile } = await import("node:fs/promises");
    const buf = await readFile(new URL(`../${u}`, import.meta.url));
    return { ok: true, blob: async () => new Blob([buf], { type: "image/jpeg" }) };
  }
  return realFetch(url, init);
};
localStorage.setItem(
  "wo:settings",
  JSON.stringify({ place: { name: "岐阜県養老町鷲巣", area: "", latitude: 35.286, longitude: 136.56 }, sensitivity: 0 }),
);

await import("../js/app.js");
await new Promise((r) => setTimeout(r, 4000));

const html = els.app.innerHTML;
const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
console.log(`[hour=${hour}] mode=${document.body.className}`);
console.log(text.slice(0, 400));
console.log("天気アイコン:", html.match(/class="weather-badge" data-kind="(\w+)"/)?.[1] ?? "なし", "|", html.match(/aria-label="([^"]+)" overflow/)?.[1] ?? "");
console.log("画像:", [...html.matchAll(/img src="([^"]+)"/g)].map((m) => m[1]).join(" ") || "なし");

const m = html.match(/data-kind="(\w+)" data-rating="cold"/);
if (!m) {
  console.log("評価ボタン: なし");
  process.exit(1);
}
const mkBtn = (rating) => ({
  dataset: { kind: m[1], rating },
  classList: { on: false, toggle(_, v) { this.on = v; } },
  setAttribute() {},
});
const btns = ["hot", "ok", "cold"].map(mkBtn);
const done = { textContent: "" };
const section = { querySelectorAll: () => btns, querySelector: () => done };
btns.forEach((b) => (b.closest = (s) => (s === ".feedback" ? section : s === "button.rate" ? b : null)));
const click = (b) => handlers["app:click"].forEach((fn) => fn({ target: b }));

click(btns[2]);
click(btns[1]);
const saved = JSON.parse(store.get("wo:feedback"));
console.log(`評価: ${saved.length} 件 / ${saved[0].kind} = ${saved[0].rating}（寒かった→ちょうどよいに押し直し）`);

console.log("服のカード:", (html.match(/<button type="button" class="item" aria-haspopup="dialog"/g) ?? []).length, "枚（タップで拡大するボタン）");

// 自分の AI に聞く: プロンプトの中身と、コピーボタン
const prompt = html.match(/<textarea class="ai-prompt"[^>]*>([\s\S]*?)<\/textarea>/)?.[1];
console.log("AI プロンプト:\n" + (prompt ?? "なし"));
console.log("送るボタン:", html.includes('data-action="share-prompt"') ? "あり" : "なし");
const aiStatus = { textContent: "" };
els.app.querySelector = (sel) => (sel === ".ai-status" ? aiStatus : null);
const copyBtn = { dataset: { action: "copy-prompt" } };
copyBtn.closest = (sel) => (sel === "button[data-action]" ? copyBtn : null);
for (const fn of handlers["app:click"]) await fn({ target: copyBtn });
console.log("コピー:", aiStatus.textContent, "| 内容一致:", copied !== null && copied.includes("寒がり度"));

// 着せ替え: 写真を選んで、服の画像とまとめて共有
console.log("着せ替え欄:", html.includes('data-action="share-tryon"') ? "あり" : "なし");
const photoStatus = { textContent: "" };
els.app.querySelector = (sel) => (sel === ".ai-status" ? aiStatus : sel === ".photo-status" ? photoStatus : null);
const photo = new File([new Uint8Array(10)], "me.jpg", { type: "image/jpeg" });
for (const fn of handlers["app:change"] ?? []) fn({ target: { matches: (s) => s === ".photo-input", files: [photo] } });
const tryBtn = { dataset: { action: "share-tryon" } };
tryBtn.closest = (sel) => (sel === "button[data-action]" ? tryBtn : null);
shared = null;
for (const fn of handlers["app:click"]) await fn({ target: tryBtn });
console.log("写真の表示:", photoStatus.textContent);
console.log("共有したファイル:", shared?.files?.map((f) => `${f.name}(${f.size}B)`).join(", "));
console.log("共有した文の末尾:\n" + shared?.text.split("\n").slice(-6).join("\n"));
console.log("状態:", aiStatus.textContent);

handlers["open-settings:click"]?.forEach((fn) => fn());
for (const fn of handlers["export-feedback:click"]) await fn();
console.log("書き出し:", els["export-status"].textContent);
console.log(shared?.text);
process.exit(0); // Anime.js の描画タイマーが残っても終わるように
