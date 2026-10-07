# すいかクリッカー Ver.11（管理者・ランキング対応）

## GitHub Pagesでゲームを表示する場合
このZIPの中身を**リポジトリの一番上（ルート）**にアップロードしてください。

最低限ここに `index.html` が必要です。

```text
index.html
manifest.webmanifest
sw.js
icons/
```

これで GitHub Pages のトップURLで404になりません。

## Renderで管理者・ランキングを動かす場合
同じフォルダをRenderのWeb Serviceに使います。
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variable: `ADMIN_PASSWORD` に管理者パスワード

Renderでは `public/index.html` がゲーム画面になります。

## 重要
GitHub Pagesだけでは「1回限りコード」とランキングのサーバー機能は動きません。管理者モードとランキングを使うときはRender版のURLを使ってください。

## 管理者モード
ゲーム画面の下部にある `🔐 管理者` → 管理者パスワード → `🎟️ コードを発行`

## プレイヤー側コード入力
ゲーム画面の `🎫 コードを入力` から1回限りコードを入力します。
