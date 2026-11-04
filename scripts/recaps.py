#!/usr/bin/env python3
"""Write match recaps for one ET day (default: yesterday ET) to data/recaps/<YYYY-MM-DD>.json.
Real final results only (scoreline, goals, cards, key player lines) plus how that day's Highlighted plays graded.
Must run BEFORE prune_past.py in the overnight job, since it reads finished games straight from the results feed."""
import json, os, sys, glob, re, unicodedata, urllib.request, datetime as dt
from concurrent.futures import ThreadPoolExecutor
from zoneinfo import ZoneInfo
ET = ZoneInfo("America/New_York")
LGS = ["eng.1","esp.1","ita.1","ger.1","fra.1","ned.1","por.1","tur.1","sco.1","bra.1","eng.league_cup","ger.dfb_pokal",
       "esp.copa_del_rey","por.taca.portugal","uefa.champions","uefa.europa","afc.champions","usa.1","mex.1","ksa.1"]
BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer"
BL = os.environ.get("BL_DATA", "https://betlab.sportslabshq.com/data")

def get(u):
    try:
        if u.startswith("http"):
            return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=20).read())
        return json.load(open(u)) if not u.endswith(".jsonl") else open(u).read()
    except Exception: return None
def gettext(u):
    try:
        if u.startswith("http"): return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=20).read().decode()
        return open(u).read()
    except Exception: return ""
def norm(x): return " ".join(unicodedata.normalize("NFKD", x or "").encode("ascii","ignore").decode().lower().replace("-"," ").split())
def etday(s): return dt.datetime.fromisoformat(s.replace("Z","+00:00")).astimezone(ET).date().isoformat()

def finals(day):
    d0 = dt.date.fromisoformat(day); out = []
    def one(lg):
        r = []
        for dd in {d0, d0 + dt.timedelta(days=1)}:     # ET day can spill into next UTC day
            j = get(f"{BASE}/{lg}/scoreboard?dates={dd:%Y%m%d}") or {}
            for e in j.get("events", []):
                st = e.get("status", {}).get("type", {})
                if st.get("completed") and etday(e["date"]) == day: r.append((lg, e))
        return r
    with ThreadPoolExecutor(8) as ex:
        for r in ex.map(one, LGS): out += r
    seen = set(); return [x for x in out if not (x[1]["id"] in seen or seen.add(x[1]["id"]))]

def highlighted(day):
    tiers = get(f"{BL}/edge_tiers.json") or {}; grades = get(f"{BL}/edge_grades.json") or {}
    rows = []
    for l in gettext(f"{BL}/edge_log.jsonl").splitlines():
        try: x = json.loads(l)
        except Exception: continue
        if x.get("sport") != "soccer" or not x.get("start") or etday(x["start"]) != day: continue
        if (tiers.get(x["id"]) or {}).get("tier") != "recommended": continue
        rows.append({"id": x["id"], "title": x.get("title"), "market": x.get("market"), "start": x["start"],
                     "p": (tiers.get(x["id"]) or {}).get("p_cal") or x.get("p_model"),
                     "result": (grades.get(x["id"]) or {}).get("result")})
    return rows

def recap(lg, e, hl):
    s = get(f"{BASE}/{lg}/summary?event={e['id']}") or {}
    c = e["competitions"][0]; teams = {t["homeAway"]: t for t in c["competitors"]}
    h, a = teams["home"], teams["away"]
    hs, as_ = int(h.get("score") or 0), int(a.get("score") or 0)
    goals, cards = [], []
    for k in s.get("keyEvents", []):
        t = (k.get("type") or {}).get("type") or ""; who = [p["athlete"]["displayName"] for p in k.get("participants", []) if p.get("athlete")]
        tm = (k.get("team") or {}).get("displayName"); mn = (k.get("clock") or {}).get("displayValue")
        if k.get("scoringPlay") and who: goals.append({"min": mn, "team": tm, "player": who[0], "assist": who[1] if len(who) > 1 else None, "og": "own" in t})
        elif t in ("red-card", "yellow-red-card") and who: cards.append({"min": mn, "team": tm, "player": who[0], "type": "Red"})
    players = {}
    for ro in s.get("rosters", []):
        for p in ro.get("roster", []):
            st = {x["name"]: x.get("value") for x in p.get("stats", [])}
            if not st.get("appearances"): continue
            players[norm(p["athlete"]["displayName"])] = {"name": p["athlete"]["displayName"], "team": ro["team"].get("abbreviation"),
                "g": int(st.get("totalGoals") or 0), "a": int(st.get("goalAssists") or 0), "sh": int(st.get("totalShots") or 0), "sot": int(st.get("shotsOnTarget") or 0)}
    mine = []
    for r in hl:
        nm = norm(re.split(r" (Anytime Goal|Shots on Target|Shots|Assists|Goals)", r["title"] or "")[0])
        p = players.get(nm) or next((v for k, v in players.items() if nm and (nm in k or k in nm)), None)
        if not p or r["start"][:16] != e["date"][:16]: continue
        line = f"{p['g']} G · {p['a']} A · {p['sot']}/{p['sh']} SOT/shots"
        mine.append({"title": r["title"], "p": r["p"], "result": r["result"] or ("pending" ), "line": line})
    win = h if hs > as_ else a if as_ > hs else None
    hn, an = h["team"]["displayName"], a["team"]["displayName"]
    if win: story = f"{win['team']['displayName']} beat {(a if win is h else h)['team']['displayName']} {max(hs,as_)}-{min(hs,as_)}."
    else: story = f"{hn} and {an} drew {hs}-{as_}."
    if goals:
        story += " Goals: " + "; ".join(f"{g['player']} {g['min']}" + (" (OG)" if g["og"] else "") for g in goals) + "."
    if cards: story += " Sent off: " + ", ".join(f"{x['player']} {x['min']}" for x in cards) + "."
    top = sorted(players.values(), key=lambda v: (-v["g"], -v["a"], -v["sot"]))[:3]
    return {"id": e["id"], "lg": lg, "date": e["date"], "status": c["status"]["type"].get("detail"),
            "home": {"abbr": h["team"].get("abbreviation"), "name": hn, "logo": h["team"].get("logo"), "score": hs},
            "away": {"abbr": a["team"].get("abbreviation"), "name": an, "logo": a["team"].get("logo"), "score": as_},
            "story": story, "goals": goals, "reds": cards, "standouts": top,
            "highlighted": mine,
            "right": [m for m in mine if m["result"] == "win"], "wrong": [m for m in mine if m["result"] == "loss"]}

def main(day=None):
    day = day or (dt.datetime.now(ET).date() - dt.timedelta(days=1)).isoformat()
    hl = highlighted(day); fs = finals(day)
    with ThreadPoolExecutor(6) as ex: games = list(ex.map(lambda x: recap(x[0], x[1], hl), fs))
    games.sort(key=lambda g: g["date"])
    allh = [m for g in games for m in g["highlighted"]]
    out = {"day": day, "updated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "games": games,
           "summary": {"finals": len(games), "highlighted": len(allh), "right": sum(m["result"] == "win" for m in allh),
                       "wrong": sum(m["result"] == "loss" for m in allh)}}
    os.makedirs("data/recaps", exist_ok=True)
    json.dump(out, open(f"data/recaps/{day}.json", "w"), separators=(",", ":"))
    idx = sorted({os.path.basename(p)[:-5] for p in glob.glob("data/recaps/20*.json")})[-60:]
    json.dump({"days": idx}, open("data/recaps/index.json", "w"))
    print(day, out["summary"])

if __name__ == "__main__": main(sys.argv[1] if len(sys.argv) > 1 else None)
