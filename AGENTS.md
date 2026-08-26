# Working in this repository

`repo-probe` inspects a repository checkout and reports how it wants to be
provisioned and tested. Filesystem in, JSON out.

The plan is [issue #1](https://github.com/Agent-Deck-App/alpha/issues/1) and its
sub-issues. Work one item at a time; the other items are being worked separately.

## Rules

- **No runtime dependencies.** Dev dependencies are fine. Where a format needs
  parsing — TOML, YAML, JSONC — write a targeted parser for the handful of keys
  the item actually names. A parser that fails loudly on what it does not
  understand is better here than a general one that guesses, and a wrong answer
  from this library is worse than no answer.
- **Every detector is independent.** It takes a root path and returns its own
  slice of the report, or null. It does not read another detector's output and it
  does not decide precedence — composition is its own work item.
- **Report what you saw, not just what you concluded.** A detector that returns
  `node: "22"` and nothing else cannot be debugged. One that also says which file
  it came from can.
- **Absent, empty and unparseable are three different results.** Collapsing them
  loses the distinction between "this repo does not use X" and "this repo uses X
  and we could not read it", and only the second is a problem.

## Conventions

- TypeScript, strict, ESM, Node 22. `verbatimModuleSyntax` is on, so use
  `import type` for type-only imports.
- Relative imports need the `.js` extension — this is `nodenext` resolution.
- vitest. Tests live beside the code as `*.test.ts`.
- Build fixture repositories with the `withRepo` helper rather than by hand.

## Before finishing an item

`pnpm test` and `pnpm typecheck` both pass. Both are expected to be green on a
clean checkout, so a failure is yours.
