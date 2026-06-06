# 保護者向け問題一覧仕様

## 1. 目的

保護者が、DATA_DIR に登録された Question / QuestionSet を確認し、出題に使える状態か、修正や停止が必要かを判断できる画面を作る。

この画面は「教材取り込み結果を見る画面」ではなく、昇格済みの問題バンクを管理する入口である。PDF OCR、手入力、AI 生成、ローカル生成など、作成経路が異なる問題を同じ一覧で扱う。

初期実装では、問題の閲覧、検索、絞り込み、詳細確認、停止・再承認の最小操作を対象にする。過去回答の再採点、複雑な revision 差分表示、教材全体の高度な編集は初期対象外とする。

## 2. 背景

既存設計では、問題本体は Question、教材上のまとまりは QuestionSet として扱う。1枚の教材画像に複数の小問が含まれる場合、QuestionSet が問題側素材・回答側素材を持ち、Question が採点と学習履歴の最小単位になる。

また、問題内容や正答の意味が変わらない修正は同じ Question ID の revision とし、意味や正答が変わる場合は旧 Question を invalidated にして新しい Question ID を発行する。

したがって問題一覧は、単なる JSON ファイル一覧ではなく、次の判断を支える管理画面である。

- 子どもへ出題してよいか
- 問題文、画像、正答、回答画像、分類が確認済みか
- 問題不備や分類不整合が疑われていないか
- QuestionSet と小問 Question の対応が崩れていないか
- 集計対象外にすべき問題が混ざっていないか

## 3. 対象ユーザー

- 主ユーザー: 保護者
- 副ユーザー: 実装・検証を行う開発者

保護者は内部 ID を理解していなくても操作できる必要がある。一方で、実装・検証では Question ID、QuestionSet ID、revision、source document ID を確認できる必要がある。

## 4. 画面の位置づけ

保護者画面に `問題一覧` セクションを置く。

将来的に一覧が大きくなった場合は独立ページへ分離できるよう、コンポーネントは `ParentConsole` から切り出す。

初期導線:

```text
おうちの人画面
  → 問題一覧
    → 検索・絞り込み
    → 問題詳細
    → 最小編集 / 停止 / 再承認
```

教材取り込み画面から昇格した直後は、該当 QuestionSet または Question 詳細へ遷移できるとよい。ただし、初期実装では一覧の再読み込みと検索で到達できればよい。

## 5. 一覧に表示する情報

### 5.1 QuestionSet 行

QuestionSet は「教材上のまとまり」として表示する。

表示項目:

| 項目 | 表示方針 |
|---|---|
| タイトル | 先頭小問のタイトル + `ほか`。未取得なら QuestionSet ID |
| 小問数 | `items.length` |
| 教科 | 小問 Question から推定。複数ある場合は `複数` |
| 単元 | 小問 Question から推定。複数ある場合は `複数` |
| 出典 | `source.type` を日本語表示 |
| 状態 | 子 Question の状態から集約 |
| ID | 詳細表示または開発者向けの小さな表示 |

状態集約の初期方針:

| 集約状態 | 条件 |
|---|---|
| 承認済み | 全 item の Question が出題可能 |
| 要確認 | draft / suspended / 分類確認待ちなどが含まれる |
| 無効化含む | invalidated が含まれる |
| 不完全 | items が空、または参照先 Question が見つからない |

### 5.2 Question 行

Question は「採点・履歴・理解度の最小単位」として表示する。

表示項目:

| 項目 | 表示方針 |
|---|---|
| タイトル | `title` |
| 問題プレビュー | `body`、presentation text、または素材種別の説明 |
| 教科 | `subject` |
| 単元 | `unitId` |
| Skill | `skillIds`。通常表示では表示名が望ましいが、初期は ID でもよい |
| 問題タイプ | 日本語ラベル + 内部値 |
| 出典 | `source.type` を日本語表示 |
| review status | 日本語ラベル |
| purposes | 学習 / 復習 / 測定 |
| revision | 存在する場合に表示 |
| ID | 詳細表示または小さく表示 |

内部値だけを大きく表示しない。例: `数値回答（numeric）` のように日本語を主にする。

## 6. 検索・絞り込み

### 6.1 検索

検索対象:

- Question title
- Question body
- presentation text
- subject
- unitId
- skillIds
- questionType
- reviewStatus
- source.type
- Question ID
- QuestionSet ID
- QuestionSet に含まれる Question の title / body

検索は初期版ではクライアント側でよい。件数が増え、表示が重くなった段階で Rust 側の検索コマンドまたは SQLite 検索へ移す。

### 6.2 絞り込み

初期実装でほしいフィルタ:

