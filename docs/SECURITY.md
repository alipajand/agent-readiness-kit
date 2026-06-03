# Security Policy

## Supported versions

Security fixes are applied to the latest release on the default branch. Older versions may not receive patches.

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

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

| Stage | Target |
| --- | --- |
| Initial acknowledgment | Within 7 days |
| Status update | Within 30 days |
| Fix or mitigation plan | Depends on severity; critical issues prioritized |

We follow coordinated disclosure: please allow reasonable time for a fix before public disclosure.

## Scope

### In scope

- Arbitrary file read/write when running `ark init`, `ark generate`, or `ark audit --output` with untrusted paths
- Path traversal or symlink issues in repo scanning
- Unsafe defaults that could overwrite user files without `--force`
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

- Run `ark` only on repositories you trust.
- Review generated files before committing; use `--force` only when you intend to overwrite.
- Treat audit reports as guidance, not a substitute for human review or production security review.

## Dependency updates

Dependency updates are managed via [Dependabot](https://docs.github.com/en/code-security/dependabot) on the `develop` branch (see [`.github/dependabot.yml`](../.github/dependabot.yml)).

## Environment variables

See [.env.example](../.env.example). No secrets are required to run the CLI.
