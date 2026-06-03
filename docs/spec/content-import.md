# 教材取り込みの探索仕様

## 1. 位置づけ

教材取り込みは、初期段階で一つの方式へ固定しない。

PDF プリント、問題集、教科書では、扱いたい情報の粒度が異なる。少量の教材を実際に取り込み、Obsidian Vault と Question JSON の使い勝手を確認しながら仕様を育てる。

本書では、現時点の仮説、最小ルール、保留事項を整理する。

## 2. 基本方針

- 教科書の構造、単元、Skill、前提関係、関連性は Obsidian Vault で管理する
- 実際に出題する確定問題は Question JSON として管理する
- PDF 問題集やプリントは、Question JSON を作るための入力元として扱う
- 教科書内の例題や章末問題も、実際に解かせる場合は Question JSON にできる
- 元教材の画像、PDF、問題文は著作権を含むため、リポジトリ外の DATA_DIR に置く
- 取り込み方式は手動、AI 補助、自動抽出を段階的に試す

## 3. 入力経路

### 3.1 教科書

教科書は、まず Obsidian Vault に単元ノートを作る。

```text
教科書
  → 教科カテゴリ
  → 単元ノート
  → Skill ノート
  → 必要な問題だけ Question JSON
```

教科書本文をそのまま公開リポジトリへ置かない。単元ノートには、教科書名、ページ、順序、Skill、関連単元などのメタデータを置く。

### 3.2 PDF プリント・問題集

PDF の問題集やプリントは、具体問題のまとまりとして扱う。

```text
PDF プリント
  → 問題候補を抽出
  → 必要なら人が修正
  → Question JSON
  → 単元・Skill と関連付け
```

初期 PoC では、PDF からの完全自動抽出を必須にしない。少数の問題を手動または AI 補助で JSON 化し、どの項目が必要かを確認する。

### 3.3 教科書内の例題・章末問題

教科書の構造は Obsidian ノートで扱う。一方、例題や章末問題を実際に出題、再出題、評価へ使う場合は Question JSON にする。

同じ教材でも、構造を説明する情報と、出題する問題を分けて管理する。

## 4. Obsidian と Question JSON の関連付け

ファイル名だけで関連付けない。ファイル名は人が見つけやすくするために使い、アプリ内部では安定した ID を使う。

Obsidian Vault は、単なる編集画面ではなく教材索引として使う。教科、単元、Skill、PDF 問題集、保護者が注目している範囲をノートで表し、関連する Question ID を緩く束ねる。

出題時に Question JSON を全件走査して傾向を推定しない。まず Obsidian 側の索引から対象となる Question ID の集合を絞り、その中で学習者状態と重みを評価する。

```text
Obsidian の教材索引
  → 教科、単元、Skill、関連教材から Question ID を絞る
  → 学習者状態と重みで候補を順位付けする
  → 必要な Question JSON だけを読む
  → 待機列へ積む
```

### 4.1 単元ノート

```yaml
---
id: fraction-addition
subject: 算数
textbook: 教科書名
pages: 42-47
order: 12
skill_ids:
  - same-denominator-addition
question_ids:
  - textbook-fraction-addition-review-001
  - print-fraction-addition-001
---
```

本文では、Obsidian Vault 内の関連ノートへリンクできる。

```markdown
## 関連 Skill

- [[same-denominator-addition]]
- [[common-denominator]]
```

### 4.2 Question JSON

```json
{
  "id": "print-fraction-addition-001",
  "subject": "算数",
  "unitId": "fraction-addition",
  "skillIds": ["same-denominator-addition"],
  "questionType": "numeric",
  "title": "次の計算をしてみよう",
  "body": "1/4 + 2/4 = ?",
  "note": "",
  "answer": {
    "type": "exact-text",
    "value": "3/4"
  },
  "source": {
    "type": "imported"
  },
  "reviewStatus": "adult-approved",
  "purposes": ["learning", "review"]
}
```

Question JSON 側の `unitId` と `skillIds` は、具体問題が最低限持つ自己記述として扱う。Obsidian 側の `question_ids` と関連リンクは、出題候補を高速に絞るための教材索引として使う。

両者に矛盾がある場合は検出して保護者向けに表示する。どちらか一方を完全な正として固定するかは、実際の運用負担を確認してから決める。

逆参照を手作業で保守する負担が大きい場合は、アプリが Question JSON から候補一覧を生成し、Obsidian ノートへ追記する補助を追加する。

### 4.3 PDF 問題集ノート

PDF 問題集やプリントにも Obsidian ノートを作れる。

```yaml
---
id: print-fraction-review-001
type: source-document
subject: 算数
unit_ids:
  - fraction-addition
skill_ids:
  - same-denominator-addition
question_ids:
  - print-fraction-addition-001
  - print-fraction-addition-002
source_document_id: print-fraction-2026-001
---
```

