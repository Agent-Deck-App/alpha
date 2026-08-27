# Items under agent-deck-app/alpha#1

The whole plan, for context. Other items are being worked separately — do not do their work.

- agent-deck-app/alpha#2 — Scaffold the package and the report type
- agent-deck-app/alpha#3 — A fixture helper that builds a repo from an object literal
  blocked by agent-deck-app/alpha#2
- agent-deck-app/alpha#4 — Detect Node version files
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3
- agent-deck-app/alpha#5 — Parse .tool-versions
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3
- agent-deck-app/alpha#6 — Parse .mise.toml
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3
- agent-deck-app/alpha#7 — Detect Python and Ruby version files
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3, agent-deck-app/alpha#4
- agent-deck-app/alpha#8 — Parse go.mod toolchain directives
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3
- agent-deck-app/alpha#9 — Read packageManager and engines from package.json
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3
- agent-deck-app/alpha#10 — Map lockfile to package manager and install command
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3, agent-deck-app/alpha#9
- agent-deck-app/alpha#11 — Detect the Python ecosystem's install command
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3, agent-deck-app/alpha#10
- agent-deck-app/alpha#12 — Detect Rust and Ruby projects
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3
- agent-deck-app/alpha#13 — Read devcontainer.json
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3
- agent-deck-app/alpha#14 — Extract test and build commands from package.json scripts
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3, agent-deck-app/alpha#10
- agent-deck-app/alpha#15 — Extract Makefile targets
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3
- agent-deck-app/alpha#16 — Extract the test command from GitHub Actions workflows
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3
- agent-deck-app/alpha#17 — Read the turbo.json task graph
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3
- agent-deck-app/alpha#18 — Detect workspace layout
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3, agent-deck-app/alpha#9
- agent-deck-app/alpha#19 — Index .claude/skills
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3
- agent-deck-app/alpha#20 — Index glob-triggered rule files
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3, agent-deck-app/alpha#19
- agent-deck-app/alpha#21 — Collect standing context files
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3
- agent-deck-app/alpha#22 — Compose every detector and resolve conflicts
  blocked by agent-deck-app/alpha#2, agent-deck-app/alpha#3, agent-deck-app/alpha#10, agent-deck-app/alpha#14
- agent-deck-app/alpha#23 — A CLI entry point
  blocked by agent-deck-app/alpha#22