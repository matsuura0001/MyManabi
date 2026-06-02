# MyManabi UI プロトタイプ

画面設計を比較するための throwaway プロトタイプ。実データは保存しない。

## 起動

```powershell
npm run dev
```

ブラウザで `http://127.0.0.1:1420/` を開く。

## 画面案

- `?variant=A` - 問題ファースト。起動後すぐ一問へ集中する
- `?variant=B` - 親子ホーム。前回の続き、保護者からの確認問題、終了導線を同じ画面で見る

開発環境では、画面下部のスイッチャーまたは左右キーでも切り替えられる。

どちらの案でも、右上から学習者向け画面と保護者向け画面を切り替えられる。

## 疎通スパイク

右下の `開発パネル` から、codex app-server へ一問生成を依頼できる。

このパネルは画面設計の一部ではない。app-server 接続確認のために一時的に残している。

## 確認済み問題バンク

Tauri アプリは、起動時に `<DATA_DIR>/content/vault/**/*.md` の Obsidian frontmatter を教材索引として読み込む。
画面が指定した単元ノート ID に紐づく `question_ids` から、必要な `<DATA_DIR>/content/questions/*.json` だけを読み込む。
`reviewStatus` が `adult-approved` または `auto-approved` の問題だけを出題する。

保存先は、環境変数 `MYMANABI_DATA_DIR` があればその値を使う。未設定なら `%APPDATA%/MyManabi` を使う。

公開リポジトリには、動作確認用の合成問題と合成 Vault だけを [`examples/data-dir`](../examples/data-dir) に置く。実教科書由来の問題は DATA_DIR へ置き、コミットしない。

問題 JSON の形式は [`schemas/question.schema.json`](../schemas/question.schema.json) を参照。

初期 PoC の Vault 読み込みは `id` と `question_ids` だけを扱う軽量実装。frontmatter の用途が増えた段階で YAML パーサーへ置き換える。

合成問題で Tauri アプリを試す場合:

```powershell
$env:MYMANABI_DATA_DIR = "..\examples\data-dir"
npm run tauri dev
```

## PDF 教材の取り込み

保護者画面の `教材を取り込む` から PDF の URL を登録できる。
PDF 本体と SourceDocument JSON は DATA_DIR 内だけへ保存し、公開リポジトリへ置かない。
登録直後は `pending-review` とし、問題候補の抽出と保護者確認は後続処理で行う。
SourceDocument JSON の形式は [`schemas/source-document.schema.json`](../schemas/source-document.schema.json) を参照。

初期画面は URL 取り込みだけに絞っている。端末内 PDF のファイル選択は後続で追加する。

GUI を起動せずに URL 取り込みを確認する場合:

```powershell
cargo run --example import_pdf -- "https://example.invalid/worksheet.pdf"
```

### 問題候補の抽出（ローカル OCR）

保存済み PDF をローカルでページ画像化し、日本語 OCR で問題候補へ分割する処理は、
C# + Tesseract の OCR ワーカー [`tools/ocr-worker`](../tools/ocr-worker) が担う。
Rust 側は [`src-tauri/src/ocr_worker.rs`](src-tauri/src/ocr_worker.rs) がこれを子プロセスとして
駆動し、Tauri コマンド `extract_source_document` として公開する。

出力は確認用の中間成果物（`reviewStatus: "draft"`）で、`<DATA_DIR>/content/extractions/<id>/`
にだけ保存する。形式は [`schemas/extraction-result.schema.json`](../schemas/extraction-result.schema.json) を参照。

GUI を起動せずに抽出を確認する場合（要: ワーカーのビルドと tessdata 取得）:

```powershell
# 1. ワーカーをビルドし、日本語 tessdata を取得
dotnet build ..\tools\ocr-worker -c Release
pwsh ..\tools\ocr-worker\scripts\get-tessdata.ps1

# 2. 保存済み SourceDocument を OCR
cargo run --example extract_pdf -- <SOURCE_DOCUMENT_ID>
```
