// 画面の動き（Anime.js v4.5.0 を js/vendor に同梱。MIT ライセンス）
// - 開いたとき: 結論の1行がふわっと現れ、服のカードが1枚ずつ下から並ぶ
// - 天気アイコン: 晴れ=太陽がゆっくり回る / くもり=雲がゆれる / 雨=しずくが落ちる / 雪=ゆらゆら降る
// 「動きを減らす」設定の人には何もしない（静止した表示のまま）

import { animate, stagger, cleanInlineStyles } from "./vendor/anime.esm.min.js";

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

let loops = []; // くり返す動き（天気アイコン）。描き直す前に止める

/** 表示を作り直す前に呼ぶ。消える要素の動きを止めて、裏で動き続けないようにする */
export function stopLoops() {
  loops.forEach((a) => a.pause());
  loops = [];
}

/**
 * 開いたときの動き。動き終わったら Anime.js が書いたスタイルを消す
 * （残すと、服のカードを押したときの沈む動き（CSS の :active）が効かなくなるため）
 */
export function playEntrance(root) {
  if (reducedMotion()) return;
  const clean = (self) => cleanInlineStyles(self);
  const headlines = root.querySelectorAll(".big");
  if (headlines.length) {
    animate(headlines, { opacity: [0, 1], y: [8, 0], duration: 450, delay: stagger(220), ease: "outQuad", onComplete: clean });
  }
  const cards = root.querySelectorAll(".coord .item");
  if (cards.length) {
    animate(cards, { opacity: [0, 1], y: [18, 0], duration: 420, delay: stagger(90, { start: 180 }), ease: "outQuad", onComplete: clean });
  }
}

/** 天気アイコンのくり返す動き */
export function playWeatherIcon(root) {
  if (reducedMotion()) return;
  const q = (sel) => root.querySelectorAll(sel);
  if (q(".sun-rays").length) {
    loops.push(animate(q(".sun-rays"), { rotate: 360, duration: 24000, ease: "linear", loop: true }));
  }
  if (q(".cloud").length) {
    loops.push(animate(q(".cloud"), { x: [-1.5, 1.5], duration: 2600, ease: "inOutSine", loop: true, alternate: true }));
  }
  if (q(".drop").length) {
    loops.push(animate(q(".drop"), { y: [0, 9], opacity: [1, 0], duration: 900, ease: "inQuad", loop: true, delay: stagger(300) }));
  }
  if (q(".flake").length) {
    loops.push(animate(q(".flake"), { y: [-2, 11], opacity: [1, 0], duration: 2400, ease: "linear", loop: true, delay: stagger(700) }));
    loops.push(animate(q(".flake"), { x: [-2, 2], duration: 1200, ease: "inOutSine", loop: true, alternate: true }));
  }
}
