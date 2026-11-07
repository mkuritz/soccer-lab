# Supported visual release — Nov6,2026

## Supported routes
- `visual-lab.html?player=<exact native ID>`: actual logged current-season shot counts, existing scorer estimate, raw recorded American-price implied probability and observed scoring-appearance rate. Current native files are read independently; their refresh times are displayed. Current scorer cache has 277 rows,109 numeric prices.
- Native player/team links dispatch exact existing identifiers; no name guesses.
## Hidden / blocked
No located shot map, per-shot xG, xG flow, field tilt or attack-zone forecasts. No untrained xG estimator. No research fixture, dataset or research-branch ancestry imported. This branch starts from clean production `e919264`. Sources were imported only as reviewed source files, never merged/cherry-picked from the research branch. No new source collection or pipeline activation.

## Verification and limits
91 cross-hub DOM/runtime/data/identity/security assertions passed against these exact release worktrees. Run one hub independently with `NODE_PATH=/workspace/visual-preview-tests/node_modules node tests/supported_visual_release.cjs`; `jsdom` is required. Browser/local-port visual verification remains pending under sandbox policy; no layout screenshot or PDF inspection claimed. No firewall/proxy/tunnel/browser workaround used.

Initial40-file Aikido scan reported10 pre-existing template warnings in legacy CBB `players.html` (the only proposed change was a profile-entry script). That modification was removed entirely; native modal invocation now occurs directly from Matchup Duel. No warnings were ignored or rules suppressed. Final combined47-file scan:0 issues. Evidence is under `audit/supported-release-aikido-*.json`. The intermediate combined scan found prop-intel HTML rendering and a dynamic builder file read; both were replaced with DOM construction/fixed-path readers and rescanned successfully. No findings ignored. Existing native hub renderers were not globally security-audited.

No new ingestion, schedules, workflows, keys, paid access, pick weights or pricing changes in this release. Unsupported menus are absent rather than empty landing pages. Original hub nav/features remain; only additive supported entries.
