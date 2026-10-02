// サービスワーカー: 画面と画像をスマホに保存し、電波がないときも開けるようにする
// - 画面のファイル（HTML / JS / CSS / マニフェスト / llms.txt 等）: ネット優先。取れなければ保存版
//   GitHub Pages は cache-control: max-age=600 を返すので、普通に fetch するとブラウザの HTTP キャッシュから
//   最大 10 分古い版が返る。cache: "no-cache" で毎回サーバーに再確認（変わっていなければ 304 で軽い）
// - 画像: 保存版をすぐ返し、裏で最新を取り直して保存を更新（stale-while-revalidate）
// - 他サイト（天気・住所検索 API）: 触らない。オフライン時の扱いは weather.js が担う
// 保存するファイルの一覧を変えたら CACHE_VERSION を上げる（古い保存を消すため）

const CACHE_VERSION = "wo-v5";

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
  "./js/ai-prompt.js",
  "./js/ai-ask.js",
  "./js/html.js",
  "./js/weather-icon.js",
  "./js/motion.js",
  "./js/vendor/anime.esm.min.js",
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
  // 初回保存も HTTP キャッシュを通さず、サーバーの最新を保存する
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: "no-cache" })))),
  );
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
    event.respondWith(staleWhileRevalidate(req, event));
  } else {
    event.respondWith(networkFirst(req));
  }
});

// 取得は元の Request ではなく URL で行う（ページ移動の Request にオプションを付けると環境によってはエラーになるため）
const fresh = (req) => fetch(req.url, { cache: "no-cache", credentials: "same-origin" });

async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(CACHE_VERSION);
  const hit = await cache.match(req);
  const update = fresh(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) {
    event.waitUntil(update); // 裏で更新を最後までやり切る
    return hit;
  }
  return (await update) ?? Response.error();
}

async function networkFirst(req) {
  try {
    const res = await fresh(req);
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
