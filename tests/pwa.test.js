import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { CLOTHES } from "../js/rules.js";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

test("マニフェスト: Chrome のインストール条件（名前・192/512 アイコン・start_url・display）を満たす", () => {
  const m = JSON.parse(read("manifest.webmanifest"));
  assert.ok(m.name || m.short_name);
  assert.ok(m.start_url);
  assert.ok(["fullscreen", "standalone", "minimal-ui", "window-controls-overlay"].includes(m.display));
  assert.notEqual(m.prefer_related_applications, true);
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes("192x192") && sizes.includes("512x512"));
  for (const i of m.icons) assert.ok(existsSync(new URL(i.src, root)), `${i.src} がない`);
});

test("サービスワーカーが保存するファイルはすべて実在する", () => {
  const sw = read("sw.js");
  const paths = [...sw.matchAll(/"(\.\/[^"]*)"/g)].map((m) => m[1]).filter((p) => p !== "./");
  for (const p of paths) assert.ok(existsSync(new URL(p, root)), `${p} がない`);
});

test("サービスワーカーの服画像リストが服カタログと一致する", () => {
  const sw = read("sw.js");
  const block = sw.slice(sw.indexOf("...["), sw.indexOf("].map"));
  const ids = [...block.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(ids, Object.keys(CLOTHES).sort());
});

test("サービスワーカーが js/ のすべてのファイルを保存対象にしている", async () => {
  const { readdirSync } = await import("node:fs");
  const sw = read("sw.js");
  const files = [
    ...readdirSync(new URL("js/", root)).filter((f) => f.endsWith(".js")),
    ...readdirSync(new URL("js/vendor/", root)).filter((f) => f.endsWith(".js")).map((f) => `vendor/${f}`), // 同梱ライブラリ（Anime.js 等）。README.md は対象外
  ];
  for (const f of files) assert.ok(sw.includes(`"./js/${f}"`), `js/${f} が sw.js の SHELL にない`);
});
