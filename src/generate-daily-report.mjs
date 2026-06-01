import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--stdout") {
      args.stdout = true;
      continue;
    }
    if (!argument.startsWith("--") || index + 1 >= argv.length) {
      throw new Error(`Invalid argument: ${argument}`);
    }
    args[argument.slice(2)] = argv[index + 1];
    index += 1;
  }
  return args;
}

function assertSafeSegment(value, label) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    throw new Error(`${label} must contain only lowercase letters, numbers, and hyphens`);
  }
}

function assertDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("date must use YYYY-MM-DD");
  }
}

export async function loadEvents({ dataDir, learnerId, date }) {
  assertSafeSegment(learnerId, "learner");
  assertDate(date);
  const eventsDir = path.join(dataDir, "learners", learnerId, "events");
  let filenames;
  try {
    filenames = await readdir(eventsDir);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const events = [];
  for (const filename of filenames.filter((name) => name.endsWith(".jsonl")).sort()) {
    const text = await readFile(path.join(eventsDir, filename), "utf8");
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.learner_id === learnerId && event.occurred_at.slice(0, 10) === date) {
          events.push(event);
        }
      } catch (error) {
        throw new Error(`${filename}:${lineIndex + 1}: ${error.message}`);
      }
    }
  }
  return events.sort((left, right) => left.occurred_at.localeCompare(right.occurred_at));
}

function count(events, predicate) {
  return events.filter(predicate).length;
}

function renderReviewItems(events) {
  const reviewItems = events.filter(
    (event) => event.flags.did_not_know || event.flags.disputed || event.adult_review_required,
  );
  if (reviewItems.length === 0) return "- なし";
  return reviewItems
    .map((event) => {
      const reasons = [];
      if (event.flags.did_not_know) reasons.push("分からない");
      if (event.flags.disputed) reasons.push("納得できない");
      if (event.adult_review_required) reasons.push("大人との確認");
      return `- ${event.unit} / ${event.template_id}: ${reasons.join("、")}`;
    })
    .join("\n");
}

export function buildDailyReport({ learnerId, date, events }) {
  const correct = count(events, (event) => event.grading.result === "correct");
  const incorrect = count(events, (event) => event.grading.result === "incorrect");
  const unknown = count(events, (event) => event.flags.did_not_know);
  const disputed = count(events, (event) => event.flags.disputed);
  const anxious = count(events, (event) => event.flags.anxious);
  const duration = events.reduce((total, event) => total + event.duration_seconds, 0);
  const units = [...new Set(events.map((event) => event.unit))];

  return `# 日次レポート ${date}

## 概要

- 学習者: ${learnerId}
- 取り組んだ単元: ${units.length > 0 ? units.join("、") : "なし"}
- 問題数: ${events.length}
- 正答数: ${correct}
- 誤答数: ${incorrect}
- \`分からない\`: ${unknown}
- \`納得できない\`: ${disputed}
- \`不安\`: ${anxious}
- 所要時間: ${duration} 秒

## 大人との確認候補

${renderReviewItems(events)}

## 注記

このレポートは観測事実だけを示す。学習者の性格や原因を断定しない。
`;
}

export async function generateDailyReport({ dataDir, learnerId, date }) {
  const events = await loadEvents({ dataDir, learnerId, date });
  const report = buildDailyReport({ learnerId, date, events });
  const reportsDir = path.join(dataDir, "learners", learnerId, "reports");
  await mkdir(reportsDir, { recursive: true });
  const outputPath = path.join(reportsDir, `${date}.md`);
  await writeFile(outputPath, report, "utf8");
  return { outputPath, report };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args["data-dir"] || !args.learner || !args.date) {
    throw new Error("Usage: --data-dir <path> --learner <id> --date <YYYY-MM-DD> [--stdout]");
  }
  const result = await generateDailyReport({
    dataDir: path.resolve(args["data-dir"]),
    learnerId: args.learner,
    date: args.date,
  });
  if (args.stdout) process.stdout.write(result.report);
  else process.stdout.write(`${result.outputPath}\n`);
}

if (typeof process !== "undefined" && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
