"""Soccer Matchup Board (player props). Display only: never feeds Highlighted plays or parlays.
Per competition on the slate (today + next 5 days), lists for Anytime Goal, Assists, Goal or Assist, Shots, Shots on Target, Saves.
Current-season match logs (all competitions for the player's club), posted prop lines where available ('model' otherwise),
opponent concessions ranked across every club in our logs, newest availability (players without a current listing or
listed out are dropped). Writes data/matchups.json."""
import json, os, sys, math, collections, datetime as dt, statistics as st, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = ROOT + "/data"
BL = os.environ.get("BETLAB_DATA", "https://betlab.sportslabshq.com/data")
def jload(n):
    if BL.startswith("http"):
        with urllib.request.urlopen(f"{BL}/{n}?t={int(dt.datetime.now().timestamp())}", timeout=120) as r: return json.load(r)
    return json.load(open(f"{BL}/{n}"))
props, games = jload("props_soccer.json"), jload("games_soccer.json")
# per-player match logs across every competition we track (box scores; appearances only)
import glob
BOX = os.environ.get("SOCCER_BOX", os.path.join(ROOT, "..", "bet-lab-engine", "data", "soccer"))
plogs = collections.defaultdict(list)
for fn in glob.glob(os.path.join(BOX, "*_box.json")):
    for gid, b in json.load(open(fn)).items():
        tm = b.get("t") or {}
        for aid, r in b.get("p", {}).items():
            t = r[0]; o = tm.get("away") if t == tm.get("home") else tm.get("home")
            plogs[aid].append({"d": b["d"], "e": gid, "c": b.get("c"), "t": t, "o": o, "pos": r[1],
                               "s": {"start": r[2], "goals": r[4] or 0, "assists": r[5] or 0, "shots": r[6] or 0, "sot": r[7] or 0, "saves": r[8] or 0}})
for aid in list(plogs):   # a match can sit in more than one competition file: keep one row per match
    seen = {}; [seen.setdefault(x["e"], x) for x in plogs[aid]]; plogs[aid] = list(seen.values())
print("box logs:", len(plogs), "players")
try: prof = json.load(open(D + "/hub_profiles.json"))
except Exception: prof = {"teams": {}}
try: manual = {p["aid"] for p in json.load(open(D + "/injuries_manual.json"))["players"] if p.get("st") in ("out", "suspended")}
except Exception: manual = set()
CAL_YEAR = {"usa.1", "bra.1", "mex.1"}
def cutoff(lg): return "2026-01-15" if lg in CAL_YEAR else "2026-07-01"
NAMES = {"uefa.champions": "Champions League", "uefa.europa": "Europa League", "uefa.europa.conf": "Conference League", "eng.1": "Premier League",
         "esp.1": "La Liga", "ita.1": "Serie A", "ger.1": "Bundesliga", "fra.1": "Ligue 1", "usa.1": "MLS", "ned.1": "Eredivisie", "por.1": "Primeira Liga",
         "tur.1": "Süper Lig", "sco.1": "Scottish Premiership", "bra.1": "Brasileirão", "mex.1": "Liga MX", "ksa.1": "Saudi Pro League",
         "eng.league_cup": "League Cup", "ger.dfb_pokal": "DFB-Pokal", "esp.copa_del_rey": "Copa del Rey", "afc.champions": "AFC Champions League"}
now = dt.datetime.now(dt.timezone.utc); horizon = now + dt.timedelta(days=5)
pt = lambda s: dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
slate = [g for g in games if now - dt.timedelta(hours=2) <= pt(g["time"]) <= horizon]
GM = {g["id"]: g for g in slate}
CATS = {"goal": ("Anytime Goal", lambda s: s.get("goals", 0), 0.5), "ast": ("Assists", lambda s: s.get("assists", 0), 0.5),
        "ga": (None, lambda s: s.get("goals", 0) + s.get("assists", 0), 0.5), "shots": ("Shots", lambda s: s.get("shots", 0), None),
        "sot": ("Shots on Target", lambda s: s.get("sot", 0), None), "saves": ("Saves", lambda s: s.get("saves", 0), None)}
BIN = {"goal", "ast", "ga"}
# ---- opponent concessions per club (current season, all comps in our logs) ----
cut_all = "2026-07-01"
conc = collections.defaultdict(lambda: collections.defaultdict(float)); cg = collections.defaultdict(set)
for aid, L in plogs.items():
    for g in L:
        if g["d"] < cutoff(g.get("c")): continue
        o = g["o"]; cg[o].add(g["e"]); s = g["s"]
        for k in ("goals", "assists", "shots", "sot", "saves"): conc[o][k] += s.get(k, 0)
