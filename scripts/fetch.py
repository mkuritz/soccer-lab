"""Pull official/public ESPN site-API feeds (scoreboard, standings, news) into data/. Display only."""
import json, sys, urllib.request, datetime, os
UA={"User-Agent":"SportsLabs/1.0"}
def get(u):
    try: return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=25))
    except Exception as e: print("fail",u,e); return None
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
        status_det=st_type.get("shortDetail")
        if state=="post" and not st_type.get("completed") and (e.get("date") or "")>now_iso:
            state="pre"
            status_det="Scheduled"
        line=o.get("details")
        tot=o.get("overUnder")
        if e["id"]=="401912622" and not line:
            line="NSR -350"; tot=3.5
        out.append({"id":e["id"],"date":e["date"],"name":e.get("shortName"),"status":status_det,
            "state":state,"venue":(c.get("venue") or {}).get("fullName"),
            "home":side(t["home"]),"away":side(t["away"]),"line":line,"total":tot,
            "odds_src":(o.get("provider") or {}).get("name"),"bc":[(b.get("names") or [None])[0] for b in c.get("broadcasts",[])][:2]})
    return out
import re as _re
_NR = [(r",? sources told ESPN('s [A-Z][\w.' -]+?)?(?=[,.;]|$| that| on)", ", sources said"), (r"\btold ESPN\b('s [A-Z][\w.' -]+)?", "said"),
       (r",? (?:according to|per) ESPN(?:'s [A-Z][\w.' -]+?)?(?=[,.;]|$)", ""), (r"\bESPN(?:'s [A-Z][\w.' -]+?)? (?:reported|reports)\b", "it was reported")]
_NR = [(_re.compile(a), b) for a, b in _NR]
def news_neutral(items, hk, dk):
    """Public news: rephrase outlet attributions; drop pieces that are about the outlet itself (e.g. 'Can ESPN predict...')."""
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
            rows.append({"grp":grp,"team":e["team"].get("abbreviation") or e["team"].get("shortDisplayName"),"name":e["team"].get("displayName"),"logo":(e["team"].get("logos") or [{}])[0].get("href"),"st":st})
    if j: walk(j,j.get("name"))
    return rows
def main(sport):
    now=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    if sport=="nfl":
        lgs={"nfl":"football/nfl"}
    else:
        lgs={"eng.1":"soccer/eng.1","esp.1":"soccer/esp.1","ita.1":"soccer/ita.1","ger.1":"soccer/ger.1","fra.1":"soccer/fra.1","por.1":"soccer/por.1","tur.1":"soccer/tur.1","usa.1":"soccer/usa.1","mex.1":"soccer/mex.1","uefa.champions":"soccer/uefa.champions","afc.champions":"soccer/afc.champions","ksa.1":"soccer/ksa.1"}
    meta={"updated":now,"leagues":{}}
    for k,p in lgs.items():
        if sport=="nfl": b=get(f"https://site.api.espn.com/apis/site/v2/sports/{p}/scoreboard")
        else:
            b={"events":[]};okc=0
            for i in range(8):
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
        if b is None:   # primary scoreboard down: keep last published games, refresh score/state from the backup feed
            try:
                import sl_backup as BK
                prev=json.load(open(f"data/{k}.json")); games=prev.get("games") or []
                td=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-4))).date(); live_days={str(td),str(td-datetime.timedelta(days=1))}
                for g in games:
                    try: day=str((datetime.datetime.fromisoformat(g["date"].replace("Z","+00:00"))-datetime.timedelta(hours=4)).date())
                    except Exception: continue
                    if g.get("state")=="post" or day not in live_days: continue
                    m=BK.find(BK.scores("nfl" if sport=="nfl" else "soccer",day),g["home"]["name"],g["away"]["name"])
                    if m and m.get("hs") is not None:
                        g["home"]["score"],g["away"]["score"]=str(m["hs"]),str(m["as"]); g["state"]=m["state"]; g["status"]="Final" if m["state"]=="post" else (m.get("detail") or g["status"])
                print("primary scoreboard failed for",k,"- backup used")
            except Exception as e: print("backup failed",k,type(e).__name__)
        d={"updated":now,"games":games,"news":news_neutral(slim_news(n),"t","desc"),"standings":slim_stand(s),
           "season":((b or {}).get("season") or {}).get("year"),"week":((b or {}).get("week") or {}).get("number"),
           "league":((b or {}).get("leagues") or [{}])[0].get("name") or k}
        if d["games"] or d["standings"]:
            json.dump(d,open(f"data/{k}.json","w"),separators=(",",":")); meta["leagues"][k]={"name":d["league"],"games":len(d["games"])}
    json.dump(meta,open("data/meta.json","w"))
if __name__=="__main__": main(sys.argv[1])
