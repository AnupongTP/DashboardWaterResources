#!/usr/bin/env python3
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'site'
BOOTSTRAP=json.loads((SITE/'data'/'waterresources.initial.json').read_text(encoding='utf-8'))
INDEX=(SITE/'index.html').read_text(encoding='utf-8')
RUNTIME=(SITE/'assets'/'runtime-config.js').read_text(encoding='utf-8')
LOADER=(SITE/'assets'/'water-data-loader.js').read_text(encoding='utf-8')
AREA=(SITE/'assets'/'area-responsibility.js').read_text(encoding='utf-8')
COMBO=(SITE/'assets'/'tambon-combobox.js').read_text(encoding='utf-8')
ADAPTER=(SITE/'assets'/'maeka-data-adapter.js').read_text(encoding='utf-8')
PROD='https://dashboard-waterresources.netlify.app'
SAMPLE=BOOTSTRAP+[{
  'id':990001,'dt':'2026-08-30 18:00','lat':19.05,'lng':99.95,'name':'FILE-MODE-LIVE-MAEKA',
  'owner':'ทดสอบ','phone':None,'type':'ฝาย','width':1,'length':2,'depth':3,'depthnet':2,
  'tambon':'แม่กา','village':'แม่กาหลวง','moo':3,'problem':'ใช้งานได้','imglink':None,
  'volume':12,'note':None,'status':'ตรวจสอบแล้ว','localAuthority':None
}]


def build_index_filemode_html():
  html=INDEX
  html=html.replace('<script src="./assets/runtime-config.js"></script>', '<script>window.WATER_DASHBOARD_CONFIG={forceMode:"file",productionOrigin:"'+PROD+'"};</script><script>'+RUNTIME+'</script>')
  html=html.replace('<script src="./assets/water-data-loader.js"></script>', '<script>'+LOADER+'</script>')
  html=html.replace('<script src="./assets/area-responsibility.js"></script>', '<script>'+AREA+'</script>')
  html=html.replace('<script src="./assets/tambon-combobox.js"></script>', '<script>'+COMBO+'</script>')
  html=html.replace('<link rel="preconnect" href="https://fonts.googleapis.com">','')
  html=html.replace('<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">','')
  return html


