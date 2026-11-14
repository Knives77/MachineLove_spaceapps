import csv, sys, os, statistics, collections, datetime as dt, re, glob

root = sys.argv[1]
files = sorted(glob.glob(os.path.join(root, '**', '*.csv'), recursive=True))

def pct(sorted_vals, p):
    if not sorted_vals: return None
    k = (len(sorted_vals) - 1) * p / 100
    f = int(k); c = min(f + 1, len(sorted_vals) - 1)
    return sorted_vals[f] + (sorted_vals[c] - sorted_vals[f]) * (k - f)

def fnum(x):
    try: return float(x)
    except: return None

results = {}
for path in files:
    rel = os.path.relpath(path, root)
    raw = open(path, 'rb').read()
    info = {
        'size_mb': os.path.getsize(path) / 1048576,
        'wc_l': raw.count(b'\n'),
        'bom': raw.startswith(b'\xef\xbb\xbf'),
        'crlf': b'\r\n' in raw,
        'ends_newline': raw.endswith(b'\n'),
        'non_ascii_bytes': sum(1 for b in raw if b > 127),
    }
    del raw
    with open(path, newline='', encoding='utf-8') as fh:
        r = csv.reader(fh)
        header = next(r)
        info['header'] = header
        idx = {c: i for i, c in enumerate(header)}
        nulls = collections.Counter()
        cnt = {c: collections.Counter() for c in ('satellite', 'instrument', 'version', 'type', 'daynight') if c in idx}
        conf_vals, conf_cat = [], collections.Counter()
        frp, scan, track, lat, lon = [], [], [], [], []
        frp_le0 = frp_null = 0
        dates = set()
        tlen = collections.Counter(); tbad = []; t_nonpad = 0
        bad_width = 0; ws = 0
        nrows = 0
        keys = collections.Counter()
        qro = collections.Counter(); qro_type = collections.Counter(); qro_zone = collections.Counter()
        qro_zone_type = collections.Counter()
        for row in r:
            nrows += 1
            if len(row) != len(header):
                bad_width += 1; continue
            for c, i in idx.items():
                v = row[i]
                if v.strip() == '' or v.strip().lower() in ('nan', 'null', 'none', 'na'):
                    nulls[c] += 1
                if v != v.strip(): ws += 1
            for c in cnt: cnt[c][row[idx[c]]] += 1
            cv = row[idx['confidence']]
            if cv.isdigit(): conf_vals.append(int(cv))
            else: conf_cat[cv] += 1
            f = fnum(row[idx['frp']])
            if f is None: frp_null += 1
            else:
                frp.append(f)
                if f <= 0: frp_le0 += 1
            scan.append(float(row[idx['scan']])); track.append(float(row[idx['track']]))
            la = float(row[idx['latitude']]); lo = float(row[idx['longitude']])
            lat.append(la); lon.append(lo)
            dates.add(row[idx['acq_date']])
            t = row[idx['acq_time']]
            tlen[len(t)] += 1
            if not (t.isdigit() and len(t) == 4 and int(t[:2]) < 24 and int(t[2:]) < 60):
                if len(tbad) < 5: tbad.append(t)
            keys[(row[idx['latitude']], row[idx['longitude']], row[idx['acq_date']], t, row[idx['satellite']])] += 1
            if 20.0 <= la <= 21.7 and -100.6 <= lo <= -99.0:
                qro['total'] += 1
                ty = row[idx['type']] if 'type' in idx else 'N/A(NRT)'
                qro_type[ty] += 1
                z = 'SierraGorda(lat>20.9)' if la > 20.9 else 'Sur/Agricola(lat<=20.9)'
                qro_zone[z] += 1
                qro_zone_type[(z, ty)] += 1
        # date validity / gaps
        dparsed = sorted(dt.date.fromisoformat(d) for d in dates)
        gaps = []
        for a, b in zip(dparsed, dparsed[1:]):
            if (b - a).days > 1: gaps.append((a + dt.timedelta(1), b - dt.timedelta(1)))
        frp.sort(); conf_vals.sort()
        info.update(dict(
            rows=nrows, bad_width=bad_width, ws=ws, nulls=dict(nulls), counts={k: dict(v.most_common()) for k, v in cnt.items()},
            conf_num=(dict(min=conf_vals[0], p25=pct(conf_vals, 25), p50=pct(conf_vals, 50), p75=pct(conf_vals, 75),
                           p90=pct(conf_vals, 90), max=conf_vals[-1], mean=statistics.fmean(conf_vals),
                           lt30=sum(v < 30 for v in conf_vals), ge80=sum(v >= 80 for v in conf_vals)) if conf_vals else None),
            conf_cat=dict(conf_cat),
            frp=dict(min=frp[0], max=frp[-1], median=statistics.median(frp), mean=statistics.fmean(frp), le0=frp_le0, null=frp_null),
            scan=(min(scan), statistics.fmean(scan), max(scan)), track=(min(track), statistics.fmean(track), max(track)),
            lat=(min(lat), max(lat)), lon=(min(lon), max(lon)),
            dmin=dparsed[0], dmax=dparsed[-1], ndays=len(dparsed), gaps=gaps, dates=set(dparsed),
            tlen=dict(tlen), tbad=tbad,
            dup_keys=sum(v - 1 for v in keys.values() if v > 1), keyset=set(keys),
            qro=dict(qro), qro_type=dict(qro_type), qro_zone=dict(qro_zone), qro_zone_type={f'{a}|type={b}': v for (a, b), v in qro_zone_type.items()},
        ))
    results[rel] = info

for rel, i in results.items():
    print('=' * 100); print(rel)
    for k, v in i.items():
        if k in ('dates', 'keyset'): continue
        print(f'  {k}: {v}')

print('=' * 100); print('ARCHIVE vs NRT')
for rel, i in results.items():
    if 'fire_archive_' not in rel: continue
    nrel = rel.replace('fire_archive_', 'fire_nrt_')
    if nrel not in results:
        print(rel, '-> NO NRT FILE'); continue
    n = results[nrel]
    ov = sorted(i['dates'] & n['dates'])
    gap = (n['dmin'] - i['dmax']).days - 1
    kov = len(i['keyset'] & n['keyset'])
    same_hdr = i['header'] == n['header'][:len(n['header'])]
    print(f"{rel}: archive {i['dmin']}..{i['dmax']} | nrt {n['dmin']}..{n['dmax']} | overlap_days={len(ov)} {ov[:3]}{'...' if len(ov)>3 else ''} | gap_days_between={max(gap,0)} | exact_record_overlap={kov}")
    print('   header diff archive-nrt:', [c for c in i['header'] if c not in n['header']], [c for c in n['header'] if c not in i['header']])
