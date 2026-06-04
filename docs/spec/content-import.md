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

取り込み元を追跡するため、SourceDocument を持たせる。

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

AI は Question JSON の候補を作れる。大人が確認したものは `adult-approved` とし、原本画像へ切り替えられるものに限り、未確認の `ai-provisional` を通常学習へ出題する余地も残す。`ai-provisional` は測定用途や確定的な理解度集計には使わない。

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

問題文と答えは、どちらもテキストだけとは限らない。図形、作図、書き取り、筆算、表、グラフ、ヒアリング問題では、問題も答えも画像や音声で持つ必要がある。

Question Entity は次を分けて持つ。

- `presentation`: 子どもへ提示するもの
- `expected_response`: 子どもに求める回答の形
- `answer`: 答え合わせや保護者確認に使う正答・模範・証拠
- `source_mapping`: 問題領域と答え領域の対応関係

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
expected_response:
  type: handwriting # text / numeric / choice / handwriting / speech / drawing / parent-review
answer:
  type: source-region
  document_id: print-kanji-answer-001
  page: 1
  region:
    x: 0.10
    y: 0.18
    width: 0.80
    height: 0.12
  text_value: "例"
answer_review_status: adult-approved
```

領域座標はページ幅、高さに対する割合で保持する。端末サイズや画像解像度が変わっても再利用しやすい。

`answer.text_value` は任意の補助情報である。表示上の正は画像や音声でもよいが、検索、復習分析、簡易採点、保護者確認を助けるため、分かる範囲でテキスト値、タグ、rubric を併記できる。

```yaml
answer:
  type: exact-text
  value: "90°"
```

```yaml
answer:
  type: source-region
  document_id: angle-print-answer-001
  page: 1
  region:
    x: 0.12
    y: 0.20
    width: 0.18
    height: 0.18
  text_value: "90°"
  tags:
    - right-angle
```

```yaml
answer:
  type: exemplar-audio
  media_id: audio-answer-001
  transcript: "The answer is ..."
```

`source_mapping` は、問題側と答え側の対応を明示する。問題用 PDF と解答用 PDF が別ファイルの場合、ページ番号や見た目だけで推測しない。

```yaml
source_mapping:
  question_region_id: qreg-001
  answer_region_id: areg-001
  relation: same-item
  item_label: "1"
  confidence: adult-confirmed # adult-confirmed / heuristic / ai-suggested
```

批判的に確認する点:

- 答えを画像だけにすると、検索、弱点分析、簡易採点が弱くなる
- 答えをテキストだけにすると、図形、作図、書き取り、筆算、表、グラフで問題の本質を失う
- 問題画像と答え画像の対応付けを暗黙にすると、誤対応が学習結果そのものを壊す
- AI が画像や OCR テキストから答えを補う場合、未確認の正答だけを根拠に自動採点しない

### 12.4 音声を使う出題

音声問題も、画像問題と同じく `presentation` と `answer` を分ける。初期 PoC では、音声認識や発音採点を確定判定に使わず、本人または保護者確認を基本にする。

```yaml
presentation:
  type: audio
  media_id: listening-question-001
  transcript: "補助用の文字起こし。子どもに表示するかは別設定"
expected_response:
  type: text
answer:
  type: exact-text
  value: "..."
grading:
  method: deterministic-or-parent-review
```

```yaml
presentation:
  type: source-region
  document_id: kanji-print-001
  page: 1
  region:
    x: 0.10
    y: 0.20
    width: 0.30
    height: 0.12
expected_response:
  type: handwriting
answer:
  type: exemplar-image
  media_id: kanji-answer-image-001
  text_value: "山"
grading:
  method: self-or-parent-review
