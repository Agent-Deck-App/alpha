# repo-probe: detect how a repository wants to be provisioned and tested

Parent spec item agent-deck-app/alpha#1 — https://github.com/Agent-Deck-App/alpha/issues/1

A zero-dependency TypeScript library that inspects a repository checkout and
reports what it needs: toolchain versions, package manager and install command,
the real test command, monorepo layout, and any agent-instruction files it
carries.

Filesystem in, JSON out. No network, no subprocesses, no environment mutation —
`probe()` reads a directory and returns a report. Deciding what to *do* with the
report belongs to the caller.

## Why

Provisioning a checkout by inference beats provisioning it by prompt: it costs no
tokens, it fails before any work starts, and it can say *why* it failed. The
signals are already there in the repo — a lockfile names the package manager, CI
is the most honest description of how a project is really tested.

## Shape

```
src/
  index.ts          probe() and the report types
  detect/           one module per signal
  fixtures.ts       test helper: materialise a tree from an object literal
test/
```

Each detector is independent, takes a root path, and returns its own slice of the
report or null. `probe()` composes them and resolves conflicts.

## Conventions

- TypeScript, strict, ESM, Node 22.
- vitest. Every detector gets a fixture directory built inline in its own test.
- No runtime dependencies. Parsing a TOML or YAML subset by hand is preferred to
  taking a dependency — we only need the handful of keys named in each item, and
  a targeted parser that fails loudly on what it does not understand is better
  here than a general one that guesses.
- Every detector reports *what it saw*, not just its conclusion, so a wrong
  answer can be traced to the file that caused it.