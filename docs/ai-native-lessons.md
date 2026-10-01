# 実践記録: 天気×服装アドバイス Web アプリ（2026-09〜10）

> ai-native-web-service スキルの `references/` に追加する想定の下書き。
> コピー先: `~/.claude/skills/ai-native-web-service/references/practice-weather-outfit-app.md`

母親向けの「天気から服装と寝間着を判定する」スマホ Web アプリを、AI native 設計で作った記録。
リポジトリ: https://github.com/ssoranaoki/weather-outfit-app （GitHub Pages で公開、サーバー処理なし）

## 最終的な構成

```
アプリ（静的サイト）: 天気取得 → ルールで判定（AI 料金ゼロ）→ 画面表示
  └「自分の AI に聞く」ボタン
      → 利用者の AI アプリへ共有: プロンプト＋天気データ＋全身写真（任意）＋服の画像
      → AI が説明書（llms.txt）を読み、同じ判定＋着せ替え画像を作る
```

- 基本機能に AI は不要だった（気温の区切りのルールで十分）。AI は「着せ替え」と「会話」の上乗せ
- 全身写真はサービスに一度も届かない（端末 → 利用者の AI アプリへ直接共有）

## 実践で分かったこと（記事に書かれていない落とし穴）

### 1. 利用者の AI は「URL を取りに行けない」ことが多い
- claude.ai の web fetch は **会話に出てきた URL しか取れない**（AI が組み立てた URL は不可）。取得結果も Claude 側でキャッシュされる
  - 出典: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool （URL validation の節）
- AI の取得機能は **robots.txt に従う**。公開 API でも robots.txt で全面 Disallow のことがある（例: api.open-meteo.com）
- 公開直後に 404 を受けると、AI 側のキャッシュで 404 が残り続けることがある。GitHub Pages の URL が読めず、raw.githubusercontent.com の URL では読めた
- **対策: サービスが持っているデータはプロンプトに埋め込んで渡す**。AI に取りに行かせるのは説明書（llms.txt）だけにする
- 説明書の URL は、プロンプトに完成形で書く（AI に URL を組み立てさせない）

### 2. 端末内の設定は AI から見えない
- ログインなしで端末（localStorage）に保存した設定（地域・寒がり度など）は、利用者の AI からは見えない
- **対策: アプリがプロンプトを組み立て、設定を書き込んで渡す**（ワンタップでコピー／共有）。AI に聞き直させない
- 説明書側には「分からなければ利用者に1回だけ聞く」も書いておく（ボタンを経由しない利用者向け）

### 3. 説明書（llms.txt）は手書きしない
- 判定ルール（ソースコード）から生成し、コミット済みファイルとの差分をテストで検出する
- 「説明書だけで判定した結果」と「アプリの判定」を実データで突き合わせると、説明書の欠けが見つかる

### 4. 画像の受け渡しは Web Share API Level 2 が楽
- `navigator.canShare({ files })` で確認 → `navigator.share({ files, text })` で写真・素材画像・文を一度に AI アプリへ
- 共有はユーザー操作の直後でないとブロックされる（transient activation）。素材画像は画面表示時に先読みしておく
- アプリによっては画像と一緒だと文が落ちる → 同時にクリップボードへもコピーしておく
- Android Chrome → ChatGPT アプリで、写真・服の画像・文が届き着せ替えまで成功を確認（2026-10-01）

### 5. 画像を作れない AI がある
- Claude は画像生成ができない（2026 時点の知識）。説明書に「画像を作れない場合は説明だけ」と書いておく

## 設計判断の記録
- 公開は GitHub Pages（静的）。計算する窓口（Cloudflare Workers 等）は、プロンプトに天気データを埋め込む方式で不要になった
- PWA 化で注意: GitHub Pages は `cache-control: max-age=600`。Service Worker のネット優先取得は `cache: "no-cache"` にしないと最大 10 分古い版が出る
