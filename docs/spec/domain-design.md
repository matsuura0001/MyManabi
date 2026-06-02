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

通常経路では、過去に確認済みの問題バンクから出題する。画面表示時に AI の応答を待たない。

```text
Obsidian の教材索引
  → 教科、単元、Skill、関連教材から対象 ID を絞る
  → 学習者状態と重みで出題選定
  → 必要な確認済み Question JSON を読む
  → 学習者別の待機列
  → 即時表示
  → 回答イベント
  → 学習者状態を更新
  → 待機列を補充
```

Question JSON 全件を出題のたびに読み込まない。Obsidian Vault のノートと frontmatter を起動時または更新時に軽量な教材索引へ変換し、絞り込みへ使う。索引の具体形式とキャッシュ更新方式は、取り込み運用を試してから決める。

バックグラウンドでは、AI が新しい問題候補を少数補充する。候補は、自動検証または大人の確認を通った後に問題バンクへ追加する。

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
- 異議が付いた問題は候補から除外される
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
