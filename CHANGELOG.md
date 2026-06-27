# Changelog

All notable changes to agent-readiness-kit are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-19

### Added

- `ark audit` — deterministic repository audit with terminal, JSON, Markdown, HTML, JUnit, and SARIF output
- `ark init`, `ark generate`, and `ark fix` — safe-write scaffolding for agent instruction files
- Thirteen audit categories covering agent docs, architecture, workflow, testing, safety, navigability, and tooling
- Score history via `.ark-history.json`
- Starter prompt templates under `docs/prompts/`
- Cursor rules under `.cursor/rules/`