| フィルタ | 値 |
|---|---|
| 状態 | すべて / 承認済み / 要確認 / 停止中 / 無効化済み |
| 出典 | すべて / 取り込み / 手作成 / AI生成 / 端末生成 |
| 用途 | すべて / 学習 / 復習 / 測定 |
| 単元 | 登録済み unitId |
| 問題タイプ | 登録済み questionType |

無効化済み Question は通常表示では隠してよい。ただし、保護者が集計変化の理由を確認できるよう、明示フィルタで表示できるようにする。

## 7. 問題詳細

一覧行を開くと詳細を表示する。

初期版は同一画面内の展開またはモーダルでよい。画面が大きくなったらルーティングを分ける。

### 7.1 詳細で表示する情報

Question 詳細:

- 問題文、presentation
- 正答、answer material
- subject / unitId / skillIds
- questionType
- expectedResponse
- reviewStatus
- purposes
- source
- sourceMapping
- QuestionSet に属している場合は親 QuestionSet
- revision
- 直近の出題有無、回答回数、分からない / 納得できない件数

QuestionSet 詳細:

- 問題側素材 `questionMaterials`
- 回答側素材 `answerMaterials`
- item 一覧
- item ごとの Question タイトル、状態、正答概要
- source
- 参照切れの有無

### 7.2 教材画像の扱い

source-region / source-page / image / audio は、存在すればプレビューする。

実教材画像や音声は DATA_DIR にあり、著作権・個人情報を含み得る。ブラウザ開発時やログ出力で外部へ送信しない。

プレビュー取得に失敗した場合は、問題自体を壊れたものとして即断せず、`素材を表示できません` と表示して詳細エラーを折りたたむ。

## 8. 操作

### 8.1 初期実装で必要な操作

| 操作 | 対象 | 内容 |
|---|---|---|
| 再読み込み | 一覧 | DATA_DIR から再取得 |
| 詳細を開く | Question / QuestionSet | 内容と関連情報を確認 |
| 停止する | Question | `suspended` に変更し、出題候補から外す |
| 再承認する | Question | 修正済みの問題を `adult-approved` に戻す |
| 無効化する | Question | 問題として成立しない場合に `invalidated` へ変更 |

停止、再承認、無効化は確認ダイアログを出す。

### 8.2 編集

初期編集対象:

- title
- body または presentation text
- answer value / textValue
- questionType
- subject
- unitId
- skillIds
- purposes
- note

QuestionSet 初期編集対象:

- item の label / order
- item の参照先確認
- questionMaterials / answerMaterials の表示順

画像領域の再指定は、既存の RegionEditModal を再利用できるなら対象にする。再利用が重い場合は、詳細から取り込みレビュー画面へ戻す導線だけでもよい。

### 8.3 revision ルール

同じ Question ID の revision として扱える変更:

- OCR 文面の表記修正
- 問題文の誤字修正
- 画像領域の微調整
- 正答の表記ゆれ追加
- rubric や許容表現の追加
- note や表示名の修正

新しい Question ID を発行すべき変更:

- 問題の意味が変わる
- 正答そのものが変わる
- 要求する回答方式が変わる
- 対象 Skill が実質的に別物になる

初期版では自動判定しない。UI では、正答や問題タイプを変える場合に `これは別問題として作り直す可能性があります` と注意する。

## 9. データ取得と永続化

### 9.1 読み込み

初期実装では既存コマンドを使う。

- `load_question_bank`
- `load_question_sets`

ブラウザプレビューでは Tauri invoke が使えないため、合成問題へフォールバックしてよい。ただし、本番動作と区別できる表示を入れる。

### 9.2 追加したい Tauri コマンド

Claude / Gemini に実装させる場合、次のコマンド追加を依頼するとよい。

```text
get_question_detail(question_id)
get_question_set_detail(question_set_id)
update_question(question)
set_question_review_status(question_id, status, reason)
update_question_set(question_set)
```

状態変更時には理由を任意入力できるようにする。理由は初期版では空でもよいが、invalidated では入力を促す。

### 9.3 SQLite 移行との関係

現在 JSON ファイルを読んでいる場合でも、UI 側は永続化方式に依存しすぎない。

将来 SQLite が正本になった場合、一覧は同じ表示モデルを受け取れるようにする。

推奨する表示用 DTO:

```ts
type ParentQuestionListItem =
  | {
      kind: "question";
      id: string;
      title: string;
      preview: string;
      subject: string;
      unitId: string;
      skillIds: string[];
      questionType: string;
      sourceType: string;
      reviewStatus: string;
      purposes: string[];
      revision?: number;
      attemptedCount?: number;
      issueCount?: number;
    }
  | {
      kind: "question-set";
      id: string;
      title: string;
      itemCount: number;
      sourceType: string;
      aggregateStatus: string;
      missingQuestionCount: number;
    };
```

