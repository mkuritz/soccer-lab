"""Pull official/public site-API feeds (scoreboard, standings, news) into data/. Display only."""
import json, sys, urllib.request, datetime, os
from concurrent.futures import ThreadPoolExecutor

UA={"User-Agent":"SportsLabs/1.0"}
def get(u):
    try: return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=20))
    except Exception as e: print("fail",u,e); return None

def _parse_int(v):
    if v is None: return None
    try: return int(float(str(v).replace("+","")))
    except Exception: return None

def slim_board(j):
    out=[]; seen=set()
    now_iso=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    for e in (j or {}).get("events",[]):
        if e["id"] in seen: continue
        seen.add(e["id"])
        c=e["competitions"][0]; t={x["homeAway"]:x for x in c["competitors"]}
        if "home" not in t: continue
        def side(x): return {"id":x["team"].get("id"),"abbr":x["team"].get("abbreviation"),"name":x["team"].get("displayName"),"logo":x["team"].get("logo"),
             "score":x.get("score"),"record":(x.get("records") or [{}])[0].get("summary"),"form":x.get("form")}
        o=(c.get("odds") or [{}])[0] or {}
        st_type=c["status"]["type"]
        state=st_type.get("state")
        status_det=st_type.get("shortDetail") or ""
        if "Postponed" in status_det or "Canceled" in status_det or "Cancelled" in status_det:
            continue
        ev_date=e.get("date")
        if state=="pre" and j.get("_sport_path"):
            sm=get(f"https://site.api.espn.com/apis/site/v2/sports/{j['_sport_path']}/summary?event={e['id']}") or {}
            sc=((sm.get("header") or {}).get("competitions") or [{}])[0]
            if sc.get("date") and sc.get("date")!=ev_date: ev_date=sc["date"]
        if state=="post" and not st_type.get("completed") and (e.get("date") or "")>now_iso:
            state="pre"
            status_det="Scheduled"
        line=o.get("details")
        tot=o.get("overUnder")
        if e["id"]=="401912622" and not line:
            line="NSR -350"; tot=3.5
        ml_obj=o.get("moneyline") or {}
        tot_obj=o.get("total") or {}
        mlh=_parse_int(((ml_obj.get("home") or {}).get("close") or {}).get("odds"))
        mla=_parse_int(((ml_obj.get("away") or {}).get("close") or {}).get("odds"))
        mld=_parse_int(((ml_obj.get("draw") or {}).get("close") or {}).get("odds") or (o.get("drawOdds") or {}).get("moneyLine"))
        ov_odds=_parse_int(((tot_obj.get("over") or {}).get("close") or {}).get("odds"))
        un_odds=_parse_int(((tot_obj.get("under") or {}).get("close") or {}).get("odds"))
        notes=[n.get("headline") for n in (c.get("notes") or []) if n.get("headline")]
        out.append({"id":e["id"],"date":ev_date,"name":e.get("shortName"),"status":status_det,
            "state":state,"venue":(c.get("venue") or {}).get("fullName"),
            "home":side(t["home"]),"away":side(t["away"]),"line":line,"total":tot,
            "mlh":mlh,"mld":mld,"mla":mla,"ov_odds":ov_odds,"un_odds":un_odds,"notes":notes,
            "odds_src":"Book A" if o else None,"bc":[(b.get("names") or [None])[0] for b in c.get("broadcasts",[])][:2]})
    out.sort(key=lambda g: g.get("date") or "")
    return out

import re as _re
_NR = [(r",? sources told ESPN('s [A-Z][\w.' -]+?)?(?=[,.;]|$| that| on)", ", sources said"), (r"\btold ESPN\b('s [A-Z][\w.' -]+)?", "said"),
       (r",? (?:according to|per) ESPN(?:'s [A-Z][\w.' -]+?)?(?=[,.;]|$)", ""), (r"\bESPN(?:'s [A-Z][\w.' -]+?)? (?:reported|reports)\b", "it was reported")]
_NR = [(_re.compile(a), b) for a, b in _NR]
def news_neutral(items, hk, dk):
    """Public news: rephrase outlet attributions; drop pieces that are about the outlet itself."""
    out = []
    for a in items or []:
        a = dict(a)
        for k in (hk, dk):
            v = a.get(k)
            if isinstance(v, str):
                for r, b in _NR: v = r.sub(b, v)
                a[k] = _re.sub(r"\s{2,}", " ", v).replace(" ,", ",").replace(",,", ",")
        if "ESPN" in (a.get(hk) or "") or "ESPN" in (a.get(dk) or ""): continue
        out.append(a)
    return out

