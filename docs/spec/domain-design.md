# 出題選定・評価・保護者関与のドメイン設計

## 1. 位置づけ

本書は、MyManabi の出題選定を改善可能にするための中核ドメインを定義する。

初期 PoC では、精巧な教育アルゴリズムを完成させることを目標にしない。単純な基準線から始め、出題理由と結果を観測し、以前の方式と比較しながら少しずつ改善できる構造を作る。

## 2. 設計原則

- 子どもへ最初の問題を速やかに表示する
- 問題生成、出題選定、回答記録、効果測定を分離する
- 問題固有の属性と、学習者ごとに変化する状態を分離する
- 時間経過だけを理由に全件更新するバッチ処理は必須にしない
- 重み付けの計算結果だけでなく、内訳と選定理由を記録する
- 改善後も基準線と旧バージョンを残し、悪化を検出できるようにする
- `N = 1` の観測値は断定ではなく、改善方向を考えるための方位磁石として扱う

## 3. 責務境界

### 3.1 本アプリ

Rust + Tauri アプリが次を担う。

- DATA_DIR の読み書き
- 学習フロー制御
- 出題選定と待機列
- 回答イベントの記録
- 決定論的に判定できる問題の採点
- レポートと公開用統計の生成

### 3.2 codex app-server

codex app-server は AI バックエンドとして次に利用する。

- 新しい問題候補の生成
- 解説と補足説明
- 決定論的に判定できない回答の採点候補
- 大人向け分析文の生成候補

利用可能なモデルは app-server の `model/list` から取得する。初期 PoC では picker-visible な `mini` 系を優先して一つ選び、利用可能な間は維持する。利用不能になった場合だけ再選択し、変更日をローカルへ記録する。

モデル名は画面へ出さない。モデルルーターや処理ごとの自動昇格は、品質不足が観測されるまで追加しない。

## 4. 問題の準備と即時応答

通常経路では、過去に確認済みの問題バンクから出題する。画面表示時に AI の応答を待たない。教材取り込みで原本画像へ切り替えられる `ai-provisional` 問題を通常学習へ使う場合も、待機列へ事前に積み、出題時に AI-OCR を待たない。

```text
Obsidian の教材索引
  → 教科、単元、Skill、関連教材から対象 ID を絞る
  → 学習者状態と重みで出題選定
  → 必要な出題可能 Question JSON を読む
  → 学習者別の待機列
  → 即時表示
  → 回答イベント
  → 学習者状態を更新
  → 待機列を補充
```

Question JSON 全件を出題のたびに読み込まない。Obsidian Vault のノートと frontmatter を起動時または更新時に軽量な教材索引へ変換し、絞り込みへ使う。索引の具体形式とキャッシュ更新方式は、取り込み運用を試してから決める。

バックグラウンドでは、AI が新しい問題候補を少数補充する。候補は、自動検証、大人の確認、または原本画像へ切り替えられる暫定出題条件を通った後に問題バンクへ追加する。

問題プールが不足した場合に限り、単純な問題をローカル生成して緊急利用する案を残す。ただし、測定用問題と混ぜず、練習用として区別する。この経路を初期 PoC へ含めるかは保留する。

## 5. 中核エンティティ

### 5.1 Skill

学習内容の単位。単元より細かい前提関係や、つまずきの遡及に使う。

```yaml
skill:
  id: fraction-addition-same-denominator
  unit_id: fraction-addition
  name: 同分母のたし算
  prerequisite_skill_ids:
    - fraction-denominator
```

初期 PoC では、一単元を扱うために必要な最小限の Skill だけを登録する。

### 5.2 Question

問題そのもの。学習者によらない安定した属性を持つ。

初期 PoC では、`<DATA_DIR>/content/questions/*.json` から出題可能な問題だけを読み込む。公開用の合成例と形式定義は [`examples/data-dir/content/questions`](../../examples/data-dir/content/questions) と [`schemas/question.schema.json`](../../schemas/question.schema.json) を参照。

```yaml
question:
  id: q-001
  skill_ids:
    - fraction-addition-same-denominator
  difficulty_band: basic
  question_type: numeric
  grading: deterministic
  source:
    type: ai-generated
    template_id: same-denominator-basic
  review_status: auto-approved
  purposes:
    - learning
    - review
  assessment:
    equivalence_group_id: fraction-addition-basic-001
    relation: isomorphic
```

評価用途は別フォルダではなく Question Entity の属性として持つ。学習、復習、測定を同じ問題へ付与できるが、実際にどの用途で出題したかは SelectionDecision と回答イベントへ記録する。

