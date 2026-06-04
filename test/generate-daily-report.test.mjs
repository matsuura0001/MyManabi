import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildDailyReport, generateDailyReport, loadEvents } from "../src/generate-daily-report.mjs";

const event = {
  schema_version: 2,
  event_id: "synthetic-test-001",
  occurred_at: "2026-05-31T09:00:00+09:00",
  learner_id: "learner-a",
  unit: "合成単元",
  template_id: "synthetic-template",
  question: "合成問題",
  response: { type: "none", reason: "分からないが選択された" },
  grading: { result: "unknown", method: "not-graded", reason: "分からないが選択された" },
  duration_seconds: 15,
  flags: { did_not_know: true, disputed: false, anxious: true },
  explanations: ["simpler-words"],
  adult_review_required: true,
};

test("buildDailyReport separates did-not-know from incorrect answers", () => {
  const report = buildDailyReport({ learnerId: "learner-a", date: "2026-05-31", events: [event] });
  assert.match(report, /問題数: 1/);
  assert.match(report, /正答数: 0/);
  assert.match(report, /誤答数: 0/);
  assert.match(report, /`分からない`: 1/);
  assert.match(report, /合成単元 \/ synthetic-template: 分からない、大人との確認/);
});

test("loadEvents filters learner and date", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "mymanabi-"));
  const eventsDir = path.join(dataDir, "learners", "learner-a", "events");
  await mkdir(eventsDir, { recursive: true });
  const ignored = { ...event, event_id: "ignored", occurred_at: "2026-06-01T09:00:00+09:00" };
  await writeFile(path.join(eventsDir, "events.jsonl"), `${JSON.stringify(event)}\n${JSON.stringify(ignored)}\n`);
  const events = await loadEvents({ dataDir, learnerId: "learner-a", date: "2026-05-31" });
  assert.deepEqual(events.map(({ event_id }) => event_id), ["synthetic-test-001"]);
});

test("generateDailyReport writes the report under the learner folder", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "mymanabi-"));
  const eventsDir = path.join(dataDir, "learners", "learner-a", "events");
  await mkdir(eventsDir, { recursive: true });
  await writeFile(path.join(eventsDir, "events.jsonl"), `${JSON.stringify(event)}\n`);
  const { outputPath, report } = await generateDailyReport({
    dataDir,
    learnerId: "learner-a",
    date: "2026-05-31",
  });
  assert.equal(outputPath, path.join(dataDir, "learners", "learner-a", "reports", "2026-05-31.md"));
  assert.match(report, /所要時間: 15 秒/);
});