```

ヒアリング問題では「音声を聞いて文字で答える」、書き取り問題では「画像や音声で指示を出して手書きで答える」という形がある。どちらも回答イベントには、入力テキスト、手書き画像、音声録音などの回答媒体を別に記録する。

批判的に確認する点:

- 音声データは個人情報になりやすいため、保存目的、削除方法、外部送信の有無を UI で明確にする
- 自動音声認識は、子どもの発音、周囲の音、マイク品質で誤りやすい
- ヒアリング問題の transcript は便利だが、子どもに見せると問題が成立しない場合がある
- 書き取りの自動採点は PoC では急がず、模範表示と本人/保護者確認を優先する

### 12.5 領域指定の継承

初期 PoC の `source-region` 取り込みでは、ページごとに毎回矩形を指定させない。最初に指定した矩形を次ページ以降へ引き継ぎ、取り込めない部分だけ保護者が介入する流れを基本にする。

```text
PDF 原本
  → ページ画像化
  → 初期領域計画を作成
  → ページを確認しながら必要箇所だけ矩形を修正
  → 矩形ごとに OCR または領域画像を候補化
  → レビュー画面
```

何も指定しない場合は、「未指定」ではなく「全ページ全体を対象にする既定矩形」として扱う。これにより、後から再実行、差分確認、レビュー対象の説明ができる。

領域計画はページごとに次の状態を持つ。

```yaml
region_plan:
  page: 1
  region:
    x: 0.00
    y: 0.00
    width: 1.00
    height: 1.00
  source: default-full-page # default-full-page / inherited / manual
  status: pending # pending / ocr-done / needs-adjustment / skipped
```

継承ルール:

- 1ページ目で矩形を指定した場合、その矩形を次ページ以降の `pending` または `inherited` な領域計画へ引き継ぐ
- 途中ページで矩形を修正した場合、操作は「このページだけ変更」と「このページ以降に適用」を分ける
- 「このページ以降に適用」は、以降の `pending` または `inherited` の領域計画だけを更新する
- `manual` の領域計画は、人が明示的に介入した結果なので一括更新で上書きしない
- ページのレイアウトが崩れている、問題数が変わる、余白が大きく違う場合は `needs-adjustment` として保護者確認へ回す
- 取り込まないページは `skipped` として記録し、暗黙に失敗扱いしない

UI は少なくとも次の操作を分けて表示する。

```text
全ページ全体を取り込む
前ページの矩形を引き継ぐ
このページだけ変更
このページ以降に適用
このページをスキップ
OCR を実行
```

批判的に確認する点:

- 比率座標の引き継ぎは、同じレイアウトのプリントでは有効だが、章末問題や段組みが変わる教材では静かにズレる
- 「このページだけ」と「以降へ適用」を分けないと、保護者が例外対応したつもりの修正で後続ページを壊す
- 全ページ全体の既定矩形は便利だが、図表や解答欄まで OCR 対象に入りやすい
- 手動介入済みの `manual` 領域を一括変更で上書きすると、レビュー済みの作業を失いやすい

### 12.6 答え合わせの扱い

PDF 原本を表示する場合も、答えの対応付けは曖昧にしない。

```text
問題領域
  ↔ Question ID
  ↔ 解答
  ↔ 解答の確認状態
