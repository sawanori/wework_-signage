# アーキテクトレビュー（Claude Opus）

レビュー日: 2026-03-17
対象: `docs/plans/implementation-plan.md` v1.0.0
ベースライン仕様: `docs/idea.md`, `docs/decisions.md`

---

## Pass 1: CRITICAL

### [C-001] playlist.json のアトミック書き込みが保証されていない
- **場所**: Section 2.C（Sync Agent）、エラー＆レスキューマップ（Section 6）
- **問題**: `fileManager.ts` で「playlist.json を上書き保存」と記載されているが、playlist.json 自体の書き込みがアトミックでない。直接上書き（`writeFileSync`）した場合、書き込み中にクラッシュまたは電源断が発生すると、Local Viewer が中途半端な JSON を読み込む。画像ファイルの tmp→rename 戦略は正しく設計されているが、肝心の playlist.json にこの戦略が適用されていない。
- **修正案**: playlist.json も画像と同様に `data/tmp/playlist.json.tmp` に書き込み後、`fs.renameSync('data/tmp/playlist.json.tmp', 'data/playlist.json')` でアトミックに置換する。この手順を計画書の処理フローとコード仕様に明記すること。

### [C-002] API 認証なしでのプレイリスト改ざんリスク
- **場所**: Section 2.B（Cloud Admin API）、decisions.md A2
- **問題**: decisions.md で「MVP段階では認証を実装しない」と確定しているが、計画書において POST/PUT/DELETE の全操作エンドポイントが認証なしで公開される。Vercel にデプロイされた時点で、誰でもプレイリストの改ざん・画像の削除が可能になる。GET のみ認証なしは許容範囲だが、書き込み系が無防備なのは信頼境界違反にあたる。
- **修正案**: 最低限の対策として以下のいずれかを計画書に追記する:
  1. **API Key 方式**: 環境変数に `ADMIN_API_KEY` を設定し、POST/PUT/DELETE は `Authorization: Bearer {key}` を要求する（実装コスト: 極小）
  2. **Vercel Password Protection**: Vercel の Project Settings でパスワード保護を有効化する
  3. decisions.md の「認証なし」判断にリスク受容の明示的記載を追加する（この場合でもAPI Key は推奨）

### [C-003] idea.md の API レスポンスに `type` / `position` フィールドが存在しない
- **場所**: Section 3（API Contract）、idea.md Section 3.1.2
- **問題**: idea.md の GET /api/playlist レスポンス例では `PlaylistItem` に `type` と `position` フィールドが含まれていない。計画書ではこれらを追加しているが、仕様との乖離が明示されていない。また idea.md には `deviceId` / `storeId` もレスポンスに含まれていない。計画書で拡張したフィールドについて、仕様からの変更点として明記すべき。
- **修正案**: 計画書の Section 3.1 に「idea.md からの拡張事項」として以下を追記:
  - `type: "image" | "pdf"` — PDF対応のために追加
  - `position: number` — 並び替え機能のために追加
  - `deviceId`, `storeId` — 複数端末対応の設計（decisions.md A3）に基づき追加

### [C-004] Sync Agent の 30MB ファイルに対する 10 秒タイムアウトの矛盾
- **場所**: Section 2.C.1（C-01, C-02）、テストケース C-EC-02
- **問題**: ポーリングのタイムアウトが 10 秒と設計されているが、テストケース C-EC-02 では「30MB画像ダウンロードが10秒タイムアウト内に完了する」ことを期待している。ネットワーク帯域によっては 30MB のダウンロードに 10 秒以上かかることが確実にある（例: 20Mbps で約12秒）。API レスポンスのタイムアウトと画像ダウンロードのタイムアウトが混同されている。
- **修正案**: タイムアウトを2段階に分離する:
  1. **API ポーリングタイムアウト**: 10秒（GET /api/playlist のレスポンス取得まで）
  2. **画像ダウンロードタイムアウト**: ファイルサイズに応じた動的タイムアウト（例: 最低30秒、1MBあたり+5秒）または固定120秒
  テストケース C-EC-02 も修正すること。

### [C-005] node-fetch の依存宣言と Node.js ビルトイン fetch の矛盾
- **場所**: Section 2.C.4（依存関係）、Section 2.C.4 直後の記述
- **問題**: `dependencies` に `"node-fetch": "^3.x"` が記載されているが、直後に「Node.js v20以上のビルトイン `fetch` を最大限活用し、外部依存を最小化する」と記載されている。Node.js v20 以上であればビルトイン fetch が利用可能であり、node-fetch は不要。依存関係の記述が自己矛盾している。
- **修正案**: `node-fetch` を dependencies から削除する。Node.js v20+ のビルトイン fetch を使用する方針で統一する。

