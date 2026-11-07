# Soccer Hub visual finish — private preview, November 6, 2026 (ET)

## Reference actually reviewed
Read original rendered PDF pages 01–06 individually, plus NHL Danger Matchup page 09 from `/workspace/mockup-review-1922`. The PDF's Soccer pages are expansion concepts, not the original Shot Map / xG Flow / Attack Zones screenshot. This pass applies their visual system to the existing three views; it does not implement those six additional features or claim to have read the unavailable original JPG.

| Reference characteristic | Actual implementation |
| --- | --- |
| Near-black green surface; compact side rail | Scoped `body.viz-on` theme and 206px rail; existing routes and shared sidebar preserved |
| Mint segmented filters and slim tabs | Three integrated hash tabs; concise data-source switch; team/player, goal and period controls |
| Main visual ~2/3, analytical rail ~1/3 | Responsive 1.85:1 grid, framed cards, 2×2 KPIs; tablet rail stacks; phone single-column |
| Pitch detail rather than an empty canvas | Striped attacking-half pitch, penalty/goal outlines, true located shots sized by provider xG; active shot has keyboard/click detail |
| Bottom plots and useful contextual rail | Distance histogram, player xG ranking/filter, shot goals, xG timeline, largest chances, defined final-third pass-origin field tilt |
| Paired tactical maps | Located action origins vs opponent shots conceded, independent color scales, counts/share labels, third-level table and lane shares |
| Restrained teal / blue / coral | Mint controls; coral/blue team chart series; no yellow betting-takeaway banner |
| Small sample / source attribution | Historical badge, concise method text and official StatsBomb logo; no future odds, independent model, fake rates or PSxG |

## Preserved boundaries
- Actual Hub `soccer-viz.js` and private research renderer changed; no standalone replacement app, iframe or synthetic screenshot UI.
- No changes to NFL Spots, models, picks, markets, gates, schedules, main Hub data or published index references.
- Private samples remain outside the repository/publish root; `source.license_ok` remains false.
- Main Hub still defaults to current recorded snapshots with unavailable fields honest; this is NOT current club event-feed integration.
- The historical adapter samples intentionally fail the **production** event validator (provider match IDs / source metadata / outcome format / license gate). They are validated through the private builder and research DOM suite, not promoted to production.

## Checks
- `hub_viz.cjs`: 42 passed; `research_preview.cjs`: 28 passed (including exact plotted coordinates, player/team/goal/period filtering, keyboard detail, field tilt, source logo, route/sidebar state).
- `supported_visual_release.cjs`: 2 assertions passed; production event contract self-test: 3 passed.
- All four packaged actual-source documents executed in jsdom without JS errors; jsdom is not a visual browser.
- Aikido scoped scan: no JS/test findings; one **pre-existing severity 50** `AIK_py_LFI` finding at `research/build_research_preview.py:24`. Fixed adapter directory + numeric-ID-only name + directory membership constrain the read. No arbitrary input path; finding not suppressed/ignored in Aikido.

## Review artifacts / limitation
Artifacts under `/workspace/design-review-1924`. Private Soccer HTML embeds historical events and MUST NOT be shared/hosted. PNG/PDF analytical document exports can be reviewed instead. Source hashes recorded by the offline packager in `MANIFEST.json`.

The document exports are derived from the ACTUAL populated Hub DOM and source styles using jsdom → WeasyPrint → PDF/PNG. Buttons/selects are flattened for print, and print-only layout/pagination rules apply. They are explicitly labeled **not browser screenshots**. Browser access to local previews was previously denied; no retry, alternate port, tunnel, browser automation or headless rendering was attempted. Actual desktop/mobile browser visual approval remains outstanding.

No push, deploy, publication, live data write or external contact.
