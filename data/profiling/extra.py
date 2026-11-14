import csv,glob,collections,sys,os
for p in sorted(glob.glob(sys.argv[1]+'/**/*.csv',recursive=True)):
    rows=list(csv.DictReader(open(p,newline='')))
    k=collections.Counter((r['latitude'],r['longitude'],r['acq_date'],r['acq_time'],r['satellite']) for r in rows)
    d=[x for x,v in k.items() if v>1]
    full=collections.Counter(tuple(r.values()) for r in rows); fd=sum(v-1 for v in full.values() if v>1)
    dec=lambda c: dict(collections.Counter(len(r[c].split('.')[1]) if '.' in r[c] else 0 for r in rows))
    b=[float(r['brightness']) for r in rows]; b31=[float(r['bright_t31']) for r in rows]
    t=[int(r['acq_time']) for r in rows]
    lastday=max(r['acq_date'] for r in rows); perday=collections.Counter(r['acq_date'] for r in rows)
    lead0=sum(r['acq_time'].startswith('0') for r in rows)
    print(os.path.relpath(p,sys.argv[1]))
    print('  dupKeys:',d[:3],'fullRowDups:',fd)
    print('  latDecimals:',dec('latitude'),' brightness:',(min(b),max(b)),' bright_t31:',(min(b31),max(b31)))
    print('  acq_time int range:',min(t),max(t),' rows with leading 0:',lead0,f'({lead0/len(rows):.1%})')
    print('  last day',lastday,'rows',perday[lastday],' median rows/day',sorted(perday.values())[len(perday)//2])
    if 'Quer' in p:
        q=collections.Counter(r['satellite'] for r in rows if 20<=float(r['latitude'])<=21.7 and -100.6<=float(r['longitude'])<=-99)
        print('  QRO by satellite:',dict(q))
        if 'type' in rows[0]:
            print('  QRO type x zone:',dict(collections.Counter((r['type'],'SG' if float(r['latitude'])>20.9 else 'SUR') for r in rows if 20<=float(r['latitude'])<=21.7 and -100.6<=float(r['longitude'])<=-99)))
