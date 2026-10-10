# Contributing to byox

**English** | [Español](CONTRIBUTING.es.md)

Thanks for wanting to help. byox accepts code, new courses, documentation and bug reports.
Before starting something big, open an issue to talk it over: it avoids duplicated work and tells
you quickly whether the idea fits. Issues and pull requests can be written in English or Spanish.

Taking part means respecting the [code of conduct](CODE_OF_CONDUCT.md). If you found a vulnerability,
**do not open an issue**: follow [SECURITY.md](SECURITY.md).

## What is in the repo

| Folder | What it is |
|---|---|
| `mcp/` | Server (TypeScript, Node 22): API, MCP, state and course verification. Tests in `mcp/test/` |
| `mcp/web/` | Landing page, documentation (`src/docs/*.md`, in Spanish) and web app, in Astro |
| `mcp/assets/` | What byox copies into learner repos (workflows, `byox.mjs`, templates, `guide.md`) |
| `cli/` | The `byox` command, in Rust |
| `courses/`, `examples/` | Bundled courses (written in Spanish) |
| `deploy/k8s-sim/` | Kubernetes (kind) simulation of two VPS (Bash). Tests in `deploy/k8s-sim/test*.sh` |

## Development environment

All you strictly need is Docker with Compose, Git and `bash` (Git Bash or WSL on Windows). You do
not need Node on your machine: the server and the web app are built and tested in containers.

```bash
git clone https://github.com/romancitodev/byox.git
cd byox
bash setup.sh                      # first time: creates the user, bot, org and runner
docker compose up -d --build mcp   # after changing the server or the web app
```

The app is at http://localhost:3333/app (user and password in `.env`, which is never committed: it is
in `.gitignore`).

### The web app with live reload

With the MCP running in Docker and Node 22 installed:

```bash
cd mcp/web && npm install && npm run dev
```

It runs on http://localhost:4321 and proxies `/api` to the MCP on `:3333` (another target with
`BYOX_API`). Do not touch `mcp/web/src/legacy/`.

### The CLI

You need Rust 1.85 or newer (it uses the 2024 edition):

```bash
cd cli
cargo build
cargo run -- --help
```

You can also build it without installing anything on the host:

```bash
docker run --rm -v "$PWD/cli:/src:ro" -v byox-cargo-target:/target -e CARGO_TARGET_DIR=/target \
  -w /src rust:1-bookworm cargo build --locked
```

## Running the tests

These are the same commands the CI runs (`.github/workflows/ci.yml`).

**MCP server** (builds with `tsc` and runs the tests in `mcp/test/`):

```bash
docker build --target build -t byox-mcp:build ./mcp
docker run --rm -v "$PWD/mcp/test:/app/test:ro" byox-mcp:build node --test "test/*.test.mjs"
```

On Windows with Git Bash, prefix the commands with `MSYS_NO_PATHCONV=1` and use `$(pwd -W)` instead of
`$PWD` inside the `-v` options.

**Web app** (checks that it builds):

```bash
docker build --target web -t byox-mcp:web ./mcp
```

**Kubernetes simulation** (optional, needs `kind` and `kubectl`, and takes a while): `deploy/k8s-sim/sim.sh up`
and `sim.sh test`.

If you change the server and add behavior, add a test in `mcp/test/` (they use `node:test`, no
dependencies). Changes to the web app and the CLI have no automated tests yet: try them by hand and
say in the PR what you checked.

## Commit format

Gitmoji + conventional commits, in English:

```
<type>(<scope>): <emoji> <description>
```

- `type`: `feat`, `fix`, `docs`, `chore`, `refactor`, `perf`, `test`, `ci`, `build`, etc.
- `scope` (optional): `mcp`, `web`, `cli`, `deploy`, `courses`, `docs`, etc.
- `emoji`: from [gitmoji.org](https://gitmoji.org) (✨ feature, 🐛 fix, 📝 documentation, 🔧 configuration, 💄 styles, ⚡ performance, ✅ tests).
- The description is lowercase, in the imperative mood and with no trailing period. Nothing else goes on the first line.

Real examples from the history:

```
feat(mcp): ✨ pluggable state store, usage metering and a Docker pool
fix(deploy): 🐛 mark shell scripts as executable
fix(web): 💄 stop the account tokens panel from overflowing
```

Small commits, each with a single purpose. If you add a `.sh` script, make sure it is executable in Git
(`git update-index --chmod=+x path/to/script.sh`).

## Pull requests

1. Fork and branch from `main`.
2. Run the tests that apply (above).
3. Open the PR using the template: what changes, why, and how you tested it.
4. If something visible changes (commands, variables, behavior), update the documentation in
   `mcp/web/src/docs/` and the READMEs. The documentation has to tell the truth: do not describe what does not exist yet.

## Proposing a new course

A course is a real project split into stages, each with its own test. There are two ways in.

**1. Open a "course proposal" issue** with the topic, the language, who it is for, a tentative list of
stages and the sources you will use. It helps check whether someone is already working on something similar.

**2. Write it.** The format is defined by byox's format guide (`mcp/assets/guide.md`), the same one the
assistant uses:

- with the CLI: `byox guide`;
- with an assistant connected to the MCP: the `get_format_guide` tool;
- in the documentation: [Crear y compartir cursos](mcp/web/src/docs/cursos.md) (Spanish).

The by-hand flow:

```bash
byox new build-your-own-grep --lang rust    # a template that already passes verification
# edit course.yaml, issues/, files/ (what the learner receives) and solution/
git push
byox check                                  # format + skeleton fails + solution passes, stage by stage
```

You can also upload a folder to a running instance and verify it:

```bash
docker run --rm --network byox -e BYOX_TOKEN=byox_… -v "$PWD:/w" -w /w node:22-bookworm-slim \
  node scripts/push-course.mjs courses/my-course --verify
```

Requirements for a course to land in `courses/`:

- **Verified.** With only `files/`, every test fails; with `files/` plus `solution/`, every test passes.
  The solution is complete and has actually been run.
- **Real sources.** Contracts, messages and numbers come from official documentation, the specification
  or from running the real implementation, and each stage ends with "Para leer" (further reading).
- **Original material.** Do not copy tests, statements or text from paid courses, books or other projects
  that are copyrighted or have no clear license. They can be cited as reading, with a link.
- **Credits.** The cover page has a "Créditos" section listing the sources.
- **License.** The courses in this repository are [CC BY-SA 4.0](courses/LICENSE): by submitting one you
  agree to publish it under that license.
- **Language.** Bundled courses are written in Spanish today; a course in another language is welcome, say so in the proposal.

## Documentation

The official documentation is in `mcp/web/src/docs/*.md` (CC BY 4.0 license, in Spanish) and the menu order in
`mcp/web/src/lib/docs-nav.js`. The READMEs (`README.md` in English and `README.es.md` in Spanish) are the
front page: keep them in sync, short, and linking to the documentation. Write in plain language, without marketing.

## Licenses for what you contribute

By submitting a contribution you agree that it is published under the license of the part of the repository
where it lands: AGPL-3.0-or-later for the code, MIT for `mcp/assets/`, CC BY-SA 4.0 for the courses and
CC BY 4.0 for the documentation (see the "Licenses" section of the [README](README.md)).
