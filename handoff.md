# 引き継ぎメモ

（本来は `.claude/handoff.md` に置く方針。環境の制約で `.claude/` に書けなかったため、一時的にプロジェクト直下に置いている）

## 現在の状況
- 作る順番 1「画面だけ版」を実装済み（ログインなし・AI なし・設定は localStorage）
- ルールのテスト 13 件合格。実データ（松本市）で通しの動作を確認済み
- 実ブラウザでの見た目は未確認（開発環境にブラウザがないため）
- 地名検索を改善: 国土地理院の住所検索（優先）＋ Open-Meteo の並行検索、「現在地を使う」ボタンを追加
  - Open-Meteo だけでは日本の町名・大字がほぼ引けなかった（例: 養老町鷲巣）
  - 国土地理院の住所検索は長期提供の保証がなく、仕様が予告なく変わりうる。止まっても Open-Meteo と現在地で動く
  - 国土地理院の案内では、代わりに CSIS シンプルジオコーディングも候補

- 公開先は GitHub Pages に決定。リポジトリ名 `weather-outfit-app`（公開）、URL は https://ssoranaoki.github.io/weather-outfit-app/
- コミットのメールは noreply（75925354+ssoranaoki@users.noreply.github.com）に差し替え済み。未 push
- ユーザーが MulmoClaude を認証情報付き（SSH エージェント転送＋gh 設定マウント）で再起動する予定

## 次にやること
1. 再起動後、`gh auth status` と `ssh-add -l` で認証を確認する
2. `gh repo create ssoranaoki/weather-outfit-app --public --source . --push` でリポジトリ作成と push
3. GitHub Pages を有効化（main ブランチの `/`）。`gh api` で設定するか、Settings → Pages で行う
4. 公開 URL をスマホで開き、表示と「現在地を使う」を確認する
5. 母親の感想で、ルールの数値（気温区分・寒がり補正）を調整する

## 保留中の判断
- 夜モードへの切り替え時刻（仮: 18 時）
- 文字サイズの切り替えを付けるか
- 服カタログ（画像生成モデルの利用規約の確認が先）
