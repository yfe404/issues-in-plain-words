<!-- Paste this into AGENTS.md or CLAUDE.md. -->

## Issues open in plain words

Every issue body opens with "**In plain words:**" and 3 to 5 sentences for
someone who does not know the code: what is wrong or wanted, which part of the
product, how we know it is done. No code spans, paths or hashes in it; `#N`
references and plain numbers are fine; at most about 150 words. It comes before
anything else, including in `gh issue create --body-file`.

Before you create an issue, run
`node scripts/check-issue-plain-words.mjs <body-file>` and fix what it reports.
A workflow labels issues that fail `needs plain words`.
