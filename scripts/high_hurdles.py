"""Soccer High Hurdles: 2+ shots on target, 2+ goal contributions (G+A), 4+ shots.
Display only: never feeds Highlighted plays. Real data only: each player's own match logs in data/hub_profiles.json
(this season + last season), limited to players named in today's/upcoming matches in data/scorers.json.
No model probability is shown; the page shows the player's actual hit rate in recent starts.
Gate: >= 6 starts logged in the window, and cleared the hurdle in >= 3 of the last 10 starts.
Output: data/high_hurdles.json"""
import json, os, datetime as dt
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
MK = {"sot2": ("2+ Shots on Target", lambda r: (r.get("sot") or 0) >= 2),
      "ga2": ("2+ Goal Contributions", lambda r: (r.get("g") or 0) + (r.get("a") or 0) >= 2),
      "sh4": ("4+ Shots", lambda r: (r.get("sh") or 0) >= 4)}
def ld(f):
    try: return json.load(open(os.path.join(D, f)))
    except Exception: return {}
def main():
    hp = ld("hub_profiles.json"); sc = ld("scorers.json"); P = hp.get("players", {})
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    rows, seen = [], set()
    for lg, L in (sc.get("leagues") or {}).items():
        for m in L.get("matches", []):
            if not m.get("start") or m["start"] < now: continue
            for pl in m.get("players", []):
                key = (pl.get("aid"), m.get("game"))
                if key in seen or str(pl.get("aid")) not in P: continue
                seen.add(key); pr = P[str(pl["aid"])]
                logs = sorted([r for r in (pr.get("last_szn") or []) + (pr.get("this_szn") or []) if r.get("st")], key=lambda r: r["d"])
                if len(logs) < 6: continue
                l10 = logs[-10:]; l5 = logs[-5:]
                for k, (lab, f) in MK.items():
                    h10 = sum(map(f, l10))
                    if h10 < 3: continue
                    rows.append(dict(game=m["game"], start=m["start"], matchup=m.get("matchup"), lg=lg, aid=str(pl["aid"]),
                        player=pr.get("player") or pl.get("player"), team=pl.get("team"), opp=pl.get("opp"), market=k, label=lab,
                        l10=[h10, len(l10)], l5=[sum(map(f, l5)), len(l5)], all=[sum(map(f, logs)), len(logs)],
                        last=[{"d": r["d"], "opp": r.get("opp"), "g": r.get("g"), "a": r.get("a"), "sh": r.get("sh"), "sot": r.get("sot")} for r in l5]))
    rows.sort(key=lambda r: (-r["l10"][0] / r["l10"][1], -r["l5"][0], r["start"]))
    json.dump({"updated": now, "rule": "cleared in 3+ of last 10 starts (min 6 starts logged)", "rows": rows}, open(os.path.join(D, "high_hurdles.json"), "w"))
    print(len(rows), "rows")
if __name__ == "__main__": main()
