import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkPlainWords,
  judgeBody,
  judgePlainWords,
} from "../scripts/check-issue-plain-words.mjs";

const GOOD =
  "**In plain words:** the checkout page fails to load for some visitors. A visitor sees a spinner that never finishes. We are done when the page opens in 30 of 32 tries.\n\n- [ ] technical `detail` in src/a.rs 8031ef3e";

const problems = (body) => checkPlainWords(body).problems.join("|");

test("good body passes", () => assert.equal(checkPlainWords(GOOD).ok, true));
test("form output with the heading passes", () =>
  assert.equal(
    checkPlainWords(
      "### In plain words\n\nOne thing breaks. It is on a shop site. Done when it loads.\n\n### Exit\n\nx"
    ).ok,
    true
  ));
test("missing marker fails", () =>
  assert.match(problems("Fix the thing. Now. Please."), /does not begin/));
test("empty body fails", () => assert.equal(checkPlainWords("").ok, false));
test("marker not first fails", () =>
  assert.equal(checkPlainWords("Intro\n\n" + GOOD).ok, false));
test("two sentences fail", () =>
  assert.match(
    problems("**In plain words:** One thing. Another thing."),
    /sentence/
  ));
test("over 150 words fails", () =>
  assert.match(
    problems(`**In plain words:** A. B. C. ${"word ".repeat(155)}`),
    /words/
  ));
test("code span fails", () =>
  assert.match(
    problems(
      "**In plain words:** The `foo` call breaks. It is on a site. Done when fixed."
    ),
    /code span/
  ));
test("file path fails", () =>
  assert.match(
    problems(
      "**In plain words:** See scripts/check.mjs for it. It breaks. Done when fixed."
    ),
    /path/
  ));
test("hex digest fails", () =>
  assert.match(
    problems(
      "**In plain words:** Commit 8031ef3e broke it. It is on a site. Done when fixed."
    ),
    /hex/
  ));
test("plain words and a slash pass", () =>
  assert.equal(
    checkPlainWords(
      "**In plain words:** Pages load and/or stall. It is a shop. Done when 3 of 3 load."
    ).ok,
    true
  ));
test("technical part after the blank line is not checked", () =>
  assert.equal(checkPlainWords(GOOD).ok, true));

const reply =
  (score, ok = true) =>
  async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => ({ answers: { answer: { score } } }),
  });

test("judge skipped without a key", async () =>
  assert.deepEqual(await judgePlainWords("x", {}), { skipped: "no key" }));
test("judge at the gate passes, below it fails with the rubric line", async () => {
  assert.equal(
    (await judgePlainWords("x", { apiKey: "k", fetchImpl: reply(0.6) })).pass,
    true
  );
  const low = await judgePlainWords("x", {
    apiKey: "k",
    fetchImpl: reply(0.3),
  });
  assert.equal(low.pass, false);
  assert.match(low.line, /cannot tell what is wrong/);
});
test("judge outage is skipped, never thrown", async () => {
  assert.match(
    (await judgePlainWords("x", { apiKey: "k", fetchImpl: reply(0, false) }))
      .skipped,
    /HTTP 500/
  );
  const boom = async () => {
    throw new Error("down");
  };
  assert.match(
    (await judgePlainWords("x", { apiKey: "k", fetchImpl: boom })).skipped,
    /down/
  );
});
test("judgeBody: mechanical failure never reaches the judge", async () => {
  const never = async () => {
    throw new Error("called");
  };
  assert.equal(
    (await judgeBody("no marker", { apiKey: "k", fetchImpl: never })).ok,
    false
  );
});
test("judgeBody: low score fails and names the score and rubric line", async () => {
  const r = await judgeBody(GOOD, { apiKey: "k", fetchImpl: reply(0.3) });
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /0\.30 of 3.*cannot tell what is wrong/);
});
test("judgeBody: no key falls back to the mechanical verdict", async () =>
  assert.equal((await judgeBody(GOOD, {})).note, "judge skipped: no key"));

test("issue references and plain numbers are allowed", () =>
  assert.equal(
    checkPlainWords(
      "**In plain words:** issue #12 asks for 3 checks on 41 issues. It touches the tracker. Done when 0 issues fail."
    ).ok,
    true
  ));
test("a 149-word paragraph passes", () =>
  assert.equal(
    checkPlainWords(`**In plain words:** A. B. C. ${"word ".repeat(146)}`).ok,
    true
  ));