本文には、使いどころ、難易度の印象、関連単元、取り込み時の注意などを残せる。

### 4.4 保護者が注目する範囲

保護者が解いてほしい問題を指定する場合、個別 Question ID だけでなく、Obsidian ノートを入口として指定できるようにする。

```text
個別問題を指定
単元ノートを指定
Skill ノートを指定
PDF 問題集ノートを指定
```

ただし、Obsidian ノート自体を依頼状態として使わない。誰に、いつ、何問、どの対象から出題してほしいかは ParentSuggestion Entity として別に記録する。

```yaml
parent_suggestion:
  id: ps-001
  learner_id: learner-a
  source_ref:
    type: vault-note
    id: print-fraction-review-001
  requested_questions: 2
  status: pending
```

## 5. SourceDocument

取り込み元を追跡するため、将来は SourceDocument を持たせる。

```yaml
source_document:
  id: print-fraction-2026-001
  type: pdf
  path: sources/print-fraction-2026-001.pdf
  imported_at: 2026-06-02T09:00:00+09:00
```

Question JSON には、必要に応じて出典を紐付ける。

```yaml
source:
  type: imported
  document_id: print-fraction-2026-001
  page: 2
  item_label: "3"
```

SourceDocument は DATA_DIR 内でのみ管理する。公開リポジトリには、実教材の PDF、画像、問題文、出典の詳細を含めない。

## 6. 初期 PoC の最小運用

最初は次の手順で十分とする。

1. Obsidian Vault に一つの単元ノートを作る
2. PDF を使う場合は、PDF 問題集ノートも作る
3. PDF または教科書から、少数の問題を選ぶ
4. Question JSON を手動または AI 補助で作る
5. Question JSON に `unitId` と `skillIds` を付ける
6. Obsidian ノートに関連 Question ID を置く
7. 内容を確認し、`reviewStatus: adult-approved` にする
8. アプリで索引を読み込み、対象集合を絞って出題する
9. 使いにくい項目、足りない分類、入力負担を記録する

生成や抽出の自動化は、この運用で必要項目が見えた後に追加する。

## 7. Markdown 記法ルール

### 7.1 DATA_DIR 内の Obsidian Vault

- Vault 内では `[[wikilink]]` を使ってよい
- frontmatter の ID は、ファイル名変更後も維持する
- アプリ内部の参照には frontmatter の ID を使う
- Mermaid ノード内では、`1. ` や `- ` のような Markdown リスト記法を避ける

### 7.2 公開リポジトリ内の docs

- `docs/` 内では標準 Markdown リンクを使う
- `[[wikilink]]` は使わない
- 実教材由来の本文や画像を置かない

## 8. 検討事項

- Obsidian 単元ノートのテンプレート
- Skill ノートの frontmatter
- PDF から問題候補を抽出する UI
- 問題画像、図、表、数式の保存形式
- SourceDocument を初期 PoC から持つか
- 単元ノートの `question_ids` を手動管理するか、自動生成するか
- 起動時に作る教材索引の形式とキャッシュ更新方法
- Obsidian ノートと Question JSON の矛盾をどう検出、修復するか
- 教科書問題と PDF 問題集を UI 上で区別する必要があるか
- OCR 結果と人が修正した問題文をどのように保持するか
- 暗号化 PDF をどの PDF エンジンでページ画像化、抽出するか

## 9. 批判的に確認する点

- ファイル名だけの関連付けは、名称変更で壊れやすい
- Obsidian ノートと Question JSON の両方に同じ情報を重複させると、同期負担が生じる
- Obsidian ノートを出題のたびに全件走査すると遅くなるため、起動時の索引化またはキャッシュが必要になる
- 保護者指定を Obsidian ノートだけで表すと、依頼の期限、対象学習者、完了状態が曖昧になる
- PDF の自動抽出を早期に作り込むと、教材形式ごとの差に引きずられる
- JSON の手入力が重い場合、取り込み UI または生成補助が必要になる
- 教材取り込みの便利さと、著作権を含む実教材を公開リポジトリへ置かない原則を両立する必要がある

## 10. 実 PDF で確認できた初期課題

実際の漢字 PDF を使った初回確認では、PDF が AES 保護されており、軽量な PDF テキスト抽出だけでは処理できなかった。

初期実装では処理を分ける。

```text
URL またはファイルを指定
  → DATA_DIR に PDF を保存
  → SourceDocument JSON を保存
  → pending-review
  → 対応可能な抽出方式を選ぶ
  → 問題候補を人が確認
  → Question JSON
```

PDF 保存と問題抽出を一つの処理に固定しない。テキスト層がある PDF、画像 PDF、暗号化 PDF、図表を含む PDF で抽出方式が変わるためである。

## 11. 取り込みコスト戦略