def main():
  results=[]
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium')

    # 1) Full Dashboard, forcing the same runtime branch that real file:// uses.
    ctx=browser.new_context(viewport={'width':390,'height':844})
    def route_handler(route):
      url=route.request.url
      if url == PROD+'/api/waterresources/version':
        body={'success':True,'initialized':True,'version':'"file-live-v1"','updatedAt':'2026-08-30T18:00:00+07:00','count':len(SAMPLE)}
        route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'}, body=json.dumps(body,ensure_ascii=False))
      elif url == PROD+'/api/waterresources':
        body={'success':True,'version':'"file-live-v1"','updatedAt':'2026-08-30T18:00:00+07:00','count':len(SAMPLE),'data':SAMPLE}
        route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'ETag','ETag':'"file-live-v1"'}, body=json.dumps(body,ensure_ascii=False))
      else:
        route.abort()
    ctx.route('**/*', route_handler)
    page=ctx.new_page(); errors=[]; page.on('pageerror',lambda e: errors.append(str(e)))
    page.set_content(build_index_filemode_html(),wait_until='domcontentloaded',timeout=30000)
    page.wait_for_function("window.__WATER_DATA_DIAGNOSTICS__ && window.__WATER_DATA_DIAGNOSTICS__.source === 'production-api-file'", timeout=30000)
    diag=page.evaluate('window.__WATER_DATA_DIAGNOSTICS__')
    assert diag['runtimeMode']=='file' and diag['count']==len(SAMPLE),diag
    assert page.evaluate('WaterData.constants.DATA_ENDPOINT')==PROD+'/api/waterresources'
    page.wait_for_function("([n])=>document.querySelector('#countNote') && document.querySelector('#countNote').textContent.includes(n.toLocaleString('th-TH'))", arg=[len(SAMPLE)], timeout=30000)
    assert not errors,errors
    results.append({'test':'file_runtime_full_dashboard_uses_live_production_api','ok':True,'count':diag['count']})
    ctx.close()

    # 2) If file:// fetch/CORS is unavailable, the read-only script bridge still returns live Production data.
    ctx=browser.new_context(viewport={'width':390,'height':844})
    def bridge_route_handler(route):
      url=route.request.url
      if url.startswith(PROD+'/api/waterresources/version') or url == PROD+'/api/waterresources':
        route.abort()
      elif url.startswith(PROD+'/api/waterresources/file-bridge?'):
        from urllib.parse import urlparse,parse_qs
        cb=parse_qs(urlparse(url).query).get('callback',[''])[0]
        payload={'success':True,'version':'"file-bridge-v1"','updatedAt':'2026-08-30T18:00:00+07:00','count':len(SAMPLE),'data':SAMPLE}
        route.fulfill(status=200, content_type='application/javascript', body=cb+'('+json.dumps(payload,ensure_ascii=False)+');')
      else:
        route.abort()
    ctx.route('**/*', bridge_route_handler)
    page=ctx.new_page(); errors=[]; page.on('pageerror',lambda e: errors.append(str(e)))
    page.set_content(build_index_filemode_html(),wait_until='domcontentloaded',timeout=30000)
    page.wait_for_function("window.__WATER_DATA_DIAGNOSTICS__ && window.__WATER_DATA_DIAGNOSTICS__.source === 'production-script-bridge-file'", timeout=30000)
    diag=page.evaluate('window.__WATER_DATA_DIAGNOSTICS__')
    assert diag['runtimeMode']=='file' and diag['transport']=='script-bridge' and diag['count']==len(SAMPLE),diag
    assert not errors,errors
    results.append({'test':'file_runtime_script_bridge_survives_fetch_cors_failure','ok':True,'count':diag['count']})
    ctx.close()

    # 3) Mae Ka adapter consumes the same API schema and maps fields correctly.
    ctx=browser.new_context()
    page=ctx.new_page()
    html='<!doctype html><html><body><script>window.WATER_DASHBOARD_CONFIG={forceMode:"file",productionOrigin:"'+PROD+'"};</script><script>'+RUNTIME+'</script><script>'+ADAPTER+'</script></body></html>'
    page.set_content(html)
    maeka=page.evaluate('(records)=>MaekaDataAdapter.fromWaterRecords(records)', SAMPLE)
    assert any(x['id']==990001 and x['depthNet']==2 and x['volumn']==12 and x['image']=='' for x in maeka),maeka[-3:]
    assert len(maeka)==sum(1 for x in SAMPLE if x.get('tambon')=='แม่กา')
    results.append({'test':'maeka_adapter_filters_live_dataset_and_maps_fields','ok':True,'count':len(maeka)})
    ctx.close()

    # 4) File-runtime offline fallback: local bootstrap global is accepted without HTTP fetch.
    ctx=browser.new_context(); page=ctx.new_page()
    html='<!doctype html><html><body><script>window.WATER_DASHBOARD_CONFIG={forceMode:"file",productionOrigin:"'+PROD+'"};window.__WATER_BOOTSTRAP_DATA__='+json.dumps(BOOTSTRAP,ensure_ascii=False)+';</script><script>'+RUNTIME+'</script><script>window.fetch=async()=>{throw new TypeError("offline")};</script><script>'+LOADER+'</script></body></html>'
    page.set_content(html)
    data=page.evaluate('WaterData.load()')
    diag=page.evaluate('window.__WATER_DATA_DIAGNOSTICS__')
    assert len(data)==1158 and diag['source']=='static-bootstrap-file',(len(data),diag)
    results.append({'test':'file_runtime_offline_uses_local_bootstrap','ok':True,'count':len(data)})
    ctx.close()

    browser.close()

  # Static launcher checks stand in for actual file:// navigation; this environment blocks file:// by administrator policy.
  root_index=(ROOT/'index.html').read_text(encoding='utf-8')
  root_maeka=(ROOT/'maeka.html').read_text(encoding='utf-8')
  assert './site/index.html' in root_index and 'window.location.replace' in root_index
  assert './site/maeka.html' in root_maeka and 'window.location.replace' in root_maeka
  results.append({'test':'root_double_click_launchers_target_site_pages','ok':True,'note':'file:// navigation blocked by CI browser policy; runtime branch tested above'})

  (ROOT/'tests/file-mode-results.json').write_text(json.dumps({'ok':True,'results':results},ensure_ascii=False,indent=2),encoding='utf-8')
  print(json.dumps({'ok':True,'tests':[x['test'] for x in results]},ensure_ascii=False,indent=2))

if __name__=='__main__': main()