```

解答 PDF が別にある場合は、解答側にもページ、領域、問題番号を持たせる。
自動対応付けが不確かな場合でも通常学習への出題は許容するが、子どもが答えを見たいと選んだ時だけ表示し、対応付けの確認状態を記録する。未確認の正答だけを根拠に自動採点しない。

漢字の書き取りでは、端末上での自動採点を必須にしない。
初期段階では、模範解答を表示して本人または保護者が確認する方式も許容する。

### 12.7 長所

- OCR 精度が低くても、原本の問題文を改変せずに使える
- PDF 全体を外部 AI へ送らずに済む
- 問題文の JSON 化より入力負担が小さい
- 問題 ID があるため、正答率、前回出題日時、保護者指定、重み付けを記録できる

### 12.8 制約

- PDF ページ全体表示は、小さい画面では読みづらい
- 問題領域の指定 UI が必要になる
- 答えの対応付けが誤っていると、学習結果そのものが壊れる
- 著作権を含む領域画像も DATA_DIR 外へ出さない
- 類題生成や検索には、後から Skill や OCR テキストを補う必要がある

### 12.9 初期実装の優先順位

```text
(1) PDF をローカルでページ画像化
(2) ページ単位で表示
(3) 全ページ全体の既定領域計画を作る
(4) 最初の矩形を次ページ以降へ引き継ぐ
(5) 取り込めないページだけ矩形を修正する
(6) 問題番号と答えを手動で対応付ける
(7) 領域を切り出して表示する
(8) OCR で領域候補、問題番号、解答候補を提案する
(9) 必要な問題だけ normalized Question へ昇格する
```

OCR は確定処理ではなく、領域候補、問題番号、解答候補を提案する補助として使う。

実装上の移行タスク:

- `schemas/question.schema.json` の `body` と `answer.value` 必須を緩め、`presentation`、`expected_response`、画像/音声 answer を追加する
- Rust の `Question` / `Answer` 型と validation を、テキスト専用から媒体対応へ広げる
- React の `Question` 型と学習者 UI を、`body` 表示だけでなく `source-region`、`image`、`audio` を描画できるようにする
- 回答イベントに、テキスト回答、手書き画像、音声録音などの回答媒体を分けて保存できるようにする
- 公開用統計には、問題画像、答え画像、音声、手書き回答を含めないことを検証する

## 13. AI-OCR を含む取り込みドメイン

### 13.1 表示方式は取り込み精度と問題成立性で選ぶ

OCR 精度と、問題として出題可能かどうかは別の軸として扱う。

- 高精度で大人が確認できた問題は `normalized` 表示を primary にできる
- 不完全な取り込みでも原本領域で問題が成立する場合は、原本画像を primary にする
- 原本画像に答えや過去の誤答が見える場合も、通常学習や復習で成立するなら利用できる
- 動的な回答マスクは標準経路にしない。必要な場合は、事前加工した画像を別の原本として取り込む
- 過去の誤答が見える問題を測定へ使う場合は、提示条件として記録し、難易度を自動補正しない

```yaml
presentation_condition: prior-response-visible
```

原本画像と normalized 表示が同じ問題内容を表す場合は、同じ Question ID の表示バリエーションとして保持する。子どもは表示を切り替えられ、実際に見た表示方式と切り替え履歴を記録する。

```yaml
presentation:
  primary:
    type: normalized
    body: "次の角度を求めましょう。"
  alternatives:
    - type: source-item
      source_item_id: worksheet-001-item-003
```

切り替えだけでは問題を停止しない。子どもが `表示がおかしい` または統合入口の `おかしい・納得できない` から報告した場合は、その Question を停止して大人の確認へ送る。

### 13.2 回答は複数表現を持てる

回答はテキスト、画像、音声などの複数表現を持てる。問題ごとに正となる `primary` を指定し、他の表現は模範表示、検索、採点補助、保護者確認へ使う。

```yaml
answer:
  primary:
    type: exact-text
    value: "90°"
  representations:
    - type: source-item
      source_item_id: worksheet-answer-001-item-003
      role: model-answer
      visibility: after-response
```

回答画像は基本的に子どもへ見せてよい。ただし、誤答直後に必ず表示せず、`もう一度考える`、`答えを見る`、`なぜ違うか説明して`、`納得できない` を選べるようにする。`答えを見る` は失敗ではなく学習行動として記録する。

### 13.3 SourceItem

PDF 内の「第 3 問」のような教材上の項目を、Question とは別の `SourceItem` として管理する。Question が無効化されても、原本上の位置、並び順、再取り込みの入口を失わないためである。

```yaml
source_item:
  id: worksheet-001-item-003
  document_id: worksheet-001
  item_label: "3"
  sequence: 12
  regions:
    - role: prompt
      page: 2
      display_order: 1
      region:
        x: 0.10
        y: 0.18
        width: 0.80
        height: 0.12
    - role: diagram
      page: 2
      display_order: 2
      region:
        x: 0.12
        y: 0.32
        width: 0.45
        height: 0.30
```

一つの SourceItem は複数領域を持てる。領域は一枚へ事前結合せず、役割と表示順を保った複数画像として表示する。加工済み画像が必要な場合だけ、別の表示バリエーションとして追加する。

一つの SourceItem から複数の Question を作れる。教材内の並びは Question に直接持たせず、教材索引側の `ContentSequence` で管理する。

```yaml
content_sequence:
  id: worksheet-001-order
  items:
    - question_id: q-angle-value
      position: 12
      sub_position: 1
    - question_id: q-angle-reason
      position: 12
      sub_position: 2