### 11.1 基本方針

教材取り込みは、可能な限りローカル処理で完結させる。

```text
PDF を DATA_DIR に保存
  → ローカルでページ画像化
  → ローカルで OCR
  → レイアウト規則で問題候補へ分割
  → 信頼度が低い箇所だけ確認対象にする
  → 必要な箇所だけ AI 補助へ送る
  → 保護者が確認
  → Question JSON
```

AI へ PDF 全体を常に送信しない。問題候補を作るために必要なページ、領域、OCR テキストだけを送る。

### 11.2 処理方式の比較

| 方式 | トークン消費 | 長所 | 主な課題 |
| --- | --- | --- | --- |
| ローカル抽出のみ | なし | 安価。教材を外部へ送らない。再実行しやすい | 日本語 OCR、ルビ、縦書き、解答欄、図表の精度 |
| AI に PDF 全体を渡す | 大きい | 実装が簡単。複雑なレイアウトにも対応しやすい | コスト、外部送信量、再現性、レビュー負担 |
| ローカル OCR + 低コスト AI | 小さい | OCR テキストの整形、分類、JSON 化へ使いやすい | OCR 誤りを AI が確定情報のように扱う危険 |
| ローカル OCR + 領域画像 + AI | 必要箇所だけ | 難しい箇所だけ画像で補える | 切り出し規則と信頼度の設計が必要 |

### 11.3 推奨するハイブリッド

初期実装では、次の段階を分離する。

```text
Stage 0: PDF・画像・テキスト保存と SourceDocument 登録
Stage 1: PDF・画像のローカルページ画像化
Stage 2: ローカル OCR またはテキスト読み込みと候補分割
Stage 3: 保護者による確認、修正
Stage 4: 任意の AI 補助
```

Stage 0 は本体（Rust）が担う。Stage 1–2 は C# + Tesseract のローカル OCR ワーカー
（[`tools/ocr-worker`](../../tools/ocr-worker)）として実装済みで、保存済み PDF を PDFium で
ページ画像化し、画像も含めて Tesseract で日本語 OCR を行い、問題番号マーカーで候補へ分割する。
UTF-8 テキストは OCR を通さず draft 候補にする。出力は
確認用の中間成果物（`extraction-result.json`、初期値 `reviewStatus: draft`）で、Stage 3 の
確認時に OCR 本文を修正し、候補を `adult-approved` または `suspended` にできる。
ただし、この承認は OCR 候補の確認であり、答えと単元を設定して Question JSON にするまでは出題しない。
初期 UI では、承認済み候補だけを対象に、教科、単元 ID、Skill ID、問題種別、答えを入力して
`<DATA_DIR>/content/questions/*.json` へ昇格する。

AI 補助は既定でオフにする。利用者が有効化した場合も、次の順序で利用する。

```text
OCR テキストだけを低コストモデルへ送る
  → 信頼度が低い箇所だけ領域画像を送る
  → それでも判断できない箇所は保護者確認へ戻す
```

AI は Question JSON の候補を作れるが、確定しない。`reviewStatus: adult-approved` へ変更するまでは出題対象にしない。

### 11.4 モデル選択

モデル名を UI の前提にしない。利用可能モデルの一覧と能力をシステム側で確認し、用途別のプロファイルへ解決する。

| プロファイル | 用途 | 必要能力 |
| --- | --- | --- |
| `extract-text-low-cost` | OCR テキストから問題候補を構造化 | 構造化出力、低コスト |
| `inspect-image-low-cost` | 不明瞭な領域画像を読む | 画像入力、構造化出力、低コスト |
| `inspect-image-fallback` | 低コストモデルで確定できない箇所 | 画像入力、より高い精度 |

取り込みは即時応答を必要としないため、非同期処理を基本とする。API を使う場合は、低優先度処理や Batch 処理を候補にする。

### 11.5 記録する値

方式の改善を比較できるよう、SourceDocument ごとに次を記録する。

```yaml
import_metrics:
  extraction_route: local-ocr
  local_ocr_engine: tesseract
  pages: 0
  candidate_questions: 0
  ai_assisted_regions: 0
  adult_corrections: 0
  elapsed_ms: 0
  estimated_api_cost_usd: 0
```

精度だけでなく、修正件数、処理時間、外部へ送った領域数、API コストを比較する。

### 11.6 批判的に確認する点

- 日本語の漢字プリントでは、OCR だけで読み、書き、送り仮名、ルビ、解答欄を正しく分離できるとは限らない
- AI に OCR 誤りを渡すと、自然な文章へ補正して誤答を作る可能性がある
- PDF 全体を AI へ送る方式は PoC には便利だが、標準経路にするとコストと外部送信量が増える
- 低コストモデルで十分かどうかは、モデル名ではなく合成教材と確認済み教材の評価セットで測る
- モデル性能と料金は変化するため、固定モデル名をコードへ散在させない

