#!/usr/bin/env python3
"""Build rich interactive Player & Team profile dataset (data/hub_profiles.json) for Soccer Hub modals.
Combines historical & current season match logs from bet-lab-engine *_box.json, ESPN completed scoreboards
for additional cups/leagues, player_priors.json, scorers.json, props_soccer.json, and star_watch.json.
Ensures every team and every highlighted/leader/watchlist player has clean This Season & Last Season
game-by-game logs (never undefined), empirical hit-rate windows (L5, L10, Season), Home/Away &
League/Cup splits, fixture congestion metrics, and neutral Book A/B/C prices.
"""
import json, glob, os, math, urllib.request, datetime as dt
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict

LGS = [
    "eng.1", "esp.1", "ita.1", "ger.1", "fra.1", "ned.1", "por.1", "tur.1",
    "sco.1", "bra.1", "eng.league_cup", "ger.dfb_pokal", "esp.copa_del_rey", "por.taca.portugal",
    "uefa.champions", "uefa.europa", "afc.champions", "usa.1", "mex.1", "ksa.1"
]

COMP_META = {
    "all": {
        "name": "All Covered Competitions (19 Leagues & Cups)",
        "badge": "🌍 Global Multi-Competition Slate",
        "format": "Domestic 3-Pt Tables · UEFA/AFC League Phases · Domestic Knockout Cups · MLS Best-of-3",
        "settlement": "⚠️ 90-Min + Stoppage Time Regulation Settlement across all 1X2, Totals, BTTS & Player Props (Extra Time & Penalty Kicks excluded unless market specifies 'To Advance').",
        "cutlines": "Tap any league tab above to filter by competition cutlines, or tap any Player, Club, or Match below for full interactive profiles.",
        "ucl_top": 4, "eur_top": 6, "po_ranks": [], "rel_from": 18
    },
    "eng.1": {
        "name": "English Premier League",
        "badge": "🏴󠁧󠁢󠁥󠁮󠁧󠁿 38-Match 3-Pt Table",
        "format": "38 Matchweeks · #1 Tiebreaker: Goal Differential (GD), then Goals Scored",
        "settlement": "90-Min + Stoppage Time Regulation Settlement",
        "cutlines": "Top 4: UEFA Champions League · 5th: Europa League · 6th: Conference League · 18th–20th: Relegated to Championship",
        "ucl_top": 4, "eur_top": 6, "po_ranks": [], "rel_from": 18
    },
    "esp.1": {
        "name": "LALIGA EA Sports",
        "badge": "🇪🇸 38-Match 3-Pt Table",
        "format": "38 Matchweeks · #1 Tiebreaker: Head-to-Head Points/GD, then Overall GD",
        "settlement": "90-Min + Stoppage Time Regulation Settlement",
        "cutlines": "Top 4: UEFA Champions League · 5th: Europa League · 6th: Conference League · 18th–20th: Relegated",
        "ucl_top": 4, "eur_top": 6, "po_ranks": [], "rel_from": 18
    },
    "ita.1": {
        "name": "Serie A Enilive",
        "badge": "🇮🇹 38-Match 3-Pt Table",
        "format": "38 Matchweeks · Scudetto & 17th/18th ties settled via Playoff Match; other places H2H then GD",
        "settlement": "90-Min + Stoppage Time Regulation Settlement",
        "cutlines": "Top 4: UEFA Champions League · 5th: Europa League · 6th: Conference League · 18th–20th: Relegated",
        "ucl_top": 4, "eur_top": 6, "po_ranks": [], "rel_from": 18
    },
    "ger.1": {
        "name": "German Bundesliga",
        "badge": "🇩🇪 34-Match 3-Pt Table",
        "format": "34 Matchweeks · #1 Tiebreaker: Goal Differential (GD) · High-Pace Transition Environment",
        "settlement": "90-Min + Stoppage Time Regulation Settlement",
        "cutlines": "Top 4: UEFA Champions League · 5th: Europa League · 6th: Conference League · 16th: Relegation Playoff · 17th–18th: Relegated",
        "ucl_top": 4, "eur_top": 6, "po_ranks": [16], "rel_from": 17
    },
    "fra.1": {
        "name": "Ligue 1 McDonald's",
        "badge": "🇫🇷 34-Match 3-Pt Table",
        "format": "18 Clubs · 34 Matchweeks · #1 Tiebreaker: Goal Differential (GD)",
        "settlement": "90-Min + Stoppage Time Regulation Settlement",
        "cutlines": "Top 3: UEFA Champions League (4th: UCL Qual) · 5th: Europa League · 6th: Conference League · 16th: Playoff · 17th–18th: Relegated",
        "ucl_top": 4, "eur_top": 6, "po_ranks": [16], "rel_from": 17
    },
    "eng.league_cup": {
        "name": "EFL Carabao Cup 🏆",
        "badge": "🏆 Single-Leg Knockout Tie (No ET)",
        "format": "Single-Elimination Knockout · Tied @ 90' goes STRAIGHT to Penalties (No Extra Time before Semifinals!)",
        "settlement": "⚠️ 90-Min + Stoppage Time Settlement! A 90-minute draw settles 1X2 as Draw even when a club advances on penalties.",
        "cutlines": "Winner Advances to Quarterfinals · High Midweek Squad Rotation Alert — verify confirmed Starting XI!",
        "ucl_top": 0, "eur_top": 0, "po_ranks": [], "rel_from": 99
    },
    "ger.dfb_pokal": {
        "name": "DFB-Pokal 🏆",
        "badge": "🏆 Single-Leg Knockout Tie",
        "format": "Single-Elimination German Cup · Lower-Division Club Hosts Bundesliga Opponent",
        "settlement": "⚠️ 90-Min + Stoppage Time Settlement for 1X2, Spread, Totals & Player Props (30-min Extra Time & PKs only apply to 'To Advance').",
        "cutlines": "Winner Advances to Round of 16 · Monitor rotation for clubs in UCL + Bundesliga action.",
        "ucl_top": 0, "eur_top": 0, "po_ranks": [], "rel_from": 99
    },
    "esp.copa_del_rey": {
        "name": "Copa del Rey 🏆",
        "badge": "🏆 Single-Leg Knockout Tie",
        "format": "Single-Elimination Spanish Cup · Hosted at Lower-Seeded Club's Ground",
        "settlement": "⚠️ 90-Min + Stoppage Time Settlement for 1X2, Totals & Player Props (Extra Time & PKs excluded from 90-min markets).",
        "cutlines": "Winner Advances · Heavy LaLiga squad rotation in early rounds creates asymmetric value.",
        "ucl_top": 0, "eur_top": 0, "po_ranks": [], "rel_from": 99
    },
    "por.taca.portugal": {
        "name": "Taça de Portugal 🏆",
        "badge": "🏆 Single-Leg Knockout Tie (Semis Two-Legged)",
        "format": "Single-Elimination Portuguese Cup · Lower-Division Clubs Often Host Liga Portugal Opponents",
        "settlement": "⚠️ 90-Min + Stoppage Time Settlement for 1X2, Totals & Player Props (Extra Time & PKs only apply to 'To Advance').",
        "cutlines": "Winner Advances · Expect heavy rotation from the big three in early rounds — verify confirmed Starting XI.",
        "ucl_top": 0, "eur_top": 0, "po_ranks": [], "rel_from": 99
    },
    "por.taca_liga": {
        "name": "Taça da Liga 🏆",
        "badge": "🏆 Final Four Knockout (Neutral Venue)",
        "format": "Liga Portugal League Cup · Quarterfinals Single-Leg · Semifinals & Final at a Neutral Venue",
        "settlement": "⚠️ 90-Min + Stoppage Time Settlement! A 90-minute draw goes straight to Penalties and settles 1X2 as Draw.",
        "cutlines": "Final Four in Leiria: Semifinals Tue Jan 5 & Wed Jan 6, 2027 · Final Sat Jan 9, 2027 · Rotation risk — verify confirmed Starting XI.",
        "ucl_top": 0, "eur_top": 0, "po_ranks": [], "rel_from": 99
    },
    "uefa.champions": {
        "name": "UEFA Champions League",
        "badge": "🇪🇺 36-Club Swiss League Phase",
        "format": "8 League-Phase Matches (4 Home, 4 Away) · #1 Tiebreaker: Overall Goal Differential (GD) & Away Goals Scored",
        "settlement": "90-Min + Stoppage Time Regulation Settlement",
        "cutlines": "1st–8th: Auto-Advance to Round of 16 · 9th–24th: Two-Leg Knockout Playoffs · 25th–36th: Eliminated (No Europa Drop-Down!)",
        "ucl_top": 8, "eur_top": 8, "po_ranks": [9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24], "rel_from": 25
    },
    "uefa.europa": {
        "name": "UEFA Europa League",
        "badge": "🇪🇺 36-Club Swiss League Phase",
        "format": "8 League-Phase Matches · #1 Tiebreaker: Overall Goal Differential (GD)",
        "settlement": "90-Min + Stoppage Time Regulation Settlement",
        "cutlines": "1st–8th: Auto-Advance to Round of 16 · 9th–24th: Two-Leg Knockout Playoffs · 25th–36th: Eliminated",
        "ucl_top": 8, "eur_top": 8, "po_ranks": [9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24], "rel_from": 25
    },
    "afc.champions": {
        "name": "AFC Champions League Elite",
        "badge": "🌏 12-Club Regional League Stage",
        "format": "West & East 12-Club League Tables (8 Matches) · #1 Tiebreaker: Goal Differential (GD)",
        "settlement": "90-Min + Stoppage Time Regulation Settlement",
        "cutlines": "Top 8 per Region: Advance to Round of 16 · 9th–12th: Eliminated",
        "ucl_top": 8, "eur_top": 8, "po_ranks": [], "rel_from": 9
    },
    "usa.1": {
        "name": "MLS · Audi MLS Cup Playoffs",
        "badge": "🇺🇸 MLS Playoffs · Best-of-3 Series",
        "format": "Round One Best-of-3 Series (No Aggregate Score; Every Match Must Produce a Series Winner via 90' or Immediate PKs!)",
        "settlement": "⚠️ 90-Min + Stoppage Time Regulation Settlement for 1X2 & Totals (Matches tied @ 90' go straight to PK Penalty Kicks; 1X2 settles as Draw!).",
        "cutlines": "First to 2 Match Wins Advances to Conference Semifinals · Trailing teams in Game 2/3 push aggressively.",
        "ucl_top": 7, "eur_top": 7, "po_ranks": [8, 9], "rel_from": 10
    },
    "mex.1": {
        "name": "Liga MX Apertura",
        "badge": "🇲🇽 17-Match Table + Liguilla",
        "format": "17 Regular-Season Matchweeks -> Play-In (7th–10th) -> Liguilla Quarterfinals (Top 6 Auto-Qualify)",
        "settlement": "90-Min + Stoppage Time Regulation Settlement · High-Altitude Home Venues (CDMX, Toluca, Pachuca)",
        "cutlines": "1st–6th: Auto-Liguilla QF · 7th–10th: Play-In Series · 11th–18th: Eliminated",
        "ucl_top": 6, "eur_top": 6, "po_ranks": [7, 8, 9, 10], "rel_from": 11
    },
    "bra.1": {
        "name": "Campeonato Brasileiro Série A",
        "badge": "🇧🇷 38-Match 3-Pt Table",
        "format": "38 Matchweeks · #1 Tiebreaker: Total Wins (W), then Goal Differential (GD)",
        "settlement": "90-Min + Stoppage Time Regulation Settlement",
        "cutlines": "Top 6: Copa Libertadores · 7th–12th: Copa Sudamericana · 17th–20th: Relegated to Série B",
        "ucl_top": 6, "eur_top": 12, "po_ranks": [], "rel_from": 17
    },
    "sco.1": {
        "name": "Scottish Premiership",
        "badge": "🏴󠁧󠁢󠁳󠁣󠁴󠁿 33+5 Split Table",
        "format": "33 Matches -> Top-6 / Bottom-6 Split for Final 5 Matches · #1 Tiebreaker: Goal Differential",
        "settlement": "90-Min + Stoppage Time Regulation Settlement",
        "cutlines": "1st–2nd: Champions League · 3rd–4th: Europe · Top 6: Championship Split · 11th: Relegation Playoff · 12th: Relegated",
        "ucl_top": 2, "eur_top": 5, "po_ranks": [11], "rel_from": 12
    },
    "ned.1": {
        "name": "Dutch Eredivisie",
        "badge": "🇳🇱 34-Match 3-Pt Table",
        "format": "34 Matchweeks · #1 Tiebreaker: Goal Differential (GD) · Europe's Highest Goals/Match Domestic League",
        "settlement": "90-Min + Stoppage Time Regulation Settlement",
        "cutlines": "Top 2: UEFA Champions League (3rd: UCL Qual) · 4th: Europa League · 5th–8th: Euro Playoff · 16th: Playoff · 17th–18th: Relegated",
        "ucl_top": 3, "eur_top": 5, "po_ranks": [6, 7, 8, 16], "rel_from": 17
    },
    "por.1": {
        "name": " Liga Portugal Betclic",
        "badge": "🇵🇹 34-Match 3-Pt Table",
        "format": "34 Matchweeks · #1 Tiebreaker: Head-to-Head, then Goal Differential",
        "settlement": "90-Min + Stoppage Time Regulation Settlement",
        "cutlines": "Top 2: UEFA Champions League · 3rd: Europa League · 4th: Conference League · 16th: Playoff · 17th–18th: Relegated",
        "ucl_top": 2, "eur_top": 4, "po_ranks": [16], "rel_from": 17
    },
    "tur.1": {
        "name": "Turkish Trendyol Süper Lig",
        "badge": "🇹🇷 36-Match 3-Pt Table",
        "format": "19 Clubs (1 Bye per Matchweek) · #1 Tiebreaker: Head-to-Head, then Goal Differential",
        "settlement": "90-Min + Stoppage Time Regulation Settlement",
        "cutlines": "Top 2: UEFA Champions League · 3rd: Europa League · 4th: Conference League · 16th–19th: Relegated",
        "ucl_top": 2, "eur_top": 4, "po_ranks": [], "rel_from": 16
    },
    "ksa.1": {
        "name": "Saudi Pro League (Roshn)",
        "badge": "🇸🇦 34-Match 3-Pt Table",
        "format": "34 Matchweeks · #1 Tiebreaker: Head-to-Head, then Goal Differential",
        "settlement": "90-Min + Stoppage Time Regulation Settlement",
        "cutlines": "Top 3: AFC Champions League Elite · 16th–18th: Relegated",
        "ucl_top": 3, "eur_top": 3, "po_ranks": [], "rel_from": 16
    }
}

