<!-- You can write in English or Spanish (también se acepta español). -->

## What changes

<!-- One or two sentences. -->

## Why

<!-- The problem or the issue it solves (Closes #...). -->

## How I tested it

<!-- Tick what applies and say what you checked by hand. -->

- [ ] Server tests: `docker build --target build -t byox-mcp:build ./mcp` and `docker run --rm -v "$PWD/mcp/test:/app/test:ro" byox-mcp:build node --test "test/*.test.mjs"`
- [ ] Web app: `docker build --target web -t byox-mcp:web ./mcp`
- [ ] CLI: `cargo build --locked` in `cli/`
- [ ] Tried by hand (what):

## Checklist

- [ ] Commits follow `<type>(<scope>): <emoji> <description>`, in English.
- [ ] I updated the documentation (`mcp/web/src/docs/`, READMEs) if the behavior changes.
- [ ] It contains no secrets, `.env` or personal data.
- [ ] If it is a course: the skeleton fails and the solution passes (`byox check`), it cites its sources and does not copy copyrighted material.
