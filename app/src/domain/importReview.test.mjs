import assert from "node:assert/strict";
import test from "node:test";

import { answerSourceLabel, answerValueFromSelection, questionSetExpectedAnswers } from "./importReview.mjs";

test("answerValueFromSelection removes duplicated question text from answer OCR", () => {
  const questionText = "1. 3 + 4 = ?";
  const answer = {
    answerCandidateId: "answer-1",
    page: 2,
    region: { x: 0, y: 0, width: 1, height: 1 },
    ocrText: "1. 3 + 4 = ?\n7",
    confidence: 0.9,
  };

  assert.equal(answerValueFromSelection(questionText, answer), "7");
});

test("questionSetExpectedAnswers derives answers from linked Questions", () => {
  const questionSet = {
    id: "set-1",
    items: [
      { questionId: "q-1", label: "1", order: 1 },
      { questionId: "q-2", label: "2", order: 2 },
    ],
  };
  const questions = [
    { id: "q-1", answer: { value: "7" } },
    { id: "q-2", answer: { textValue: "12" } },
  ];

  assert.deepEqual(questionSetExpectedAnswers(questionSet, questions), [
    { questionId: "q-1", label: "1", value: "7" },
    { questionId: "q-2", label: "2", value: "12" },
  ]);
});

test("answerSourceLabel does not call generated answers manual input", () => {
  assert.deepEqual(
    answerSourceLabel({ selectedAnswer: undefined, answerValue: "7", requiresAnswerPair: false }),
    { kind: "ready", text: "答え生成済み" },
  );
});
