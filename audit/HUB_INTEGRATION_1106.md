# Soccer visuals: Hub integration + local research preview (not published)
Base: main e55b209. Branch preview/soccer-hub-viz-1106.

## Published Hub (fail-closed)
- Sidebar: Shot Map / xG Flow / Attack Zones = index.html#viz-shotmap|#viz-xgflow|#viz-zones (repo side.js). Active state tested for all three.
- `visual-lab.html` redirects (`visual-redirect.js`): `?player=<digits>` becomes `index.html?vzplayer=<id>#viz-shotmap`, which opens the player's club team view, labelled as team-level.
- Current data: team match totals (shots, SOT, goals), recorded goal minutes ("Observed goals — not xG"), and the market no-vig baseline only. No independent model or edge claim.
- No event feed is connected, so status text sits above the empty pitch. `evOk` requires license_ok===true; there is no data/events/ dir.

## Local research preview (noncommercial, offline)
- `python3 research/build_research_preview.py --events /workspace/wt/soccer-event-adapter-1106/research/soccer-events/preview/3943043.json /workspace/wt/soccer-event-adapter-1106/research/soccer-events/preview/3869685.json`
  writes `/workspace/research-preview/soccer-hub-1106/` (outside the repo, CNAME removed, robots noindex,nofollow, RESEARCH_PREVIEW.txt).
- Real StatsBomb Open Data samples (Euro 2024 final, WC 2022 final), with license_ok=false preserved.
  - Shot map: located shots sized by provider xG, player filter, distance bars, xG by player.
  - xG flow: two-team cumulative steps, goal markers, period lines, field tilt (final-third pass origins), largest chances.
  - Zones: 3x3 action-origin and shot-concession pitches, pass/carry filter, table.
- Labels: historical, not current club coverage, provider-native IDs (never joined to current fixtures), continuous elapsed time with the source clock in tooltips, own goals not covered, shootout excluded, n/a for missing xG.
- Attribution text is included. The StatsBomb logo is NOT bundled; it's required before any publication.

## Tests
- tests/hub_viz.cjs: 42/42. tests/research_preview.cjs: 22/22 (also asserts the published repo has no research scripts or event data). tests/event_contract.cjs self-test: 3/3.
- tests/supported_visual_release.cjs: soccer runs hub_viz plus the redirect / no-standalone-link assertion.
- No browser or screenshot verification is claimed.

## Aikido
- soccer-viz.js, redirect, tests, research renderer: 0 issues. An innerHTML finding was fixed via inert DOMParser + replaceChildren; an earlier SSRF finding was fixed with fixed data paths.
- research/build_research_preview.py: 1 residual AIK_py_LFI (sev 50) on open(). The input is a local operator CLI argument, realpath-checked against an allowlist regex of adapter preview files (`/etc/passwd` is refused, tested). Not suppressed.
