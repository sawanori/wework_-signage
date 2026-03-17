# Teams構成 — フロントエンド・バックエンド並列開発

## チーム編成概要

```
┌─────────────────────────────────────────────────────┐
│                 Manager (Opus)                        │
│           オーケストレーター・意思決定               │
├────────────────────────┬────────────────────────────┤
│   Frontend Team        │    Backend Team             │
│   (並列実行)           │    (並列実行)              │
├────────────────────────┼────────────────────────────┤
│ FE Lead (Sonnet)       │ BE Lead (Sonnet)           │
│ ├─ UI Designer         │ ├─ API Designer            │
│ ├─ FE Implementer      │ ├─ BE Implementer          │
│ ├─ FE Tester           │ ├─ BE Tester               │
│ └─ FE Quality Fixer    │ └─ BE Quality Fixer        │
├────────────────────────┴────────────────────────────┤
│              Cross-Team (共通)                       │
│ ├─ Architect Reviewer (Opus)                        │
│ ├─ Code Reviewer (Opus)                             │
│ ├─ Document Reviewer (Opus)                         │
│ └─ Integration Tester (Sonnet)                      │
└─────────────────────────────────────────────────────┘
```

## Manager（私＝Claude Code Opus）

| 責務 | 内容 |
|------|------|
| 全体計画 | 要件分析→タスク分解→チームへの配分 |
| 同期管理 | FE/BE間のインターフェース定義、依存関係管理 |
| レビュー承認 | 各チームの成果物を最終レビュー |
| リスク管理 | ブロッカー検出・解決・エスカレーション |

**絶対ルール**: Manager自身はコードを書かない。すべてsubagentに委託する。

---

## Frontend Team

### FE Lead
- **モデル**: sonnet
- **agent**: `task-executor-frontend`
- **責務**: フロントエンド実装の統括、タスク実行

### UI Designer
- **モデル**: sonnet
- **agent**: `technical-designer-frontend`, `ui-spec-designer`
- **責務**: コンポーネント設計、UI仕様策定
- **スキル**: `apple-design` スキルを常に参照

### FE Implementer
- **モデル**: sonnet
- **agent**: `task-executor-frontend`
- **責務**: React/HTML/CSS実装

### FE Tester
- **モデル**: sonnet
- **agent**: `acceptance-test-generator`, `integration-test-reviewer`
- **責務**: フロントエンドテスト作成・実行

### FE Quality Fixer
- **モデル**: sonnet
- **agent**: `quality-fixer-frontend`
- **責務**: lint/type/test/buildエラーの修正

---

## Backend Team

### BE Lead
- **モデル**: sonnet
- **agent**: `task-executor`
- **責務**: バックエンド実装の統括、タスク実行

### API Designer
- **モデル**: sonnet
- **agent**: `technical-designer`
- **責務**: API設計、DB設計、ADR作成

### BE Implementer
- **モデル**: sonnet
- **agent**: `task-executor`
- **責務**: API/DB/ビジネスロジック実装

### BE Tester
- **モデル**: sonnet
- **agent**: `acceptance-test-generator`, `integration-test-reviewer`
- **責務**: バックエンドテスト作成・実行

### BE Quality Fixer
- **モデル**: sonnet
- **agent**: `quality-fixer`
- **責務**: テスト・ビルドエラーの修正

---

## Cross-Team（共通チーム）

### Architect Reviewer
- **モデル**: opus
- **agent**: `code-reviewer`, `code-verifier`
- **責務**: アーキテクチャレビュー、設計整合性検証
- **タイミング**: 計画書完成後、実装完了後

### Document Reviewer
- **モデル**: opus
- **agent**: `document-reviewer`, `design-sync`
- **責務**: PRD/設計書のレビュー、ドキュメント間整合性チェック

### Integration Tester
- **モデル**: sonnet
- **agent**: `integration-test-reviewer`
- **責務**: FE/BE結合テスト、E2Eテスト

---

## 並列開発ワークフロー

### Phase 1: 計画（Manager主導）
```
Manager(Opus)
├── requirement-analyzer → 要件分析
├── prd-creator(Sonnet) → PRD作成
└── document-reviewer(Opus) → PRDレビュー
```

### Phase 2: 設計（並列）
```
Manager(Opus) ── インターフェース定義（API Contract）を先に確定
├── [FE] technical-designer-frontend(Sonnet) → フロントエンド設計
├── [BE] technical-designer(Sonnet) → バックエンド設計
└── design-sync(Opus) → 設計整合性チェック
```

### Phase 3: タスク分解（Manager主導）
```
Manager(Opus)
├── work-planner(Sonnet) → 作業計画
├── task-decomposer(Sonnet) → タスク分解
└── Manager → FE/BEタスク振り分け
```

### Phase 4: 実装（並列）
```
[FE Team]                          [BE Team]
├── テスト作成(Red)                 ├── テスト作成(Red)
├── 実装(Green)                     ├── 実装(Green)
├── quality-fixer-frontend          ├── quality-fixer
└── code-reviewer(Opus)             └── code-reviewer(Opus)
```

### Phase 5: 統合・検証
```
Manager(Opus)
├── integration-test-reviewer → 結合テスト検証
├── code-verifier(Opus) → 仕様との整合性検証
└── 最終レビュー・承認
```

---

## 同期ポイント（Sync Points）

FE/BEが並列で動く中で、以下のタイミングで同期を取る:

| タイミング | 内容 | 責任者 |
|-----------|------|--------|
| API Contract確定後 | エンドポイント・型定義の合意 | Manager |
| 設計レビュー後 | 設計整合性の確認 | Architect Reviewer |
| 実装50%時点 | 進捗確認・ブロッカー解消 | Manager |
| 実装完了後 | 結合テスト実施 | Integration Tester |
| 最終レビュー | 全体品質確認・リリース判断 | Manager |

---

## チーム間コミュニケーション規約

### 共有成果物の配置
| 成果物 | パス |
|--------|------|
| PRD | `docs/prd/` |
| 設計書 | `docs/design/` |
| API Contract | `docs/api-contract/` |
| 作業計画 | `docs/plans/` |
| タスクファイル | `docs/plans/tasks/` |

### API Contract（FE/BE間の契約）
- API Contractは**Phase 2で最優先**で確定する
- FEはContractに基づきモック実装で先行開発可能
- BEはContractに基づき実装
- Contract変更時はManagerが両チームに通知
