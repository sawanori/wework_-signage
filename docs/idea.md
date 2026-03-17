# Non-Turn Signage System - 詳細要件定義および実装計画書

## 1. プロジェクト概要
Ubuntu端末上で動作する完全自律型のデジタルサイネージシステム。
高解像度の商業写真素材の構図を完全に保持しつつ、オフライン環境下でも絶対に停止しない堅牢な再生環境を構築する。



## 2. システム要件と技術スタック
* **クラウド管理画面 (Cloud Admin):** Next.js (TypeScript), Tailwind CSS, Cloudflare R2 (画像ストレージ), Vercel (ホスティング)
* **ローカル同期エージェント (Sync Agent):** Node.js (TypeScript), PM2 (プロセスマネージャー)
* **ローカルビューワー (Local Viewer):** React (TypeScript), Vite, Zustand (状態管理)
* **インフラ (Target OS):** Ubuntu (WSL2でのローカル開発後、実機へデプロイ), Chromium (キオスクモード)

---

## 3. モジュール別 詳細設計

### 3.1 クラウド管理画面 (Cloud Admin)
プレイリストの状態を管理し、エージェントへ配信する司令塔。

#### 3.1.1 ディレクトリ構成例
```text
cloud-admin/
├── src/
│   ├── app/
│   │   ├── api/playlist/route.ts  # プレイリスト配信API
│   │   ├── api/upload/route.ts    # R2への署名付きURL発行API
│   │   ├── layout.tsx
│   │   └── page.tsx               # 管理画面UI
│   ├── components/                # プレビューUI、アップローダー
│   └── lib/
│       ├── db.ts                  # プレイリスト状態の永続化(KV or DB)
│       └── r2.ts                  # Cloudflare R2クライアント
```

#### 3.1.2 API仕様 (GET /api/playlist)
同期エージェントが定期的にポーリングするエンドポイント。

Response (200 OK):

```json
{
  "version": "v_1710678000",
  "orientation": "portrait",
  "globalSettings": {
    "fadeDurationMs": 2000,
    "intervalMs": 10000
  },
  "items": [
    {
      "id": "img_001",
      "url": "https://cdn.non-turn.com/kyokomachi/interior-01.jpg",
      "hash": "a1b2c3d4e5f6...",
      "durationOverrideMs": null
    },
    {
      "id": "img_002",
      "url": "https://cdn.non-turn.com/kyokomachi/menu-spring.jpg",
      "hash": "f6e5d4c3b2a1...",
      "durationOverrideMs": 15000
    }
  ]
}
```

特記事項: `version` または `hash` を含めることで、エージェント側での無駄な再ダウンロードを防ぐ。

### 3.2 ローカル同期エージェント (Sync Agent)
ネットワークの切断や遅延を前提とした、極めて堅牢なファイル同期プログラム。

#### 3.2.1 ディレクトリとファイル構成
```text
sync-agent/
├── src/
│   ├── index.ts           # メインループ
│   ├── fetcher.ts         # API通信とリトライ処理
│   └── fileManager.ts     # アトミックなファイル操作
├── data/
│   ├── playlist.json      # ビューワーが読み込む確定版データ
│   ├── images/            # 表示用の正規画像ディレクトリ
│   └── tmp/               # ダウンロード中の退避ディレクトリ
```

#### 3.2.2 同期ロジックの厳格な要件（異常系ハンドリング）
ポーリング: 1分間に1回、クラウドAPIへリクエストを送信。タイムアウトは10秒。エラー時は次回ループへスキップ（ログのみ出力）。

差分検知: APIレスポンスの `version` とローカルの `playlist.json` の `version` を比較。一致すれば処理終了。

アトミック・ダウンロード（最重要）:

新規画像をまず `data/tmp/` ディレクトリに `{id}.tmp` としてダウンロード。

ダウンロード中のネットワーク切断時: `.tmp` ファイルを破棄し、プレイリストの更新を中止。次回ループで再試行。

