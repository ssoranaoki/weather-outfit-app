// 天気アイコンの SVG（絵を組み立てるだけ。動きは motion.js が付ける）
// 動かす部品には class を付けておく: sun-rays（回る）/ cloud（ゆれる）/ drop（落ちる）/ flake（降る）

import { WEATHER_LABELS } from "./rules.js";

const SUN = `
  <g class="sun-rays" stroke="#f0a020" stroke-width="3" stroke-linecap="round">
    ${Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      const p = (r) => `${(32 + r * Math.cos(a)).toFixed(1)} ${(32 + r * Math.sin(a)).toFixed(1)}`;
      return `<path d="M${p(19)} L${p(26)}"/>`;
    }).join("")}
  </g>
  <circle cx="32" cy="32" r="12" fill="#ffc83d"/>`;

// 雲（rain / snow / cloudy で共通）
const CLOUD = `<path class="cloud" fill="#a9b6c9" d="M18 38 a10 10 0 0 1 3-19 a13 13 0 0 1 24 3 a8 8 0 0 1 1 16 Z"/>`;

const DROPS = [20, 30, 40]
  .map((x) => `<path class="drop" d="M${x} 42 l-2 6" stroke="#3d8bdc" stroke-width="3" stroke-linecap="round"/>`)
  .join("");

const FLAKES = [21, 32, 43]
  .map((x) => `<circle class="flake" cx="${x}" cy="45" r="2.6" fill="#e6f0ff" stroke="#5c7fb0" stroke-width="1.2"/>`)
  .join("");

const BODY = {
  clear: SUN,
  cloudy: CLOUD,
  rain: CLOUD + DROPS,
  snow: CLOUD + FLAKES,
};

/**
 * @param {"clear"|"cloudy"|"rain"|"snow"} kind
 * @param {string} prefix 「明日は」など、ラベルの前に付ける言葉
 */
export function weatherBadgeHtml(kind, prefix = "") {
  if (!BODY[kind]) return "";
  const label = `${prefix}${WEATHER_LABELS[kind]}`;
  return `
    <div class="weather-badge" data-kind="${kind}">
      <svg viewBox="0 0 64 64" width="56" height="56" role="img" aria-label="${label}" overflow="visible">${BODY[kind]}</svg>
      <span>${label}</span>
    </div>`;
}
