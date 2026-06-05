export function normalizeForComparison(line) {
  return line.replace(/[\s　]/g, "").toLowerCase();
}

export function subtractCommonLines(questionText, answerText) {
  const qLines = questionText.split("\n").map((line) => line.trim()).filter(Boolean);
  const aLines = answerText.split("\n").map((line) => line.trim()).filter(Boolean);

  while (
    aLines.length > 0 &&
    qLines.length > 0 &&
    normalizeForComparison(aLines[0]) === normalizeForComparison(qLines[0])
  ) {
    aLines.shift();
    qLines.shift();
  }

  while (
    aLines.length > 0 &&
    qLines.length > 0 &&
    normalizeForComparison(aLines[aLines.length - 1]) ===
      normalizeForComparison(qLines[qLines.length - 1])
  ) {
    aLines.pop();
    qLines.pop();
  }

  return aLines.join("\n");
}

export function answerTextFromSuggestion(suggestion) {
  return suggestion?.value?.trim() ?? "";
}

export function bestAnswerSuggestion(link, answer) {
  return link?.suggestedAnswer ?? answer?.suggestedAnswer;
}

export function answerValueFromSelection(questionText, answer, link) {
  if (!answer) return "";
  const suggested = bestAnswerSuggestion(link, answer);
  const suggestedValue =
    suggested && suggested.source !== "answer-ocr" ? answerTextFromSuggestion(suggested) : "";
  if (suggestedValue) return suggestedValue;

  const subtracted = subtractCommonLines(questionText, answer.ocrText);
  return subtracted || answer.ocrText.trim();
}

export function expectedAnswerForQuestion(question) {
  return question?.answer?.value?.trim() || question?.answer?.textValue?.trim() || "";
}

export function questionSetExpectedAnswers(questionSet, questions) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  return questionSet.items.map((item, index) => {
    const question = questionById.get(item.questionId);
    return {
      questionId: item.questionId,
      label: item.label ?? `問${index + 1}`,
      value: expectedAnswerForQuestion(question),
    };
  });
}

export function answerSourceLabel({ selectedAnswer, answerValue, requiresAnswerPair }) {
  if (selectedAnswer) {
    const item = selectedAnswer.itemLabel ? ` / ${selectedAnswer.itemLabel}` : "";
    return {
      kind: answerValue.trim() ? "ready" : "missing",
      text: `答え候補 P${selectedAnswer.page}${item}`,
    };
  }

  if (answerValue.trim()) {
    return { kind: "ready", text: "答え生成済み" };
  }

  return {
    kind: "missing",
    text: requiresAnswerPair ? "答え候補未選択" : "答え未生成",
  };
}
