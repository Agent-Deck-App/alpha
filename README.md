# repo-probe

Detect how a repository wants to be provisioned and tested.

`probe()` reads a directory and returns a report: toolchain versions, package
manager and install command, the real test command, monorepo layout, and any
agent-instruction files the repository carries. Filesystem in, JSON out — no
network, no subprocesses, no environment mutation. Deciding what to *do* with the
report belongs to the caller.

Provisioning a checkout by inference beats provisioning it by prompt: it costs
nothing, it fails before any work starts, and it can say *why* it failed. The
signals are already there — a lockfile names the package manager, and CI is the
most honest description of how a project is really tested.

## Status

Early. The plan is [issue #1](https://github.com/Agent-Deck-App/alpha/issues/1).

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
```

Conventions are in [AGENTS.md](AGENTS.md).
