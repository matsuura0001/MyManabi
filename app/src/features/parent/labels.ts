import type { Question } from "../../domain/question";
import type { QuestionSet } from "../../domain/questionSet";

export function sourceLabel(
  sourceType: Question["source"]["type"] | QuestionSet["source"]["type"]
): string {
  switch (sourceType) {
    case "adult-authored":
      return "手作成";
    case "ai-generated":
      return "AI生成";
    case "local-generated":
      return "端末生成";
    case "imported":
      return "取り込み";
  }
}

export function statusLabel(status: Question["reviewStatus"]): string {
  switch (status) {
    case "adult-approved":
      return "承認済み";
    case "auto-approved":
      return "自動承認";
    case "draft":
      return "下書き";
    case "suspended":
      return "停止中";
  }
}

export function purposeLabel(purpose: string): string {
  switch (purpose) {
    case "learning":
      return "学習";
    case "review":
      return "復習";
    case "assessment":
      return "測定";
    default:
      return purpose;
  }
}

export function questionTypeLabel(type: string): string {
  switch (type) {
    case "numeric":
      return "数値回答";
    case "kanji":
      return "漢字";
    case "multiple-choice":
      return "選択肢";
    case "word-problem":
      return "応用問題";
    case "free-text":
      return "自由記述";
    case "handwriting":
      return "手書き";
    case "speech":
      return "音声";
    default:
      return type;
  }
}

export function expectedResponseLabel(type: string): string {
  switch (type) {
    case "text":
      return "テキスト";
    case "numeric":
      return "数値";
    case "choice":
      return "選択肢";
    case "handwriting":
      return "手書き";
    case "speech":
      return "音声";
    case "drawing":
      return "描画";
    case "parent-review":
      return "保護者レビュー";
    default:
      return type;
  }
}

export function answerTypeLabel(type: string): string {
  switch (type) {
    case "exact-text":
      return "テキスト一致";
    case "numeric":
      return "数値";
    case "choice":
      return "選択肢";
    case "ai-assisted":
      return "AI採点";
    case "source-region":
      return "教材範囲";
    case "source-page":
      return "教材ページ";
    case "image":
      return "画像";
    case "exemplar-image":
      return "模範画像";
    case "audio":
      return "音声";
    case "exemplar-audio":
      return "模範音声";
    case "manual-review":
      return "手動採点";
    default:
      return type;
  }
}
