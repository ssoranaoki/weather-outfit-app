# きょうの服装

天気予報から、今日（朝に開いた場合）または明日と今夜の寝間着（就寝前に開いた場合）の服装をアドバイスする Web アプリです。

## 動かし方
ES Modules を使うため、ファイルを直接開くのではなく、ローカルサーバー経由で開きます。

```bash
python3 -m http.server 8080
# ブラウザで http://localhost:8080/ を開く
```

- `http://localhost:8080/?hour=7` … 朝の画面を確認
- `http://localhost:8080/?hour=22` … 就寝前の画面を確認

## テスト
```bash
npm test
```

天気データ: [Open-Meteo.com](https://open-meteo.com/)（CC BY 4.0）
