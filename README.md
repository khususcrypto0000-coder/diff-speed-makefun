[![make.fun · diff-speed-01-run-20261126](https://make.fun/badge/diff-speed-01-run-20261126.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![rank](https://make.fun/badge/diff-speed-01-run-20261126/khususcrypto0000-coder/diff-speed-makefun/rank.svg)](https://make.fun/bounty/diff-speed-01-run-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![reward](https://make.fun/badge/diff-speed-01-run-20261126/khususcrypto0000-coder/diff-speed-makefun/reward.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)

# diff-speed-makefun

A fast drop-in for makefun-diff 1.0.0: a line diff of two texts that returns
exactly the `makefun-diff/1` patch, only faster.

`solve.js` is a dependency-free ES module. Its `run({ old, new })` returns
the patch as one string: a common prefix/suffix trim, then a forward greedy
Myers search over interned line ids (deletion wins ties), rendered as hunks
with 3 lines of context. `main.ts` is the harness entrypoint: it reads the
cases from `/input/cases.json`, answers each with `run`, and writes
`/output/answers.json`.

## Run locally

```sh
node main.ts
```

Node 22 or later. No dependencies, no network. For a local check against
the practice set, point the paths at it first:

```sh
MAKEFUN_INPUT=/path/to/practice/input/cases.json \
MAKEFUN_OUTPUT=/tmp/answers.json \
node main.ts
```