### 5.3 LearnerSkillState

学習者と Skill の関係。習熟と忘却の推定を保持する。

```yaml
learner_skill_state:
  learner_id: learner-a
  skill_id: fraction-addition-same-denominator
  attempts: 8
  correct_count: 6
  last_reviewed_at: 2026-06-01T09:00:00+09:00
  learning_curve:
    type: power
    initial_value: 1.0
    exponent: -0.25
  forgetting_curve:
    type: power
    initial_retention: 1.0
    decay_rate: 0.35
```

### 5.4 LearnerQuestionState

学習者と個別問題の関係。同一問題の暗記、直近出題、異議、出題停止を扱う。

```yaml
learner_question_state:
  learner_id: learner-a
  question_id: q-001
  attempts: 2
  last_presented_at: 2026-05-20T09:00:00+09:00
  disputed_count: 0
  status: active
```

Skill 単位を基本にしつつ、教科書例題、漢字、英単語、過去問などは問題単位の追跡を強められるようにする。

## 6. 値オブジェクト

### 6.1 LearningCurve

反復に伴う変化を推定する。初期候補として冪関数を使う。

```text
Y = a * X^b
```

- `X`: Skill へ取り組んだ回数
- `Y`: 推定値
- `a`: 初期値
- `b`: 習熟速度

初期 PoC の少量データで係数を精密に推定しない。共通の仮値から始め、式と係数を差し替えられるようにする。

### 6.2 ForgettingCurve

時間経過に伴う保持率を推定する。初期候補として冪関数を使う。

```text
R(t) = a * (t + 1)^(-b)
```

- `t`: 最終確認からの経過時間
- `R(t)`: 推定保持率
- `a`: 初期保持率
- `b`: 忘却速度

指数関数モデルなど、別の式と比較できる構造にする。特定の式を普遍則として固定しない。

### 6.3 AgingWeight

基準値、基準日時、増加率、上限を保持し、アクセス時に現在値を計算する。

```yaml
aging_weight:
  base_value: 20
  evaluated_at: 2026-05-20T09:00:00+09:00
  growth_per_day: 3
  max_value: 60
```

時間経過だけを理由に永続化データを毎日更新しない。

### 6.4 PriorityEvaluation

出題優先度と内訳を返す。選定理由を説明可能にする。

```yaml
priority_evaluation:
  total: 72
  evaluated_at: 2026-06-02T09:00:00+09:00
  contributions:
    progress: 20
    review_urgency: 35
    recent_mistake: 25
    repetition_penalty: -8
```

初期 PoC の式は仮説である。重みの種類を増やしすぎず、テストと観測結果を基に改善する。

## 7. 出題方針と選定記録

### 7.1 LearningPattern

保護者が選べる名前付きの出題方針。比較可能性を保つため、バージョンを固定する。

```yaml
learning_pattern:
  id: textbook-order
  version: 1
```

初期候補:

| ID | 内容 |
|---|---|
| `textbook-order-v1` | 教科書順。重み付け改善との比較基準 |
| `review-mix-v1` | 新規問題へ復習問題を混ぜる |
| `forgetting-curve-v1` | 忘却曲線から復習優先度を計算する |
| `weak-skill-focus-v1` | つまずいた Skill を重点的に確認する |

初期 PoC では `textbook-order-v1` を必ず残す。係数を変更した場合は、同じ ID の値を上書きせず新しいバージョンにする。

### 7.2 SelectionDecision

実際に選んだ問題と理由を記録する。

```yaml
selection_decision:
  pattern_id: forgetting-curve
  pattern_version: 1
  selected_question_id: q-001
  selected_at: 2026-06-02T09:00:00+09:00
  reason: spaced-review-due
  priority_snapshot:
    total: 72
    review_urgency: 35
    recent_mistake: 25
```

### 7.3 QuestionQueueItem

即時応答用の待機列。優先度は計算時点のスナップショットとして持つ。

```yaml
question_queue_item:
  learner_id: learner-a
  question_id: q-001
  priority_snapshot: 72
  calculated_at: 2026-06-02T08:55:00+09:00
  expires_at: 2026-06-02T12:55:00+09:00
```

## 8. 評価プロトコル

### 8.1 目的

初期 PoC の評価値は、学習者の能力や手法の一般的有効性を断定するために使わない。改善方向を考え、悪化を検出し、旧方式へ戻せるようにするための方位磁石として扱う。

