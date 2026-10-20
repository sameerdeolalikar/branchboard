# BranchBoard: development plan

Estimated future effort: **62–92 hours**. These milestones are proposed, not implemented or approved paid work. Reassess scope after practical use.

## 1. Dependency graph and accessible picking — 14–20 hours

Add a visual dependency editor with keyboard selection, explicit direction and a cycle explanation. Preserve task identities and statuses across filtering and graph edits.

Definition of done: documented behavior, regression tests, matched before/after UI evidence where visible, valid import/export, and preservation of current undo and storage behavior.

## 2. Grouped and hierarchical work — 14–20 hours

Add parent groups, multi-select moves and reversible bulk actions. Parent completion rules must be explicit and import migration must preserve old tasks.

Definition of done: documented behavior, regression tests, matched before/after UI evidence where visible, valid import/export, and preservation of current undo and storage behavior.

## 3. Async save and recovery — 12–18 hours

Add recoverable local drafts and a conflict comparison flow. Simulate delayed responses, another-tab saves and storage errors without discarding the unsaved document.

Definition of done: documented behavior, regression tests, matched before/after UI evidence where visible, valid import/export, and preservation of current undo and storage behavior.

## 4. Board interaction and accessibility — 12–18 hours

Add keyboard drag alternatives, persistent focus after moves, responsive inspectors, reduced motion and RTL verification. Keep filtered cards and destination counts consistent.

Definition of done: documented behavior, regression tests, matched before/after UI evidence where visible, valid import/export, and preservation of current undo and storage behavior.

## 5. Release and scale — 10–16 hours

Measure performance on realistic larger boards, add migration fixtures, cross-browser checks and documented backup/restore behavior.

Definition of done: documented behavior, regression tests, matched before/after UI evidence where visible, valid import/export, and preservation of current undo and storage behavior.

## Suggested first session

Add a visual dependency picker that remains usable under search and keyboard navigation. Test cycle prevention, focus restoration and saved-reference integrity.

## Delivery order

Freeze the user-visible requirement and a passing control before implementation. Finish one bounded feature at a time; do not combine all milestones into one evaluation prompt. Record implemented behavior and remaining limitations in the README after each release.
