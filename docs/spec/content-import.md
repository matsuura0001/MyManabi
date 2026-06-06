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

### 3.4 手入力と画像添付

問題は PDF OCR からだけ作るものではない。保護者が問題文を手入力し、必要に応じて問題画像や回答画像を添付する経路も標準として扱う。

ファイル由来の素材は SourceDocument として DATA_DIR に保存する。純粋な手入力だけで成立する問題は SourceDocument を持たず、`source.type: adult-authored` とする。

```text
手入力のみ
  → adult-authored Question / QuestionSet

画像を添付
  → SourceDocument として画像を保存
  → QuestionSet の question_materials または answer_materials へ追加
```

画像を添付する時点では、`問題画像` と `補助画像` を細かく分けない。問題文テキストと画像は共存できるため、初期版では問題側素材か回答側素材かだけを選ぶ。

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

### 5.1 同一ファイルの再取り込み

同じ実体の PDF、画像、テキストを何度も取り込んでも、同じ SourceDocument が履歴に重複して並ばないようにする。

同一性の一次判定には、ファイル名や取り込み日時ではなく、正規化した入力バイト列のハッシュを使う。

```yaml
source_document:
  id: worksheet-fraction-001
  type: pdf
  path: sources/worksheet-fraction-001.pdf
  content_hash:
    algorithm: sha256
    value: "..."
  original_file_names:
    - worksheet.pdf
  first_imported_at: 2026-06-02T09:00:00+09:00
  last_seen_at: 2026-06-04T18:30:00+09:00
  import_count: 3
```

再取り込み時の扱い:

- `content_hash` が既存 SourceDocument と一致する場合は、新しい SourceDocument を作らない
- `last_seen_at` と `import_count` を更新し、必要なら `original_file_names` に別名を追加する
- 既存の抽出結果がある場合は、その結果を開く
- 利用者には「同じ教材はすでに取り込み済みです。既存の結果を開きます」と表示する
- 「再OCR」「AI-OCRで再実行」は SourceDocument の重複ではなく ImportRun / ExtractionArtifact として記録する

同じファイルを再処理したい場合は、SourceDocument を増やすのではなく、同じ SourceDocument に対する新しい ImportRun として扱う。

```yaml
import_run:
  id: import-run-20260604-001
  source_document_id: worksheet-fraction-001
  route: local-ocr
  started_at: 2026-06-04T18:31:00+09:00
  status: completed
```

履歴 UI では SourceDocument を主行として表示し、同じ教材に対する ImportRun は折りたたんだ「処理履歴」として表示する。

```text
教材A.pdf
  最新結果を見る
  処理履歴:
    2026-06-04 local-ocr
    2026-06-04 ai-ocr-image
```