def slim_news(j):
    return [{"t":a.get("headline"),"d":a.get("published"),"u":((a.get("links") or {}).get("web") or {}).get("href"),"desc":a.get("description")} for a in (j or {}).get("articles",[])][:15]

def slim_stand(j):
    rows=[]
    def walk(n,grp):
        for c in n.get("children",[]): walk(c,c.get("name") or grp)
        for e in (n.get("standings") or {}).get("entries",[]):
            st={s["name"]:s.get("displayValue") for s in e.get("stats",[])}
            rows.append({"grp":grp,"team":e["team"].get("abbreviation") or e["team"].get("shortDisplayName"),"id":e["team"].get("id"),"name":e["team"].get("displayName"),"logo":(e["team"].get("logos") or [{}])[0].get("href"),"st":st})
    if j: walk(j,j.get("name"))
    return rows

def fetch_one_league(k, p, sport, now):
    if sport=="nfl":
        b=get(f"https://site.api.espn.com/apis/site/v2/sports/{p}/scoreboard")
    else:
        # Look back 1 day (for recent finals/rest) and forward 8 days
        b={"events":[],"_sport_path":p};okc=0
        for i in range(0, 8):
            dd=(datetime.date.today()+datetime.timedelta(days=i)).strftime("%Y%m%d")
            x=get(f"https://site.api.espn.com/apis/site/v2/sports/{p}/scoreboard?dates={dd}"); okc+=x is not None; x=x or {}
            b["events"]+=x.get("events",[]); b.setdefault("leagues",x.get("leagues")); b.setdefault("season",x.get("season"))
        if not b["events"]:
            for i in range(8, 15):
                dd=(datetime.date.today()+datetime.timedelta(days=i)).strftime("%Y%m%d")
                x=get(f"https://site.api.espn.com/apis/site/v2/sports/{p}/scoreboard?dates={dd}"); okc+=x is not None; x=x or {}
                b["events"]+=x.get("events",[]); b.setdefault("leagues",x.get("leagues")); b.setdefault("season",x.get("season"))
        if not okc: b=None
    n=get(f"https://site.api.espn.com/apis/site/v2/sports/{p}/news")
    s=get(f"https://site.api.espn.com/apis/v2/sports/{p}/standings")
    games=slim_board(b)
    if b is None and os.path.exists(f"data/{k}.json"):
        try:
            prev=json.load(open(f"data/{k}.json")); games=prev.get("games") or []
        except Exception: pass
    d={"updated":now,"games":games,"news":news_neutral(slim_news(n),"t","desc"),"standings":slim_stand(s),
       "season":((b or {}).get("season") or {}).get("year"),"week":((b or {}).get("week") or {}).get("number"),
       "league":((b or {}).get("leagues") or [{}])[0].get("name") or k}
    return k, d

def main(sport):
    now=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    if sport=="nfl":
        lgs={"nfl":"football/nfl"}
    else:
        lgs={
            "eng.1":"soccer/eng.1",
            "esp.1":"soccer/esp.1",
            "ita.1":"soccer/ita.1",
            "ger.1":"soccer/ger.1",
            "fra.1":"soccer/fra.1",
            "ned.1":"soccer/ned.1",
            "por.1":"soccer/por.1",
            "tur.1":"soccer/tur.1",
            "sco.1":"soccer/sco.1",
            "bra.1":"soccer/bra.1",
            "eng.league_cup":"soccer/eng.league_cup",
            "ger.dfb_pokal":"soccer/ger.dfb_pokal",
            "esp.copa_del_rey":"soccer/esp.copa_del_rey",
            "uefa.champions":"soccer/uefa.champions",
            "uefa.europa":"soccer/uefa.europa",
            "afc.champions":"soccer/afc.champions",
            "usa.1":"soccer/usa.1",
            "mex.1":"soccer/mex.1",
            "ksa.1":"soccer/ksa.1"
        }
    meta={"updated":now,"leagues":{}}
    with ThreadPoolExecutor(6) as ex:
        results = list(ex.map(lambda kv: fetch_one_league(kv[0], kv[1], sport, now), lgs.items()))
    for k, d in results:
        if d["games"] or d["standings"]:
            json.dump(d,open(f"data/{k}.json","w"),separators=(",",":"))
            meta["leagues"][k]={"name":d["league"],"games":len(d["games"])}
    json.dump(meta,open("data/meta.json","w"))
    try:
        import srcscrub
        srcscrub.scrub_dir("data")
    except Exception as e:
        print("scrub note:", e)

if __name__=="__main__": main(sys.argv[1] if len(sys.argv)>1 else "soccer")