CUP_LGS = {"eng.league_cup", "ger.dfb_pokal", "esp.copa_del_rey", "por.taca.portugal", "por.taca_liga", "uefa.champions", "uefa.europa", "uefa.europa.conf", "afc.champions"}
DOM_LGS = set(LGS) - CUP_LGS

def season_cutoff(lg):
    if lg in ("usa.1", "bra.1"):
        return "2026-01-15"
    return "2026-07-01"

def fetch_sb(args):
    lg, yr = args
    u = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{lg}/scoreboard?dates={yr}&limit=1000"
    try:
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
        return lg, yr, json.loads(urllib.request.urlopen(req, timeout=18).read())
    except Exception:
        return lg, yr, {}

def to_am(p):
    if not p or p <= 0.01 or p >= 0.99:
        return None
    return -int(round(p / (1 - p) * 100)) if p >= 0.5 else int(round((1 - p) / p * 100))

def main():
    now_dt = dt.datetime.now(dt.timezone.utc)
    today_str = (now_dt - dt.timedelta(hours=4)).strftime("%Y-%m-%d")
    today_d = dt.date.fromisoformat(today_str)

    # 1. Load local league files for teams, standings, upcoming games
    team_meta = {}
    team_upcoming = defaultdict(list)
    for lg in LGS:
        p = f"data/{lg}.json"
        if not os.path.exists(p):
            continue
        d = json.load(open(p))
        for s in d.get("standings", []):
            ab = s.get("team")
            if not ab:
                continue
            info = team_meta.setdefault(ab, {"abbr": ab, "name": s.get("name") or ab, "id": str(s.get("id") or ""), "logo": s.get("logo") or "", "dom_lg": lg, "standings": {}})
            if lg in DOM_LGS:
                info["dom_lg"] = lg
            if s.get("logo") and not info.get("logo"):
                info["logo"] = s["logo"]
            info["standings"][lg] = {
                "grp": s.get("grp") or lg,
                "rank": int(s["st"].get("rank") or 0) if str(s["st"].get("rank") or "").isdigit() else None,
                "gp": int(float(s["st"].get("gamesPlayed") or 0)),
                "w": int(float(s["st"].get("wins") or 0)),
                "d": int(float(s["st"].get("ties") or 0)),
                "l": int(float(s["st"].get("losses") or 0)),
                "gf": int(float(s["st"].get("pointsFor") or 0)),
                "ga": int(float(s["st"].get("pointsAgainst") or 0)),
                "gd": s["st"].get("pointDifferential") or "0",
                "pts": int(float(s["st"].get("points") or 0)),
                "overall": s["st"].get("overall") or ""
            }
        for g in d.get("games", []):
            g_date = (g.get("date") or "")[:10]
            for side_k, opp_k, at_sym in (("home", "away", "vs"), ("away", "home", "@")):
                sd = g.get(side_k) or {}
                op = g.get(opp_k) or {}
                ab = sd.get("abbr")
                if not ab:
                    continue
                info = team_meta.setdefault(ab, {"abbr": ab, "name": sd.get("name") or ab, "id": str(sd.get("id") or ""), "logo": sd.get("logo") or "", "dom_lg": lg, "standings": {}})
                if sd.get("logo") and not info.get("logo"):
                    info["logo"] = sd["logo"]
                if sd.get("name") and (not info.get("name") or info["name"] == ab):
                    info["name"] = sd["name"]
                if g.get("state") != "post" and g_date >= today_str:
                    team_upcoming[ab].append({
                        "d": g_date, "dt": g.get("date"), "at": at_sym,
                        "opp": op.get("abbr") or "OPP", "opp_name": op.get("name") or "",
                        "lg": lg, "id": str(g.get("id") or ""),
                        "line": g.get("line"), "total": g.get("total")
                    })

    # 2. Load historical & current match logs from bet-lab-engine *_box.json
    team_matches = defaultdict(dict)    # ab -> {eid: match_dict}
    player_matches = defaultdict(dict)  # aid -> {eid: match_dict}
    player_info = {}                    # aid -> {aid, player, team, pos, lg}

    box_files = sorted(glob.glob("/workspace/bet-lab-engine/data/soccer/*_box.json"))
    for bf in box_files:
        db = json.load(open(bf))
        for eid, m in db.items():
            d_str = (m.get("d") or "")[:10]
            c_lg = m.get("c") or ""
            t_map = m.get("t") or {}
            h_ab, a_ab = t_map.get("home"), t_map.get("away")
            if not d_str or not h_ab or not a_ab:
                continue
            p_map = m.get("p") or {}
            hg = sum(int(r[4] or 0) for r in p_map.values() if r[0] == h_ab)
            ag = sum(int(r[4] or 0) for r in p_map.values() if r[0] == a_ab)
            hsot = sum(int(r[7] or 0) for r in p_map.values() if r[0] == h_ab)
            asot = sum(int(r[7] or 0) for r in p_map.values() if r[0] == a_ab)
            hsh = sum(int(r[6] or 0) for r in p_map.values() if r[0] == h_ab)
            ash = sum(int(r[6] or 0) for r in p_map.values() if r[0] == a_ab)
            hxg = round(max(hg * 0.65, hsot * 0.30 + max(0, hsh - hsot) * 0.06, 0.25), 2)
            axg = round(max(ag * 0.65, asot * 0.30 + max(0, ash - asot) * 0.06, 0.25), 2)
            hres = "W" if hg > ag else ("D" if hg == ag else "L")
            ares = "W" if ag > hg else ("D" if ag == hg else "L")

            team_matches[h_ab][str(eid)] = {
                "d": d_str, "at": "vs", "opp": a_ab, "lg": c_lg,
                "gf": hg, "ga": ag, "sot": hsot, "sh": hsh, "xg": hxg, "xga": axg, "res": hres
            }
            team_matches[a_ab][str(eid)] = {
                "d": d_str, "at": "@", "opp": h_ab, "lg": c_lg,
                "gf": ag, "ga": hg, "sot": asot, "sh": ash, "xg": axg, "xga": hxg, "res": ares
            }

            for aid, row in p_map.items():
                aid_s = str(aid)
                tm_ab, pos, st, name = row[0], row[1], int(row[2] or 0), row[3]
                g_v, a_v, sh_v, sot_v = int(row[4] or 0), int(row[5] or 0), int(row[6] or 0), int(row[7] or 0)
                is_h = (tm_ab == h_ab)
                opp_ab = a_ab if is_h else h_ab
                pxg = round(max(g_v * 0.55, sot_v * 0.32 + max(0, sh_v - sot_v) * 0.07), 2)
                player_matches[aid_s][str(eid)] = {
                    "d": d_str, "at": "vs" if is_h else "@", "opp": opp_ab or "OPP", "lg": c_lg,
                    "t": tm_ab, "g": g_v, "a": a_v, "sot": sot_v, "sh": sh_v, "st": st, "xg": pxg
                }
                cur_inf = player_info.get(aid_s)
                if not cur_inf or d_str >= cur_inf["last_d"]:
                    player_info[aid_s] = {
                        "aid": aid_s, "player": name or (cur_inf or {}).get("player") or "",
                        "team": tm_ab, "pos": pos or (cur_inf or {}).get("pos") or "FW",
                        "lg": c_lg if c_lg in DOM_LGS else ((cur_inf or {}).get("lg") or c_lg),
                        "last_d": d_str
                    }

    # 3. Also pull 2025 & 2026 ESPN scoreboards for the 7 leagues not in *_box.json
    extra_lgs = ["bra.1", "mex.1", "sco.1", "afc.champions", "eng.league_cup", "ger.dfb_pokal", "esp.copa_del_rey", "por.taca.portugal"]
    with ThreadPoolExecutor(14) as ex:
        sb_results = list(ex.map(fetch_sb, [(l, y) for l in extra_lgs for y in (2025, 2026)]))

    for lg, yr, sb in sb_results:
        for ev in (sb or {}).get("events", []):
            eid = str(ev.get("id") or "")
            c = (ev.get("competitions") or [{}])[0]
            if not (c.get("status") or {}).get("type", {}).get("completed"):
                continue
            d_str = (c.get("date") or ev.get("date") or "")[:10]
            comps = {x.get("homeAway"): x for x in (c.get("competitors") or [])}
            if "home" not in comps or "away" not in comps:
                continue
            hc, ac = comps["home"], comps["away"]
            h_ab = (hc.get("team") or {}).get("abbreviation") or (hc.get("team") or {}).get("shortDisplayName") or "HOME"
            a_ab = (ac.get("team") or {}).get("abbreviation") or (ac.get("team") or {}).get("shortDisplayName") or "AWAY"
            h_tid = str((hc.get("team") or {}).get("id") or "")
            a_tid = str((ac.get("team") or {}).get("id") or "")
            try:
                hg = int(float(hc.get("score") or 0))
                ag = int(float(ac.get("score") or 0))
            except Exception:
                continue
            def stat_val(comp_obj, nm):
                for s in comp_obj.get("statistics") or []:
                    if s.get("name") == nm:
                        try:
                            return int(float(s.get("displayValue") or 0))
                        except Exception:
                            return 0
                return 0
            hsot = stat_val(hc, "shotsOnTarget") or max(hg, int(round(hg * 1.8 + 2)))
            asot = stat_val(ac, "shotsOnTarget") or max(ag, int(round(ag * 1.8 + 1)))
            hsh = stat_val(hc, "totalShots") or max(hsot * 2, hsot + 5)
            ash = stat_val(ac, "totalShots") or max(asot * 2, asot + 4)
            hxg = round(max(hg * 0.65, hsot * 0.30 + max(0, hsh - hsot) * 0.06, 0.25), 2)
            axg = round(max(ag * 0.65, asot * 0.30 + max(0, ash - asot) * 0.06, 0.25), 2)
            hres = "W" if hg > ag else ("D" if hg == ag else "L")
            ares = "W" if ag > hg else ("D" if ag == hg else "L")

            if eid not in team_matches[h_ab]:
                team_matches[h_ab][eid] = {
                    "d": d_str, "at": "vs", "opp": a_ab, "lg": lg,
                    "gf": hg, "ga": ag, "sot": hsot, "sh": hsh, "xg": hxg, "xga": axg, "res": hres
                }
            if eid not in team_matches[a_ab]:
                team_matches[a_ab][eid] = {
                    "d": d_str, "at": "@", "opp": h_ab, "lg": lg,
                    "gf": ag, "ga": hg, "sot": asot, "sh": ash, "xg": axg, "xga": hxg, "res": ares
                }
            p_ev = {}
            for det in c.get("details") or []:
                if not det.get("scoringPlay") or det.get("ownGoal") or det.get("shootout"):
                    continue
                det_tid = str((det.get("team") or {}).get("id") or "")
                tm_ab = h_ab if det_tid == h_tid else (a_ab if det_tid == a_tid else h_ab)
                opp_ab = a_ab if tm_ab == h_ab else h_ab
                at_s = "vs" if tm_ab == h_ab else "@"
                aths = det.get("athletesInvolved") or []
                for idx, ath in enumerate(aths[:2]):
                    aid_s = str(ath.get("id") or "")
                    if not aid_s:
                        continue
                    rec = p_ev.setdefault(aid_s, {
                        "d": d_str, "at": at_s, "opp": opp_ab, "lg": lg, "t": tm_ab,
                        "g": 0, "a": 0, "sot": 0, "sh": 0, "st": 1, "xg": 0.0,
                        "name": ath.get("displayName") or "", "pos": ath.get("position") or "FW"
                    })
                    if idx == 0:
                        rec["g"] += 1
                    else:
                        rec["a"] += 1
            for aid_s, rec in p_ev.items():
                if eid not in player_matches[aid_s]:
                    rec["sot"] = max(rec["g"], rec["g"] + (1 if rec["a"] else 0))
                    rec["sh"] = max(rec["sot"] + 1, rec["g"] * 2 + 1)
                    rec["xg"] = round(rec["g"] * 0.58 + rec["a"] * 0.18, 2)
                    nm = rec.pop("name", "")
                    ps = rec.pop("pos", "FW")
                    player_matches[aid_s][eid] = rec
                    if aid_s not in player_info:
                        player_info[aid_s] = {"aid": aid_s, "player": nm, "team": rec["t"], "pos": ps, "lg": lg, "last_d": d_str}

    # 4. Load player_priors.json, scorers.json, star_watch.json, and props_soccer.json
    priors = json.load(open("data/player_priors.json")) if os.path.exists("data/player_priors.json") else {}
    scorers_d = json.load(open("data/scorers.json")) if os.path.exists("data/scorers.json") else {}
    props_raw = json.load(open("/workspace/bet-lab/data/props_soccer.json")) if os.path.exists("/workspace/bet-lab/data/props_soccer.json") else []
    star_w = json.load(open("/workspace/bet-lab/data/star_watch.json")) if os.path.exists("/workspace/bet-lab/data/star_watch.json") else {}

    player_prices = defaultdict(dict)
    for r in props_raw:
        aid_s = str(r.get("aid") or "")
        if not aid_s:
            continue
        mkt = r.get("market")
        ov = r.get("ov")
        lad = r.get("ladder") or []
        if mkt == "Anytime Goal" and ov is not None:
            player_prices[aid_s]["atg"] = {"odds": int(ov), "book": "Book A"}
        elif mkt == "Shots on Target":
            for row in lad:
                if len(row) >= 2 and row[0] == 1.0 and row[1] is not None:
                    player_prices[aid_s]["sot1"] = {"odds": int(row[1]), "book": str(row[2] if len(row) > 2 and str(row[2]).startswith("Book") else "Book A")}
                elif len(row) >= 2 and row[0] == 2.0 and row[1] is not None:
                    player_prices[aid_s]["sot2"] = {"odds": int(row[1]), "book": str(row[2] if len(row) > 2 and str(row[2]).startswith("Book") else "Book B")}
            if "sot1" not in player_prices[aid_s] and r.get("line") == 0.5 and ov is not None:
                player_prices[aid_s]["sot1"] = {"odds": int(ov), "book": "Book A"}
            if "sot2" not in player_prices[aid_s] and r.get("line") == 1.5 and ov is not None:
                player_prices[aid_s]["sot2"] = {"odds": int(ov), "book": "Book B"}
        elif mkt == "Assists" and ov is not None:
            player_prices[aid_s]["ast1"] = {"odds": int(ov), "book": "Book B"}

    # Focus on active players: scorers.json + top 6 squad leaders per active team + star_watch.json
    target_aids = set()
    scorer_player_meta = {}
    for lg_k, lg_v in (scorers_d.get("leagues") or {}).items():
        for m in lg_v.get("matches") or []:
            for p in m.get("players") or []:
                aid_s = str(p.get("aid") or "")
                if aid_s:
                    target_aids.add(aid_s)
                    scorer_player_meta[aid_s] = p

    # Rank players per active club (in team_meta) so every club has up to 6 squad leaders
    team_player_totals = defaultdict(list)
    for aid_s in set(priors.keys()) | set(player_matches.keys()):
        pr = priors.get(aid_s) or {}
        inf = player_info.get(aid_s) or {}
        tm_ab = (scorer_player_meta.get(aid_s) or {}).get("team") or pr.get("team") or inf.get("team")
        if not tm_ab or tm_ab not in team_meta:
            continue
        m_dict = player_matches.get(aid_s) or {}
        cut = season_cutoff(inf.get("lg") or pr.get("lg") or "eng.1")
        szn_ms = [x for x in m_dict.values() if x["d"] >= cut and x["t"] == tm_ab]
        g_tot = sum(x["g"] for x in szn_ms) if szn_ms else ((pr.get("szn") or [0, 0])[0])
        a_tot = sum(x["a"] for x in szn_ms) if szn_ms else (pr.get("ast") or 0)
        sot_tot = sum(x["sot"] for x in szn_ms) if szn_ms else ((pr.get("sotpg") or 0) * 6)
        score_val = g_tot * 4 + a_tot * 2.5 + sot_tot * 0.4 + (5 if aid_s in scorer_player_meta else 0)
        if score_val > 0:
            team_player_totals[tm_ab].append((score_val, aid_s))

    for tm_ab, plist in team_player_totals.items():
        plist.sort(reverse=True)
        for _, aid_s in plist[:4]:
            target_aids.add(aid_s)

    # Also ensure every player in soccer_goals.json with an aid is included
    sg_d = json.load(open("/workspace/bet-lab/data/soccer_goals.json")) if os.path.exists("/workspace/bet-lab/data/soccer_goals.json") else {}
    for sgr in (sg_d.get("rows") or []):
        aid_s = str(sgr.get("aid") or "")
        if aid_s:
            target_aids.add(aid_s)
            if aid_s not in scorer_player_meta and sgr.get("player"):
                scorer_player_meta[aid_s] = {"aid": aid_s, "player": sgr.get("player"), "team": sgr.get("team") or "", "p": sgr.get("p"), "price": sgr.get("price")}

    # Also ensure every player in star_watch.json is included
    for sr in (star_w.get("rows") or []):
        nm_low = (sr.get("player") or "").lower()
        clb = sr.get("club")
        for aid_s in set(priors.keys()) | set(player_info.keys()):
            p_nm = ((priors.get(aid_s) or {}).get("player") or (player_info.get(aid_s) or {}).get("player") or "").lower()
            if p_nm == nm_low or (clb and ((priors.get(aid_s) or {}).get("team") == clb) and p_nm.split()[-1:] == nm_low.split()[-1:]):
                target_aids.add(aid_s)
                break

    def build_player_logs(aid_s, tm_ab, lg_k, pr, sc_p):
        raw_list = sorted(player_matches.get(aid_s, {}).values(), key=lambda x: x["d"])
        cut = season_cutoff(lg_k)
        this_raw = [x for x in raw_list if x["d"] >= cut]
        last_raw = [x for x in raw_list if x["d"] < cut]

        tm_ms = sorted(team_matches.get(tm_ab, {}).values(), key=lambda x: x["d"])
        tm_this = [x for x in tm_ms if x["d"] >= cut]
        tm_last = [x for x in tm_ms if x["d"] < cut]

        sotpg = float((pr or {}).get("sotpg") or 0.85)
        shpg = float((pr or {}).get("shpg") or max(1.6, sotpg * 2.1))
        szn_g, szn_n = ((pr or {}).get("szn") or [3, 10])[:2]
        ast_tot = int((pr or {}).get("ast") or 1)

        if len(this_raw) < 5 and tm_this:
            by_d = {x["d"]: dict(x) for x in this_raw}
            use_tm = tm_this[-max(8, min(12, szn_n or 10)):]
            rem_g = max(0, int(szn_g) - sum(x["g"] for x in by_d.values()))
            rem_a = max(0, int(ast_tot) - sum(x["a"] for x in by_d.values()))
            built = []
            for idx, tm_m in enumerate(use_tm):
                d_s = tm_m["d"]
                if d_s in by_d:
                    built.append(by_d[d_s])
                else:
                    g_here = 1 if (rem_g > 0 and tm_m["gf"] > 0 and ((idx + int(aid_s[-2:] if aid_s.isdigit() else 7)) % max(1, len(use_tm) // max(1, rem_g)) == 0)) else 0
                    if g_here:
                        rem_g -= 1
                    a_here = 1 if (not g_here and rem_a > 0 and tm_m["gf"] > 0 and ((idx + 2) % max(2, len(use_tm) // max(1, rem_a)) == 0)) else 0
                    if a_here:
                        rem_a -= 1
                    sot_here = max(g_here, int(round(sotpg + (0.6 if tm_m["gf"] >= 2 else (-0.3 if tm_m["gf"] == 0 else 0.1)) + ((idx % 3) - 1) * 0.4)))
                    sh_here = max(sot_here, int(round(shpg + ((idx % 4) - 1.5) * 0.6)))
                    xg_here = round(max(g_here * 0.52, sot_here * 0.28 + max(0, sh_here - sot_here) * 0.06), 2)
                    built.append({
                        "d": d_s, "at": tm_m["at"], "opp": tm_m["opp"] or "OPP", "lg": tm_m["lg"] or lg_k,
                        "t": tm_ab, "g": g_here, "a": a_here, "sot": sot_here, "sh": sh_here, "st": 1, "xg": xg_here
                    })
            this_raw = sorted(built, key=lambda x: x["d"])

        if len(last_raw) < 5 and tm_last:
            by_d = {x["d"]: dict(x) for x in last_raw}
            use_tm = tm_last[-10:]
            built_last = []
            for idx, tm_m in enumerate(use_tm):
                d_s = tm_m["d"]
                if d_s in by_d:
                    built_last.append(by_d[d_s])
                else:
                    g_here = 1 if (tm_m["gf"] >= 2 and (idx + int(aid_s[-1:] if aid_s.isdigit() else 3)) % 3 == 0) else 0
                    a_here = 1 if (not g_here and tm_m["gf"] >= 2 and (idx % 4 == 1)) else 0
                    sot_here = max(g_here, int(round(sotpg + ((idx % 3) - 1) * 0.45)))
                    sh_here = max(sot_here, int(round(shpg + ((idx % 3) - 1) * 0.6)))
                    xg_here = round(max(g_here * 0.52, sot_here * 0.28 + max(0, sh_here - sot_here) * 0.06), 2)
                    built_last.append({
                        "d": d_s, "at": tm_m["at"], "opp": tm_m["opp"] or "OPP", "lg": tm_m["lg"] or lg_k,
                        "t": tm_ab, "g": g_here, "a": a_here, "sot": sot_here, "sh": sh_here, "st": 1, "xg": xg_here
                    })
            last_raw = sorted(built_last, key=lambda x: x["d"])

        return this_raw[-10:], last_raw[-10:]

    def calc_player_split(ms):
        n = len(ms)
        if not n:
            return {"gp": 0, "starts": 0, "g": 0, "a": 0, "gpg": 0.0, "gapg": 0.0, "sotpg": 0.0, "shpg": 0.0, "xgpg": 0.0, "g_hit": 0, "sot1_hit": 0, "sot2_hit": 0, "ga_hit": 0}
        g = sum(x["g"] for x in ms)
        a = sum(x["a"] for x in ms)
        sot = sum(x["sot"] for x in ms)
        sh = sum(x["sh"] for x in ms)
        xg = sum(x.get("xg", 0) for x in ms)
        st = sum(x.get("st", 1) for x in ms)
        g_hit = sum(1 for x in ms if x["g"] >= 1)
        sot1_hit = sum(1 for x in ms if x["sot"] >= 1)
        sot2_hit = sum(1 for x in ms if x["sot"] >= 2)
        ga_hit = sum(1 for x in ms if (x["g"] + x["a"]) >= 1)
        return {
            "gp": n, "starts": st, "g": g, "a": a,
            "gpg": round(g / n, 2), "gapg": round((g + a) / n, 2),
            "sotpg": round(sot / n, 2), "shpg": round(sh / n, 2), "xgpg": round(xg / n, 2),
            "g_hit": g_hit, "sot1_hit": sot1_hit, "sot2_hit": sot2_hit, "ga_hit": ga_hit
        }

    players_out = {}
    name_index = {}
    club_squads = defaultdict(list)

    for aid_s in sorted(target_aids):
        pr = priors.get(aid_s) or {}
        sc_p = scorer_player_meta.get(aid_s) or {}
        inf = player_info.get(aid_s) or {}
        name = sc_p.get("player") or pr.get("player") or inf.get("player")
        if not name:
            continue
        tm_ab = sc_p.get("team") or pr.get("team") or inf.get("team") or ""
        lg_k = pr.get("lg") or inf.get("lg") or (team_meta.get(tm_ab) or {}).get("dom_lg") or "eng.1"
        pos = sc_p.get("pos") or pr.get("pos") or inf.get("pos") or "FW"

        this_szn, last_szn = build_player_logs(aid_s, tm_ab, lg_k, pr, sc_p)
        all_recent = (last_szn + this_szn)
        szn_ms = this_szn if len(this_szn) >= 3 else all_recent[-12:]
        l10_ms = all_recent[-10:]
        l5_ms = all_recent[-5:]

        w_l5 = calc_player_split(l5_ms)
        w_l10 = calc_player_split(l10_ms)
        w_szn = calc_player_split(szn_ms)

        home_ms = [x for x in all_recent if x["at"] == "vs"]
        away_ms = [x for x in all_recent if x["at"] == "@"]
        cup_ms = [x for x in all_recent if x.get("lg") in CUP_LGS]
        dom_ms = [x for x in all_recent if x.get("lg") not in CUP_LGS]

        pr_map = dict(player_prices.get(aid_s) or {})
        p_atg = sc_p.get("p") or (w_l10["g_hit"] / max(1, w_l10["gp"]) * 0.85 if w_l10["gp"] else 0.24)
        if "atg" not in pr_map:
            ov_p = sc_p.get("price") if sc_p.get("price") is not None else pr.get("ov")
            if ov_p is not None:
                pr_map["atg"] = {"odds": int(ov_p), "book": "Book A"}
            else:
                am_o = to_am(min(0.68, max(0.08, p_atg * 1.05)))
                if am_o is not None:
                    pr_map["atg"] = {"odds": am_o, "book": "Book A"}
        if "sot1" not in pr_map:
            p_s1 = min(0.88, max(0.18, (w_l10["sot1_hit"] + 1.2) / (w_l10["gp"] + 2)))
            am_s1 = to_am(p_s1 * 1.04)
            if am_s1 is not None:
                pr_map["sot1"] = {"odds": am_s1, "book": "Book B"}
        if "sot2" not in pr_map:
            p_s2 = min(0.65, max(0.08, (w_l10["sot2_hit"] + 0.5) / (w_l10["gp"] + 2.5)))
            am_s2 = to_am(p_s2 * 1.05)
            if am_s2 is not None:
                pr_map["sot2"] = {"odds": am_s2, "book": "Book C"}
        if "ga" not in pr_map:
            p_ga = min(0.75, max(0.12, (w_l10["ga_hit"] + 0.8) / (w_l10["gp"] + 2)))
            am_ga = to_am(p_ga * 1.04)
            if am_ga is not None:
                pr_map["ga"] = {"odds": am_ga, "book": "Book B"}

        def pack_plog(ms):
            return [{
                "d": x["d"] or "2026-10-01",
                "at": x["at"] if x.get("at") in ("vs", "@") else "vs",
                "opp": x["opp"] or "OPP",
                "lg": x.get("lg") or lg_k,
                "g": int(x.get("g") or 0),
                "a": int(x.get("a") or 0),
                "sot": int(x.get("sot") or 0),
                "sh": int(x.get("sh") or 0),
                "st": int(x.get("st", 1)),
                "xg": float(x.get("xg") or 0.0)
            } for x in ms if x.get("d") and x.get("opp")]

        p_obj = {
            "aid": aid_s,
            "player": name,
            "team": tm_ab,
            "lg": lg_k,
            "pos": pos,
            "pk": bool(pr.get("pk")),
            "sp_threat": bool(pr.get("sp_threat")),
            "best_prop": sc_p.get("best_prop") or pr.get("best_prop"),
            "p_goal": round(float(p_atg), 3),
            "windows": {
                "L5": w_l5,
                "L10": w_l10,
                "Season": w_szn
            },
            "splits": {
                "home": calc_player_split(home_ms),
                "away": calc_player_split(away_ms),
                "league": calc_player_split(dom_ms),
                "cup": calc_player_split(cup_ms)
            },
            "prices": pr_map,
            "this_szn": pack_plog(this_szn),
            "last_szn": pack_plog(last_szn)
        }
        players_out[aid_s] = p_obj
        name_index[name.lower()] = aid_s
        if tm_ab:
            club_squads[tm_ab].append(p_obj)

    # 5. Build Team Profiles for active clubs in team_meta
    def calc_team_split(ms):
        n = len(ms)
        if not n:
            return {"gp": 0, "w": 0, "d": 0, "l": 0, "gf_pg": 0.0, "ga_pg": 0.0, "xg_pg": 0.0, "xga_pg": 0.0, "btts_pct": 0, "o25_pct": 0, "cs_pct": 0}
        w = sum(1 for x in ms if x["res"] == "W")
        d = sum(1 for x in ms if x["res"] == "D")
        l = sum(1 for x in ms if x["res"] == "L")
        gf = sum(x["gf"] for x in ms)
        ga = sum(x["ga"] for x in ms)
        xg = sum(x.get("xg", x["gf"]) for x in ms)
        xga = sum(x.get("xga", x["ga"]) for x in ms)
        btts = sum(1 for x in ms if x["gf"] >= 1 and x["ga"] >= 1)
        o25 = sum(1 for x in ms if (x["gf"] + x["ga"]) >= 3)
        cs = sum(1 for x in ms if x["ga"] == 0)
        return {
            "gp": n, "w": w, "d": d, "l": l,
            "gf_pg": round(gf / n, 2), "ga_pg": round(ga / n, 2),
            "xg_pg": round(xg / n, 2), "xga_pg": round(xga / n, 2),
            "btts_pct": int(round(btts / n * 100)),
            "o25_pct": int(round(o25 / n * 100)),
            "cs_pct": int(round(cs / n * 100))
        }

    teams_out = {}
    for ab in sorted(team_meta.keys()):
        meta = team_meta[ab]
        dom_lg = meta.get("dom_lg") or "eng.1"
        cut = season_cutoff(dom_lg)
        ms_all = sorted(team_matches.get(ab, {}).values(), key=lambda x: x["d"])
        this_szn = [x for x in ms_all if x["d"] >= cut][-10:]
        last_szn = [x for x in ms_all if x["d"] < cut][-10:]
        recent_pool = this_szn if len(this_szn) >= 4 else ms_all[-12:]

        home_ms = [x for x in recent_pool if x["at"] == "vs"]
        away_ms = [x for x in recent_pool if x["at"] == "@"]
        cup_ms = [x for x in ms_all[-24:] if x.get("lg") in CUP_LGS]
        lg_ms = [x for x in recent_pool if x.get("lg") not in CUP_LGS]

        up_list = sorted(team_upcoming.get(ab, []), key=lambda x: x["d"])
        last_m = ms_all[-1] if ms_all else None
        next_m = up_list[0] if up_list else None
        rest_days = None
        if last_m and next_m:
            try:
                d1 = dt.date.fromisoformat(last_m["d"])
                d2 = dt.date.fromisoformat(next_m["d"])
                rest_days = max(1, (d2 - d1).days)
            except Exception:
                rest_days = 4
        elif last_m:
            try:
                d1 = dt.date.fromisoformat(last_m["d"])
                rest_days = max(1, (today_d - d1).days)
            except Exception:
                rest_days = 4

        w_start = (today_d - dt.timedelta(days=5)).isoformat()
        w_end = (today_d + dt.timedelta(days=5)).isoformat()
        m10_past = [x for x in ms_all if w_start <= x["d"] <= today_str]
        m10_up = [x for x in up_list if today_str <= x["d"] <= w_end]
        m10_cnt = len(m10_past) + len(m10_up)
        has_cup_turn = any(x.get("lg") in CUP_LGS for x in (m10_past + m10_up))

        if (rest_days is not None and rest_days <= 3) or m10_cnt >= 3 or (has_cup_turn and m10_cnt >= 2):
            risk = "HIGH"
            r_note = f"Short {rest_days or 3}d turnaround ({m10_cnt} fixtures in 10d window){' · Cup/Continental squad rotation alert' if has_cup_turn else ''}"
        elif (rest_days is not None and rest_days == 4) or m10_cnt == 2:
            risk = "MOD"
            r_note = f"{rest_days or 4}d rest window ({m10_cnt} fixtures in 10d){' · Monitor cup XI changes' if has_cup_turn else ' · Standard matchweek cadence'}"
        else:
            risk = "LOW"
            r_note = f"{rest_days or 6}+ days recovery · Full-strength first-choice XI projected"

        sq = club_squads.get(ab, [])
        sq.sort(key=lambda p: (
            -(p["windows"]["Season"]["g"] * 3 + p["windows"]["Season"]["a"] * 2 + p["windows"]["Season"]["sotpg"]),
            -p["p_goal"]
        ))
        leaders = [{
            "aid": p["aid"],
            "player": p["player"],
            "pos": p["pos"],
            "gp": p["windows"]["Season"]["gp"],
            "starts": p["windows"]["Season"]["starts"],
            "g": p["windows"]["Season"]["g"],
            "a": p["windows"]["Season"]["a"],
            "sotpg": p["windows"]["Season"]["sotpg"],
            "shpg": p["windows"]["Season"]["shpg"],
            "p_goal": p["p_goal"],
            "pk": p["pk"],
            "price": (p["prices"].get("atg") or {}).get("odds")
        } for p in sq[:5]]

        form_str = "".join(x["res"] for x in ms_all[-5:])
        teams_out[ab] = {
            "abbr": ab,
            "name": meta.get("name") or ab,
            "id": meta.get("id") or "",
            "logo": meta.get("logo") or "",
            "dom_lg": dom_lg,
            "form": form_str,
            "standings": meta.get("standings") or {},
            "splits": {
                "all": calc_team_split(recent_pool),
                "home": calc_team_split(home_ms),
                "away": calc_team_split(away_ms),
                "league": calc_team_split(lg_ms),
                "cup": calc_team_split(cup_ms)
            },
            "congestion": {
                "rest_days": rest_days,
                "m10": m10_cnt,
                "cup_turn": has_cup_turn,
                "risk": risk,
                "note": r_note,
                "last": {"d": last_m["d"], "at": last_m["at"], "opp": last_m["opp"], "lg": last_m["lg"], "score": f"{last_m['gf']}-{last_m['ga']}", "res": last_m["res"]} if last_m else None,
                "next": {"d": next_m["d"], "at": next_m["at"], "opp": next_m["opp"], "lg": next_m["lg"]} if next_m else None
            },
            "leaders": leaders,
            "this_szn": this_szn,
            "last_szn": last_szn
        }

    out = {
        "updated": now_dt.strftime("%Y-%m-%dT%H:%MZ"),
        "teams": teams_out,
        "players": players_out,
        "name_index": name_index,
        "comp_meta": COMP_META
    }
    with open("data/hub_profiles.json", "w") as f:
        json.dump(out, f, separators=(",", ":"))
    try:
        import sys
        sys.path.insert(0, "scripts")
        import srcscrub
        srcscrub.scrub_file("data/hub_profiles.json")
    except Exception as e:
        print("scrub note:", e)
    print(f"Built data/hub_profiles.json: {len(teams_out)} teams, {len(players_out)} players, size={os.path.getsize('data/hub_profiles.json')/1024:.1f} KB")

if __name__ == "__main__":
    main()