通常学習中の正答率だけでは比較しない。簡単な問題を多く出す方式ほど有利になるためである。

### 8.2 評価問題

評価問題は通常学習用の問題と分け、条件を可能な範囲で揃える。

| 種類 | 目的 |
|---|---|
| 同一問題 | 同じ内容を保持できたか |
| 同型問題 | Skill を理解し、数値や表現が変わっても解けるか |
| 応用問題 | 少し異なる条件でも使えるか |

```yaml
assessment_item:
  id: assess-fraction-001-b
  skill_id: fraction-addition-same-denominator
  equivalence_group_id: fraction-addition-basic-001
  relation: isomorphic
  difficulty_band: basic
```

初期 PoC では `1 日後` と `7 日後` の遅延テストを候補とする。主指標は `7 日後の同型問題正答率` とする。

### 8.3 補助指標

- 同一問題の正答率
- 回答時間
- `分からない` の割合
- `納得できない` の割合
- 学習継続率
- 最初の問題が表示されるまでの時間
- 大人による確認件数

## 9. 公開用統計

保護者が任意で、学習手法の改善へ役立てるための集計結果を共有できるようにする。個別の学習イベントとは分離する。

```yaml
schema_version: 1
learning_pattern:
  id: forgetting-curve
  version: 1
conditions:
  field: fraction-addition
  observation_days: 14
  delayed_test_days: 7
  evaluation_set_version: 1
sample:
  learner_count: 1
  learning_questions: 42
  evaluation_questions: 12
results:
  delayed_isomorphic_correct_rate: 0.67
  immediate_correct_rate: 0.71
  incorrect_rate: 0.19
  did_not_know_rate: 0.10
```

標準の公開用統計には、氏名、学習者 ID、年齢、学年、実施日、問題文、個別回答、回答順序、画像、音声を含めない。

学年帯などを分析軸として追加する場合は、保護者へ公開項目を明示し、任意項目として扱う。初期 PoC では収集しない。

GitHub への自動投稿は初期要件にしない。公開用ファイルをローカル生成し、保護者が内容を確認した後に手動で共有できればよい。

## 10. 保護者の関与

### 10.1 ParentSuggestion

保護者は、子どもに解いてほしい問題や Skill を少数提案できる。個別 Question ID のほか、Obsidian の単元ノート、Skill ノート、PDF 問題集ノートを入口として対象集合を指定できる。通常の重み付けとは別の出題依頼として記録する。

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

Obsidian ノートは対象集合を表す。依頼の対象学習者、件数、期限、完了状態は ParentSuggestion Entity が保持する。

### 10.2 ChildResponse

子どもは保護者指定問題に対して意思表示できる。

```text
やってみる
あとでやる
今は解きたくない
この種類の問題は減らしてほしい
```

子どもの意思表示を保護者向けレポートへ載せる。自動的に出題禁止へせず、親子の会話へ渡す。繰り返し `減らしてほしい` が付いた問題形式を追加する場合は、保護者へ注意を表示する。

介入強度を複雑な設定として持たない。一定期間に提示された保護者指定問題の件数、頻度、完了数、延期数、辞退数、`減らしてほしい` の件数から、実際の介入を観測する。

## 11. 将来課題

### 11.1 親子メッセージ

AI と切り離した短いメッセージ交換を将来候補とする。

- 保護者からの短文やスタンプ
- 子どもからの短い返信
- 保護者指定問題への返信
- クラウド同期

同期方式は未決定とする。Google Sheets、Google Drive、小規模なクラウド DB、専用 API などを候補に残す。初期 PoC では実装しない。

## 12. テストの中心

値オブジェクトと選定方針は、今後の改善の中心となる。

- 同じ入力と時刻なら、同じ優先度になる
- 時刻を外から渡して固定できる
- 時間が経過すると復習優先度が増える
- 優先度が上限を超えない
- 出題直後は再出題されにくい
- 問題不備の報告が付いた問題は候補から除外される
- AI 採点への異議だけでは問題が候補から除外されない
- 同じ問題ばかりが続かない
- 優先度の内訳と選定理由を説明できる
- 基準線と新しい方針を同じ評価プロトコルで比較できる

## 13. 保留事項

- 初期 PoC で採用する Skill の具体的な粒度
- LearningCurve と ForgettingCurve の初期係数
- 復習問題を混ぜる初期割合
- 待機列の件数と有効期限
- 問題プール枯渇時にローカル生成を使うか
- 公開用統計のリポジトリ構成とスキーマ
- 保護者指定問題を学習開始時にどう提示するか