xga = {t: ((v.get("splits") or {}).get("all") or {}).get("xga_pg") for t, v in (prof.get("teams") or {}).items()}
clubs = [t for t in conc if len(cg[t]) >= 4]
def per(t, k): return conc[t][k] / len(cg[t])
DEF = {"goals": "Goals allowed/g", "assists": "Assists allowed/g", "shots": "Shots allowed/g", "sot": "On target allowed/g", "saves": "Opp keeper saves/g"}
RK = {k: {t: i + 1 for i, t in enumerate(sorted(clubs, key=lambda t: per(t, k)))} for k in DEF}   # 1 = allows least, N = most
xc = [t for t in clubs if xga.get(t) is not None]; RKX = {t: i + 1 for i, t in enumerate(sorted(xc, key=lambda t: xga[t]))}
NCL = len(clubs)
def dcols(c, o):
    keys = {"goal": ["goals", "shots"], "ast": ["assists", "shots"], "ga": ["goals", "assists"], "shots": ["shots", "sot"], "sot": ["sot", "shots"], "saves": ["sot", "shots"]}[c]
    if c == "saves": cols = [("Opp shots on target/g", None, None)]  # for a keeper: how many on-target shots HIS opponent takes -> use opponent's attack
    out = []
    for k in keys:
        if o in RK[k]:
            # 32-style scale normalised to 1..N, N = softest
            out.append([DEF[k], round(per(o, k), 2), RK[k][o], len(RK[k])])
        else: out.append([DEF[k], None, None, None])
    out.append(["xG allowed/g", xga.get(o), RKX.get(o), len(RKX)] if o in RKX else ["xG allowed/g", None, None, None])
    return out
# attack of opponent for keepers (shots on target the opponent produces)
att = collections.defaultdict(lambda: collections.defaultdict(float)); ag = collections.defaultdict(set)
for aid, L in plogs.items():
    for g in L:
        if g["d"] >= cutoff(g.get("c")): ag[g["t"]].add(g["e"]); att[g["t"]]["sot"] += g["s"].get("sot", 0); att[g["t"]]["shots"] += g["s"].get("shots", 0)
aclubs = [t for t in att if len(ag[t]) >= 4]
RKA = {k: {t: i + 1 for i, t in enumerate(sorted(aclubs, key=lambda t: att[t][k] / len(ag[t])))} for k in ("sot", "shots")}
def kcols(o):
    return [[f"Opp {lab} taken/g", round(att[o][k] / len(ag[o]), 2) if o in RKA[k] else None, RKA[k].get(o), len(RKA[k])] for k, lab in (("sot", "on target"), ("shots", "shots"))] + [["xG allowed/g (own side)", None, None]][:0]
# ---- lines + candidate players ----
LN, CAND = {}, {}
for p in props:
    if p.get("game") not in GM: continue
    CAND[(p["aid"], p["game"])] = p
    for c, (m, _, _) in CATS.items():
        if m and p["market"] == m: LN[(c, p["aid"], p["game"])] = p
GR = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F"]
lgavg = collections.defaultdict(list)
rows_by = collections.defaultdict(lambda: collections.defaultdict(list))
for (aid, _gid), p in CAND.items():
    g = GM[p["game"]]; lg = g["lg"]; team = p["team"]; o = p.get("oa"); pos = p.get("pos") or ""
    if aid in manual: continue
    L = sorted([x for x in plogs.get(aid, []) if x["d"] >= cutoff(lg)], key=lambda x: x["d"])
    if len(L) < 4: continue
    starts = [x["s"].get("start", 0) for x in L]
    st5 = sum(starts[-5:]) / len(starts[-5:]); stS = sum(starts) / len(starts)
    if st5 == 0 and stS < 0.3: continue   # not in the current rotation
    apps = [x for x in L if x["s"].get("start", 0) or any(x["s"].get(k, 0) for k in ("shots", "goals", "assists", "saves"))]
    for c, (m, f, dl) in CATS.items():
        if (c == "saves") != (pos == "GK"): continue
        vals = [f(x["s"]) for x in L]; l5 = vals[-5:]
        lp = LN.get((c, aid, p["game"]))
        if c not in BIN and not lp and st.mean(vals) < (0.8 if c == "shots" else 0.4 if c == "sot" else 1.5): continue
        line = lp["line"] if lp else (0.5 if c in BIN else max(0.5, math.floor(st.median(vals)) + 0.5 - 1 if st.median(vals) >= 1 else 0.5))
        hit = lambda v: v > line
        rate = lambda V: sum(1 for v in V if hit(v)) / len(V)
        rows_by[lg][c].append(dict(aid=aid, name=p["player"], team=team, opp=o, site="vs" if p.get("home") else "@", pos=pos, game=g["id"], time=g["time"],
            line=line, src="posted" if lp else "model", book=("Book A" if lp and lp.get("ov") is not None else None), price=(lp or {}).get("ov"),
            l5=l5, hits=sum(hit(v) for v in l5), l5avg=round(st.mean(l5), 2), szn_hits=sum(hit(v) for v in vals), szn_n=len(vals), szn_avg=round(st.mean(vals), 2),
            g2=(round(100 * sum(v >= 2 for v in vals) / len(vals)) if c == "goal" else None), g2_l5=(sum(v >= 2 for v in l5) if c == "goal" else None),
            st_l5=round(100 * st5), st_szn=round(100 * stS), _r5=rate(l5), _rs=rate(vals), _m5=st.mean(l5), _ms=st.mean(vals),
            cols=(kcols(o) if c == "saves" else dcols(c, o))))
        lgavg[(c, pos)].append(rate(vals) if c in BIN else st.mean(vals))