## 10. 安全と公開リポジトリ上の注意

- 実学習データ、手書き画像、音声、実教材コンテンツをリポジトリへ保存しない
- 画面確認用のスクリーンショットに実教材・個人情報が含まれる場合は公開しない
- AI へ実教材や学習データを送る処理を一覧画面から暗黙に実行しない
- 削除より停止・無効化を優先する
- 無効化は学習履歴・集計への影響があるため、確認なしで実行しない

## 11. 段階実装

### Phase 1: 閲覧一覧

- ParentConsole に QuestionList を表示する
- Question / QuestionSet を読み込む
- 件数を表示する
- 検索できる
- 基本メタデータを表示する
- ブラウザプレビューでは合成問題へフォールバックする

完了条件:

- `npm run build` が通る
- DATA_DIR が空でも画面が壊れない
- QuestionSet が 0 件でも表示できる
- 検索で対象が絞り込まれる

### Phase 2: フィルタと詳細

- 状態、出典、用途、単元、問題タイプで絞り込める
- Question 詳細を開ける
- QuestionSet 詳細を開ける
- 参照切れ Question を検出して表示する
- source-region / image の表示失敗を安全に扱う

完了条件:

- 無効化済みを通常表示から隠せる
- 明示フィルタで無効化済みを確認できる
- QuestionSet 内の missing item が分かる

### Phase 3: 状態変更

- Question を suspended にできる
- suspended を adult-approved に戻せる
- invalidated にできる
- 状態変更理由を保存できる
- 状態変更後に一覧へ反映される

完了条件:

- suspended / invalidated は出題候補から除外される
- invalidated の確認ダイアログがある
- 出題済み問題を物理削除しない

### Phase 4: 最小編集

- title / body / answer / type / unit / skill / purposes を編集できる
- revision を増やす
- 別 Question ID が必要な変更に注意を出す
- QuestionSet の item label / order を編集できる

完了条件:

- 編集後の JSON または DB レコードが schema に適合する
- 参照切れを作らない
- 意味変更を安易に同一 Question ID へ上書きしない

## 12. テスト観点

### 12.1 ユニットテスト

- source type を日本語表示できる
- review status を日本語表示できる
- QuestionSet の集約状態を判定できる
- 検索対象文字列に title / body / unitId / skillIds / ID が含まれる
- invalidated を通常表示から除外できる
- missing Question を検出できる

### 12.2 結合テスト

- `load_question_bank` と `load_question_sets` から一覧を作れる
- DATA_DIR に question-sets が存在しなくても一覧が表示される
- suspended / invalidated の状態変更が保存される
- 状態変更後、待機列や出題候補へ反映される

### 12.3 画面確認

- デスクトップ幅で一覧が読みやすい
- モバイル幅で横スクロールしない
- 長い Question ID や unitId が枠を壊さない
- 検索欄、フィルタ、件数表示が重ならない
- 実教材画像が表示できない場合も画面全体が落ちない

## 13. 実装エージェント向け指示

Claude / Gemini に渡す場合は、次の順で依頼する。

1. この仕様と `docs/spec/domain-design.md` の `Question`、`QuestionSet`、`問題の表示、停止、リビジョン` を読む
2. 既存の `ParentConsole`、`QuestionList`、`question.ts`、`questionSet.ts`、Tauri の `question_bank.rs`、`question_set.rs` を確認する
3. まず Phase 1 を完成させる
4. 既存のユーザー変更や未コミット差分を上書きしない
5. 実データや教材コンテンツをリポジトリへ追加しない
6. 変更後に `npm run build` を実行する
7. 状態変更や永続化を入れた場合は Rust 側のテストも追加する

実装プロンプト例:

```text
docs/spec/parent-question-list.md の Phase 1 を実装してください。
既存の ParentConsole と DATA_DIR 読み込みコマンドを使い、問題一覧、検索、件数表示、QuestionSet 表示を追加してください。
実教材や実学習データは追加しないでください。
完了後に npm run build を通してください。
```

## 14. 批判的に確認する点

- 問題一覧は便利だが、編集や無効化を軽く扱うと過去の学習記録と集計の信頼性を壊す
- QuestionSet と Question を同じ表に混ぜると分かりにくくなるため、表示上はまとまりと小問の違いを明確にする
- 内部 ID を出しすぎると保護者向け画面として使いにくいが、完全に隠すと不具合調査が難しくなる
- 無効化済み問題を完全に隠すと、正答率やレポート値が変わった理由を追えなくなる
- 最初から高度な編集機能を作ると、PoC の焦点が学習体験から管理システムへ寄りすぎる
- AI 生成や OCR 取り込みの改善をこの画面へ詰め込みすぎると、責務が曖昧になる