## 14. 現在の実装との突き合わせ

`app/` には、Tauri アプリから codex app-server を子プロセスとして起動し、認証確認と一問生成を行う疎通スパイクがある。

### 14.1 整合している点

- Rust + Tauri + React を使う
- codex app-server を JSON-RPC over stdio で駆動する
- ChatGPT アカウントの認証状態とプランを確認する
- AI の問題生成が家庭内 PoC で成立するか試せる

### 14.2 スパイクのままでよい点

現在のスパイクは、接続ごとに app-server を起動し、一問生成後に終了する。通知も、一回のテキスト生成に必要なものだけを処理する。

これは接続確認としては妥当である。本実装では、長寿命の app-server 接続、スレッド再利用、ストリーミング、失敗時の復旧を別の縦切りで追加する。

### 14.3 本設計に向けて追加する点

| 項目 | 現状 | 本設計で必要なこと |
|---|---|---|
| 最初の問題 | AI 生成を待つ | 確認済み問題バンクと待機列から即時表示する |
| モデル選択 | app-server の既定値に任せる | `model/list` から軽量モデルを初回選択し、利用不能時だけ再選択する |
| 学習状態 | 未実装 | Skill、問題、学習者別状態を DATA_DIR へ保存する |
| 出題理由 | 未実装 | LearningPattern と SelectionDecision を記録する |
| 効果測定 | 未実装 | 遅延テストと公開用統計を生成する |
| 保護者関与 | 未実装 | ParentSuggestion と ChildResponse を記録する |

ルート直下の `src/generate-daily-report.mjs` は、イベント形式とレポート内容を確認するための先行 PoC として扱う。Tauri アプリへ統合する際は、同じ振る舞いを Rust 側へ移すか、独立した検証用 CLI として残すかを決める。

## 15. 問題の表示、停止、リビジョン

### 15.1 表示バリエーション

同じ問題内容を表す原本画像版と normalized 版は、別 Question にせず、同じ Question ID の表示バリエーションとして持つ。子どもは表示を切り替えられ、回答イベントには実際に見た表示方式と切り替え履歴を記録する。

```yaml
presentation_used:
  type: source-item
  source_item_id: worksheet-001-item-003
  condition: prior-response-visible
```

過去の誤答が見える画像も、通常学習、復習、実力確認へ利用できる。ただし、ヒントになる場合と過去の失敗へ引っ張られる場合の両方があるため、結果を自動補正せず提示条件として記録する。

表示切り替えは取り込み不備の兆候になり得るが、単に原本の方が好みの場合もある。切り替えだけでは問題を停止せず、`表示がおかしい` または統合入口の `おかしい・納得できない` が押された場合だけ大人の確認へ送る。

### 15.2 Question revision

問題内容と正答が同一のまま、表示、表記、許容する正答範囲、採点規則を修正する場合は、Question ID を維持して revision を増やす。

```yaml
question:
  id: q-001
  revision: 2
  review_status: adult-approved
```

回答イベントには出題時の Question revision と表示参照先を記録する。教材コンテンツが削除されていない限り、旧 revision を保持し、過去結果では当時の表示内容を再現する。

問題の意味、正答そのもの、要求する回答が変わる場合は、新しい Question ID を発行する。

### 15.3 停止と無効化

状態を次のように分ける。

| 状態 | 意味 |
| --- | --- |
| `active` | 出題可能 |
| `suspended` | 確認・修正のため一時停止 |
| `invalidated` | 問題として成立しないことが確認され、復活させない |

子どもが問題不備を報告した場合は、その指摘が正しいと確定する前でも Question を即時停止する。つまずいたまま再出題する価値が低く、誤った問題を繰り返す損失が大きいためである。

大人が問題文、正答、問題と回答の対応付けなどの不備を確認した場合は、Question を `invalidated` にする。無効化された問題は復活させず、修正版が必要なら新しい Question ID で作る。

無効化された元問題から、正誤、問題別回答回数、習熟度への寄与は引き継がない。教材内の並びや、同じ Skill を最近表示した時刻だけは、連続出題を避けるために利用できる。

教材内の並びは Question ではなく、教材索引側の `ContentSequence` で管理する。修正版を作る場合も、問題同士を直接関連付けず、必要なら同じ教材位置へ置く。

### 15.4 分類不整合

単元・Skill の分類不整合は、表示不備のように子どもが確実に判別できるものではない。大人、子ども、AI、回答傾向などから不整合が報告されても、報告時点では誤りと確定しない。

