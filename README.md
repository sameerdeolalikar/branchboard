# BranchBoard

BranchBoard is a local project-planning application with a dependency-aware task board. Users can edit tasks, move them between backlog, active and completed states, filter priorities, inspect blockers and save versioned documents. Its Python/SQLite backend rejects dependency cycles, missing references and invalid status transitions; a JavaScript interface supports drag-and-drop alongside button-based actions.

This is a new local application prototype with original synthetic examples and no claimed user base. It shares a small original local-workspace foundation with other personal utility projects; its domain model and workflows are specific to this application. No external service, account or telemetry is required.

## Implemented baseline

Dependency validation; board drag/drop and button transitions; priority and text filters; task editor; undo/redo; JSON import/export; SQLite library; optimistic revision checks.

## Run

Python 3.11+ is required; there are no Python runtime dependencies.

```sh
python3 server.py
# Open http://127.0.0.1:7431
```

Run from the repository root. `--port` changes the port; `--data PATH` chooses the SQLite library (default `.local-data/library.sqlite3`). Use the printed `127.0.0.1` address: Host, Origin and custom-header checks protect local mutations. This server is intended for local use, not internet hosting. Back up your library before experimenting with it.

## Test

```sh
python3 -m unittest discover -s tests -v
# In a separate terminal, run the server with a disposable --data path.
npm ci
npx playwright install chromium
npm run test:ui
```

Browser tests use Node.js 20+ and pinned Playwright. They create synthetic saved documents. Set `BASE_URL` for a custom test server and `UI_SCREENSHOTS` for screenshots outside application source. Chromium requires its normal OS libraries. No hosted CI or other-browser certification is claimed.

## Project structure

- `core.py`: normalization, constraints and domain analysis.
- `server.py`: loopback HTTP boundary and optimistic SQLite revisions.
- `web/`: interface, DOM/SVG rendering, dialogs and edit history.
- `examples/sample.json`: original fictional fixture.
- `tests/`: core regression cases and browser workflows.

## Scope and limits

This is a single-user local board, not a collaborative service. Dependencies are entered by stable IDs; there is no graph editor, nested task hierarchy, scheduling engine or multi-selection yet. Reopening a prerequisite is rejected while a dependent task is active or done. Removing referenced tasks is rejected. Undo keeps the last 50 successful document edits in this browser session.

Documents have at most 150 entries; the library supports 100 documents. Request/import size is bounded to 256 KB. Undo/redo is per-tab memory, not durable history. Export drafts before closing; there is no automatic crash recovery yet. Optimistic revisions reject stale saves, but merging conflicts is future work.

## Planned development

[ROADMAP.md](ROADMAP.md) specifies approximately **62–92 hours** of proposed work with acceptance criteria. [QUALITY-PLAN.md](QUALITY-PLAN.md) describes representative review dimensions and transition cases. Estimates are future engineering effort, not completed hours or promised paid work. [CONTRIBUTING.md](CONTRIBUTING.md) explains contribution conventions.

## License

MIT. See [LICENSE](LICENSE).
