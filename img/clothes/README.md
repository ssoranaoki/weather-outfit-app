# 服カタログ画像

- 生成: Gemini API の画像生成（MulmoClaude の generateImage）、2026-09-30
- 利用規約: Google は生成物の所有権を主張せず、アプリでの配布は可能（利用者が責任を負う）。https://ai.google.dev/gemini-api/terms
- ファイル名 = `js/rules.js` の `CLOTHES` の id

## 共通の撮影ルール（追加・作り直しのときは必ずこの文を付ける）

```
Product catalog photo of <服の説明>, laid perfectly flat and centered, shot from directly above (flat lay),
on a pure white seamless background. Soft even studio lighting, very subtle natural shadow.
Simple, calm, everyday casual style suitable for a woman in her 60s. Square composition with generous white margin.
No text, no logos, no brand labels, no tags, no people, no mannequin, no hangers, no props.
```

## 各アイテムの説明と色

| id | 説明（<服の説明> に入れる内容） |
|---|---|
| top-short | women's short-sleeve crew-neck cotton T-shirt (pullover, no buttons) in soft sage green |
| top-long | women's long-sleeve crew-neck cotton pullover top (T-shirt style, NO buttons) in soft beige |
| top-sweater | women's fine-knit crew-neck pullover sweater (no buttons) in soft dusty blue |
| top-thick-sweater | women's thick chunky cable-knit turtleneck pullover sweater in charcoal gray |
| bottom-light | women's lightweight linen wide-leg cropped pants with elastic waist in light gray |
| bottom-pants | women's straight-leg cotton trousers in navy blue |
| bottom-thick | women's thick warm corduroy trousers in dark brown |
| outer-light | women's thin lightweight knit cardigan with front buttons in light heather gray |
| outer-jacket | women's light cotton zip-up jacket with collar in khaki olive |
| outer-coat | women's knee-length wool coat with buttons in camel color |
| outer-thick-coat | women's thick long padded down coat with hood in deep navy |
| acc-winter | women's knit winter scarf folded with matching knit gloves in muted burgundy |
| pj-short | women's cotton pajama set, short-sleeve top and knee-length shorts, pale sky blue |
| pj-long | women's cotton pajama set, long-sleeve button-front top and long pants, soft lavender |
| pj-warm | women's thick fleece pajama set with cozy wool socks, dusty rose pink |

## 加工（ImageMagick）

生成画像は横長（1376x768）で背景がわずかに灰色なので、背景を白に寄せてから余白を削り、正方形にする。

```bash
convert in.png -level 0%,95% -fuzz 8% -trim +repage -resize 340x340 \
  -gravity center -background white -extent 400x400 -strip -quality 82 out.jpg
```