ダウンロードが完全に成功（ハッシュ値チェック推奨）した場合のみ、`data/images/` へ移動（`fs.renameSync` によるアトミック操作）。

クリーンアップ: プレイリストから除外された古い画像は `data/images/` から削除し、ディスク容量の逼迫を防ぐ。

プレイリスト更新: 全画像の準備が整った最後に `data/playlist.json` を上書き保存する。

### 3.3 ローカルビューワー (Local Viewer)
高解像度画像をGPUの力で滑らかに描画するフロントエンド。

#### 3.3.1 ディレクトリ構成例
```text
local-viewer/
├── public/                 # Agentが書き込むdataディレクトリをここへマウント
├── src/
│   ├── components/
│   │   ├── Slide.tsx       # 1枚の画像コンポーネント（パターンC実装）
│   │   └── Player.tsx      # ループ・プリロード・フェード管理
│   ├── hooks/
│   │   └── usePlaylist.ts  # local-playlist.jsonの定期監視
│   └── App.tsx
```

#### 3.3.2 描画とパフォーマンス要件
パターンC（ハイブリッドぼかし）のCSS実装要件:

```css
/* 背景レイヤー */
.bg-blur {
  position: absolute;
  inset: 0;
  background-image: url('...');
  background-size: cover;
  background-position: center;
  filter: blur(40px) brightness(0.5); /* 視線誘導のため少し暗くする */
  transform: scale(1.1); /* ぼかしによるフチの白浮き防止 */
  z-index: 1;
}
/* 前面レイヤー（元構図を保持） */
.fg-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  z-index: 2;
}
```

プリロード（Preload）戦略:
DOM上に常に「現在表示中のSlide（opacity: 1）」と「次に表示するSlide（opacity: 0）」の2つだけをマウントする。メモリリークを防ぐため、フェードアウトが完了したスライドのDOMは即座にアンマウント（破棄）すること。

フェイルセーフUI:
`window.addEventListener('keydown')` で Escape キーを監視。3回連続押下などで、画面上に「キオスクモードを終了しますか？ (Y/N)」のプロンプトを出し、OSのデスクトップへ戻る導線を作る。

## 4. インフラ・OS設定要件 (Ubuntu / WSL2)
実稼働環境（および開発用のWSL2環境）におけるOSレベルのセットアップ要件。

### 4.1 プロセス永続化 (PM2)
Node.js環境におけるプロセス監視・自動再起動を行う。

```bash
# Agentとローカルサーバー(Viewer配信用のViteプレビュー等)の起動
pm2 start npm --name "sync-agent" -- run start:agent
pm2 start npm --name "local-viewer" -- run preview
pm2 save
pm2 startup
```

### 4.2 キオスクモード自動起動設定
UbuntuのGUI（X11またはWayland）起動時に、自動的にChromiumを立ち上げるスクリプト（`~/.config/autostart/signage.desktop` 等に登録）。

```bash
#!/bin/bash
# 画面の焼き付き防止機能とカーソルをオフにする
xset s off
xset -dpms
xset s noblank
unclutter -idle 0.5 -root &

# Chromiumをキオスクモードで起動（クラッシュダイアログ等も無効化）
chromium-browser \
  --noerrdialogs \
  --disable-infobars \
  --kiosk \
  --incognito \
  --autoplay-policy=no-user-gesture-required \
  http://localhost:4173
```

この粒度であれば、フロントエンドエンジニア、バックエンドエンジニア（あるいはご自身のコーディング用AI）がそれぞれ独立して、齟齬なく開発を進めることができます。

まずは開発環境（WSL2やMacBook Air）にて、ダミーの画像を数枚用意し、**「3.3 ローカルビューワー」の美しいフェードとぼかし背景の実装**から取り掛かるのが、モチベーション的にもシステムの中核を確認する意味でもおすすめです。

もし、各コンポーネント（例えばReactの `Player.tsx` の具体的なコードなど）の初期コードを生成する必要があれば、すぐにお申し付けください。コードを書き出します。
