// サービスワーカー: 画面と画像をスマホに保存し、電波がないときも開けるようにする
// - 画面のファイル（HTML / JS / CSS / マニフェスト）: ネット優先。取れなければ保存版
// - 画像: 保存版優先（めったに変わらないので速さを優先）
// - 他サイト（天気・住所検索 API）: 触らない。オフライン時の扱いは weather.js が担う
// 保存するファイルの一覧を変えたら CACHE_VERSION を上げる（古い保存を消すため）

const CACHE_VERSION = "wo-v1";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/app.js",
  "./js/rules.js",
  "./js/weather.js",
  "./js/settings.js",
  "./js/feedback.js",
  "./js/zoom.js",
  "./img/icons/icon-192.png",
  "./img/icons/apple-touch-icon.png",
  ...[
    "top-short", "top-long", "top-sweater", "top-thick-sweater",
    "bottom-light", "bottom-pants", "bottom-thick",
    "outer-light", "outer-jacket", "outer-coat", "outer-thick-coat",
    "acc-winter", "pj-short", "pj-long", "pj-warm",
  ].map((id) => `./img/clothes/${id}.jpg`),
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.includes("/img/")) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(networkFirst(req));
  }
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE_VERSION)).put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE_VERSION)).put(req, res.clone());
    return res;
  } catch {
    // オフライン: 保存版。ページ移動（URL に ?hour= などが付いていても）は index.html を返す
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === "navigate") return caches.match("./index.html");
    return Response.error();
  }
}