```text
通常学習
  → 出題を継続
  → 該当 Skill の理解度集計は確認まで保留

測定テスト
  → 確認まで出題候補から除外
```

大人が分類誤りを確認した場合は、分類を修正して Question revision を増やし、再承認する。

## 16. 通常学習と測定テスト

### 16.1 通常学習

通常学習は、一問ごとのフィードバックと学び直しを重視する。

```text
問題へ回答
  → 採点結果を表示
  → もう一度考える
  → 答えを見る
  → なぜ違うか説明して
  → おかしい・納得できない
```

`答えを見る` は失敗ではなく学習行動として記録する。一度答えを見た後の解き直し結果は理解の手がかりになるが、未提示状態の正答率や評価結果へ混ぜない。

### 16.2 測定テスト

測定テストは通常学習の一問ずつのフローをそのまま流用しない。

```text
複数問題をまとめて提示
  → 必要に応じて制限時間を設定
  → 回答中は正誤・答え・解説を表示しない
  → 終了後に結果一覧を表示
  → 子どもが気になる問題を選んで振り返る
```

結果一覧から、自分の回答、模範解答、解説、解き直しを問題ごとに開けるようにする。答えを見ずにもう一度考えたい子の機会を残しつつ、終了後には振り返れるようにする。

表示バリエーションは測定中も切り替え可能とする。不備への気づきを優先し、実際に見た表示方式と切り替え履歴を記録する。

`ai-provisional`、分類不整合の確認待ち、未確認 rubric の問題は測定テストへ使わない。

### 16.3 表示不備の報告と集計保留

子ども向けには `おかしい・納得できない` を一つの入口にし、原因分類は任意にする。

```text
おかしい・納得できない
  → 私の答えも合っていると思う
  → 模範解答がおかしいと思う
  → 問題文や画像がおかしい
  → よく分からない
```

報告は Question 単位で受け取り、大人の確認時に Question、SourceItem、回答対応付け、分類などの原因を分類する。SourceItem 起因と判明した場合は、それを参照する Question をまとめて停止する。

報告された回答イベントは保存するが、大人の確認が終わるまで理解度・テスト集計から保留する。

## 17. 採点判断と異議

### 17.1 採点方式

決定論的に比較できる回答テキストや選択肢は、本アプリで採点する。回答画像は模範表示や確認材料として使い、画像だけを根拠に毎回 AI 採点しない。

英作文の筆記、自由記述、手書きなど、決定論的に判定できない問題は AI 採点を許可する。

```yaml
grading:
  method: ai-assisted
  input: handwriting-image
  rubric_id: english-writing-basic-v1
```

問題原本は確認できても、AI-OCR が抽出した正答だけが未確認の場合は出題可能とする。ただし、自動採点せず、子どもには正誤や未確認の模範解答を表示せず、`答えを確認中` として次へ進める。

### 17.2 AI 採点と採点保留

AI が回答内容を読み取り、判定できる場合は、通常学習では暫定的な正誤をその場で表示する。測定テストでは終了後にまとめて表示する。

```yaml
grading_result:
  verdict: incorrect
  authority: ai
  status: provisional
```

画像欠損、読み取り不能など、回答内容自体を評価できない場合は、無理に不正解とせず採点保留にする。

### 17.3 AI 採点への異議

AI 採点結果の近くに `AI 採点に不服` を専用で置く。これは問題不備の報告とは分けて記録する。

```yaml
grading_dispute:
  grading_result_id: grade-001
  reason: learner-disagrees
  status: pending-parent-review
```

AI 採点への異議は、個別回答の読み取りや評価の問題である可能性が高いため、Question は停止せず、その採点結果だけを保留する。同じ Question や rubric で覆りが繰り返される場合に、採点方式の停止や改善を検討する。

選択式や完全一致など決定論的に採点できる問題では、通常 `AI 採点に不服` を表示しない。問題、選択肢、正答定義がおかしい場合に備えて、`おかしい・納得できない` は残す。

大人の確認結果に対する再異議フローは作らない。大人との確認後の納得は、親子の直接コミュニケーションで扱い、解決主体のない異議をシステムへ残さない。

### 17.4 部分点と rubric

記述式や英作文では、`correct` / `incorrect` の二値だけでなく、`partially-correct` や部分点を許可する。

```yaml
grading_result:
  verdict: partially-correct
  score:
    earned: 2
    possible: 3
  rubric_results:
    - criterion: claim
      achieved: true
    - criterion: reasoning
      achieved: true
    - criterion: language-accuracy
      achieved: false
```

