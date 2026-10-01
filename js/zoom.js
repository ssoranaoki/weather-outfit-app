// 服のカードをタップしたとき、画面の中央へ「ぐわっ」と拡大して浮かび上がらせる
// 仕組み: 中央に大きく置いた拡大カードを、最初だけ「元のカードの位置・大きさ」に見えるよう変形しておき、
// その変形を外すアニメーションで中央へ飛ばす（FLIP という手法）。閉じるときは逆再生する。

const OPEN_MS = 460;
const CLOSE_MS = 280;
// 少し行き過ぎてから戻る曲線（「ぐわっ」と飛び出す感じ）
const OPEN_EASING = "cubic-bezier(0.2, 1.35, 0.4, 1)";
const CLOSE_EASING = "cubic-bezier(0.4, 0, 0.6, 1)";

/**
 * 拡大カード（to）を元のカード（from）の位置・大きさに重ねるための transform を求める（純粋関数）
 * from, to は getBoundingClientRect() と同じ形 { left, top, width, height }
 */
export function flipTransform(from, to) {
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const scale = to.width > 0 ? from.width / to.width : 1;
  return `translate(${round(dx)}px, ${round(dy)}px) scale(${round(scale, 4)})`;
}

const round = (n, digits = 2) => Number(n.toFixed(digits));

/** 拡大カードの一辺（画面に収まり、大きすぎない大きさ） */
export function zoomSize(viewWidth, viewHeight) {
  return Math.round(Math.min(viewWidth * 0.82, viewHeight * 0.6, 420));
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

let current = null; // 表示中の拡大 { layer, card, sourceEl }

/** card: タップされた button.item */
export function openZoom(card) {
  if (current) return;
  const sourceEl = card.querySelector("img") ?? card;
  const label = card.querySelector("small")?.textContent ?? "";

  const layer = document.createElement("div");
  layer.className = "zoom-layer";
  layer.setAttribute("role", "dialog");
  layer.setAttribute("aria-modal", "true");
  layer.setAttribute("aria-label", `${label}（拡大表示）`);
  layer.tabIndex = -1;

  const backdrop = document.createElement("div");
  backdrop.className = "zoom-backdrop";

  const figure = document.createElement("figure");
  figure.className = "zoom-card";
  const size = zoomSize(window.innerWidth, window.innerHeight);
  figure.style.width = `${size}px`;
  const img = card.querySelector("img");
  if (img) {
    const big = document.createElement("img");
    big.src = img.src;
    big.alt = label;
    figure.append(big);
  } else {
    // 画像が読めず絵文字になっている場合は、絵文字を大きく出す
    const emoji = document.createElement("div");
    emoji.className = "zoom-emoji";
    emoji.textContent = card.firstChild?.textContent ?? "";
    figure.append(emoji);
  }
  const caption = document.createElement("figcaption");
  caption.textContent = label;
  figure.append(caption);

  const hint = document.createElement("p");
  hint.className = "zoom-hint";
  hint.textContent = "タップで閉じる";

  layer.append(backdrop, figure, hint);
  document.body.append(layer);
  current = { layer, card, sourceEl };

  // 元のカードは隠して「そこから飛び出した」ように見せる
  card.style.visibility = "hidden";
  card.setAttribute("aria-expanded", "true");

  layer.addEventListener("click", closeZoom);
  layer.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      closeZoom();
    }
  });
  layer.focus();

  if (reducedMotion()) {
    layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
    return;
  }
  const from = sourceEl.getBoundingClientRect();
  const to = figure.getBoundingClientRect();
  figure.animate([{ transform: flipTransform(from, to) }, { transform: "none" }], { duration: OPEN_MS, easing: OPEN_EASING });
  backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS * 0.6, easing: "ease-out" });
  hint.animate([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], { duration: OPEN_MS });
}

export function closeZoom() {
  if (!current) return;
  const { layer, card, sourceEl } = current;
  current = null;
  const finish = () => {
    layer.remove();
    card.style.visibility = "";
    card.setAttribute("aria-expanded", "false");
    card.focus({ preventScroll: true });
  };
  if (reducedMotion()) {
    layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120 }).finished.then(finish, finish);
    return;
  }
  const figure = layer.querySelector(".zoom-card");
  // 開いている間にスクロールしても元の位置へ戻れるよう、閉じる時点で測り直す
  card.style.visibility = "";
  const from = sourceEl.getBoundingClientRect();
  card.style.visibility = "hidden";
  const to = figure.getBoundingClientRect();
  layer.querySelector(".zoom-backdrop").animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS, fill: "forwards" });
  layer.querySelector(".zoom-hint").animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS / 2, fill: "forwards" });
  figure
    .animate([{ transform: "none" }, { transform: flipTransform(from, to) }], { duration: CLOSE_MS, easing: CLOSE_EASING, fill: "forwards" })
    .finished.then(finish, finish);
}