```

SourceItem の領域不備が確認された場合は、その SourceItem を使う Question をすべて停止する。

### 13.4 SourceItemMapping

問題用 PDF と解答用 PDF が別の場合、問題側と回答側にそれぞれ SourceItem を作り、対応付けを独立して管理する。

```yaml
source_item_mapping:
  question_source_item_id: worksheet-001-item-003
  answer_source_item_id: worksheet-answer-001-item-003
  relation: answer-for
  confidence: ai-suggested # ai-suggested / adult-confirmed
```

独立した Mapping により、Question 作成前のレビュー、同じ原本項目から作る複数 Question での再利用、AI-OCR の対応付け精度の評価ができる。初期実装は単純な `answer-for` 関係から始める。

未確認の Mapping でも、子どもが `答えを見る` を選んだ場合は回答画像を表示できる。ただし、表示時の確認状態を記録し、未確認の正答だけを根拠に自動採点しない。

### 13.5 ExtractionArtifact

ローカル OCR、AI-OCR、テキスト抽出の生結果は、Question に直接埋め込まず `ExtractionArtifact` として分離する。

```yaml
extraction_artifact:
  id: extraction-ai-001
  source_item_id: worksheet-001-item-003
  import_run_id: import-run-001
  route: ai-ocr-image
  raw_text: "..."
  confidence: 0.92
```

同じ SourceItem へ複数方式を実行した場合は、採用・不採用にかかわらず成果物を残す。AI は `ai-provisional` の採用結果を自動選択でき、大人が `adult-approved` にする際は採用結果を確認する。

複数の抽出成果物を組み合わせて normalized 文を作ることも許可する。ただし、参照元を記録し、原本にない自然な文章を補完する危険を前提にする。

```yaml
normalized_content:
  body: "..."
  derived_from_artifact_ids:
    - extraction-local-001
    - extraction-ai-001
```

AI が原本から読み取れない箇所を推測した場合は、観測箇所と区別する。大人が確認するまでは原本画像を primary にし、レビュー画面では推測箇所を強調する。

```yaml
normalized_content:
  segments:
    - text: "次の角度を"
      confidence: observed
    - text: "求めましょう"
      confidence: inferred
```

大人でも読み取れない原本は `unreadable-source` として停止し、出題しない。

### 13.6 承認状態と暫定出題

出題可否は Question 全体の一つの承認状態で判定する。提示内容、回答、対応付けのどれかが不正なら問題として成立しない。一方、差し戻し理由は分けて記録する。

```yaml
review_status: needs-revision
review_issues:
  - answer-mismatch
```

初期の状態候補:

| 状態 | 通常学習 | 測定テスト | 理解度集計 |
| --- | --- | --- | --- |
| `adult-approved` | 使用可 | 使用可 | 確定値へ使用可 |
| `ai-provisional` | 条件付きで使用可 | 使用しない | 暫定値として分離 |
| `suspended` | 使用しない | 使用しない | 新規結果を作らない |
| `invalidated` | 使用しない | 使用しない | 過去結果も集計対象外 |

`ai-provisional` は、原本画像へ切り替えられることを出題条件にする。原本画像がなく AI-OCR 文だけの問題は、大人が確認するまで出題しない。問題原本は確認できても回答が未確認の場合は出題できるが、自動採点せず採点保留にする。

子ども向けには未確認状態を強調せず、`問題がおかしい` を押しやすくする。大人向け画面では未確認状態を明示する。

### 13.7 ImportProfile と品質停止

取り込み品質は、モデル名だけでなく、教材、レイアウト、抽出経路の組み合わせで追跡する。

```yaml
import_profile:
  source_document_type: worksheet
  layout_profile_id: angle-worksheet-v1
  extraction_route: ai-ocr-image
  model_profile: inspect-image-low-cost
