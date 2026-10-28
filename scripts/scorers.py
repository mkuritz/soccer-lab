#!/usr/bin/env python3
"""Soccer Hub 'Likely Scorers' (Highlighted). Reuses the Bet Lab anytime-goal model:
ours = last-10 scoring rate blended with the market no-vig % (30-game weight, likely.py), then the
#soccer-chat context nudge (form, start %, team goal projection with 3.5 per-team cap, opponent defense, home).
When player prop lines are not posted yet for an upcoming fixture, uses real match-log priors (player_priors.json)
with strict first-team club roster verification, showing fewer high-confidence players where data is thin rather than guessing.
Adds: opponent goals conceded/90 & league defense rank, penalty-taker & set-piece/aerial threat tags, high-total match tags,
season + h2h rates for display, Out/Suspended filter.
Writes data/scorers.json. Real data only: players without >=5 recent matches are skipped."""
import json, math, urllib.request, datetime as dt, sys, os, re
from concurrent.futures import ThreadPoolExecutor

PROPS = 'https://betlab.sportslabshq.com/data/props_soccer.json'
ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/{lg}/{p}'
LGS = [
    "eng.1", "esp.1", "ita.1", "ger.1", "fra.1", "ned.1", "por.1", "tur.1",
    "sco.1", "bra.1", "eng.league_cup", "ger.dfb_pokal", "esp.copa_del_rey",
    "uefa.champions", "uefa.europa", "afc.champions", "usa.1", "mex.1", "ksa.1"
]
CUP_DOM_MAP = {
    "eng.league_cup": "eng.1",
    "ger.dfb_pokal": "ger.1",
    "esp.copa_del_rey": "esp.1",
}
PER_MATCH = 3
PER_MATCH_TODAY = 6
MIN_SCORE = 0.20
CAL = 0.76   # display calibration from scorers_backtest.py (Oct 2026: 299 listed players scored 28.1% vs 36.9% raw model); ranking unchanged

_ROSTER_CACHE = {}

def get(u):
    try:
        return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=25).read())
    except Exception:
        return None

def ts(s):
    return dt.datetime.fromisoformat(s.replace('Z', '+00:00'))

def imp(o):
    return 100 / (o + 100) if o > 0 else -o / (-o + 100)

def base(r):
    w = (r.get('x') or {}).get('l10')
    if not w or w[1] < 5:
        return None
    bk = round(imp(r['ov']) / 1.07, 3) if r.get('ov') else None
    return min((w[0] + 30 * bk) / (w[1] + 30) if bk is not None else w[0] / w[1], 0.97)

def implied_goals(p):
    gs = p.get('gs') or {}
    tot = gs.get('tot') or 2.6
    ml = gs.get('ml')
    if ml is None:
        return min(3.5, tot / 2)
    pr = imp(ml)
    share = min(0.8, max(0.2, 0.5 + (pr - 0.4) * 0.9))
    return min(3.5, tot * share)

def score(q, p, ga=None):
    x = p.get('x') or {}
    st = ((p.get('u') or {}).get('st') or {})
    dv = p.get('dvp') or {}
    l10 = x.get('l10') or [0, 0, 0]
    form = (l10[0] + 1) / (l10[1] + 2) if l10[1] else q
    start = (st.get('l5') if st.get('l5') is not None else 80) / 100
    q = min(max(q, 0.01), 0.97)
    opp_weak = dv.get('v')
    if opp_weak is None and ga is not None:
        opp_weak = min(0.95, max(0.15, (ga - 0.8) / 1.6))
    elif opp_weak is None:
        opp_weak = 0.5
    h2h = x.get('h2h') or [0, 0]
    h2h_nudge = 0.12 if (h2h and len(h2h) >= 2 and h2h[1] >= 1 and h2h[0] >= 1 and (h2h[0] / h2h[1]) >= 0.5) else (0.06 if (h2h and len(h2h) >= 2 and h2h[1] >= 1 and h2h[0] >= 1) else 0.0)
    z = (math.log(q / (1 - q))
         + 0.6 * (form - q)
         + 0.8 * (min(start, 1) - 0.85)
         + 0.25 * (implied_goals(p) - 1.4)
         + 0.4 * (opp_weak - 0.5)
         + h2h_nudge
         + (0.05 if p.get('home') else 0))
    return 1 / (1 + math.exp(-z))

