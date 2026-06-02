<!-- 日本語 | English (README.en.md — 準備中) -->

# MyManabi

子どもの家庭学習を支援する AI 学習環境の設計・PoC。

- 教科書に沿った学習
- つまずきや判定への違和感の記録
- AI で解決できない問題の引き継ぎ
- 到達水準・安定性・つまずき方の把握

> **状態**: 設計・PoC 段階。最初の縦切りとして、合成学習イベントから日次レポートを生成できる。

## ドキュメント

- [アーキテクチャ概要](docs/architecture.md) — 全体構成・責務分担・データ配置・主要フローの図解
- [コンセプト](docs/concept/README.md) — 目的・方針・前提・到達点・保留事項・リスク
- [仕様](docs/spec/README.md) — 学習フロー・理解度測定・教材管理・学習履歴・レポート・データ配置
- [初期 PoC ロードマップ](docs/spec/initial-poc-roadmap.md) — 小さく検証する実装順と最初の縦切り

## 最初の縦切りを試す

Node.js 20 以降で、公開用の合成イベントから日次レポートを生成する。

```powershell
node src/generate-daily-report.mjs --data-dir examples/data-dir --learner learner-a --date 2026-05-31 --stdout
```

実運用時は `--data-dir` にリポジトリ外の保存先を指定する。

## データの扱い（重要）

個人情報と実教科書由来の教材コンテンツは、**本リポジトリに含めない**。リポジトリ外の `DATA_DIR`（例: `%APPDATA%/MyManabi`）に置く。

本リポジトリに含めるのは、合成データとスキーマのみ。詳細は [仕様 9. データ配置](docs/spec/README.md#9-データ配置) を参照。

## ライセンス

コード・ドキュメントともに [MIT License](LICENSE)。
