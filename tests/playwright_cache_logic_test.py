#!/usr/bin/env python3
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
LOADER_JS = (ROOT / 'site' / 'assets' / 'water-data-loader.js').read_text(encoding='utf-8')

FAKE_IDB = r'''
(function(){
  const stores = new Map();
  function asyncCall(fn){ setTimeout(fn, 0); }
  function ensureStore(name){ if(!stores.has(name)) stores.set(name, new Map()); return stores.get(name); }
  const db = {
    objectStoreNames:{ contains(name){ return stores.has(name); } },
    createObjectStore(name){ ensureStore(name); return {}; },
    transaction(name, mode){
      const store = ensureStore(name);
      const tx = {
        oncomplete:null,onerror:null,onabort:null,
        objectStore(){
          return {
            get(key){
              const req={result:undefined,error:null,onsuccess:null,onerror:null};
              asyncCall(()=>{ req.result=store.get(key); if(req.onsuccess) req.onsuccess(); });
              return req;
            },
            put(value,key){
              store.set(key, structuredClone(value));
              asyncCall(()=>{ if(tx.oncomplete) tx.oncomplete(); });
            },
            delete(key){
              store.delete(key);
              asyncCall(()=>{ if(tx.oncomplete) tx.oncomplete(); });
            }
          };
        }
      };
      return tx;
    }
  };
  const fakeIndexedDB = {
    open(name,version){
      const req={result:db,error:null,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};
      asyncCall(()=>{
        if(!stores.has('state') && req.onupgradeneeded) req.onupgradeneeded();
        if(req.onsuccess) req.onsuccess();
      });
      return req;
    }
  };
  Object.defineProperty(window,'indexedDB',{value:fakeIndexedDB,configurable:true});
  window.__fakeIdbStores = stores;
})();
'''

MOCK_FETCH = r'''
window.__netState = {
  version:'"v1"', data:[{id:1},{id:2}], apiOffline:false,
  forbidDataset:false, datasetRequests:0, versionRequests:0,
  bootstrap:[{id:101},{id:102},{id:103}]
};
window.fetch = async function(url, options){
  const s=window.__netState;
  if(url==='/api/waterresources/version'){
    s.versionRequests++;
    if(s.apiOffline) throw new TypeError('offline');
    return new Response(JSON.stringify({success:true,version:s.version,count:s.data.length,updatedAt:'2026-08-25T00:00:00+07:00'}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(url==='/api/waterresources'){
    s.datasetRequests++;
    if(s.apiOffline) throw new TypeError('offline');
    if(s.forbidDataset) return new Response('{"error":"forbidden test call"}',{status:500,headers:{'Content-Type':'application/json'}});
    const inm=options&&options.headers&&options.headers['If-None-Match'];
    if(inm===s.version) return new Response(null,{status:304,headers:{ETag:s.version}});
    return new Response(JSON.stringify({success:true,version:s.version,count:s.data.length,data:s.data}),{status:200,headers:{'Content-Type':'application/json',ETag:s.version}});
  }
  if(url==='/data/waterresources.initial.json'){
    return new Response(JSON.stringify(s.bootstrap),{status:200,headers:{'Content-Type':'application/json'}});
  }
  throw new Error('Unexpected fetch '+url);
};
'''


def make_html():
    return '<!doctype html><html><body><script>'+FAKE_IDB+'</script><script>'+MOCK_FETCH+'</script><script>'+LOADER_JS+'</script></body></html>'


def main():
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium')
        page=browser.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(make_html())

        # 1 cold cache -> full API
        data=page.evaluate('WaterData.load()')
        diag=page.evaluate('window.__WATER_DATA_DIAGNOSTICS__')
        assert len(data)==2 and diag['source']=='netlify-blob-api', (data,diag)
        assert page.evaluate('__netState.datasetRequests')==1
        results.append({'test':'cold_load_fetches_dataset_and_caches','ok':True,'diagnostics':diag})

        # 2 same version -> IndexedDB, no dataset call
        page.evaluate("__netState.forbidDataset=true")
        before=page.evaluate('__netState.datasetRequests')
        data=page.evaluate('WaterData.load()')
        diag=page.evaluate('window.__WATER_DATA_DIAGNOSTICS__')
        assert len(data)==2 and diag['source']=='indexeddb-cache',diag
        assert page.evaluate('__netState.datasetRequests')==before
        results.append({'test':'same_version_uses_indexeddb_without_dataset_request','ok':True,'diagnostics':diag})

        # 3 new version -> refresh
        page.evaluate("__netState.version='\\\"v2\\\"';__netState.data=[{id:1},{id:2},{id:3}];__netState.forbidDataset=false")
        data=page.evaluate('WaterData.load()')
        diag=page.evaluate('window.__WATER_DATA_DIAGNOSTICS__')
        assert len(data)==3 and diag['source']=='netlify-blob-api' and diag['version']=='"v2"',diag
        results.append({'test':'new_version_refreshes_indexeddb','ok':True,'diagnostics':diag})

        # 4 API offline -> warm cache
        page.evaluate('__netState.apiOffline=true')
        data=page.evaluate('WaterData.load()')
        diag=page.evaluate('window.__WATER_DATA_DIAGNOSTICS__')
        assert len(data)==3 and diag['source']=='indexeddb-cache-offline',diag
        results.append({'test':'api_offline_uses_warm_cache','ok':True,'diagnostics':diag})
        assert not errors,errors
        page.close()

        # 5 separate browser document = no cache, API offline -> bootstrap
        page=browser.new_page(); errors2=[]; page.on('pageerror',lambda e:errors2.append(str(e)))
        page.set_content(make_html())
        page.evaluate('__netState.apiOffline=true')
        data=page.evaluate('WaterData.load()')
        diag=page.evaluate('window.__WATER_DATA_DIAGNOSTICS__')
        assert len(data)==3 and diag['source']=='static-bootstrap',diag
        assert not errors2,errors2
        results.append({'test':'cold_offline_uses_static_bootstrap','ok':True,'diagnostics':diag})
        browser.close()

    out=ROOT/'tests'/'playwright-cache-results.json'
    out.write_text(json.dumps({'ok':True,'results':results},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'ok':True,'tests':[r['test'] for r in results]},ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
