# 🔨 byox

Self-hosted "build your own X": courses that are Forgejo repositories. Every stage is
an issue with a test, the issues form a dependency graph, and every push runs the
tests, closes what passes and unlocks what comes next. Courses can be written by an AI
through an MCP server or by a person by hand, and either way they are verified against
a real reference solution before they are published.

[Léelo en español](README.md) · [Docs (Spanish)](mcp/web/src/docs/index.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

> The documentation, the courses and most of the code comments are in Spanish. This page
> is a short summary in English.

## How it works

1. `byox start <course>` (or the button in the web app) creates your private repo with one issue per stage.
2. You write code and test locally with `byox test`, in the same Docker image the CI uses.
3. You `git push`. The Forgejo runner runs the tests of the open issues.
4. Passing stages are closed, the ones that depended on them are unlocked, and the app and the CLI show you the result (file and line included when something fails).

Everything runs on your machine or your server: a Forgejo, a runner that executes the
tests in Docker, and one application (web app, HTTP API and MCP server). There are no
external services and no third-party accounts.

## Quick start

You need Docker (with Compose), Git and `bash` (Git Bash or WSL on Windows).

```bash
git clone https://github.com/romancitodev/byox.git
cd byox
bash setup.sh
```

The script creates the admin user (`BYOX_USER`, `owner` by default), the `byox` bot, the
`cursos` organization, registers the runner and starts everything. The password is saved
in `.env`. Then open http://localhost:3333/app. Every route requires an account.

## Components

| Folder | What it is |
|---|---|
| `mcp/` | Server: HTTP API, MCP server, state, course verification (TypeScript) |
| `mcp/web/` | Landing page, documentation and web app (Astro) |
| `mcp/assets/` | What byox copies into each learner's repo: workflows, scripts, templates, format guide |
| `cli/` | The `byox` command (Rust) |
| `courses/`, `examples/` | Bundled courses: a Redis in Rust (66 stages so far, still growing), parallel algorithms in Rust (16), and a small calculator example in Python (3) |
| `deploy/vps/` | Single-VPS kit: bootstrap, Caddy, backups, monitoring and Discord alerts |
| `deploy/k8s-sim/` | A kind simulation of two VPS with horizontal runners (a test bench) |

## Status

Usable today, but young. Not done yet: isolated execution of course tests, per-repository
credentials, per-user quotas and course review. Until then **open sign-up is not safe**:
the bot account is a collaborator on every learner repository and the runner uses the
host's Docker socket. Use byox for yourself, your team or a classroom you trust (see
[SECURITY.md](SECURITY.md)). A paid hosted version is only a future plan: there are no
plans, prices or dates. Automated tests cover the MCP server and the VPS scripts; the web
app and the CLI are tested by hand.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) (set-up, tests, commit convention and how to propose
a course) and the [code of conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately,
as described in [SECURITY.md](SECURITY.md).

## Licenses

| What | License |
|---|---|
| Code (app, API, MCP server, web, CLI, `setup.sh`, Compose) | [AGPL-3.0-or-later](LICENSE) |
| Templates, workflows and guide copied into learners' repos (`mcp/assets/`) | [MIT](mcp/assets/LICENSE) |
| Bundled courses (`courses/`, `examples/`) | [CC BY-SA 4.0](courses/LICENSE) |
| Documentation (`mcp/web/src/docs/`) | [CC BY 4.0](mcp/web/src/docs/LICENSE) |

You can use, modify and self-host byox for free. If you offer a modified version as a
network service, the AGPL asks you to publish your changes under the same license. What
byox generates inside learners' repositories is MIT, so it places no conditions on the
courses you write. Courses cite their sources (specifications, official documentation,
books), which keep their own licenses.