def fetch_roster(lg, tid, ab):
    key = (lg, str(tid))
    if key in _ROSTER_CACHE:
        return _ROSTER_CACHE[key]
    r = get(ESPN.format(lg=lg, p=f"teams/{tid}/roster")) or {}
    if not r.get('athletes') and lg in CUP_DOM_MAP:
        r = get(ESPN.format(lg=CUP_DOM_MAP[lg], p=f"teams/{tid}/roster")) or {}
    on, out = {}, set()
    for a in r.get('athletes', []) or []:
        aid = str(a.get('id'))
        on[aid] = ab
        inj = ' '.join((i.get('status') or '') for i in a.get('injuries', []) or [])
        if 'Out' in inj or 'Suspend' in inj:
            out.add(aid)
    _ROSTER_CACHE[key] = (on, out)
    return on, out

def status(lg, gid, h_id=None, h_ab=None, a_id=None, a_ab=None):
    d = get(ESPN.format(lg=lg, p=f'summary?event={gid}'))
    out = {'state': 'pre', 'xi': {}, 'out': set(), 'on': {}, 'roster_ids': {}}
    comps = []
    if d and (d.get('header') or {}).get('competitions'):
        c = d['header']['competitions'][0]
        st_type = c['status']['type']
        st_val = st_type['state']
        if st_val == 'post' and not st_type.get('completed'):
            st_val = 'pre'
        out['state'] = st_val
        for t in d.get('rosters', []) or []:
            for a in t.get('roster', []) or []:
                out['xi'][str(a['athlete']['id'])] = bool(a.get('starter'))
        for cp in c.get('competitors', []) or []:
            comps.append((cp['team']['id'], cp['team'].get('abbreviation')))
    if not comps and h_id and a_id:
        comps = [(h_id, h_ab), (a_id, a_ab)]
    for tid, ab in comps:
        on_map, out_set = fetch_roster(lg, tid, ab)
        out['on'].update(on_map)
        out['out'].update(out_set)
        out['roster_ids'][ab] = set(on_map.keys())
    return out

def why(p, ga, def_rk=None, pr=None):
    x = p.get('x') or {}
    b = []
    if pr and pr.get('h2h_note'):
        b.append(pr['h2h_note'])
    l5 = (pr or {}).get('l5') or x.get('l5')
    l10 = (pr or {}).get('l10') or x.get('l10')
    sz = (pr or {}).get('szn') or x.get('szn')
    h = x.get('h2h')
    if l5 and l5[1]:
        b.append(f'scored in {l5[0]} of last {l5[1]}')
    if l10 and l10[1] and (not l5 or l10[0] >= 3):
        b.append(f'{l10[0]} of last {l10[1]} (L10)')
    if sz and sz[1]:
        b.append(f'{sz[0]} goals in {sz[1]} matches this season')
    sp = ((p.get('sp') or {}).get('League') or {})
    sotpg = (pr or {}).get('sotpg') or sp.get('sotpg')
    shpg = (pr or {}).get('shpg')
    if sotpg and shpg:
        b.append(f"{sotpg:.2f} SOT/g ({shpg:.2f} shots/g)")
    elif sotpg:
        b.append(f"{sotpg:.1f} shots on target/game")
    st_val = (pr or {}).get('st_l5') if (pr and pr.get('st_l5') is not None) else ((p.get('u') or {}).get('st') or {}).get('l5')
    if st_val is not None:
        b.append(f"started {st_val}% of last 5")
    if h and h[1] and h[0] and not (pr and pr.get('h2h_note')):
        b.append(f'{h[0]} goals in {h[1]} vs this opponent')
    if ga is not None:
        rk_str = f" (#{def_rk[0]}/{def_rk[1]} D)" if def_rk else ""
        b.append(f'opponent concedes {ga:.1f} GA/90{rk_str}')
    return b

def build_tags(p, pr, ga, def_rk, tot):
    tags = []
    x = p.get('x') or {}
    h = x.get('h2h')
    if h and len(h) >= 2 and h[1] >= 1 and h[0] >= 1 and (h[0] / h[1]) >= 0.5:
        tags.append(f"🏆 {h[0]}/{h[1]} ({int(round(h[0]/h[1]*100))}%) H2H")
    if pr and pr.get('pk'):
        tags.append("🎯 Penalty Taker")
    sp_l = ((p.get('sp') or {}).get('League') or {})
    sotpg = (pr or {}).get('sotpg') or sp_l.get('sotpg') or 0
    shpg = (pr or {}).get('shpg') or 0
    if (pr and pr.get('sp_threat')) or sotpg >= 1.1 or shpg >= 2.4:
        tags.append("🔥 Set-Piece / Volume Threat")
    if def_rk and (def_rk[0] > def_rk[1] - 5 or (ga is not None and ga >= 1.65)):
        tags.append(f"🚨 vs Bottom-5 Defense ({ga:.1f} GA/90)")
    elif ga is not None and ga >= 1.65:
        tags.append(f"🚨 vs Sieve Defense ({ga:.1f} GA/90)")
    if tot is not None and tot >= 3.0:
        tags.append(f"⚡ High-Total Match ({tot:g})")
    return tags

