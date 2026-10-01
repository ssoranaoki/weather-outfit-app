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
  });
globalThis.document = { getElementById: el, body: { className: "" }, createElement: () => ({ click() {} }), addEventListener() {}, querySelector: () => null, visibilityState: "visible" };
let shared = null;
Object.defineProperty(globalThis, "navigator", { value: { share: async (d) => { shared = d; } }, configurable: true });
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

handlers["open-settings:click"]?.forEach((fn) => fn());
for (const fn of handlers["export-feedback:click"]) await fn();
console.log("書き出し:", els["export-status"].textContent);
console.log(shared?.text);