```

子どもが `問題がおかしい` を押した Question は即時停止する。同じ ImportProfile の異なる 3 問で報告された場合は、その取り込み種類を一時停止する仮ルールを置く。

ImportProfile 停止時は、未出題の問題を停止し、すでに報告なく完了した問題は継続可能とする。プロファイル停止だけでは過去結果を無効化せず、問題単位で不備が確認された場合だけ集計から除外する。

### 13.8 取り込み経路とレビュー UI

アプリは、入力に応じた取り込み経路を推奨し、大人が変更できるようにする。

```text
テキスト層あり PDF
  → テキスト抽出を推奨

定型レイアウト・鮮明な画像
  → ローカル OCR を推奨

複雑なレイアウト・認識精度不足
  → AI-OCR を推奨

図表中心・OCR 不要
  → 原本画像利用を推奨
```

AI-OCR で PDF 全体を送る経路は選択肢として残すが、標準経路にはしない。標準は必要なページ・領域だけを送信する。同じ ImportRun 内では送信範囲の許可を引き継げるが、別教材・別実行へ自動で引き継がない。

レビュー画面は次の順で確認しやすくする。

```text
(1) 問題画像と回答画像の対応
(2) 問題として成立しているか
(3) 回答テキスト・採点方法
(4) 単元・Skill・並び順
```

一括承認画面では、問題画像、回答画像、回答テキスト、採点方式、状態を並べ、原本ページへ拡大できるようにする。回答画像を正として使える問題は、回答テキストがなくても承認可能にする。

個別承認と一括承認の両方を許可し、一括承認した ImportRun を追跡する。後から誤りが見つかった場合は、同じ実行やレイアウトの問題をまとめて再確認できるようにする。

## 14. SourceDocument のリビジョンと削除

より鮮明な PDF・画像へ差し替える場合は、元データを上書きせず SourceDocument の新しいリビジョンとして取り込む。

```yaml
source_document:
  id: worksheet-001
  revision: 2
  replaces_revision: 1
```

画像だけが鮮明になり、問題内容と正答が同一だと大人が確認できた場合は、Question ID を維持して Question revision を増やし、表示参照先を新しい SourceItem へ更新する。旧領域座標は初期候補として引き継げるが、自動確定しない。

SourceDocument の削除はアプリ上の操作に限定し、参照する SourceItem、Question、回答表現、過去履歴への影響を表示する。通常削除は論理削除と復元期間を経て物理削除し、個人情報や誤取り込みでは影響確認後の即時物理削除も許可する。

削除理由に応じて対象を分ける。

```text
原本のみ削除
  → 大人が確認した normalized 問題は継続可能

教材コンテンツを完全削除
  → normalized 文・回答・抽出成果物も削除
  → 関連 Question を停止

個人情報・誤取り込み
  → 関連媒体と抽出成果物を連動削除
```

教材コンテンツを完全削除した場合は、過去イベント内の問題文、問題画像、回答画像、教材由来の回答テキストも削除し、日時、所要時間、当時の判定状態、集計対象外になった事実だけを残す。

物理削除後は、内部 ID、教材種別、削除状態だけを残し、元ファイル名や詳細出典を削除可能にする。

## 15. 初期実装範囲と将来拡張

### 15.1 初期実装で優先する

- SourceDocument、SourceItem、比率座標の領域
- 問題側 SourceItem と回答側 SourceItem の単純な `answer-for` Mapping
- 原本画像を primary とする Question
- 回答画像と任意の回答テキスト
- 個別承認と一括承認
- `adult-approved` と `suspended`
- 問題と回答を並べるレビュー UI

### 15.2 方針として残し、必要性を見て追加する

- AI-OCR による `ai-provisional` 出題
- ImportProfile 単位の品質停止
- 複数 ExtractionArtifact の比較と合成
- normalized 表示と原本表示の切り替え
- SourceDocument の論理削除、復元期間、完全削除
- AI 採点評価ハーネスとの連携

### 15.3 批判的に確認する点

- 未確認問題を出題できるようにすると、承認待ちの負担は減るが、子どもが品質確認役になる危険がある
- 原本画像を安全弁にしても、問題と回答の対応付けが誤っていれば誤学習を防げない
- エンティティを増やしすぎると初期 PoC の実装が重くなるため、SourceItemMapping は単純な関係から始める
- 教材削除を厳密に行うには、イベントやレポートへ教材内容を複製しすぎない設計が必要になる