### [C-006] playlist.json の書き込みとクリーンアップの順序問題
- **場所**: Section 2.C.3（メインループ処理フロー）
- **問題**: フローチャートでは `WritePlaylist → Cleanup` の順序だが、この順序では playlist.json が更新された後に古い画像ファイルが削除される。この間（短い時間ではあるが）Local Viewer が新しい playlist.json を読み込み、まだ削除されていない古い画像を参照する可能性がある。これ自体は問題ないが、逆に **Cleanup が playlist.json 更新前に行われると**、Viewer が参照中の画像が消える。現在の順序は正しいが、計画書内に「この順序は意図的」である旨のコメントがない。
- **修正案**: 処理フロー図の近くに以下の注記を追加: 「重要: playlist.json の更新は必ずクリーンアップの前に行う。これにより、Viewer が新しいプレイリストで参照する画像が全て images/ に存在することを保証する。」

---

## Pass 2: INFORMATIONAL

### [I-001] PDF 100ページ展開時のメモリ管理戦略が未定義
- **場所**: テストケース A-EC-04、Section 2.A.3（pdfLoader.ts）
- **指摘**: テストケース A-EC-04 で「100ページのPDFが100スライドとして展開され、メモリ枯渇なく再生される」ことを期待しているが、pdfLoader.ts の仕様では全ページを BlobURL に変換してキャッシュする設計。100ページ分の高解像度 canvas を一括展開するとメモリ消費が数GBに達する可能性がある。
- **推奨対応**: 遅延ローディング戦略を検討する。例えば「現在のページ + 前後2ページのみをレンダリングし、それ以外は BlobURL を revoke する」方式。MVP では上限ページ数（例: 20ページ）を設定してバリデーションするのも有効。

### [I-002] PDF の各ページに対する durationOverrideMs の扱いが不明確
- **場所**: Section 2.A.1（A-06）、Section 3.1（PlaylistItem 型定義）
- **指摘**: PDFが複数ページに展開される場合、元の PlaylistItem の `durationOverrideMs` は全ページに適用されるのか、それとも PDF 全体の合計表示時間なのかが不明。例えば `durationOverrideMs: 15000` の3ページPDFは、各ページ15秒（合計45秒）なのか、各ページ5秒（合計15秒）なのか。
- **推奨対応**: 計画書に「PDFの durationOverrideMs は各ページに個別適用される」等の明確な仕様を追記する。

### [I-003] shared/types.ts の配置場所とインポート方法が未定義
- **場所**: Section 3.1
- **指摘**: 「cloud-admin と sync-agent の両方でインポートして使用する」とあるが、物理的なファイル配置（monorepo の packages/shared? シンボリックリンク? コピー?）が定義されていない。
- **推奨対応**: 以下のいずれかを計画書に明記する:
  1. **monorepo 方式**: プロジェクトルートに `shared/` を配置し、TypeScript の `paths` で参照
  2. **コピー方式**: ビルド時に shared/ を各プロジェクトにコピー
  3. **npm workspace 方式**: pnpm/npm workspace でローカルパッケージとして管理

### [I-004] Sync Agent のポーリング間隔 60 秒は管理画面操作の UX に影響
- **場所**: Section 2.C.1（C-01）
- **指摘**: 管理画面でプレイリストを変更してから最大60秒（平均30秒）の遅延がある。管理者が「反映されない」と感じる可能性がある。
- **推奨対応**: MVP ではこのままで問題ないが、将来的に WebSocket / Server-Sent Events によるプッシュ通知を検討リストに追加することを推奨。または管理画面に「次回同期まで最大60秒かかります」の表示を追加。

### [I-005] Chromium キオスクモードの GPU アクセラレーション設定が不足
- **場所**: 付録（start-kiosk.sh）
- **指摘**: コアバリューである「カクつくことなく美しくフェード」を実現するには、Chromium の GPU アクセラレーションが有効であることが重要。現在の起動オプションに GPU 関連のフラグがない。Ubuntu 環境によってはデフォルトで GPU アクセラレーションが無効になるケースがある。
- **推奨対応**: 以下のフラグを検討:
  - `--enable-gpu-rasterization`
  - `--enable-accelerated-2d-canvas`
  - `--ignore-gpu-blocklist`（GPUがブロックリストに載っている場合）
  また、CSS側で `will-change: opacity` や `transform: translateZ(0)` でコンポジットレイヤーを明示的に作成し、GPU レンダリングを促進する。

