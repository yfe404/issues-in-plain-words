# Issues in plain words

A template for one rule: **every GitHub issue opens with a short paragraph that a
person who does not know the code can understand.**

It is meant for repositories where most issues are written by coding agents, or by
people deep in the code. Such issues are often accurate and still unreadable to
anyone else. This rule keeps the first paragraph readable and leaves the technical
detail below it.

## The rule

An issue body starts with `**In plain words:**` and then 3 to 5 sentences that
answer three questions:

1. What is wrong or wanted?
2. Which part of the product does it touch?
3. How will we know it is done?

The paragraph comes before everything else, has at most about 150 words, and
contains no code, file paths or commit hashes. Issue references such as `#123`
and plain numbers are fine.

Example:

> **In plain words:** The checkout page does not load for visitors from Belgium.
> They see a spinner that never finishes, while the same page opens from France.
> In our last measurement 10 of 10 visits from Belgium failed. This is done when
> the page opens from Belgium about as often as it does from France, and no other
> country gets worse.

## What is in this template

| File                                      | What it does                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/ISSUE_TEMPLATE/issue.yml`        | The issue form. Its first, required field is "In plain words". `config.yml` beside it disables blank issues.                                                  |
| `scripts/check-issue-plain-words.mjs`     | The rule, in one place. No dependencies.                                                                                                                      |
| `.github/workflows/issue-plain-words.yml` | Runs the script on every issue that is opened, edited or reopened. A failing issue gets the label `needs plain words` and one comment that says what failed. |
| `tests/check-issue-plain-words.test.mjs`  | Unit tests of the script.                                                                                                                                     |
| `AGENTS-snippet.md`                       | The paragraph to paste into your agent instructions (`AGENTS.md`, `CLAUDE.md`).                                                                               |

## Use it

1. Select **Use this template**, or copy the files into your repository.
2. Paste `AGENTS-snippet.md` into the instructions your agents read.
3. Open an issue without the paragraph and check that the label and the comment
   appear. Edit the issue; the check runs again and removes the label.

Check a body before you create the issue:

```sh
node scripts/check-issue-plain-words.mjs body.md   # exit 1 and a list of problems on failure
gh issue create --title "..." --body-file body.md
```

List the open issues that fail the mechanical check:

```sh
node scripts/check-issue-plain-words.mjs --scan
```

Run the tests:

```sh
npm test
```

## The two checks

**Mechanical.** The marker comes first; at least 3 sentences; at most 150 words
before the first blank line; no backticks, file paths or hex digests in that
paragraph. This check alone removes most unreadable openings.

**Judge (optional).** When the mechanical check passes and the repository secret
`OPENROUTER_API_KEY` is set, a scoring model (Jev, `typesafe/jev-1.13`) rates
the paragraph from 0 to 3 against this rubric:

- 0: a reader who does not know the code cannot tell what is wrong
- 1: says what is wrong but not where or how we know it is done
- 2: answers all three questions but uses words only an engineer on this project knows
- 3: a stranger can tell what is wrong, where, and how we know it is done, in everyday words

A score below `JUDGE_PASS` fails the issue. Without the secret the judge is
skipped and the mechanical result stands. A judge outage never blocks an issue.

## Calibrate the judge before you trust it

Do not pick the pass mark from the rubric. In the repository this template comes
from, nine issues written in the required shape scored between 1.0 and 1.9, and
ten older, unreadable issues scored between 0.0 and 0.2. A pass mark of 2.5 would
have failed every one of them. The two groups separate cleanly, so `JUDGE_PASS`
is 0.6, the midpoint of the gap.

Measure your own issues and set `JUDGE_PASS` in the script from your own table:

```sh
OPENROUTER_API_KEY=... node scripts/check-issue-plain-words.mjs --scores 12 15 31
```

Measure again when you change the judge model.
