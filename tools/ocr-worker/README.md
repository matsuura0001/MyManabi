# MyManabi OCR ワーカー（C# + Tesseract）

PDF 問題集を取り込むための**ローカル OCR ワーカー**。保存済み PDF をページ画像化し、
日本語 OCR を行い、問題番号マーカーで**問題候補**へ分割して、確認用の抽出結果 JSON を
出力する。これは教材取り込み仕様（[`docs/spec/content-import.md`](../../docs/spec/content-import.md)）の
**Stage 1–2（ローカルページ画像化＋ローカル OCR と候補分割）**に当たる。

設計上の位置づけ:

- Rust + Tauri 本体は **Stage 0**（PDF を DATA_DIR へ保存し SourceDocument を登録）を担う
  （[`app/src-tauri/src/source_document.rs`](../../app/src-tauri/src/source_document.rs)）。
- 本ワーカーはその SourceDocument を入力に取り、**子プロセス**として駆動される
  （codex app-server と同じ「外部ワーカーを子プロセスで駆動」パターン）。
- 出力は**確定 Question ではなく、確認用の中間成果物**。すべて `reviewStatus: "draft"` で、
  大人が確認するまで出題対象にしない（仕様 §11.3 / §12）。

```text
SourceDocument(PDF)                       本ワーカー（C#+Tesseract）
  → ページ画像化(PDFium)            ┐
  → 日本語 OCR(Tesseract, 行＋信頼度) ├─→ content/extractions/<id>/
  → 問題番号マーカーで候補分割        │      page-NNN.png / page-NNN-cNN.png
  → 領域(ページ比率)＋クロップ        │      extraction-result.json
  → 抽出結果 JSON                    ┘   （DATA_DIR 内のみ・非コミット）
```

## 使用ライブラリとライセンス

いずれも MIT 本体と併存できる寛容ライセンス（GPL/AGPL なし）。

| 用途 | ライブラリ | ライセンス | ネイティブ |
| --- | --- | --- | --- |
| PDF → ページ画像 | [PDFtoImage](https://github.com/sungaila/PDFtoImage) | MIT | PDFium（BSD-3-Clause） |
| 画像入出力 | SkiaSharp | MIT | Skia（BSD-3-Clause） |
| OCR | [Tesseract（charlesw）](https://github.com/charlesw/tesseract) | Apache-2.0 | leptonica / tesseract（Apache-2.0） |
| 学習済みデータ | tessdata `jpn` / `jpn_vert` | Apache-2.0 | — |

> 上表は NuGet パッケージのメタデータで確認した値。配布物確定後の正式調査（推移的依存・
> NOTICE 整備）は仕様 §11.7 のタスクで行う。

> 配布時の第三者ライセンス整備（LICENSE / THIRD_PARTY_NOTICES）は、仕様 §11.7 の
> 調査タスクとして配布物確定後に行う。

## 前提

- .NET SDK 8 以上（`net8.0` を対象）。
- 日本語 tessdata（`jpn.traineddata` / `jpn_vert.traineddata`）。リポジトリには含めない。

```powershell
# tessdata を取得（既定の保存先は <DATA_DIR>/tessdata）
pwsh tools/ocr-worker/scripts/get-tessdata.ps1            # 高精度版(best)
pwsh tools/ocr-worker/scripts/get-tessdata.ps1 -Quality fast   # 軽量版(fast)
```

## ビルドとテスト

```powershell
cd tools/ocr-worker
dotnet build -c Release          # ワーカー本体
dotnet test                      # 純粋ロジックの単体テスト（候補分割・種別推定）
```

`dotnet test` は既定で高速・決定論的（OCR 非依存）。ネイティブ経路まで通す統合テストは
opt-in:

```powershell
$env:MYMANABI_OCR_INTEGRATION = "1"
$env:MYMANABI_TESSDATA = "<tessdata のパス>"
dotnet test --filter "FullyQualifiedName~IntegrationOcrTests"
```

## 実行

```powershell
# 保存済み SourceDocument を OCR（id は <DATA_DIR>/content/source-documents/<id>.json）
MyManabi.OcrWorker --source-document <id>

# PDF を直接指定（id はファイル名から導出）
MyManabi.OcrWorker --pdf .\worksheet.pdf --tessdata .\tessdata
```

主なオプション（`--help` に全件）:

| オプション | 既定 | 説明 |
| --- | --- | --- |
| `-s, --source-document <id>` | — | `content/source-documents/<id>.json` を入力にする |
| `--pdf <path>` | — | PDF を直接処理する |
| `--data-dir <path>` | `%MYMANABI_DATA_DIR%` ／ `%APPDATA%/MyManabi` | DATA_DIR |
| `--tessdata <path>` | `%MYMANABI_TESSDATA%` ／ `<DATA_DIR>/tessdata` | tessdata フォルダ |
| `--lang <langs>` | `jpn+jpn_vert` | 言語（未導入分は自動で除外） |
| `--dpi <n>` | `300` | ページ画像化 DPI |
| `--password <pw>` | — | PDF オープンパスワード |
| `--no-crops` | off | 候補クロップ画像を出力しない |
| `--max-pages <n>` | 0（全部） | 処理する最大ページ数 |

> 暗号化 PDF: PDFium は**ユーザーパスワードが空の AES 保護 PDF**（保護付きプリントに多い）を
> そのまま画像化できる。これが「テキスト抽出は不可でも画像化＋OCR は可能」（仕様 §10）の理由。

## 出力

`<DATA_DIR>/content/extractions/<id>/` に保存（公開リポジトリには置かない）:

- `extraction-result.json` — 抽出結果（stdout にも出力）。形式は
  [`schemas/extraction-result.schema.json`](../../schemas/extraction-result.schema.json)。
- `page-NNN.png` — ページ全体の画像
- `page-NNN-cNN.png` — 候補ごとの領域クロップ

候補の `region` はページ幅・高さに対する比率（0..1）で保持し、端末サイズや解像度が
変わっても再利用できる（仕様 §12.3）。

## Tauri からの駆動

Rust ドライバ [`app/src-tauri/src/ocr_worker.rs`](../../app/src-tauri/src/ocr_worker.rs) が本ワーカーを
子プロセスとして起動する。実行ファイルの解決順:

1. 環境変数 `MYMANABI_OCR_WORKER`
2. `tools/ocr-worker/src/MyManabi.OcrWorker/bin/{Release,Debug}/net8.0/MyManabi.OcrWorker(.exe)`
3. `PATH` 上の `MyManabi.OcrWorker`

GUI を起動せずに通しで確認する:

```powershell
cargo run --example extract_pdf -- <SOURCE_DOCUMENT_ID>
```

## 設計メモ

- **OCR は提案であって確定ではない。** 候補分割・種別推定は経験則で、誤読・誤分割を前提に
  人の確認へ渡す。`reviewStatus` は常に `draft`。
- **候補分割**は行頭の問題番号マーカー（`問1` / `大問1` / `第1問` / `(1)` / `１．` / `①` …）を
  検出して行をまとめる。マーカーが無いページは 1 ページ＝1 候補（`source-page` 相当）。
- **純粋ロジック**（[`CandidateSplitter`](src/MyManabi.OcrWorker/CandidateSplitter.cs) /
  [`QuestionTypeHeuristic`](src/MyManabi.OcrWorker/QuestionTypeHeuristic.cs)）はネイティブ依存から
  切り離し、単体テストで固定している。
- **AI 補助は含めない。** 本ワーカーはローカル完結（Stage 1–2）。AI 補助（Stage 4）は別段で、
  既定オフ・必要箇所のみ（仕様 §11.3）。
