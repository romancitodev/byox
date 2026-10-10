# 🔨 byox

**English** | [Español](README.es.md)

Self-hosted "build your own X": courses that are Forgejo repositories. Every stage is
an issue with a test, the issues form a dependency graph, and every push runs the
tests, closes what passes and unlocks what comes next. Courses can be written by an AI
through an MCP server or by a person by hand, and either way they are verified against
a real reference solution before they are published.

[Documentation (Spanish)](mcp/web/src/docs/index.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Code of conduct](CODE_OF_CONDUCT.md)

> The official documentation (`mcp/web/src/docs/`), the bundled courses and the web app
> are in Spanish; the web app also has an English interface. This README, the contributing
> guide and the security policy are available in both languages.

## How it works

A course is a real project split into stages. Whoever takes it receives a repository with
a skeleton that compiles and tests that fail; solving a stage means making its test pass.

1. `byox start <course>` (or the button in the web app) creates your private repo with one issue per stage.
2. You write code and test locally with `byox test`, in the same Docker image the CI uses.
3. You `git push`. The Forgejo runner runs the tests of the open issues.
4. Passing stages are closed, the ones that depended on them are unlocked, and the app and the CLI show you the result (file and line included when something fails).

Everything runs on your machine or your server: a Forgejo, a runner that executes the tests
in Docker, and one application (web app, HTTP API and MCP server). There are no external
services and no third-party accounts.

## Project status

byox can be installed and used today, but it is a young project. What exists and what does not:

