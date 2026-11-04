#!/usr/bin/env python3
"""Drop games dated before today (America/New_York) from every Soccer Hub league/cup board file.
Board files only (data/<league>.json); graded records and logs are never touched."""
import json, glob, os, datetime
from zoneinfo import ZoneInfo
ET = ZoneInfo("America/New_York")
SKIP = {"hub_profiles.json", "injuries_manual.json", "meta.json", "player_priors.json", "scorers.json"}

def et_day(iso):
    if not iso: return None
    t = datetime.datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return t.astimezone(ET).date()

def keep(g, today):
    d = et_day(g.get("date"))
    return d is None or d >= today

def prune_games(games, today=None):
    today = today or datetime.datetime.now(ET).date()
    return [g for g in (games or []) if keep(g, today)]

def main(data="data"):
    today = datetime.datetime.now(ET).date()
    meta_p = os.path.join(data, "meta.json")
    meta = json.load(open(meta_p)) if os.path.exists(meta_p) else {"leagues": {}}
    for f in sorted(glob.glob(os.path.join(data, "*.json"))):
        if os.path.basename(f) in SKIP: continue
        d = json.load(open(f))
        if not isinstance(d, dict) or "games" not in d: continue
        g0 = d["games"] or []; g1 = prune_games(g0, today)
        if len(g1) != len(g0):
            d["games"] = g1
            json.dump(d, open(f, "w"), separators=(",", ":"))
            k = os.path.basename(f)[:-5]
            if k in meta.get("leagues", {}): meta["leagues"][k]["games"] = len(g1)
            print(f"{f}: removed {len(g0)-len(g1)} past games, {len(g1)} left")
    json.dump(meta, open(meta_p, "w"))

if __name__ == "__main__":
    main()
