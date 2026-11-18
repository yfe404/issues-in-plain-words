// The "In plain words" rule for GitHub issues, in one place.
// The issue workflow and the tests both call checkPlainWords.
// After the mechanical check, an optional judge (Jev, typesafe/jev-1.13 on
// OpenRouter) scores the paragraph against a four-level rubric; the gate is
// JUDGE_PASS. Calibrate JUDGE_PASS on your own issues (see README.md).
// CLI: node scripts/check-issue-plain-words.mjs <body-file>   (exit 1 on failure)
//      node scripts/check-issue-plain-words.mjs --scan        (open issues, mechanical only; needs gh)
//      node scripts/check-issue-plain-words.mjs --scores 199 200 (mechanical + Jev score table; needs gh)
// OPENROUTER_API_KEY enables the judge; without it the judge is skipped.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const RULE =
  'An issue opens with "**In plain words:**" and then 3 to 5 sentences (at most about 150 words, ending at the first blank line) for someone who does not know the code: what is wrong or wanted, which part of the product, how we know it is done. No code spans, file paths or hex digests in that paragraph.';

export const JUDGE_MODEL = "typesafe/jev-1.13";
export const JUDGE_URL = "https://openrouter.ai/api/v1/systemone";
export const JUDGE_PASS = 0.6;
export const RUBRIC = [
  "a reader who does not know the code cannot tell what is wrong",
  "says what is wrong but not where or how we know it is done",
  "answers all three questions but uses words only an engineer on this project knows",
  "a stranger can tell what is wrong, where, and how we know it is done, in everyday words",
];
const JUDGE_QUESTION =
  "This paragraph opens a GitHub issue of a software project. How well does it serve a reader who does not know the code and barely the project?";

const MARKER = "**In plain words:**";
const FORM_HEADING = /^###\s+In plain words\s*\n+/i;
const MIN_SENTENCES = 3;
const MAX_WORDS = 150;

export function extractPlainWords(body) {
  const text = String(body ?? "")
    .replace(/\r\n/g, "\n")
    .trimStart();
  let rest;
  if (text.startsWith(MARKER)) rest = text.slice(MARKER.length);
  else if (FORM_HEADING.test(text)) rest = text.replace(FORM_HEADING, "");
  else return null;
  return rest.split(/\n[ \t]*\n/)[0].trim();
}

export function checkPlainWords(body) {
  const paragraph = extractPlainWords(body);
  if (paragraph === null) {
    return {
      ok: false,
      problems: ['the body does not begin with "**In plain words:**"'],
    };
  }
  const problems = [];
  const sentences = paragraph
    .split(/(?<=[.!?])\s+/)
    .filter((s) => /\w/.test(s));
  if (sentences.length < MIN_SENTENCES) {
    problems.push(
      `only ${sentences.length} sentence(s); need at least ${MIN_SENTENCES}`
    );
  }
  const words = paragraph.split(/\s+/).filter(Boolean).length;
  if (words > MAX_WORDS)
    problems.push(`${words} words; keep it to about ${MAX_WORDS}`);
  if (paragraph.includes("`"))
    problems.push("contains a code span (backticks)");
  const pathLike = paragraph
    .split(/\s+/)
    .some(
      (t) =>
        /^[~.]?\/\w/.test(t) || /[\w-]+\/[\w.-]+\/|[\w-]+\/[\w-]+\.\w+/.test(t)
    );
  if (pathLike) problems.push("contains a file path");
  if (/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,}\b/i.test(paragraph)) {
    problems.push("contains a hex digest or commit hash");
  }
  return { ok: problems.length === 0, problems };
}

// Returns {skipped: reason} or {score, line, pass}. Never throws: a judge outage must not block issues.
export async function judgePlainWords(
  paragraph,
  { apiKey, fetchImpl = fetch } = {}
) {
  if (!apiKey) return { skipped: "no key" };
  try {
    const response = await fetchImpl(JUDGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        state: paragraph,
        questions: {
          answer: {
            type: "score",
            instructions: JUDGE_QUESTION,
            criteria: RUBRIC,
          },
        },
      }),
    });
    if (!response.ok) return { skipped: `HTTP ${response.status}` };
    const score = (await response.json())?.answers?.answer?.score;
    if (typeof score !== "number")
      return { skipped: "no score in the response" };
    return {
      score,
      line: RUBRIC[Math.min(3, Math.max(0, Math.round(score)))],
      pass: score >= JUDGE_PASS,
    };
  } catch (error) {
    return { skipped: `error: ${error.message}` };
  }
}

export async function judgeBody(body, options) {
  const mechanical = checkPlainWords(body);
  if (!mechanical.ok) return { ok: false, problems: mechanical.problems };
  const judge = await judgePlainWords(extractPlainWords(body), options);
  if (judge.skipped)
    return { ok: true, problems: [], note: `judge skipped: ${judge.skipped}` };
  const note = `Jev scored the paragraph ${judge.score.toFixed(2)} of 3 (landed on: "${judge.line}"); the gate is ${JUDGE_PASS}`;
  return judge.pass
    ? { ok: true, problems: [], note }
    : { ok: false, problems: [note], note };
}

async function scores(numbers) {
  for (const n of numbers) {
    const body = JSON.parse(
      execFileSync("gh", ["issue", "view", String(n), "--json", "body"], {
        encoding: "utf8",
      })
    ).body;
    const mechanical = checkPlainWords(body);
    const judge = await judgePlainWords(
      extractPlainWords(body) ??
        String(body ?? "")
          .trim()
          .split(/\n[ \t]*\n/)[0],
      {
        apiKey: process.env.OPENROUTER_API_KEY,
      }
    );
    console.log(
      `${n}\tmechanical ${mechanical.ok ? "pass" : "fail"}\tjev ${judge.score ?? `skipped (${judge.skipped})`}`
    );
  }
}

function scan() {
  const issues = JSON.parse(
    execFileSync(
      "gh",
      [
        "issue",
        "list",
        "--state",
        "open",
        "--limit",
        "1000",
        "--json",
        "number,body",
      ],
      { encoding: "utf8" }
    )
  );
  const failing = issues
    .filter((i) => !checkPlainWords(i.body).ok)
    .map((i) => i.number);
  console.log(
    `${failing.length} of ${issues.length} open issues fail: ${failing.sort((a, b) => a - b).join(" ")}`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (arg === "--scan") scan();
  else if (arg === "--scores") await scores(process.argv.slice(3));
  else if (!arg) {
    console.error(
      "usage: check-issue-plain-words.mjs <body-file> | --scan | --scores <numbers...>"
    );
    process.exit(2);
  } else {
    const result = await judgeBody(readFileSync(arg, "utf8"), {
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    for (const p of result.problems) console.log(`- ${p}`);
    if (result.ok && result.note) console.log(result.note);
    process.exit(result.ok ? 0 : 1);
  }
}
