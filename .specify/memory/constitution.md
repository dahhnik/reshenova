# Reshenova Constitution

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)
Every piece of code must be readable, minimal, and purposeful; no dead code, no speculative abstractions; functions do one thing; naming is self-documenting; complexity must be justified by a concrete requirement, never by anticipation of future needs; all changes pass linting and type-checking before merge.

### II. Test-First Development (NON-NEGOTIABLE)
TDD is mandatory: tests are written and approved before implementation begins; Red-Green-Refactor cycle is strictly enforced; no feature ships without tests covering the happy path and at least one failure path; test names describe behavior, not implementation.

### III. Testing Standards
Unit tests cover all pure logic; integration tests cover every external boundary (APIs, storage, parsers); end-to-end tests cover the primary user journey (text in → decision out); test coverage floor is 80% for new code; flaky tests are fixed immediately — never skipped; mocks are used only at true system boundaries, never to replace real logic.

### IV. User Experience Consistency
The product surface must behave predictably: identical inputs produce identical outputs; error messages are human-readable and actionable; latency is communicated to the user (loading states, progress indicators); UI language is consistent — same terminology throughout; no feature breaks existing keyboard or screen-reader accessibility.

### V. Performance Requirements
P95 response time for any decision request ≤ 2 seconds under normal load; initial page/CLI load ≤ 1 second; no blocking operations on the main thread; pagination or streaming required for any result set that can exceed 50 items; performance regressions that exceed 20% of baseline must be addressed before merge.

## Quality Gates

All pull requests must satisfy:
- Linting and type-checking pass with zero errors
- All existing tests pass
- New code meets the 80% coverage floor
- No P95 regression > 20% measured against the baseline
- UX copy reviewed for consistency with existing terminology

## Development Workflow

1. Write failing tests first, get approval
2. Implement until tests pass
3. Refactor without changing behavior
4. Verify performance benchmarks
5. PR review against all principles above

## Governance

This constitution supersedes all other practices and style guides; amendments require a written rationale, approval, and a migration plan for existing code; all PRs and code reviews must explicitly verify compliance with these principles; violations are blocking, not advisory.

**Version**: 1.0.0 | **Ratified**: 2026-04-28 | **Last Amended**: 2026-04-28
