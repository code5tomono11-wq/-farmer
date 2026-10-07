# すいかクリッカー Ver.11

## 追加したもの
- 管理者モード
- 1回限りシリアルコード発行（サーバー側で使用済み管理）
- コード報酬：すいかポイント / 転生のしずく / 🍍 / 🍎 / 🍇
- リアルタイムランキングAPI
- ワンタップのバックアップ書き出し・復元

## Render
1. GitHubにこのフォルダをアップロード
2. RenderでWeb Serviceを作成
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Environment Variablesに `ADMIN_PASSWORD` を設定

## 注意
ランキングは現在、クライアントから送られた累計ポイントを記録する方式なので、不正対策はまだ完全ではありません。管理者コードはサーバー側で1回限りにしています。
