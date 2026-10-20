# Repository Guidelines

## Project Structure & Module Organization

BranchBoard is a local Python/SQLite application with a JavaScript browser workspace. `core.py` owns domain validation and analysis; `server.py` owns HTTP and persistence; `web/` owns rendering and interactions. `examples/` contains fictional documents; `tests/` contains core and browser regressions. Keep evaluation records and screenshots outside source.

## Build, Test, and Development Commands

Run `python3 server.py` from the repository root. Use `--data` for a disposable database and `--port` for another local port. Run `python3 -m unittest discover -s tests -v` for core checks. Browser checks require `npm ci`, `npx playwright install chromium`, and `npm run test:ui` while the local test server runs. BASE_URL can select its address. There is no frontend build step or hosted CI configured.

## Coding Style & Naming Conventions

Use four spaces and snake_case in Python; two spaces, camelCase and semicolons in JavaScript. Follow nearby HTML/CSS conventions. Preserve stable document IDs and schema versions. Keep authoritative validation server-side, use textContent for user labels and reject malformed imports atomically. Avoid unrelated formatting or dependency churn.

## Testing Guidelines

Test observable outcomes and preservation of the next ordinary action. Extend existing cases for boundary values, dependencies, identity, undo/redo and stale saves when relevant. Use synthetic fixtures and isolated SQLite paths. Run browser checks after interaction changes and inspect keyboard and narrow-screen behavior. QUALITY-PLAN.md lists future cases as plans, not as already verified coverage.

## Commit & Pull Request Guidelines

Use focused imperative subjects; this new repository has no long-established history. Explain the trigger, resulting behavior, validation and limitations in pull requests. Add screenshots for visible changes and reference issues when available. Never commit credentials, local libraries, caches, dependencies or unverified claims of accessibility completeness.
