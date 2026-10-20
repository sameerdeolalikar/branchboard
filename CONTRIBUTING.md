# Contributing to BranchBoard

Read README.md, ROADMAP.md and QUALITY-PLAN.md. Use original fictional fixtures and keep local libraries, credentials, dependencies and screenshots out of source commits.

Python uses four-space indentation and snake_case. JavaScript uses two spaces, camelCase and semicolons; format web assets consistently with nearby code. Keep authoritative constraints in core.py and apply edits atomically. Do not bypass save revisions or turn validation failures into silent data changes.

Run `python3 -m unittest discover -s tests -v`. After UI changes run the documented browser workflow against a disposable database. Add regression tests for observable behavior, not tests that merely repeat implementation details. There is no coverage quota or hosted CI yet.

Use focused imperative commit subjects. Pull requests should describe the problem, resulting behavior, commands run and known limitations. Include before/after images for visible changes and link the relevant issue when available. Preserve real history and accurately distinguish planned from implemented features.