### [I-006] テストケースに Cloud Admin UI（Module D）のエッジケースが不足
- **場所**: Section 5（Module D テスト）
- **指摘**: Module D のテストケースが他モジュールに比べて少ない。特に以下が未定義:
  - ドラッグ&ドロップ中のネットワーク切断
  - 同時に複数ファイルをアップロードした場合の進捗表示
  - PDF アップロード時のサムネイル生成失敗
  - 0件プレイリスト状態での UI 表示
- **推奨対応**: MVP の品質ラインとして最低限必要なエッジケースを追加するか、「Module D のテストは後続フェーズで拡充」と明記する。

### [I-007] playlist_items テーブルの store_id / device_id カラムが冗長
- **場所**: Section 4.1（DBスキーマ）
- **指摘**: `playlist_items` テーブルに `store_id` と `device_id` が直接持たされているが、これらは `playlists` テーブル経由で取得可能（`playlist_items.playlist_id → playlists.store_id / device_id`）。正規化の観点からは冗長。
- **推奨対応**: 以下のいずれか:
  1. **冗長カラムを削除**: JOIN で取得する（正規化重視）
  2. **現状維持**: クエリの簡素化を優先する意図があるなら、その旨をコメントとして追記

### [I-008] Local Viewer の Vite preview サーバーが本番運用に適切か
- **場所**: 付録（PM2設定）、Section 1.3
- **指摘**: PM2 設定で `npm run preview`（Vite preview）を使用しているが、Vite preview は本番用サーバーではなく開発確認用である。ローカルで静的ファイルを配信するだけなので問題は小さいが、Vite 公式ドキュメントでも本番利用は推奨されていない。
- **推奨対応**: 以下のいずれかを検討:
  1. `vite build` の成果物を `serve` パッケージや nginx で配信する
  2. ローカル利用に限定されるため、このままリスク受容とする（その旨を明記）

### [I-009] intervalMs と fadeDurationMs の関係性バリデーションが未定義
- **場所**: Section 2.A.1、テストケース A-EC-07
- **指摘**: テストケース A-EC-07 で `intervalMs=100ms` のエッジケースを想定しているが、`fadeDurationMs=2000ms` との組み合わせでは「フェード完了前に次のスライドに切り替わる」状態になる。計画書では `intervalMs >= fadeDurationMs` の制約を設けていない。
- **推奨対応**: 以下のいずれかを計画書に明記:
  1. **バリデーション**: `intervalMs >= fadeDurationMs` を強制する（Cloud Admin API / UI 双方で）
  2. **動作仕様**: intervalMs < fadeDurationMs の場合はフェード完了を待ってから次のスライドに遷移する（実質 fadeDurationMs が intervalMs の下限になる）

### [I-010] R2 署名付き URL の有効期限が未定義
- **場所**: Section 2.B.1（B-02）、Section 3.4
- **指摘**: POST /api/upload で発行される署名付き URL の有効期限（expiry）が計画書に記載されていない。有効期限が長すぎるとセキュリティリスク、短すぎると大容量ファイルのアップロード中に期限切れになる。
- **推奨対応**: 有効期限を明記する（推奨: 15分〜1時間）。30MB ファイルのアップロードに十分な時間を確保すること。

---

## サマリ

- **CRITICAL の数**: 6件
- **INFORMATIONAL の数**: 10件
- **総合評価**: **条件付き承認**

### 判断根拠

計画書は全体として非常に高品質であり、仕様文書（idea.md, decisions.md）の要件を網羅的にカバーしている。モジュール分割、API Contract、テストケース、エラー＆レスキューマップのいずれも実装に十分な粒度で記述されている。

ただし、以下の CRITICAL 項目は実装前に解決が必要:

1. **C-001（playlist.json のアトミック書き込み）** — データ安全性に直結。最優先で修正。
2. **C-002（API 認証なし）** — 公開エンドポイントでの書き込み操作は最低限の保護が必要。API Key 方式で最小コストで対応可能。
3. **C-004（タイムアウトの2段階分離）** — 30MB ファイルダウンロードが実運用で確実に失敗するため、修正必須。
4. **C-005（node-fetch の矛盾）** — 依存関係の整合性。軽微だが修正は必須。

C-003（仕様乖離の明示）と C-006（処理順序の注記）は計画書への追記のみで対応可能。

**上記 CRITICAL 6件を修正した上で、実装フェーズへの移行を承認する。**