| Done | Pending or limited |
|---|---|
| Local install with `setup.sh` and Docker Compose | The automated test suite covers the MCP server; the web app and the CLI are tested by hand |
| Accounts (Forgejo users), sessions and personal tokens | **Open sign-up is not safe yet**: the bot is a collaborator on every learner repo and the runner uses the host's Docker socket (see [Security](SECURITY.md)) |
| MCP server with tools to write, verify and publish courses and to assist the learner | Isolated execution of tests, per-repository credentials and quotas: not implemented |
| Web app, landing page and documentation (Astro) | A paid hosted version is only a future plan; there are no plans, prices or dates |
| Native CLI (Rust): progress, tests, hints, course creation and sharing | The Redis course is unfinished (66 stages published; see [Courses](#courses)) |
| State in JSON files, or in Postgres for servers | Moving an existing install to Postgres is a manual process |
| A two-VPS simulation on Kubernetes with kind | The Kubernetes simulation is a test bench, not an install method |

## Quick start

You need Docker (with Compose), Git and `bash` (Git Bash or WSL on Windows).

```bash
git clone https://github.com/romancitodev/byox.git
cd byox
bash setup.sh
```

`setup.sh` creates the admin user (`BYOX_USER`, `owner` by default), the `byox` bot, the
`cursos` organization, registers the runner and starts everything. The password is saved in
`.env`. You can run it again safely.

Everything requires an account: open http://localhost:3333/app and sign in with that user.
To add more people, set `BYOX_SIGNUP=invite` (or `open`) in `.env`.

| | |
|---|---|
| **Your courses** | http://localhost:3333/app |
| Landing page | http://localhost:3333 |
| Documentation | http://localhost:3333/docs |
| Forgejo | http://localhost:3000 |
| MCP | http://localhost:3333/mcp |

The step-by-step guide (in Spanish) is [Inicio rápido](mcp/web/src/docs/inicio-rapido.md).

## Components

| Folder | What it is | Technology |
|---|---|---|
| [`mcp/`](mcp) | Server: HTTP API, MCP server, state, course verification | TypeScript (Node 22) |
| [`mcp/web/`](mcp/web) | Landing page, documentation and web app; the MCP serves the built output | Astro |
| [`mcp/assets/`](mcp/assets) | What byox copies into each learner repo (workflows, scripts, templates, format guide) | YAML, JS, templates |
| [`cli/`](cli) | The `byox` command | Rust |
| [`courses/`](courses), [`examples/`](examples) | Bundled courses | See [Courses](#courses) |
| [`deploy/k8s-sim/`](deploy/k8s-sim) | A kind simulation of two VPS with horizontal runners | Bash, Kubernetes |
| [`docker-compose.yml`](docker-compose.yml), [`docker-compose.cloud.yml`](docker-compose.cloud.yml) | The services and the Postgres variant | Docker Compose |
| [`setup.sh`](setup.sh), [`scripts/`](scripts) | Installation and uploading courses from a folder | Bash, Node |

An instance is three services: `forgejo` (repos, issues, Actions), `runner` (runs the tests
in containers using the host's Docker) and `mcp` (the app).

## Courses

The courses are written in Spanish.

| Course | Language | Stages | Status |
|---|---|---|---|
| [`build-your-own-redis`](courses/build-your-own-redis) | Rust | 66, in 5 milestones (RESP, server, strings, expiry, lists) | In progress: persistence, transactions, pub/sub, replication and more are still missing. The tests compare against a real `redis-server` |
| [`build-your-own-parallel`](courses/build-your-own-parallel) | Rust | 16, in 6 milestones | Published: parallel reduction, scan, odd-even and merge sort |
| [`build-your-own-calc`](examples/build-your-own-calc) | Python | 3, in 2 milestones | Small example: tokenizer and evaluator |

Every stage ends with a "Para leer" (further reading) section and every course cites its
sources on its cover page: specifications, official documentation and books. Those works keep
their own licenses; the courses do not copy their content.

To upload a course from a folder to a running instance (with a personal token in `BYOX_TOKEN`):

```bash
docker run --rm --network byox -e BYOX_TOKEN=byox_… -v "$PWD:/w" -w /w node:22-bookworm-slim \
  node scripts/push-course.mjs examples/build-your-own-calc --verify --start
```

## The CLI

`byox` is a native executable (Rust) that talks to the same API as the web app. Inside a
course repo it detects which course it is.

```bash
cargo install --path cli
byox login byox_…   # create the token in the app: Account → Tokens (or the BYOX_TOKEN variable)
```

| Command | What it does |
|---|---|
| `byox` | Progress, current stage and the result of the last push (with the error and file:line if it failed) |
| `byox test [n]` | Runs the tests in Docker, in the same image as the CI, and tells you what failed and where. `--local` uses `sh` and your own tools |
| `byox watch` | After `git push`: waits for the CI and tells you what closed, what opened and what failed |
| `byox show [n]` | The stage instructions in the terminal |
| `byox hint [n]` | The next hint |
| `byox log [n]` | The test output from the CI, with the error lines highlighted |
| `byox open [n]` | Opens the stage in the web app |
| `byox courses` / `byox clone <course>` | Your courses, and cloning the repo of one |
| `byox new <course> --lang python\|rust\|go\|node` | A hand-written course, from a template that already works |
| `byox check [course]` | How the course you are writing turned out: format and, per stage, whether the skeleton fails and the solution passes |
| `byox start <course>` | Starts a verified course: creates your repo with the issues |
| `byox export <course>` | Copies the course code so you can share it (`-o course.byox` saves it to a file) |
| `byox import [code\|file]` | Imports a course; with no argument, the code on the clipboard |
| `byox guide` | The course format |

Without the CLI, on Windows: `.course\test 7` (it also runs in Docker). More in [CLI](mcp/web/src/docs/cli.md) (Spanish).

## The web app

http://localhost:3333/app is where you follow the courses:

- A sidebar with the stages per milestone: ✓ done, ⋯ available, # blocked.
- Each course's cover page (`/app/c/<course>`) with the README, a clickable stage map and a button to continue.
- Rendered instructions, the command to verify locally and your hints (you ask for the next one with a button).
- At the top, the live status of the last push: running, finished, link to the logs.
- When a push closes stages, a notice with what was unlocked and a button to the next one.
- On the right: your streak, your progress and what depends on what.
- **Created** (`/app/creados`): the courses you wrote, with the verification status of each push
  (the skeleton must fail and the solution must pass, stage by stage) and the log of what fails.
  From there you create a new course from a template or import one.
- **Share**: on a course's cover page, a `byox1-…` code to copy or a `.byox` file to download.
  Whoever receives it imports it from Created, with a preview before confirming.

The landing page (http://localhost:3333) explains byox with an invented example course.
The old routes (`/cursos`, `/actividad`, `/c/...`) redirect to `/app`.

The web is an [Astro](https://astro.build) project in `mcp/web/` (landing in
`src/pages/index.astro`, app in `src/pages/app.astro`, documentation in `src/docs/`). The MCP's
Dockerfile builds it and the MCP serves the result. To work on it with live reload, with the MCP
running in Docker:

```bash
cd mcp/web && npm install && npm run dev
```

It runs on http://localhost:4321 and proxies `/api` to the MCP on `:3333` (another target with
`BYOX_API`). To show a GitHub link on the landing page, add `PUBLIC_GITHUB_URL` to `.env` and
bring it up again with `docker compose up -d --build mcp`.

## The assistant (MCP)

Connect Claude Code (the MCP requires a personal token; create it in Account → Tokens):

```bash
claude mcp add --transport http byox http://localhost:3333/mcp \
  --header "Authorization: Bearer byox_…"
```

To write and publish courses:

| Tool | What it does |
|---|---|
| `get_format_guide` | The format and the rules for writing a course |
| `list_courses` | Created courses and their progress |
| `read_course` | Reads files from the source repo |
| `write_course_files` | Writes files to the source repo (one commit) |
| `validate_course` | Checks format and graph |
| `verify_course` | Runs the tests in the real image: the skeleton must fail and the solution must pass |
| `start_course` | Publishes your course repo (only if the commit is verified) |
| `upgrade_course` | Brings the course's changes into an already started repo, without touching the learner's code |
| `course_status` | What is closed, available or blocked |
| `export_course` / `import_course` | A course's code to share, and importing it |

To assist the learner while they take a course:

| Tool | What it does |
|---|---|
| `where_am_i` | Progress in each course, available stages and failing tests with their file:line |
| `get_stage` | A stage's instructions, what it depends on, what it unlocks and the hints already requested |
| `explain_failure` | Why a test fails: diagnosis, log lines and the learner's code at that commit |
| `get_hint` | Requests the next hint and returns it when the bot publishes it |
| `ci_status` | The last push and the result of each tested stage |
| `read_my_code` | Reads the learner's repo in Forgejo |
| `my_stats` | Streak, record, and courses created, started and finished |

There are also prompts, which show up as commands in Claude Code: `/mcp__byox__atascado`,
`/mcp__byox__que_sigue`, `/mcp__byox__revisar_etapa` and `/mcp__byox__crear_curso`. The web app
shows whether an assistant is connected: since the MCP has no sessions, a client counts as
connected if it used the MCP in the last 15 minutes. More in
[Asistente (MCP)](mcp/web/src/docs/asistente.md) (Spanish).

## Accounts and permissions

Accounts are Forgejo users; byox does not store passwords. The web app uses a session
(`HttpOnly` cookie), and the MCP and the CLI use personal `byox_…` tokens (stored hashed).

| Variable | Values | What it does |
|---|---|---|
| `BYOX_SIGNUP` | `closed` (default), `invite`, `open` | Who can create an account |
| `BYOX_AUTHORS` | `admin` (default), `all` | Who writes, verifies and imports courses (it runs code in Docker) |
| `BYOX_PUBLIC_URL`, `BYOX_DOMAIN`, `BYOX_WEB_URL` | URLs | Public addresses when it is not localhost |
| `BYOX_TRUST_PROXY`, `BYOX_SECURE_COOKIES` | `1` | Behind an HTTPS proxy |

All variables are in [Configuración](mcp/web/src/docs/configuracion.md) (Spanish).

> **Known limit.** The `byox` bot is a collaborator on every learner repo and its token is
> available as an Actions secret, and the tests run with the host's Docker. A shared instance
> is not isolated between strangers: use it with teams and classrooms you trust. Details in
> [SECURITY.md](SECURITY.md).

## On a server

- **Postgres.** By default Forgejo uses SQLite and the MCP keeps its state (sessions, tokens,
  invitations, results) in JSON files in `BYOX_DATA`. For a server, `docker-compose.cloud.yml`
  moves both to Postgres (one database and one user per service): set
  `COMPOSE_FILE=docker-compose.yml:docker-compose.cloud.yml` in `.env` and run `./setup.sh`, which
  generates the passwords. With `DATABASE_URL` in its environment the MCP uses Postgres (a `kv`
  table, created automatically). Forgejo picks its database the first time it starts: to move an
  existing install you have to run `forgejo dump` and restore.
- **Simulation.** [`deploy/k8s-sim`](deploy/k8s-sim) brings up in kind the equivalent of two VPS
  (one with the core, others with runners) to test the topology.
- The general guide: [Llevarlo a producción](mcp/web/src/docs/produccion.md) (Spanish).

## What byox creates

```
cursos/<slug>            source repo (written by the AI or a person)
├── README.md            cover page
├── course.yaml          milestones, issues, deps, tests, hints
├── issues/*.md          body of each issue
├── files/**             skeleton the learner receives
└── solution/**          reference solution (not published)

<you>/<slug>             your repo (created by start_course)
├── .course/run.sh       runs the tests: sh .course/run.sh [n...]
├── .course/byox.mjs     plan / advance / hint, used by the workflows
└── .forgejo/workflows/  byox.yml (push) and pista.yml (/pista)
```

On every push to `main`: **plan** lists the open issues; **test** runs each one's test in the
course image; **advance** closes the ones that passed and have their dependencies closed
(cascading), moves the `bloqueado` and `disponible` labels and notifies the MCP to update your
profile. Commenting `/pista` on an issue publishes the next hint; hints travel as an Actions
secret and are not in your repo. The MCP also maintains `<you>/.profile`, which Forgejo shows on
your profile: streak, courses and a 16-week heatmap. More in
[Cómo funciona](mcp/web/src/docs/como-funciona.md) (Spanish).

## Writing and sharing courses

Besides asking the AI, you can build a course yourself with your editor and git:

```bash
byox new build-your-own-grep --lang rust --title "build-your-own-grep"
cd build-your-own-grep
# course.yaml, issues/, files/ (what the learner receives) and solution/
git push
byox check
byox start build-your-own-grep
```

`byox new` creates `cursos/<course>` from a template with two issues, tests and a solution that
already pass verification, with `origin: human` in `course.yaml`. Forgejo notifies the MCP on every
push to the source repo and the MCP verifies it by itself (15 s after the last push): with `files/`
every test must fail, and with `files/` + `solution/`, pass. The full format: `byox guide` or
[Crear y compartir cursos](mcp/web/src/docs/cursos.md) (Spanish).

`byox export <course>` copies a `byox1-…` code to the clipboard: the whole source repo (with the
solution), compressed. It does not go through any server: you send it however you like and the
other person pastes it into `byox import` or into **Import** in the web app. The tests of an
imported course run on your Docker: only import codes from people you trust.

## Contributing

Contributions are welcome: code, new courses, documentation and bug reports.
[CONTRIBUTING.md](CONTRIBUTING.md) explains how to set up the environment, run the tests, the
commit format and how to propose a course. Taking part means respecting the
[code of conduct](CODE_OF_CONDUCT.md). Vulnerabilities are reported privately, as described in
[SECURITY.md](SECURITY.md). Issues and pull requests can be written in English or Spanish.

## Licenses

Each part has the license that fits it best, with the full text in the `LICENSE` of its folder.

| What | License | Where |
|---|---|---|
| Code: app, API, MCP server, web, CLI, `setup.sh` and Compose | [AGPL-3.0-or-later](LICENSE) | repository root |
| Templates, workflows and guide that byox copies into learners' repositories | [MIT](mcp/assets/LICENSE) | `mcp/assets/` |
| Bundled courses | [CC BY-SA 4.0](courses/LICENSE) | `courses/`, `examples/` |
| Documentation | [CC BY 4.0](mcp/web/src/docs/LICENSE) | `mcp/web/src/docs/` |

- You can use, modify and self-host byox for free. If you offer a modified version as a network service, the AGPL requires you to publish your changes under the same license.
- What byox generates inside your learners' repositories (workflows, test scripts) is MIT, so it places no conditions on your courses. The courses you write are yours and you license them as you like.
- The courses in `courses/` and `examples/` cite their sources (specifications, documentation and books) in the "Para leer" section of each stage and on their cover page; those works keep their own licenses.
- Dependencies are not included in the repository: they are installed with `npm` and `cargo`. The direct ones use permissive licenses (MIT, ISC, Apache-2.0, OFL for the fonts), except [GSAP](https://gsap.com/standard-license), which has its own free-of-charge license and is not open source.
