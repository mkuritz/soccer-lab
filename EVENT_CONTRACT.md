# Soccer event-feed adapter contract (`sl-soccer-events/1`)

Status: **contract only. No feed is connected and no event data ships in this branch.** Every event panel
shows "unavailable" until a verified adapter writes files matching this contract.

## Integration point
- The UI reads `data/events/<game_id>.json`, where `<game_id>` is the hub fixture id in `data/<league>.json` (`games[].id`, digits only).
- Loader: `soccer-viz.js` → `J('events/'+id)` (fixed-path allowlist `SAFE`) → `evOk()` gate → `EV`.
- The UI uses a file only if `schema === "sl-soccer-events/1"` and `source.license_ok === true`. Any other file is ignored, so the panel stays "unavailable".
- Renderers that use `EV`: Shot Map dots (`evDots`). xG Flow, field tilt, largest chances and Attack Zones keep their "unavailable" state until their renderers are wired to the fields below, and that wiring should happen only once real data passes validation.

## File shape
```json
{
  "schema": "sl-soccer-events/1",
  "game_id": "401878758",
  "source": {"provider": "…", "feed": "…", "retrieved_utc": "2026-11-07T03:00:00Z",
             "license_ok": true, "license_note": "noncommercial section use; attribution text below",
             "attribution": "Data: …", "redistribution": "display-only|cached-ok|…"},
  "teams": {"home": "LEE", "away": "TOT"},
  "coords": {"length": 105, "width": 68, "origin": "bottom-left of attacking team", "attack": "left-to-right for both teams (normalized)"},
  "shots": [
    {"id": "s1", "team": "TOT", "player": "Name", "player_id": "espn-or-provider id",
     "minute": 23, "second": 41, "period": 1, "x": 92.4, "y": 30.1,
     "xg": 0.21, "xg_model": "provider model name/version",
     "outcome": "goal|saved|blocked|off_target|post", "body_part": "right_foot|left_foot|head|other",
     "situation": "open_play|set_piece|penalty|counter|corner|free_kick"}
  ],
  "possession_events": [
    {"team": "TOT", "minute": 23, "second": 10, "type": "pass|carry|touch", "x": 70.0, "y": 40.0, "end_x": 88.0, "end_y": 34.0}
  ]
}
```

## Rules
1. Coordinates are metres on a 105×68 pitch, normalized so the shooting team attacks toward x=105. The adapter does the conversion from provider units and documents it.
2. `xg` must come from the provider's (or a documented, validated) xG model, with `xg_model` naming it. **Never** derive xG from shot counts (e.g. shots × constant) or from the hub's `xg_pg` / `xgpg` shot-weight heuristic. Use `null` when the provider has no xG; the UI then draws a fixed-size marker.
3. Missing values are `null`, never 0. Penalties stay in `shots` with `situation: "penalty"`.
4. Field tilt = share of `possession_events` with `x >= 70` per team. It renders only when `possession_events` is present and non-empty.
5. Attack zones = `shots` and `possession_events` bucketed on the pitch. Bucket boundaries go in the renderer, not the file.
6. Attribution: the `source.attribution` string must be displayed wherever the data renders. If `redistribution` forbids caching, the adapter must not commit files to the repo.
7. Provider terms apply to each source on its own, even where the section is noncommercial. Set `license_ok` only after those terms are reviewed.
8. Validate with `node tests/event_contract.cjs <file>` before wiring a file in.

## Research preview mode (added after the adapter landed)
- Adapter: `/workspace/wt/soccer-event-adapter-1106` @ `c511eb6` (`SOCCER_EVENT_ADAPTER.md`). Its files use provider-native match/team IDs, `historical: true` and `source.license_ok: false`.
- The published Hub stays fail-closed: no `data/events/`, the `evOk` gate is unchanged, and `index.html` has no research scripts.
- `research/build_research_preview.py` writes a LOCAL build outside the repo (default `/workspace/research-preview/soccer-hub-1106`, CNAME removed). It embeds the samples as `research-events.js` and adds `research/soccer-research.js`. A "Historical research sample (local only)" source toggle then shows real shot maps, xG flow, field tilt, largest chances and zone views, with StatsBomb attribution.
- The samples are never auto-joined to current ESPN fixtures. The timeline is continuous elapsed time; tooltips show the source period clock. Own goals are not covered; shootouts are excluded; missing xG shows as n/a.
- Before any publication: the StatsBomb logo is required (none is bundled) and raw/normalized event redistribution must be cleared.

## Publish note (2026-11-09)
Research builder/scripts and StatsBomb samples stay out of the published Hub tree. In-Hub Shot Map / xG Flow / Attack Zones ship fail-closed on public hub snapshots only; located-event layers remain labeled unavailable until a license-cleared adapter writes `data/events/`.
