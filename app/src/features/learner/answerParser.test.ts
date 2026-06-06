import { describe, it, expect } from 'vitest';
import { parseAnswerLines } from './answerParser';

describe('parseAnswerLines', () => {
  const orderedItems = [
    { questionId: 'q1' },
    { questionId: 'q2' },
    { questionId: 'q3' },
  ];

  it('parses normal 3 lines correctly', () => {
    const result = parseAnswerLines("ans1\nans2\nans3", orderedItems);
    expect(result.responses).toEqual([
      { questionId: 'q1', value: 'ans1' },
      { questionId: 'q2', value: 'ans2' },
      { questionId: 'q3', value: 'ans3' },
    ]);
    expect(result.extraLines).toEqual([]);
  });

  it('handles empty input', () => {
    const result = parseAnswerLines("", orderedItems);
    expect(result.responses).toEqual([
      { questionId: 'q1', value: '' },
      { questionId: 'q2', value: '' },
      { questionId: 'q3', value: '' },
    ]);
    expect(result.extraLines).toEqual([]);
  });

  it('handles empty middle line', () => {
    const result = parseAnswerLines("ans1\n\nans3", orderedItems);
    expect(result.responses).toEqual([
      { questionId: 'q1', value: 'ans1' },
      { questionId: 'q2', value: '' },
      { questionId: 'q3', value: 'ans3' },
    ]);
    expect(result.extraLines).toEqual([]);
  });

  it('handles missing lines', () => {
    const result = parseAnswerLines("ans1\nans2", orderedItems);
    expect(result.responses).toEqual([
      { questionId: 'q1', value: 'ans1' },
      { questionId: 'q2', value: 'ans2' },
      { questionId: 'q3', value: '' },
    ]);
    expect(result.extraLines).toEqual([]);
  });

  it('handles extra lines', () => {
    const result = parseAnswerLines("ans1\nans2\nans3\nextra1\nextra2", orderedItems);
    expect(result.responses).toEqual([
      { questionId: 'q1', value: 'ans1' },
      { questionId: 'q2', value: 'ans2' },
      { questionId: 'q3', value: 'ans3' },
    ]);
    expect(result.extraLines).toEqual(['extra1', 'extra2']);
  });

  it('ignores a single trailing newline', () => {
    const result = parseAnswerLines("ans1\nans2\nans3\n", orderedItems);
    expect(result.responses).toEqual([
      { questionId: 'q1', value: 'ans1' },
      { questionId: 'q2', value: 'ans2' },
      { questionId: 'q3', value: 'ans3' },
    ]);
    expect(result.extraLines).toEqual([]);
  });

  it('handles CRLF correctly', () => {
    const result = parseAnswerLines("ans1\r\nans2\r\nans3", orderedItems);
    expect(result.responses).toEqual([
      { questionId: 'q1', value: 'ans1' },
      { questionId: 'q2', value: 'ans2' },
      { questionId: 'q3', value: 'ans3' },
    ]);
  });

  it('trims whitespace', () => {
    const result = parseAnswerLines("  ans1  \n\t ans2\nans3  ", orderedItems);
    expect(result.responses).toEqual([
      { questionId: 'q1', value: 'ans1' },
      { questionId: 'q2', value: 'ans2' },
      { questionId: 'q3', value: 'ans3' },
    ]);
  });

  it('handles 0 items', () => {
    const result = parseAnswerLines("ans1\nans2", []);
    expect(result.responses).toEqual([]);
    expect(result.extraLines).toEqual(['ans1', 'ans2']);
  });
});
