// 利用者の設定（ログインなし版はこの端末のブラウザ内だけに保存する）
// 保存するのは設計書 ① の最小限: 地域・寒がり度。全身写真や体型などは持たない。

const KEY = "wo:settings";

const DEFAULTS = { place: null, sensitivity: 0 };

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

export const SENSITIVITY_CHOICES = [
  { value: 2, label: "かなり寒がり" },
  { value: 1, label: "少し寒がり" },
  { value: 0, label: "ふつう" },
  { value: -1, label: "少し暑がり" },
  { value: -2, label: "かなり暑がり" },
];