ファイル内容が同じでファイル名だけ違う場合も、同じ SourceDocument として扱う。逆に、ファイル名が同じでも内容が変わった場合は別実体として扱う。ただし、より鮮明な版や修正版のように同一教材の差し替えと分かる場合は、[SourceDocument のリビジョン](#14-sourcedocument-のリビジョンと削除)として扱う。

批判的に確認する点:

- ハッシュだけで自動統合すると、同じ教材を別用途の教材セットとして扱いたい場合に見かけ上まとめられすぎる
- PDF のメタデータだけが変わった同一内容の検出は、単純なバイトハッシュではできない。初期 PoC ではバイトハッシュを採用し、必要になったらページ画像化後の perceptual hash やページ数・画像特徴で補助する
- URL からの取り込みは、同じ URL でも内容が変わることがあるため、URL ではなくダウンロード後の内容ハッシュを正とする
- 重複検出は便利だが、誤って同一扱いすると削除や再OCRの影響範囲を見誤るため、統合理由とハッシュを大人向け詳細に表示できるようにする

### 5.2 取り込み履歴の整理と削除

取り込み履歴の主行は SourceDocument とし、同じ教材に対する再OCR、AI-OCR再実行、失敗ログは折りたたみの処理履歴として扱う。履歴が同じファイル名で大量に並ぶ状態は避ける。

利用者向けの削除操作は、細かい分岐を出さず **削除する / 何もしない** の二択にする。保護者が `Question`、抽出候補、元ファイル、学習履歴の依存関係を判断する前提にしない。

削除前には、影響範囲を短く表示する。

```text
この取り込みを削除します。
未使用の問題・候補・元ファイルは削除されます。
すでに学習で使われた問題は、今後出題せず集計から外します。
この操作は戻せません。
```

削除時の扱い:

- SourceDocument に保存した元 PDF・画像・テキストは削除する
- ExtractionArtifact、ImportRun、未昇格候補は削除する
- 未出題の draft / 承認済み Question は物理削除できる
- 出題済み Question は物理削除せず、`invalidated` にして統計から除外する
- 作り直す場合は、旧 Question を復活させず新しい Question ID を発行する
- 削除後も、利用者が同じファイルを再選択すれば再取り込みできる

これは「履歴だけを隠す」機能ではない。間違って取り込んだ教材や、出したくない教材を整理する操作なので、元ファイルと抽出結果も連動して扱う。

批判的に確認する点:

- 「削除」と表示しても、出題済み Question は内部的に残るため、UI 文言で `今後出題せず集計から外す` と明示する必要がある
- 物理削除できる範囲を広げすぎると、過去の学習イベントが参照不能になる
- 逆に論理削除だけに寄せすぎると、誤取り込みや個人情報混入時に利用者の期待とずれる

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

## 10.1 問題画像と解答画像が両方ある教材の取り込み

PDF 問題集には、問題ページとは別に解答ページまたは解答欄画像が含まれる場合がある。
この場合、取り込みでは問題だけを候補化せず、解答側も同じ SourceDocument 由来の抽出成果物として扱う。

基本方針:

- 問題領域と解答領域は、どちらもページ画像上の region と OCR テキストを持つ
- 問題候補と解答候補は、最初は別々に抽出する
- 問題と解答の対応は、確定情報ではなく `answerLinkCandidate` として信頼度付きで作る
- 保護者レビューでは、問題画像、問題 OCR、解答画像、解答 OCR、推定正答を横に並べて確認できるようにする
- 対応付けが未確認の問題は、原本画像を表示できても自動採点へ使わない

抽出結果の中間モデルでは、従来の `candidates` を問題候補として維持し、追加で次を持つ。

```json
{
  "answerCandidates": [
    {
      "answerCandidateId": "a-001",
      "page": 12,
      "itemLabel": "1",
      "region": { "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.05 },
      "regionImagePath": "content/extractions/.../answers/a-001.png",
      "ocrText": "1. 画",
      "confidence": 0.82
    }
  ],
  "answerLinks": [
    {
      "candidateId": "q-001",
      "answerCandidateId": "a-001",
      "matchReason": ["item-label", "sequence-order", "ocr-answer-token"],
      "confidence": 0.78,
      "reviewStatus": "draft"
    }
  ]
}
```

対応付けの推定には、複数の弱い根拠を組み合わせる。

| 根拠 | 例 | 注意点 |
|---|---|---|
| 問題番号 | `1`, `(1)`, `①`, `問1` が一致 | OCR が番号を落とすことがある |
| 並び順 | 問題 1 番目と解答 1 番目 | ページをまたぐ時やまとめ解答で崩れる |
| 見出し | `答え`, `解答`, `解` 以降のページを解答側とみなす | 本文中の語と誤認する可能性がある |
| OCR テキスト | 問題が漢字読みなら、解答側のかな・漢字を正答候補にする | OCR 補正が自然な誤答を作る危険がある |
| レイアウト | 右端や下段など、教材ごとの解答欄位置 | 教材ごとの規則に依存する |

解答部分の推測は、最終正答ではなく `suggestedAnswer` として扱う。
`suggestedAnswer` には、解答 OCR 由来の候補、問題 OCR から推測した候補、AI 補助で整形した候補を分けて保存する。

```json
{
  "suggestedAnswer": {
    "value": "画",
    "source": "answer-ocr",
    "confidence": 0.82,
    "alternatives": [
      { "value": "が", "source": "question-ocr-inference", "confidence": 0.55 }
    ]
  }
}
```

レビュー UI は、対応付けの正しさを人が見て判断しやすいことを最優先にする。
問題画像と解答画像が離れている教材では、人間でも誤判定しやすいため、単に候補一覧を表示するだけでは不十分である。

最低限必要な表示:

- 問題画像と解答画像を左右に並べて同時表示する
- 問題番号、解答番号、ページ番号、候補順位を常に見える位置に置く
- 問題 OCR と解答 OCR を、それぞれ画像の近くに表示する
- 対応候補が複数ある場合は、右側の解答候補だけを前後に切り替えられるようにする
- 画像上の対応領域を枠線で強調し、現在確認している範囲を迷わせない
- 承認操作は、問題画像と解答画像が同時に見えている状態でのみ行えるようにする

あるとよい表示:

- OCR から推定した答えを、解答画像の近くに小さく表示する
- 問題番号一致、並び順一致、OCR 推定一致など、紐づけ根拠を短いラベルで表示する
- 信頼度が低い場合は「要確認」を明示し、自動承認候補にしない
- ページ全体表示と切り出し表示を切り替えられるようにする
- 見比べ中にスクロール位置がずれないよう、左右ペインを固定または同期する

保護者が承認した時点で Question JSON の正答欄へ反映する。
ただし、承認は「問題と解答の対応付け」と「正答値」の両方を確認したものとして記録する。

### 10.2 QuestionSet への昇格

取り込みレビューで承認した単位は、必ずしも 1 Question に対応させない。1つの問題画像または問題領域に複数の小問が含まれる場合は、画像を QuestionSet の素材として保持し、その中に複数の Question を作る。

基本形:

- 問題画像・回答画像は QuestionSet に紐づける
- Question は QuestionSet 内の最小回答単位として作る
- QuestionSet の `items` は初期版では `question_id`、`label`、`order` のみを持つ
- 小問ごとの画像座標は初期版では必須にしない
- 必要になったら `region_hint` を追加する

```yaml
question_set:
  id: set-kanji-001
  question_materials:
    - type: source-region
      document_id: worksheet-kanji-001
      page: 2
      region: { x: 0.05, y: 0.10, width: 0.90, height: 0.35 }
  answer_materials:
    - type: source-region
      document_id: worksheet-kanji-001
      page: 8
      region: { x: 0.05, y: 0.12, width: 0.90, height: 0.25 }
  items:
    - question_id: q-kanji-001
      label: "問1"
      order: 1
    - question_id: q-kanji-002
      label: "問2"
      order: 2
```

この方針では、現在の「1候補を1 Question に昇格する」操作は、単問の QuestionSet を作る特殊ケースとして扱う。複数回答が必要な場合は、同じ QuestionSet に複数 Question を追加する。

回答側も単一の `answer` だけに固定しない。回答画像や模範解答ページのような表示素材は QuestionSet の `answer_materials` に置き、各 Question の採点に必要な期待回答は Question 側に持たせる。これにより、1枚の解答画像に複数の答えが載っている教材を扱える。

### 10.3 回答テキストの分割とハーネス

QuestionSet へ昇格する画面では、回答欄の textarea を残す。OCR や手入力の解答テキストをまず textarea に置き、そこから回答スロット候補を作る。

```text
解答OCR / 貼り付け textarea

1. ( 90° )
2. ( 20° )
3. ( 40° )
4. ( 80° )
5. ( 60° )
6. ( 170° )

  → 回答を分割

問1  [90°]
問2  [20°]
問3  [40°]
問4  [80°]
問5  [60°]
問6  [170°]
```

初期 UI では次を用意する。

- 回答OCR / 貼り付け用 textarea
- `回答を分割` ボタン
- `AIで分割候補を作る` ボタン
- QuestionSet の `items` に対応する回答スロット一覧
- 分割できなかったテキストを残す未割り当て欄
- 保護者が各スロットを直接編集できる入力欄

回答スロットの数は、解答OCRから推測した個数ではなく、QuestionSet 側の小問数を基本にする。解答側の OCR は余計な行、解説、ページ番号を拾いやすいため、解答側を正として Question 数まで作ると壊れやすい。

処理は二段構えにする。

1. ローカルの軽量ルールで番号付き回答を即時分割する
2. 失敗または曖昧な場合だけ AI に分割候補を作らせる

ローカルルールで扱う初期パターン:

- `1. ( 90° )`
- `1 (90°)`
- `(1) 90°`
- `① 90°`

ローカルルールは、番号、括弧、余分な空白を剥がし、純粋な答えを候補にする。複数行の説明、横並び OCR、解説文混入などを完全に解く必要はない。分割に失敗した部分は未割り当てテキストとして残し、人が修正できるようにする。

AI 分割は、OCR テキスト、問題側 OCR、QuestionSet の小問ラベルと期待個数、必要なら回答画像の参照情報を入力し、構造化された候補を返す。

```json
{
  "items": [
    { "label": "問1", "value": "90°", "confidence": 0.94 },
    { "label": "問2", "value": "20°", "confidence": 0.91 }
  ],
  "unassignedText": "",
  "warnings": []
}
```

AI の提案は確定情報ではない。保護者が確認・修正した結果を最終値とし、AI 提案との差分をローカルハーネスへ記録する。

ハーネスへ記録する内容:

- 入力 OCR テキスト
- 問題側 OCR テキスト
- QuestionSet の小問数とラベル
- ローカルルールの分割結果
- AI の分割候補
- 保護者が修正した最終 `answerItems`
- 使用したルール、AI モデル、プロンプトバージョン
- 成功、修正あり、失敗の分類
- 修正理由または警告

```yaml
answer_split_case:
  id: split-case-001
  source_document_id: worksheet-angle-001
  question_set_id: set-angle-001
  input_text: |
    1. ( 90° )
    2. ( 20° )
  expected_item_count: 2
  rule_output:
    - label: "問1"
      value: "90°"
      confidence: 0.99
  ai_output:
    - label: "問1"
      value: "90°"
      confidence: 0.94
  final_items:
    - label: "問1"
      value: "90°"
    - label: "問2"
      value: "20°"
  status: corrected # accepted / corrected / failed
```

同じ教材形式で修正が少ないことが確認できた場合は、自動分割の信頼度を上げられる。ただし、AI 分割だけで自動承認するかは別判断とし、初期版では保護者確認を前提にする。

批判的に確認する点:

- Question ごとに画像を細かく紐づけると、1枚に10問ある教材で10個の領域管理が必要になり、入力負担が大きい
- 一方で QuestionSet に画像を寄せすぎると、問3だけの位置を強調したい場面では情報が足りない可能性がある
- 初期版は `label` と `order` で運用し、必要性が見えてから `region_hint` を追加する
- 「どんな OCR でも分ける」ことを目標にすると、取り込み機能が過剰に複雑になる
- ハーネスを作らず AI に任せるだけでは、もっともらしい誤分割を検出しにくい

### 10.4 客観的なリスク

- 解答ページの番号と問題ページの番号が一致しても、章・ページ単位がずれていれば誤対応する
- OCR と AI 推測を重ねると、もっともらしいが原本と違う正答を作る可能性がある
- 画像表示は確認には強いが、採点可能な正答定義とは別物である
- 実教材の問題画像・解答画像は著作権を含むため、DATA_DIR 外へ出さない

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
Stage 3: AI-OCR による自動・手動読み直し（保護者確認前）
Stage 4: 保護者による確認、修正、Question JSON へ昇格
```

Stage 0 は本体（Rust）が担う。Stage 1–2 は C# + Tesseract のローカル OCR ワーカー
（[`tools/ocr-worker`](../../tools/ocr-worker)）として実装済みで、保存済み PDF を PDFium で
ページ画像化し、画像も含めて Tesseract で日本語 OCR を行い、問題番号マーカーで候補へ分割する。
UTF-8 テキストは OCR を通さず draft 候補にする。出力は
確認用の中間成果物（`extraction-result.json`、初期値 `reviewStatus: draft`）である。

取り込み開始時に、保護者は「通常 OCR」または「複雑なレイアウト向け AI-OCR」を選択できる。
AI-OCR を初期から選択した場合、ローカル OCR の代わりに（または併用して）高精度の領域抽出とテキスト認識を行う。

Stage 3（AI-OCR 補正）は、通常のローカル OCR を選択した場合でも、結果が不十分な箇所を保護者確認前に補正する。UI 上の出現ポイントは以下の 2 つである：
- 取り込み開始時: 「複雑なレイアウト向け AI-OCR」を選択し、全編または難しいページへ自動で適用する。
- OCR 候補レビュー時: 低信頼度候補に対して手動で「AI で読み直す」を実行する。

自動フォールバック条件の例：
- `candidate.confidence` が閾値未満
- OCR テキストが空、短すぎる、文字化けしている
- 問題番号や解答欄の構造を認識できない
- 領域再指定後も信頼度が改善しない

Stage 4（保護者確認）では、AI 補正後も含めた候補の確認を行う。OCR 本文を修正し、候補を `adult-approved` または `suspended` にできる。
この承認は OCR 候補の確認であり、答えと単元を設定して Question JSON にするまでは出題しない。
初期 UI では、承認済み候補だけを対象に、教科、単元、問題種別、答えを確認して
`<DATA_DIR>/content/questions/*.json` へ昇格する。`Question ID`、`unitId`、`skillIds` のような内部 ID は
通常の利用者へ自由入力させない。単元は表示名から選択し、`unitId` はシステムが解決する。
Skill は単元に登録済みの候補から自動付与するか、必要な場合だけ表示名から選択する。
適切な Skill が存在しない場合に、利用者へ新しい Skill ID の命名を求めない。

AI 補助（Stage 3）は既定でオフにする。利用者が有効化した場合も、次の順序で利用する。

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

取り込み時に OCR が `1. ( 90° )` のように問題番号や括弧を含んで読み取った場合でも、正規化パイプライン（テンプレート抽出またはプレフィックス除去）を通し、純粋な解答である `90°` のみを `value` や `text_value` として保存する。これにより、UI での入力と完全一致比較しやすくなる。

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

問題種別は、JSON・API 内では `questionType` の安定した英字値を保持する。一方、利用者向け UI では
日本語ラベルを主表示し、内部値も確認できるよう `数値回答（numeric）` のように二重表記する。
英字値だけを表示したり、利用者へ値を手入力させたりしない。

| `questionType` | 利用者向け表示 |
| --- | --- |
| `numeric` | 数値回答（numeric） |
| `kanji` | 漢字（kanji） |
| `multiple-choice` | 選択式（multiple-choice） |
| `word-problem` | 文章題（word-problem） |
| `free-text` | 自由記述（free-text） |
| `handwriting` | 手書き回答（handwriting） |
| `speech` | 音声回答（speech） |

Skill は習熟度推定や出題選定に使う内部分類であり、利用者向け UI では `skillIds` を直接表示・入力させない。
表示が必要な場合は Skill の日本語名を使い、詳細情報としてのみ内部 ID を確認できるようにする。

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

SourceDocument の削除はアプリ上の操作に限定し、利用者向けには **削除する / 何もしない** の二択にする。削除理由ごとに細かい選択肢を出すと、保護者が依存関係を判断する必要が出て混乱しやすい。

削除時は、影響範囲を短く表示したうえで、この取り込みに由来する元ファイル、抽出成果物、未使用の候補・問題をまとめて削除する。すでに学習で使われた Question は物理削除せず、`invalidated` にして今後出題せず、統計から除外する。

教材コンテンツを完全削除した場合は、過去イベント内の問題文、問題画像、回答画像、教材由来の回答テキストも削除し、日時、所要時間、当時の判定状態、集計対象外になった事実だけを残す。

物理削除後は、内部 ID、教材種別、削除状態だけを残し、元ファイル名や詳細出典を削除可能にする。

## 15. 初期実装範囲と将来拡張

### 15.1 初期実装で優先する

- SourceDocument、SourceItem、比率座標の領域
- 問題側 SourceItem と回答側 SourceItem の単純な `answer-for` Mapping
- 原本画像を primary とする Question
- 回答画像と任意の回答テキスト
- textarea から回答スロットを作る最小分割 UI
- 回答分割の入力、提案、保護者修正結果のハーネス記録
- 個別承認と一括承認
- `adult-approved` と `suspended`
- 問題と回答を並べるレビュー UI

### 15.2 方針として残し、必要性を見て追加する

- AI-OCR による `ai-provisional` 出題
- ImportProfile 単位の品質停止
- AI による回答分割候補の精度改善
- 複数 ExtractionArtifact の比較と合成
- normalized 表示と原本表示の切り替え
- SourceDocument の論理削除、復元期間、完全削除
- AI 採点評価ハーネスとの連携

### 15.3 批判的に確認する点

- 未確認問題を出題できるようにすると、承認待ちの負担は減るが、子どもが品質確認役になる危険がある
- 原本画像を安全弁にしても、問題と回答の対応付けが誤っていれば誤学習を防げない
- エンティティを増やしすぎると初期 PoC の実装が重くなるため、SourceItemMapping は単純な関係から始める
- 教材削除を厳密に行うには、イベントやレポートへ教材内容を複製しすぎない設計が必要になる