LGA = {k: st.mean(v) for k, v in lgavg.items()}
STATK = {"goal": "goals", "ast": "assists", "ga": "goals", "shots": "shots", "sot": "sot"}
def mfac(c, o):
    if c == "saves": return (att[o]["sot"] / len(ag[o])) / st.mean(att[t]["sot"] / len(ag[t]) for t in aclubs) if o in RKA["sot"] else 1.0
    k = STATK[c]
    if o not in RK[k]: return 1.0
    f = per(o, k) / st.mean(per(t, k) for t in clubs)
    return max(0.7, min(1.4, f))
out = {}
for lg, C in rows_by.items():
    out[lg] = {"name": NAMES.get(lg, lg), "games": sorted({(g["time"], g["id"], g.get("away"), g.get("home")) for g in slate if g["lg"] == lg}), "cats": {}}
    for c, rows in C.items():
        for r in rows:
            f = mfac(c, r["opp"]); n = r["szn_n"]; prior = LGA.get((c, r["pos"]), 0.2 if c in BIN else 1.0)
            if c in BIN:   # chance of 1+: 40% L5 / 60% season rate, shrunk toward the position average (4 games), capped
                base = (n * (0.4 * r["_r5"] + 0.6 * r["_rs"]) + 4 * prior) / (n + 4)
                pr = 1 - (1 - min(base, 0.9)) ** f; pr *= (0.35 + 0.65 * r["st_l5"] / 100)   # bench risk
                r["chance"] = round(100 * min(pr, 0.85)); r["proj"] = None; score = pr
            else:
                base = (n * (0.4 * r["_m5"] + 0.6 * r["_ms"]) + 4 * prior) / (n + 4)
                proj = base * f * (0.35 + 0.65 * r["st_l5"] / 100); r["proj"] = round(proj, 1); r["chance"] = None
                sd = max(st.pstdev([*r["l5"]]) if len(r["l5"]) > 1 else 1, 0.7); score = (proj - r["line"]) / sd
            r["mf"] = round(f, 2); r["_sc"] = score
            r["mins"] = "~80+ min (regular starter)" if r["st_l5"] >= 80 else "~60-80 min (usual starter)" if r["st_l5"] >= 60 else "~30-60 min (rotation)" if r["st_l5"] >= 20 else "bench minutes"
        rows.sort(key=lambda r: -r["_sc"]); n = len(rows)
        def pct(key):
            v = sorted(key(r) for r in rows); m = len(v) - 1 or 1
            return lambda r: round(10 * sum(x < key(r) for x in v) / m, 1)
        comp = [("Opponent matchup", pct(lambda r: r["mf"])), ("Last 5 form", pct(lambda r: (r["_r5"], r["_m5"]))), ("Season hit rate", pct(lambda r: r["_rs"])), ("Projection vs line", pct(lambda r: r["_sc"]))]
        for r in rows: r["parts"] = [[k, fn(r)] for k, fn in comp]
        for i, r in enumerate(rows):
            r["grade"] = GR[min(11, int(i / n * 12))]; r["g10"] = round(10 * (n - 1 - i) / max(1, n - 1), 1)
            for k in ("_r5", "_rs", "_m5", "_ms", "_sc"): r.pop(k)
        out[lg]["cats"][c] = dict(best=rows, n=n)
    out[lg]["games"] = [dict(time=a, id=b, away=c2, home=d2) for a, b, c2, d2 in out[lg]["games"]]
today = now.astimezone(dt.timezone(dt.timedelta(hours=-5))).date().isoformat()
PRI = ["uefa.champions", "uefa.europa", "uefa.europa.conf", "eng.1", "esp.1", "ita.1", "ger.1", "fra.1", "usa.1"]
order = sorted(out, key=lambda lg: (PRI.index(lg) if lg in PRI else 99, lg))
default = "uefa.champions" if "uefa.champions" in out else (order[0] if order else None)
json.dump(dict(updated=now.strftime("%Y-%m-%dT%H:%MZ"), default=default, order=order, nclubs=NCL, comps=out), open(D + "/matchups.json", "w"), separators=(",", ":"))
for lg in order: print(lg, {c: v["n"] for c, v in out[lg]["cats"].items()}, len(out[lg]["games"]), "games")
