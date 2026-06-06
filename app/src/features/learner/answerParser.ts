export type ParseAnswerLinesResult = {
  responses: { questionId: string; value: string }[];
  extraLines: string[];
};

export function parseAnswerLines(text: string, orderedItems: { questionId: string }[]): ParseAnswerLinesResult {
  if (!text) {
    return {
      responses: orderedItems.map(item => ({ questionId: item.questionId, value: "" })),
      extraLines: []
    };
  }

  const lines = text.split(/\r?\n/);
  
  // Remove trailing empty line if it's just from the last newline
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const responses = orderedItems.map((item, index) => ({
    questionId: item.questionId,
    value: lines[index]?.trim() ?? "",
  }));

  const extraLines = lines.slice(orderedItems.length).map(l => l.trim());

  return {
    responses,
    extraLines
  };
}
