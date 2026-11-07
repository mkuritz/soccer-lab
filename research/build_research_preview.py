#!/usr/bin/env python3
"""Build a LOCAL/OFFLINE noncommercial research preview of the Soccer Hub with historical
StatsBomb Open Data samples (normalized by the soccer-event adapter).

Output goes OUTSIDE the repo/publish root (default /workspace/research-preview/soccer-hub-1106).
The published Hub never references research/ or research-events.js, so it stays fail-closed.
Usage: python3 research/build_research_preview.py --match-ids 3943043 3869685 [--out DIR]
(reads only files listed in the fixed adapter preview directory ADAPTER_PREVIEW)
"""
import argparse, json, os, shutil, sys
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {'.git', 'tests', 'research', 'audit', 'scripts', '__pycache__'}

ADAPTER_PREVIEW = '/workspace/wt/soccer-event-adapter-1106/research/soccer-events/preview'

def need(cond, msg):
    if not cond: raise SystemExit('invalid research sample: ' + msg)

def load(match_id):
    need(str(match_id).isdigit() and len(str(match_id)) <= 12, 'match id must be digits')
    names = {n for n in os.listdir(ADAPTER_PREVIEW) if n.endswith('.json')}
    fname = '%d.json' % int(match_id)
    need(fname in names, 'no adapter preview file for match ' + str(match_id))
    with open(os.path.join(ADAPTER_PREVIEW, fname), encoding='utf-8') as fh:
        d = json.load(fh)
    need(d.get('schema') == 'sl-soccer-events/1', 'schema')
    need(d.get('historical') is True and d.get('coverage', {}).get('live') is False, 'only historical samples')
    need(d['source'].get('license_ok') is False, 'license gate must stay false (redistribution unclear)')
    for s in d['shots']:
        need(0 <= s['x'] <= 105 and 0 <= s['y'] <= 68 and (s['xg'] is None or 0 <= s['xg'] <= 1), 'shot ' + str(s.get('id')))
    return d

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--match-ids', nargs='+', required=True)
    ap.add_argument('--out', default='/workspace/research-preview/soccer-hub-1106'); a = ap.parse_args()
    out = os.path.abspath(a.out)
    if out == REPO or out.startswith(REPO + os.sep): sys.exit('refusing: output must be outside the repo/publish root')
    samples = [load(m) for m in a.match_ids]
    if os.path.exists(out): shutil.rmtree(out)
    shutil.copytree(REPO, out, ignore=lambda d, names: [n for n in names if d == REPO and n in SKIP])
    shutil.copy(os.path.join(REPO, 'research', 'soccer-research.js'), os.path.join(out, 'soccer-research.js'))
    blob = json.dumps(samples, separators=(',', ':')).replace('</', '<\\/')
    open(os.path.join(out, 'research-events.js'), 'w').write('/* LOCAL RESEARCH PREVIEW ONLY - StatsBomb Open Data, not for redistribution */\nwindow.SL_RESEARCH_EVENTS=' + blob + ';\n')
    idx = os.path.join(out, 'index.html'); h = open(idx).read()
    tag = '<script src="soccer-viz.js?v='
    need(tag in h, 'index.html script anchor')
    h = h.replace(tag, '<script src="research-events.js"></script><script src="soccer-research.js"></script>' + tag, 1)
    h = h.replace('<meta name="robots" content="noindex">', '<meta name="robots" content="noindex,nofollow"><!-- LOCAL RESEARCH PREVIEW BUILD -->', 1)
    open(idx, 'w').write(h)
    for f in ('CNAME',):
        p = os.path.join(out, f)
        if os.path.exists(p): os.remove(p)   # never deployable as the production domain
    open(os.path.join(out, 'RESEARCH_PREVIEW.txt'), 'w').write('Local noncommercial research preview. Not for publication or deployment.\n')
    print(out, len(samples), 'samples')

if __name__ == '__main__': main()
