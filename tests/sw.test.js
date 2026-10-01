// sw.js を Node の vm で動かし、ネット・保存（Cache Storage）を差し替えて振る舞いを確かめる
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ORIGIN = "https://ssoranaoki.github.io";
const BASE = `${ORIGIN}/weather-outfit-app/`;

function loadSw({ online = true, server = {} } = {}) {
  const store = new Map(); // url -> body（保存）
  const fetchLog = [];
  const state = { online };
  const res = (body) => ({ ok: true, body, clone() { return res(body); } });
  const cache = {
    match: async (r) => (store.has(urlOf(r)) ? res(store.get(urlOf(r))) : undefined),
    put: async (r, v) => store.set(urlOf(r), v.body),
    addAll: async () => {},
  };
  const urlOf = (r) => (typeof r === "string" ? new URL(r, BASE).href : r.url).split("?")[0];
  const listeners = {};
  const ctx = {
    self: { location: { origin: ORIGIN }, addEventListener: (t, fn) => (listeners[t] = fn), skipWaiting() {}, clients: { claim() {} } },
    caches: { open: async () => cache, match: cache.match, keys: async () => [], delete: async () => {} },
    fetch: async (url, init) => {
      fetchLog.push({ url, init });
      if (!state.online) throw new TypeError("offline");
      return res(server[url] ?? `server:${url}`);
    },
    Request: class { constructor(u, init) { this.url = u; this.init = init; } },
    Response: { error: () => ({ ok: false, error: true }) },
    URL,
  };
  vm.runInNewContext(readFileSync(new URL("../sw.js", import.meta.url), "utf8"), ctx);
  async function request(path, mode = "cors") {
    let responded;
    const pending = [];
    listeners.fetch({
      request: { url: BASE + path, method: "GET", mode },
      respondWith: (p) => (responded = p),
      waitUntil: (p) => pending.push(p),
    });
    const r = await responded;
    await Promise.all(pending);
    return r;
  }
  return { request, store, fetchLog, state };
}

test("画面のファイルは毎回サーバーに再確認する（cache: no-cache）", async () => {
  const sw = loadSw({ server: { [`${BASE}js/app.js`]: "v2" } });
  sw.store.set(`${BASE}js/app.js`, "v1");
  const r = await sw.request("js/app.js");
  assert.equal(r.body, "v2");
  assert.equal(sw.fetchLog[0].init.cache, "no-cache");
  assert.equal(sw.store.get(`${BASE}js/app.js`), "v2"); // 保存も最新に
});

test("電波がないときは保存版を返す。ページ移動は ?hour= 付きでも index.html", async () => {
  const sw = loadSw({ online: false });
  sw.store.set(`${BASE}js/app.js`, "v1");
  sw.store.set(`${BASE}index.html`, "<html>");
  assert.equal((await sw.request("js/app.js")).body, "v1");
  assert.equal((await sw.request("?hour=22", "navigate")).body, "<html>");
});

test("画像は保存版をすぐ返し、裏で最新に入れ替える", async () => {
  const sw = loadSw({ server: { [`${BASE}img/clothes/top-long.jpg`]: "new" } });
  sw.store.set(`${BASE}img/clothes/top-long.jpg`, "old");
  assert.equal((await sw.request("img/clothes/top-long.jpg")).body, "old");
  assert.equal(sw.store.get(`${BASE}img/clothes/top-long.jpg`), "new");
  assert.equal((await sw.request("img/clothes/top-long.jpg")).body, "new");
});

test("他サイト（天気 API）には触らない", () => {
  let fetchListener;
  vm.runInNewContext(readFileSync(new URL("../sw.js", import.meta.url), "utf8"), {
    self: { location: { origin: ORIGIN }, addEventListener: (t, fn) => t === "fetch" && (fetchListener = fn), skipWaiting() {}, clients: {} },
    caches: {}, fetch() {}, Request: class {}, Response: {}, URL,
  });
  let responded = false;
  fetchListener({
    request: { url: "https://api.open-meteo.com/v1/forecast", method: "GET", mode: "cors" },
    respondWith: () => (responded = true),
    waitUntil() {},
  });
  assert.equal(responded, false);
});
