# Security Policy

## Supported versions

Security fixes are applied to the latest release on the default branch. Older versions may not receive patches.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting a vulnerability

If you believe you have found a security issue in **agent-readiness-kit**, please report it responsibly.

**Preferred:** use [GitHub private vulnerability reporting](https://github.com/alipajand/agent-readiness-kit/security/advisories/new) so maintainers can review and respond without public disclosure.

**Do not** open a public GitHub issue for undisclosed vulnerabilities.

Include in your report:

- Description of the issue and potential impact
- Steps to reproduce
- Version (`ark --version` or `package.json`)
- Environment (OS, Node.js version)

### Response expectations

| Stage                  | Target                                           |
| ---------------------- | ------------------------------------------------ |
| Initial acknowledgment | Within 7 days                                    |
| Status update          | Within 30 days                                   |
| Fix or mitigation plan | Depends on severity; critical issues prioritized |

We follow coordinated disclosure: please allow reasonable time for a fix before public disclosure.

## Scope

### In scope

- Arbitrary file read/write when running `ark init`, `ark generate`, or `ark audit --output` with untrusted paths
- Path traversal or symlink issues in repo scanning
- Unsafe defaults that could overwrite user files without `--force` or `--allow-outside`
- Supply-chain issues in published npm dependencies

### Out of scope

- Security of repositories you audit with `ark` (the tool inspects your codebase; it does not secure it)
- Misconfiguration of AI agents (Cursor, Copilot, etc.) in your project
- Vulnerabilities in third-party repos you point `ark` at

## Design boundaries

- **No telemetry** — the CLI does not phone home.
- **No authentication** — there are no accounts or API keys for ark itself.
- **No LLM or external API calls** during audit — scoring is local and heuristic.
- **Secrets** — do not commit `.env`, tokens, or credentials. Use `.env.example` as documentation only.

## Safe usage

- Prefer running `ark` on repositories you trust. It is hardened for untrusted input (see below), but scaffolding commands still write files into the target repository.
- Review generated files before committing; use `--force` only when you intend to overwrite.
- Treat audit reports as guidance, not a substitute for human review or production security review.

## File writes

`init`, `generate`, and `fix` write only to fixed paths under the target repository through `writeFileSafe`, which:

- skips existing files unless `--force` is passed;
- treats a symlink at the target (including a dangling one) as existing, and never writes through it, even with `--force`;
- refuses any write that would land outside the repository after following symlinked directories (for example `.github -> /elsewhere`).

Refused writes are reported as `Refused (...)` and nothing is written.

`ark audit` records score history in `.ark-history.json` by default. That write is refused, with a warning, when the file is a symlink or resolves outside the repository; the audit still completes. Malformed history content is ignored.

`audit --output` and `badge --output` take a destination path from you. Every such path is resolved against the audited repository root and must stay inside it:

| `--output` path                              | Resolved as                           | Result                |
| -------------------------------------------- | ------------------------------------- | --------------------- |
| Relative (for example `docs/report.md`)      | Under the **audited** repository root | Written               |
| Relative with `..` (for example `../x.md`)   | Normalised, then checked              | Rejected, exit code 1 |
| Absolute inside the repo                     | Used as given                         | Written               |
| Absolute elsewhere (for example `/tmp/x.md`) | Used as given                         | Rejected, exit code 1 |

Rejection is enforced by `resolveOutputPath` (`src/fs/resolveOutputPath.ts`) before the audit runs, so no report or badge is produced for an escaping path. The check runs both lexically and after resolving symlinks in the existing part of the path, so a symlinked directory inside the repo cannot redirect the write. The report is never written through a symlink at the final path component.

Passing `--allow-outside` disables the containment check for a path given on the command line. It never applies to `audit.output` from `.arkrc`.

## Untrusted `.arkrc`

`.arkrc` comes from the repository being audited or scaffolded, so:

- `audit.repoPath`, `init.repoPath`, and `generate.repoPath` must stay inside the directory that contains `.arkrc`. Otherwise `init`/`generate` could scaffold, or with `force` overwrite, files in another project.
- `audit.output` must stay inside the audited repository.
- `.arkrc` must be a regular file under 1 MiB.

## Reading untrusted repositories

- Symlinked directories are not traversed during the audit, and symlinked files count only when they point to a regular file inside the repository. A link such as `docs -> /` cannot walk the audit across the filesystem or list outside files in a report.
- Only regular files up to 1 MiB are read, so FIFOs, devices, or huge files cannot hang an audit.
- Control characters and invisible Unicode in file names and messages are neutralized in terminal output. Markdown reports escape HTML and use fence-safe code spans; HTML reports escape all text.

## Dependency updates

Dependency updates are managed via [Dependabot](https://docs.github.com/en/code-security/dependabot) on `main` for npm and GitHub Actions (see [`.github/dependabot.yml`](.github/dependabot.yml)). Installs use pnpm 11, which blocks dependency install scripts unless allowed in `pnpm-workspace.yaml` and refuses packages published less than a day ago. Transitive security floors live in `pnpm-workspace.yaml` `overrides`.

## Environment variables

See [.env.example](.env.example). No secrets are required to run the CLI.
