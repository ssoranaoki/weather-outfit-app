# きょうの服装（天気×服装アドバイス）

母親向けのスマホ Web アプリ。朝は今日、就寝前は明日＋寝間着の服装をアドバイスする。
AI native 設計（AI は利用者側に置く）。バイブコーディングで進める。

- 設計書: `../../artifacts/documents/2026/09/weather-outfit-app-design-909ffdff165b414e.md`
- 引き継ぎ: `handoff.md`（作業前に必ず読む）

## 構成
- `js/rules.js` 判定ルール（純粋関数。将来 MCP 窓口からも使う）
- `js/weather.js` Open-Meteo 取得とキャッシュ
- `js/settings.js` 端末内の設定（地域・寒がり度のみ）
- `js/feedback.js` 「どうだった？」の記録と CSV 書き出し（端末内のみ）
- `js/app.js` 画面の組み立て
- `js/zoom.js` 服のカードをタップしたときの中央拡大表示（FLIP アニメーション）
- `tests/` ルールのテスト（`npm test`）
- `img/clothes/` 服カタログ画像（生成条件は同フォルダの README.md）
- `manifest.webmanifest` / `sw.js` / `img/icons/` ホーム画面に追加（PWA）とオフライン表示
- `llms.txt` / `catalog.json` AI 向けの説明書と機械可読ルール（`node tools/build-llms.mjs` で rules.js から生成。手で編集しない）
- `tools/ui-smoke.mjs` ブラウザなしで画面の組み立てを確認するスクリプト

## 方針
- 判定ロジックは `rules.js` に集約し、変更したら必ずテストを追加・実行する
- 全身写真・体型・健康情報は保存しない
- 天気データの出典表示（Open-Meteo, CC BY 4.0）を消さない