部分点の基準は問題ごとの rubric として事前に持たせる。AI 採点と大人の再判定は同じ rubric を使う。子ども向けには点数だけでなく、`△` と短い理由を表示できる。

正解率、部分到達率、得点率は分けて集計する。選択式と記述式を単純な正答率だけで比較しない。

未確認 rubric を持つ `ai-provisional` 問題は、通常学習で暫定フィードバックへ使えるが、測定テストや確定的な理解度集計へ使わない。

### 17.5 判断の履歴と再採点

AI 判定と大人の判定は上書きせず両方を保存し、大人の判定を有効な最新判断として扱う。大人の理由入力は任意とし、rubric の選択結果と判定変更を中心に記録する。

```yaml
judgments:
  - id: judgment-ai-001
    authority: ai
    verdict: incorrect
  - id: judgment-parent-001
    authority: parent
    verdict: partially-correct
    supersedes: judgment-ai-001
```

正答範囲を広げるだけの採点規則変更は、同じ Question ID の revision として扱う。旧回答の再採点は自動で行わず、大人が明示的に選んだ場合だけ行う。再採点後の有効判定は理解度集計へ反映し、当時の判定も履歴へ残す。

過去に生成済みの日次・週次レポートは書き換えない。当時の観測記録として残し、現在の結果一覧と今後の集計へ訂正を反映する。

子どもへ突然訂正通知を出す必要はない。過去の結果一覧で該当問題を見た時に、`正解へ訂正` または `問題不備のため集計対象外` と分かるようにする。

## 18. 永続化と集計の責務

### 18.1 SQLite を正本にする

初期アプリでは、学習イベント、採点判断、集計対象外の状態を連動して扱いやすくするため、SQLite を正本にする。JSONL と SQLite の二重管理は、同期や復旧の複雑さが必要になるまで追加しない。

後からイベントストアや別ファイルへ分離できるよう、データの責務を区分する。

```text
content
  → 問題、表示表現、回答表現、取り込み元

learning_event
  → 出題、回答、表示切り替え、問題報告

judgment
  → 採点、保留、訂正、無効化

derived_state
  → 理解度、問題別状態、集計値
```

`learning_event` は原則変更せず、問題の誤りが判明した場合は `judgment` 側で無効化する。`derived_state` は再計算可能な派生データとして扱う。

### 18.2 問題無効化と集計除外

問題の誤りが確認された場合は、Question と関連する採点結果を連動して無効化し、理解度・テスト集計から除外する。

```text
問題の誤りを確認
  → Question を invalidated
  → 関連する judgment を invalidated
  → derived_state を再計算
```

無効化された問題は物理削除しない。過去の結果一覧やレポートとの差を説明するため、提示された事実、日時、当時の判定、無効化理由を残す。

回答イベントには問題文や画像を毎回複製せず、Question ID、revision、実際に使った表示表現への参照を基本として保存する。必要なスナップショットは、教材削除時に連動して削除できる領域へ分離する。

### 18.3 ローカル評価ハーネス

大人が AI 採点を覆した回答は、DATA_DIR 内のローカル評価ハーネス候補へ自動追加できるようにする。実際の評価セット採用は大人が選ぶ。

```yaml
grading_evaluation_case:
  question_id: q-001
  rubric_version: english-writing-basic-v1
  ai_judgment_id: judgment-ai-001
  expected_judgment_id: judgment-parent-001
  status: evaluation-candidate
```

実教材、実回答、手書き画像は著作権や個人情報を含み得るため、ローカル評価ハーネスから外部共有・公開リポジトリへ出さない。公開評価ハーネスには、合成問題、権利上公開可能と確認した問題、合成回答だけを使う。

この評価ハーネスは将来拡張とし、初期 PoC の中心には置かない。

## 19. 追加のテスト観点

- `ai-provisional` は原本画像へ切り替えられない場合に出題されない
- 問題不備の報告で Question が即時停止される
- AI 採点への異議では Question が停止されず、個別 judgment だけが保留になる
- SourceItem 起因の不備で関連 Question がまとめて停止される
- 無効化された Question の judgment が理解度集計から除外される
- Question revision 更新後も、過去結果が当時の表示内容を参照できる
- 正答範囲の拡張による再採点は、大人の明示操作なしに実行されない
- 再採点後の有効判定で derived_state を再計算できる
- 測定テスト中は正誤・答え・解説が表示されない
- 答えを見た後の解き直し結果が、未提示状態の正答率へ混ざらない
