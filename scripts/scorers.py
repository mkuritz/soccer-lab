#!/usr/bin/env python3
"""Soccer Hub 'Likely Scorers' (Highlighted). Reuses the Bet Lab anytime-goal model:
ours = last-10 scoring rate blended with the market no-vig % (30-game weight, likely.py), then the
#soccer-chat context nudge (form, start %, team goal projection with 3.5 per-team cap, opponent defense, home).
Adds: opponent goals conceded/game from the league table, season + h2h rates for display, ESPN Out/Suspended filter.
Writes data/scorers.json. Real data only: players without >=5 recent matches are skipped."""
import json,math,urllib.request,datetime as dt,sys,os
from concurrent.futures import ThreadPoolExecutor
PROPS='https://betlab.sportslabshq.com/data/props_soccer.json'
ESPN='https://site.api.espn.com/apis/site/v2/sports/soccer/{lg}/{p}'
LGS=["eng.1","esp.1","ita.1","ger.1","fra.1","usa.1","uefa.champions","ksa.1"]
PER_MATCH=3; MIN_SCORE=0.20
CAL=0.76   # display calibration from scorers_backtest.py (Oct 2026: 299 listed players scored 28.1% vs 36.9% raw model); ranking unchanged
def get(u):
  try: return json.loads(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read())
  except Exception: return None
def ts(s): return dt.datetime.fromisoformat(s.replace('Z','+00:00'))
def imp(o): return 100/(o+100) if o>0 else -o/(-o+100)
def base(r):
  w=(r.get('x') or {}).get('l10')
  if not w or w[1]<5: return None
  bk=round(imp(r['ov'])/1.07,3) if r.get('ov') else None
  return min((w[0]+30*bk)/(w[1]+30) if bk is not None else w[0]/w[1],.97)
def implied_goals(p):
  gs=p.get('gs') or {}; tot=gs.get('tot') or 2.6; ml=gs.get('ml')
  if ml is None: return min(3.5,tot/2)
  pr=imp(ml); share=min(.8,max(.2,.5+(pr-.4)*.9)); return min(3.5,tot*share)
def score(q,p):
  x=p.get('x') or {}; st=((p.get('u') or {}).get('st') or {}); dv=p.get('dvp') or {}
  l10=x.get('l10') or [0,0,0]
  form=(l10[0]+1)/(l10[1]+2) if l10[1] else q
  start=(st.get('l5') if st.get('l5') is not None else 80)/100
  q=min(max(q,.01),.97)
  z=math.log(q/(1-q))+0.6*(form-q)+0.8*(min(start,1)-0.85)+0.25*(implied_goals(p)-1.4)+0.4*(dv.get('v',.5)-0.5)+(0.05 if p.get('home') else 0)
  return 1/(1+math.exp(-z))
def status(lg,gid):
  d=get(ESPN.format(lg=lg,p=f'summary?event={gid}'))
  if not d: return None
  c=d['header']['competitions'][0]; out={'state':c['status']['type']['state'],'xi':{},'out':set(),'on':{}}
  for t in d.get('rosters',[]) or []:
    for a in t.get('roster',[]) or []: out['xi'][a['athlete']['id']]=bool(a.get('starter'))
  for cp in c['competitors']:
    r=get(ESPN.format(lg=lg,p=f"teams/{cp['team']['id']}/roster")) or {}
    for a in r.get('athletes',[]):
      out['on'][str(a.get('id'))]=cp['team'].get('abbreviation')
      inj=' '.join((i.get('status') or '') for i in a.get('injuries',[]) or [])
      if 'Out' in inj or 'Suspend' in inj: out['out'].add(str(a.get('id')))
  return out
def why(p,ga):
  x=p.get('x') or {}; b=[]; l5=x.get('l5'); l10=x.get('l10'); sz=x.get('szn'); h=x.get('h2h')
  if l5 and l5[1]: b.append(f'scored in {l5[0]} of last {l5[1]}')
  if sz and sz[1]: b.append(f'{sz[0]} goals in {sz[1]} matches this season')
  sp=((p.get('sp') or {}).get('League') or {})
  if sp.get('sotpg'): b.append(f"{sp['sotpg']:.1f} shots on target/game")
  st=((p.get('u') or {}).get('st') or {})
  if st.get('l5') is not None: b.append(f"started {st['l5']}% of last 5")
  if h and h[1]: b.append(f'{h[0]} goals in {h[1]} vs this opponent')
  if ga is not None: b.append(f'opponent concedes {ga:.1f}/game')
  return b
def main():
  now=dt.datetime.now(dt.timezone.utc); P=get(PROPS) or []
  rows=[r for r in P if r.get('market')=='Anytime Goal' and r.get('time') and now<ts(r['time'])<now+dt.timedelta(days=7)]
  GA={}
  for lg in LGS:
    try:
      for s in json.load(open(f'data/{lg}.json')).get('standings',[]):
        gp=float(s['st'].get('gamesPlayed') or 0); pa=float(s['st'].get('pointsAgainst') or 0)
        if gp: GA[(lg,s['team'])]=pa/gp
    except Exception: pass
  games={(r['lg'],str(r['game'])) for r in rows if r['lg'] in LGS}
  with ThreadPoolExecutor(8) as ex: ST=dict(zip(games,ex.map(lambda k:status(*k),games)))
  out={'updated':now.strftime('%Y-%m-%dT%H:%MZ'),'leagues':{},'bt':{'n':299,'hit':0.281}}
  for lg in LGS:
    M={}
    for r in rows:
      if r['lg']!=lg: continue
      q=base(r); s=ST.get((lg,str(r['game'])))
      if q is None or not s or s['state']!='pre': continue
      aid=str(r['aid'])
      if aid in s['out'] or aid not in s['on']: continue   # must be on a current roster of one of the two clubs
      if s['xi'] and not s['xi'].get(aid): continue   # official XI out: starters only
      st=((r.get('u') or {}).get('st') or {}).get('l5')
      if not s['xi'] and st is not None and st<60: continue   # probable starter
      sc=score(q,r)
      if sc<MIN_SCORE: continue
      ga=GA.get((lg,r.get('oa')))
      g=M.setdefault(str(r['game']),{'game':str(r['game']),'start':r['time'],'matchup':f"{r.get('oa')} @ {r['team']}" if r.get('home') else f"{r['team']} @ {r.get('oa')}",'players':{}})
      if aid not in g['players'] or g['players'][aid]['raw']<sc:
        g['players'][aid]={'player':r['player'],'aid':aid,'team':r['team'],'pos':r.get('pos'),'p':round(sc*CAL,3),'raw':round(sc,3),'xi':'confirmed starter' if s['xi'] else 'probable starter','why':why(r,ga)}
    L=[]
    for g in M.values():
      g['players']=sorted(g['players'].values(),key=lambda x:-x['raw'])[:PER_MATCH]; L.append(g)
    L.sort(key=lambda g:g['start'])
    out['leagues'][lg]={'matches':L,'n_matches':len(L),'n_players':sum(len(g['players']) for g in L)}
  json.dump(out,open('data/scorers.json','w'),separators=(',',':'))
  for lg,v in out['leagues'].items(): print(lg,v['n_matches'],'matches',v['n_players'],'players')
if __name__=='__main__': main()
