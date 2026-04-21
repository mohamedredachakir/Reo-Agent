# Reo Agent Project TODO (Finish Checklist)

## Current conclusion

Project status is **MVP / in progress**. Core functionality exists, but it is **not finished for stable release** yet.

## 1) Critical blockers (must fix first)

- [x] Fix TypeScript compile errors in [src/main.tsx](src/main.tsx)
  - Problem: ANSI escapes use `\033` (octal escape), rejected by TypeScript.
  - Expected fix: use `\x1b` escape form consistently.
  - Done when: `bun run typecheck` passes with zero errors.

- [x] Re-run full typecheck after blocker fix
  - Command: `bun run typecheck`
  - Goal: reveal any additional hidden typing issues after first blocker is cleared.

## 2) Product features still incomplete

- [x] Make `/config` fully persistent through command flow
  - Current behavior says config changes are not yet persisted from slash command path.
  - Done when: `/config <key> <value>` updates YAML config and survives restart.

- [x] Implement real `/cost` tracking
  - Current output is static placeholder values.
  - Done when: command reports real token usage and estimated cost per session.

- [x] Reconcile CLI options with actual behavior
  - `--no-stream`, `--model`, `--max-tokens`, `--temperature` are declared but not fully wired in entry flow.
  - Done when: each option impacts runtime behavior as advertised.

## 3) Architecture and code quality gaps

- [x] Remove duplicate/overlapping tool implementations where possible
  - `glob` and `grep` exist in multiple tool files with overlapping responsibilities.
  - Done when: one clear implementation per tool behavior and registry is consistent.

- [x] Align versions and constants in one source of truth
  - Example: header/version values should come from package version everywhere.
  - Done when: no hardcoded stale version strings in UI/commands.

- [ ] Strengthen error handling and user feedback
  - Normalize command/tool errors and exit codes.
  - Done when: errors are actionable and consistent for users.

## 4) Testing and reliability work

- [x] Add unit tests for core modules
  - Priority modules: `QueryEngine`, command parsing, tool registry, file tools.

- [ ] Add integration tests for CLI workflows
  - Cases: slash commands, streaming mode, tool call loops, malformed input.

- [ ] Add regression tests for known issues
  - First regression: ANSI escape compile failure in main CLI.

- [x] Add CI pipeline gates
  - Required checks: typecheck, lint, build, tests.
  - Done when: PRs are blocked on failing checks.

## 5) Documentation gaps

- [x] Expand [docs/architecture.md](docs/architecture.md)
  - Current architecture doc is too minimal.

- [x] Expand [docs/index.md](docs/index.md)
  - Add practical usage flows, command examples, and troubleshooting.

- [ ] Keep README aligned with real implementation status
  - Mark experimental features clearly and avoid overpromising.

## 6) Release-readiness criteria

Project can be considered "finished" when all conditions below are true:

- [x] `bun run typecheck` passes
- [x] `bun run lint` passes
- [x] `bun run build` and `bun run build:prod` pass
- [x] No placeholder command outputs for key commands (`/config`, `/cost`)
- [x] Core CLI options work as documented
- [x] Tests exist and pass in CI
- [x] Documentation reflects actual behavior and limitations

---

Prepared on 21 April 2026 from current repository analysis and build output.
