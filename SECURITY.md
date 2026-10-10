# Security policy

**English** | [Español](SECURITY.es.md)

## How to report a vulnerability

**Do not open a public issue** with the details of a vulnerability.

Use GitHub's private reporting: in the repository's **Security** tab, **Report a vulnerability**
(https://github.com/romancitodev/byox/security/advisories/new). Only the maintainers can see it.

If you can, tell us:

- which component is affected (MCP server, API, web app, CLI, deploy scripts, the `mcp/assets/` templates);
- the steps to reproduce it and the effect it achieves;
- the version or commit, and how the instance was configured (`BYOX_SIGNUP`, `BYOX_AUTHORS`, whether it was behind a proxy).

byox is maintained by one person, so the response is best-effort and there are no guaranteed timelines. We
will acknowledge receipt, tell you whether we consider it a vulnerability, and let you know when there is a fix.
If you want, we will credit you in the public advisory.

If you find secrets that were published by mistake (a token, a password, a webhook), report it through the same
channel so they can be rotated.

## Supported versions

byox does not publish numbered releases yet: fixes only go to the `main` branch. If you self-host an instance, update
regularly (`git pull` and `docker compose up -d --build`).

## Threat model

byox **runs code**: the code of each course's tests, which can come from an AI assistant or from another person. What
follows summarizes [Seguridad](mcp/web/src/docs/seguridad.md) in the documentation (in Spanish), which is the full reference.

### What it is meant for

Personal use, a team or a classroom where you trust every account.

### What it does protect

- Everything requires an account: the API and the MCP answer `401` without a valid session or token.
- Each person sees their own progress and repositories. Passwords are validated against Forgejo; byox stores sessions and the SHA-256 hash of tokens, which can be revoked.
- Sessions use `HttpOnly` and `SameSite=Lax` cookies, and requests that modify data with a cookie must come from the same origin.
- There is a rate limit on login and sign-up attempts.
- CI notifications cannot be forged across repositories (each learner repo has its own secret) and the webhook for source-course changes is signed.
- Writing, verifying and importing courses is restricted to administrators by default (`BYOX_AUTHORS=admin`), and sign-up is closed by default (`BYOX_SIGNUP=closed`).

### Known limits: why open sign-up is not safe yet

These limits are documented and **are not considered vulnerabilities by themselves**: they are the reason byox must not be offered
as an open service to strangers. A useful report is one that shows a way around the controls that do exist.

1. **The `byox` bot is a collaborator on every learner repository**, and its token is available as an Actions secret in each one.
   Since each learner controls their repository's workflows, they can read that token and, with it, access the private repositories of the other learners on the instance.
2. **The runner uses the host's Docker socket** (`/var/run/docker.sock`, also mounted in the byox service to verify courses).
   Malicious code inside a test can take control of the host.
3. **Importing a course means running someone else's code**, and a course written by an assistant also runs code.
4. **`.env` concentrates the instance's credentials** (Forgejo admin token, bot token): whoever reads it controls the instance.

What is missing for a public instance, not implemented: an isolated execution environment for the tests (with CPU, memory, network and
time limits), per-repository credentials instead of a shared bot, per-user quotas, and review of courses before they are published.

### What is in scope

- Bypassing authentication, authorization between users, or the authoring restriction (`BYOX_AUTHORS`).
- Forging another repository's CI results, or performing actions with permissions that do not apply.
- Injection, XSS, CSRF, SSRF or secret leakage in the server, the web app, the CLI and the deploy scripts.
- Secrets exposed in the repository or its history.

### What is out of scope

- The four known limits above, while they are used as documented.
- Misconfiguration of an instance that does not follow the [hardening checklist](mcp/web/src/docs/seguridad.md#lista-de-endurecimiento).
- Vulnerabilities in Forgejo, Docker, Caddy or other dependencies: report them to those projects (if byox uses them insecurely, we do want to know).
- Attacks that require physical access or an already compromised administrator account.

## Recommendations for self-hosters

The full checklist is in [Seguridad](mcp/web/src/docs/seguridad.md) (Spanish). The essentials: install byox on a dedicated machine, keep
`BYOX_SIGNUP=closed` or `invite` and `BYOX_AUTHORS=admin`, publish it behind HTTPS with `BYOX_SECURE_COOKIES=1`, do not expose ports 3000, 3333 or 2222 directly,
and keep backups.