### 11.7 OCR ライブラリ確定後のライセンス調査タスク

OCR の実証が終わり、配布へ含めるライブラリ、ネイティブバイナリ、学習済みモデルが確定した時点で、Claude に次の調査を依頼する。候補比較中には実行しない。

```text
MyManabi の OCR 配布物について、第三者ライセンスを調査してください。

前提:
- MyManabi 本体は MIT License で公開する
- OCR ワーカーは OS ごとに配布する
- 採用した OCR エンジン、ラッパー、ネイティブ DLL、学習済みモデルは実装と配布物から確認する

調査内容:
1. 配布物へ含まれる第三者コンポーネントを推移的な依存関係まで列挙する
2. 各コンポーネントの名称、バージョン、配布元 URL、ライセンス、同梱ファイルを記録する
3. LICENSE、NOTICE、著作権表示、変更表示、ソース公開など、バイナリ再配布時の義務を確認する
4. 学習済みモデル、言語データ、ネイティブ DLL をライブラリ本体とは分けて確認する
5. OS ごとの配布物に必要な LICENSE ファイルと THIRD_PARTY_NOTICES.txt の案を作る
6. MIT License の MyManabi 本体と併存できない条件、または法務確認が必要な条件があれば明示する
7. インストーラーとリリース成果物にライセンス関連ファイルが含まれることを検証する方法を提案する

推測で確定せず、一次情報を優先し、確認できない事項は未確認として残してください。
```

## 12. PDF 原本を使う出題モード

### 12.1 問題文を必ず JSON 化しない

取り込み精度が不足する場合、PDF の問題文を OCR で完全に再構築しない。
PDF 原本またはページ内の領域画像をそのまま表示し、答え合わせに必要な情報だけを Question Entity へ持たせる。

```text
PDF 原本
  → ページ画像化
  → 問題領域を指定
  → Question ID を発行
  → 答えを対応付ける
  → 単元、Skill を必要な粒度で付与
  → 出題時は領域画像を表示
```

初期 PoC では、この方式を優先候補にする。

### 12.2 取り込みモード

| モード | 表示内容 | 必須の取り込み情報 | 適した用途 |
| --- | --- | --- | --- |
| `source-region` | PDF ページ内の指定領域画像 | ページ、領域、答え | 漢字、計算ドリル、定型プリント |
| `source-page` | PDF のページ画像 | ページ、問題番号、答え | 領域分割が難しいプリント |
| `normalized` | Question JSON の本文 | 問題文、答え、分類 | 再利用、表示最適化、類題生成 |

最初から全問題を `normalized` にしない。必要になった問題だけ段階的に昇格させる。

```text
source-page
  → source-region
  → normalized
```

### 12.3 Question Entity の追加候補

```yaml
presentation:
  type: source-region
  document_id: print-kanji-001
  page: 1
  region:
    x: 0.10
    y: 0.18
    width: 0.80
    height: 0.12
source_item_label: "1"
answer:
  type: exact-text
  value: "例"
answer_review_status: adult-approved
```

領域座標はページ幅、高さに対する割合で保持する。端末サイズや画像解像度が変わっても再利用しやすい。

### 12.4 答え合わせの扱い

PDF 原本を表示する場合も、答えの対応付けは曖昧にしない。

```text
問題領域
  ↔ Question ID
  ↔ 解答
  ↔ 解答の確認状態
```

解答 PDF が別にある場合は、解答側にもページ、領域、問題番号を持たせる。
自動対応付けが不確かな場合は、保護者の確認が終わるまで出題対象にしない。

漢字の書き取りでは、端末上での自動採点を必須にしない。
初期段階では、模範解答を表示して本人または保護者が確認する方式も許容する。

### 12.5 長所

- OCR 精度が低くても、原本の問題文を改変せずに使える
- PDF 全体を外部 AI へ送らずに済む
- 問題文の JSON 化より入力負担が小さい
- 問題 ID があるため、正答率、前回出題日時、保護者指定、重み付けを記録できる

### 12.6 制約

- PDF ページ全体表示は、小さい画面では読みづらい
- 問題領域の指定 UI が必要になる
- 答えの対応付けが誤っていると、学習結果そのものが壊れる
- 著作権を含む領域画像も DATA_DIR 外へ出さない
- 類題生成や検索には、後から Skill や OCR テキストを補う必要がある

### 12.7 初期実装の優先順位

```text
(1) PDF をローカルでページ画像化
(2) ページ単位で表示
(3) 問題番号と答えを手動で対応付ける
(4) 領域を切り出して表示する
(5) OCR で領域候補を提案する
(6) 必要な問題だけ normalized Question へ昇格する
```

OCR は確定処理ではなく、領域候補、問題番号、解答候補を提案する補助として使う。
