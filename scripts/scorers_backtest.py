#!/usr/bin/env python3
"""Backtest Likely Scorers on archived Bet Lab props snapshots (first pre-kickoff snapshot per player-match)."""
import json,subprocess,sys,collections as C
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0,'scripts'); import scorers as S
REPO=sys.argv[1] if len(sys.argv)>1 else '/workspace/wt/bl-site'
H=[l.split() for l in subprocess.run(['git','-C',REPO,'log','--reverse','--format=%H %cI','--','data/props_soccer.json'],capture_output=True,text=True).stdout.split('\n') if l]
first={}
for c,t in H:
  T=S.ts(t)
  try: d=json.loads(subprocess.run(['git','-C',REPO,'show',f'{c}:data/props_soccer.json'],capture_output=True,text=True).stdout)
  except Exception: continue
  for r in d:
    if r.get('market')!='Anytime Goal' or r.get('lg') not in S.LGS or not r.get('time') or S.ts(r['time'])<=T: continue
    k=(str(r['aid']),str(r['game'])); first.setdefault(k,r)
M=C.defaultdict(list)
for (aid,g),r in first.items():
  q=S.base(r); st=((r.get('u') or {}).get('st') or {}).get('l5')
  if q is None or (st is not None and st<60): continue
  sc=S.score(q,r)
  if sc>=S.MIN_SCORE: M[(r['lg'],g)].append((sc,aid))
games=list(M)
def box(k):
  d=S.get(S.ESPN.format(lg=k[0],p=f'summary?event={k[1]}'))
  if not d or not d['header']['competitions'][0]['status']['type'].get('completed'): return None
  o={}
  for t in d.get('rosters',[]) or []:
    for a in t.get('roster',[]) or []:
      if a.get('starter') or a.get('subbedIn'):
        s={x['name']:x.get('value',0) for x in a.get('stats',[])}; o[a['athlete']['id']]=(s.get('totalGoals') or 0)>0
  return o
with ThreadPoolExecutor(8) as ex: B=dict(zip(games,ex.map(box,games)))
R=C.defaultdict(lambda:[0,0,0.0,0]); BINS=C.defaultdict(lambda:[0,0,0.0])
for k,L in M.items():
  b=B.get(k)
  if not b: continue
  R[k[0]][3]+=1
  for sc,aid in sorted(L,reverse=True)[:S.PER_MATCH]:
    if aid not in b: continue   # did not play: void
    R[k[0]][0]+=b[aid]; R[k[0]][1]+=1; R[k[0]][2]+=sc
    bn=min(int(sc*10),6); BINS[bn][0]+=b[aid]; BINS[bn][1]+=1; BINS[bn][2]+=sc
print('league matches players hit% predicted%')
for lg in S.LGS:
  h,n,p,m=R[lg]; print(lg,m,n,f'{h/n:.1%}' if n else '-',f'{p/n:.1%}' if n else '-')
h=sum(v[0] for v in R.values()); n=sum(v[1] for v in R.values()); p=sum(v[2] for v in R.values()); print('ALL',n,f'{h/n:.1%}',f'{p/n:.1%}')
for bn in sorted(BINS): h,n,p=BINS[bn]; print(f'bin {bn*10}%+',n,f'{h/n:.1%}',f'pred {p/n:.1%}')