def parse_line_ml(line_str, team_ab):
    if not line_str or line_str == "EVEN":
        return None
    parts = str(line_str).split()
    if len(parts) == 2:
        try:
            v = int(float(parts[1]))
            return v if parts[0] == team_ab else (-v if v > 0 else int(10000 / -v))
        except Exception:
            return None
    return None

def main():
    now = dt.datetime.now(dt.timezone.utc)
    today_et = (now - dt.timedelta(hours=4)).strftime('%Y-%m-%d')
    P = []
    if os.path.exists('/workspace/bet-lab/data/props_soccer.json'):
        try:
            P = json.load(open('/workspace/bet-lab/data/props_soccer.json'))
        except Exception:
            P = []
    if not P:
        P = get(PROPS) or []
    try:
        PRIORS = json.load(open('data/player_priors.json'))
    except Exception:
        PRIORS = {}
    rows = [r for r in P if r.get('market') == 'Anytime Goal' and r.get('time') and now < ts(r['time']) < now + dt.timedelta(days=12)]
    GA = {}
    DEF_RK = {}
    TEAM_DOM_GA = {}
    TEAM_DOM_RK = {}
    LG_GAMES = {}
    for lg in LGS:
        try:
            d = json.load(open(f'data/{lg}.json'))
            LG_GAMES[lg] = [g for g in d.get('games', []) if g.get('state') == 'pre' and g.get('date') and now - dt.timedelta(hours=3) < ts(g['date']) < now + dt.timedelta(days=12)]
            stand_ga = []
            for s in d.get('standings', []):
                gp = float(s['st'].get('gamesPlayed') or 0)
                pa = float(s['st'].get('pointsAgainst') or 0)
                if gp > 0:
                    ga_val = pa / gp
                    GA[(lg, s['team'])] = ga_val
                    stand_ga.append((ga_val, s['team']))
                    if lg not in ('uefa.champions', 'uefa.europa', 'afc.champions'):
                        TEAM_DOM_GA[s['team']] = ga_val
            stand_ga.sort(key=lambda x: x[0])
            n_tm = len(stand_ga)
            for idx, (ga_val, tm) in enumerate(stand_ga):
                DEF_RK[(lg, tm)] = (idx + 1, n_tm)
                if lg not in ('uefa.champions', 'uefa.europa', 'afc.champions'):
                    TEAM_DOM_RK[tm] = (idx + 1, n_tm)
        except Exception:
            LG_GAMES[lg] = []

    def get_ga_rk(lg, tm):
        ga = GA.get((lg, tm))
        rk = DEF_RK.get((lg, tm))
        if ga is None and tm in TEAM_DOM_GA:
            ga = TEAM_DOM_GA[tm]
            rk = TEAM_DOM_RK.get(tm)
        return ga, rk

    game_meta = {}
    for lg in LGS:
        for g in LG_GAMES.get(lg, []):
            gid = str(g['id'])
            game_meta[(lg, gid)] = {
                'lg': lg, 'gid': gid, 'start': g['date'],
                'h_id': (g.get('home') or {}).get('id'), 'h_ab': (g.get('home') or {}).get('abbr'),
                'a_id': (g.get('away') or {}).get('id'), 'a_ab': (g.get('away') or {}).get('abbr'),
                'line': g.get('line'), 'total': g.get('total')
            }
    for r in rows:
        lg = r.get('lg')
        if lg in LGS:
            gid = str(r['game'])
            if (lg, gid) not in game_meta:
                h_ab = r['team'] if r.get('home') else r.get('oa')
                a_ab = r.get('oa') if r.get('home') else r['team']
                game_meta[(lg, gid)] = {
                    'lg': lg, 'gid': gid, 'start': r['time'],
                    'h_id': None, 'h_ab': h_ab, 'a_id': None, 'a_ab': a_ab,
                    'line': None, 'total': (r.get('gs') or {}).get('tot')
                }

    unique_teams = {(m['lg'], str(m['h_id']), m['h_ab']) for m in game_meta.values() if m.get('h_id')} | \
                   {(m['lg'], str(m['a_id']), m['a_ab']) for m in game_meta.values() if m.get('a_id')}
    with ThreadPoolExecutor(10) as ex:
        list(ex.map(lambda k: fetch_roster(*k), unique_teams))

    keys = list(game_meta.keys())
    with ThreadPoolExecutor(10) as ex:
        ST = dict(zip(keys, ex.map(lambda k: status(k[0], k[1], game_meta[k]['h_id'], game_meta[k]['h_ab'], game_meta[k]['a_id'], game_meta[k]['a_ab']), keys)))

    out = {'updated': now.strftime('%Y-%m-%dT%H:%MZ'), 'leagues': {}, 'bt': {'n': 299, 'hit': 0.281, 'raw': 0.369, 'cal': CAL}}
    for lg in LGS:
        M = {}
        # 1. Score rows from props_soccer.json (market + form)
        lg_rows = [r for r in rows if r.get('lg') == lg]
        for r in lg_rows:
            gid = str(r['game'])
            s = ST.get((lg, gid))
            if not s or s['state'] != 'pre':
                continue
            aid = str(r['aid'])
            pr = PRIORS.get(aid)
            if aid in s['out'] or s['on'].get(aid) != r.get('team'):
                continue
            if s['xi'] and not s['xi'].get(aid):
                continue
            st_l5 = (pr or {}).get('st_l5') if (pr and pr.get('st_l5') is not None) else ((r.get('u') or {}).get('st') or {}).get('l5')
            if not s['xi'] and st_l5 is not None and st_l5 < 60:
                continue
            r_eff = dict(r)
            if pr:
                x_eff = dict(r.get('x') or {})
                if pr.get('l5'): x_eff['l5'] = pr['l5']
                if pr.get('l10'): x_eff['l10'] = pr['l10']
                if pr.get('szn'): x_eff['szn'] = pr['szn']
                opp_ab = r.get('oa')
                if opp_ab and (pr.get('h2h') or {}).get(opp_ab):
                    x_eff['h2h'] = pr['h2h'][opp_ab]
                r_eff['x'] = x_eff
                if pr.get('ov') is not None:
                    r_eff['ov'] = pr['ov']
            q = base(r_eff)
            if q is None:
                continue
            ga, def_rk = get_ga_rk(lg, r.get('oa'))
            sc = score(q, r_eff, ga)
            if pr and pr.get('best_prop') and sc < MIN_SCORE:
                sc = max(sc, 0.28)
            if sc < MIN_SCORE:
                continue
            gm_info = game_meta.get((lg, gid), {})
            tot = (r.get('gs') or {}).get('tot') or gm_info.get('total')
            tags = build_tags(r_eff, pr, ga, def_rk, tot)
            matchup = f"{r.get('oa')} @ {r['team']}" if r.get('home') else f"{r['team']} @ {r.get('oa')}"
            m_tags = []
            if tot is not None and tot >= 3.0:
                m_tags.append(f"⚡ High-Total ({tot:g})")
            g = M.setdefault(gid, {
                'game': gid, 'start': r['time'], 'matchup': matchup,
                'total': tot, 'match_tags': m_tags, 'players': {}
            })
            if aid not in g['players'] or g['players'][aid]['raw'] < sc:
                g['players'][aid] = {
                    'player': (pr or {}).get('player') or r['player'], 'aid': aid, 'team': r['team'], 'opp': r.get('oa'),
                    'pos': r.get('pos') or (pr or {}).get('pos'),
                    'p': round(sc * CAL, 3), 'raw': round(sc + (0.04 if (pr and pr.get('best_prop')) else 0), 3),
                    'price': r_eff.get('ov'),
                    'xi': 'confirmed starter' if s['xi'] else 'probable starter',
                    'cal_tier': 'Market + Logs',
                    'best_prop': (pr or {}).get('best_prop'), 'rank_ord': (pr or {}).get('rank_ord', 99),
                    'tags': tags,
                    'why': why(r_eff, ga, def_rk, pr)
                }

        # 2. Score verified roster players from match-log priors (both for unpriced fixtures and cup/continental ties)
        for (lg_k, gid), gm in game_meta.items():
            if lg_k != lg:
                continue
            s = ST.get((lg, gid))
            if not s or s['state'] != 'pre' or not s['on']:
                continue
            h_ab, a_ab = gm['h_ab'], gm['a_ab']
            if not h_ab or not a_ab:
                continue
            tot = gm.get('total')
            for aid, club_ab in s['on'].items():
                if aid in s['out']:
                    continue
                if gid in M and aid in M[gid]['players']:
                    continue
                pr = PRIORS.get(aid)
                if not pr:
                    continue
                if pr['team'] != club_ab and lg not in ('uefa.champions', 'uefa.europa', 'afc.champions', 'eng.league_cup', 'ger.dfb_pokal', 'esp.copa_del_rey'):
                    continue
                if s['xi'] and not s['xi'].get(aid):
                    continue
                if not s['xi'] and pr.get('st_l5', 0) < 60:
                    continue
                is_home = (club_ab == h_ab)
                opp_ab = a_ab if is_home else h_ab
                h2h = (pr.get('h2h') or {}).get(opp_ab) or [0, 0]
                ml = parse_line_ml(gm.get('line'), club_ab)
                ov_val = pr.get('ov')
                synth = {
                    'aid': aid, 'player': pr['player'], 'team': club_ab, 'oa': opp_ab,
                    'pos': pr.get('pos'), 'home': is_home, 'ov': ov_val,
                    'gs': {'tot': tot or 2.6, 'ml': ml},
                    'x': {'l5': pr['l5'], 'l10': pr['l10'], 'szn': pr['szn'], 'h2h': h2h},
                    'sp': {'League': {'sotpg': pr.get('sotpg')}},
                    'u': {'st': {'l5': pr.get('st_l5')}}
                }
                q = base(synth)
                if q is None:
                    continue
                ga, def_rk = get_ga_rk(lg, opp_ab)
                sc = score(q, synth, ga)
                if pr.get('best_prop') and sc < MIN_SCORE:
                    sc = max(sc, 0.28)
                if sc < MIN_SCORE:
                    continue
                tags = build_tags(synth, pr, ga, def_rk, tot)
                m_tags = []
                if tot is not None and tot >= 3.0:
                    m_tags.append(f"⚡ High-Total ({tot:g})")
                g = M.setdefault(gid, {
                    'game': gid, 'start': gm['start'], 'matchup': f"{a_ab} @ {h_ab}",
                    'total': tot, 'match_tags': m_tags, 'players': {}
                })
                if aid not in g['players'] or g['players'][aid]['raw'] < sc:
                    g['players'][aid] = {
                        'player': pr['player'], 'aid': aid, 'team': club_ab, 'opp': opp_ab,
                        'pos': pr.get('pos'),
                        'p': round(sc * CAL, 3), 'raw': round(sc + (0.04 if pr.get('best_prop') else 0), 3),
                        'price': ov_val,
                        'xi': 'confirmed starter' if s['xi'] else 'probable starter',
                        'cal_tier': 'Market + Logs' if ov_val is not None else 'Form + Matchup',
                        'best_prop': pr.get('best_prop'), 'rank_ord': pr.get('rank_ord', 99),
                        'tags': tags,
                        'why': why(synth, ga, def_rk, pr)
                    }

        L = []
        for g in M.values():
            try:
                g_day = (ts(g['start']) - dt.timedelta(hours=4)).strftime('%Y-%m-%d')
            except Exception:
                g_day = ''
            all_p = sorted(g['players'].values(), key=lambda x: (-(1 if x.get('best_prop') else 0), x.get('rank_ord', 99), -x['raw']))
            curated = [x for x in all_p if x.get('best_prop')]
            if g_day == today_et and len(curated) >= 2:
                g['players'] = curated[:8]
            else:
                non_df = [x for x in all_p if x.get('pos') != 'DF' or x.get('raw', 0) >= 0.38]
                g['players'] = (non_df or all_p)[:PER_MATCH]
            if g['players']:
                L.append(g)
        L.sort(key=lambda g: g['start'])
        out['leagues'][lg] = {'matches': L, 'n_matches': len(L), 'n_players': sum(len(g['players']) for g in L)}
    json.dump(out, open('data/scorers.json', 'w'), separators=(',', ':'))
    try:
        import srcscrub
        srcscrub.scrub_file('data/scorers.json')
    except Exception:
        pass
    for lg, v in out['leagues'].items():
        if v['n_matches']:
            print(lg, v['n_matches'], 'matches', v['n_players'], 'players')

if __name__ == '__main__':
    main()
