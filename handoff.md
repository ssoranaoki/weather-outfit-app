# 引き継ぎメモ

（本来は `.claude/handoff.md` に置く方針。環境の制約で `.claude/` に書けなかったため、一時的にプロジェクト直下に置いている）

## 現在の状況
- 作る順番 1「画面だけ版」を実装し、GitHub Pages で公開済み: https://ssoranaoki.github.io/weather-outfit-app/
  - リポジトリ `ssoranaoki/weather-outfit-app`（公開）。コミットのメールは noreply（75925354+ssoranaoki@users.noreply.github.com）
  - push はユーザーが自分の Windows PC（PowerShell）から行う。この開発環境（サンドボックス）からは push できない
- ルールのテスト 13 件合格。実データで通しの動作を確認済み
- 地名検索: 国土地理院の住所検索（優先）＋ Open-Meteo の並行検索、「現在地を使う」ボタン
  - 国土地理院の住所検索は長期提供の保証がない。止まっても Open-Meteo と現在地で動く（代替候補: CSIS シンプルジオコーディング）
- 画面案の見本を `mockups/` に追加（コミット済み。ユーザーの push 待ち）
- ユーザーの環境では MulmoClaude の右側の表示欄に HTML が出なかったことがある → 画面案などは必ずファイルリンクも添える

- 「どうだった？」の記録機能を追加（`js/feedback.js`）
  - 夜の画面で「今日の服装」、朝の画面で「昨夜の寝間着」を 暑かった／ちょうどよい／寒かった で記録
  - 記録は localStorage のみ。設定画面の「記録を送る」で CSV を共有（LINE 等）→ クリップボード → ファイルの順に試す
  - 記録するアドバイスと気温は、評価した時点の最新データで計算し直した値（朝に見た予報とは少しずれることがある）

- 作る順番 2「服カタログ」を実装: 15 点を Gemini で生成し `img/clothes/` に配置（生成条件は同フォルダの README.md）
  - 絵文字の代わりに画像を表示。読めないときは絵文字に戻る
- 服の画像をタップすると画面中央へ拡大表示（`js/zoom.js`）。実機での動きは未確認
- ブラウザがない環境向けの確認スクリプト `tools/ui-smoke.mjs`（`node tools/ui-smoke.mjs 22` など）

- PWA 化: `manifest.webmanifest`・`sw.js`・`img/icons/`。オフライン時は前回の天気を「○時点」と添えて表示
  - まずユーザーが Android で試し、その後に母親の iPhone で使ってもらう予定
  - iPhone はホーム画面アプリと Safari でデータが別 → 追加後に地域の再設定が必要

- AI 連携 案1: `llms.txt` と `catalog.json` を rules.js から生成（`tools/build-llms.mjs`）
  - 説明書だけで判定した結果とアプリの判定を、実データ 4 地域・48 件で突き合わせて全件一致
  - claude.ai で試した: GitHub Pages の URL は 404（公開直後に試した可能性が高い）、raw.githubusercontent.com の URL では読めた
  - llms.txt に「寒がり・暑がり」の節を追加（AI が判定前に1回聞く。5段階の言葉は settings.js から生成）。説明書だけの判定とアプリを 80 件突き合わせて全件一致
  - llms.txt に予備の取得先（raw URL）を記載。Claude の答えとアプリの判定の一致はユーザー確認待ち

- 公開後に古い版が残る問題を修正（sw.js v2）
  - 原因: GitHub Pages の cache-control: max-age=600 を、SW のネット優先取得が素通りしていなかった
  - 対策: no-cache で毎回再確認、画像は stale-while-revalidate、updateViaCache: none、新版に切り替わったら 1 回だけ自動で読み直す
  - 裏で開いたままのアプリは、画面に戻ったら表示を作り直す（朝夜の切り替えが古いまま残らない）

## 次にやること
0. ユーザーが Android でホーム画面追加とオフライン表示を確認 → OK なら母親の iPhone に追加してもらう
1. 母親に 1〜2 週間使ってもらい、記録を送ってもらう
2. 記録の CSV をもとに、ルールの数値（気温区分・寒がり補正）を調整する
3. 実機（スマホ）で服の画像の見え方を確認する（特に夜の暗い画面）
4. 自分の AI で llms.txt を試した結果を見て、案2（計算する窓口: Cloudflare Workers 等）が必要か判断する

## 保留中の判断
- 夜モードへの切り替え時刻（仮: 18 時）
- 文字サイズの切り替えを付けるか
