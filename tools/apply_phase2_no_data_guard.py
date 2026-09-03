#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
index = root / 'site' / 'index.html'
text = index.read_text(encoding='utf-8')
old = "if(bestTb2.pct<10 && (!selectedTambon||bestTb2.tb===selectedTambon))"
new = "if(bestTb2 && bestTb2.pct<10 && (!selectedTambon||bestTb2.tb===selectedTambon))"
count = text.count(old)
if count != 1:
    raise SystemExit(f'PATCH ERROR: no-data guard expected 1 anchor, found {count}')
index.write_text(text.replace(old, new, 1), encoding='utf-8', newline='\n')
print('PATCH OK: executive no-data policy guard')
