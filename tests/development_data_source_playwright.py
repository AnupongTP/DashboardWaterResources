"""Browser contracts for the localhost Production read path (mocked API)."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
ACTIVE = 'https://dashboard-waterresources1.netlify.app'
OLD = 'https://dashboard-waterresources.netlify.app'
CHROME = os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE')
SAMPLE = json.loads((SITE / 'data/waterresources.initial.json').read_text(encoding='utf-8'))[:2]
VERSION = '"test-live-v1"'


def fixture(context, html=None, fail=False, requests=None):
    def route(request):
        url = request.request.url
        if requests is not None and '/api/waterresources' in url:
            requests.append((url, request.request.method))
        if url == 'http://localhost:8888/index.html':
            request.fulfill(status=200, content_type='text/html', body=html or '''<!doctype html><html><head></head><body>
                <script src="/assets/runtime-config.js"></script>
                <script src="/assets/water-data-loader.js"></script></body></html>''')
        elif url.startswith('http://localhost:8888/'):
            file = (SITE / url.split('http://localhost:8888/', 1)[1].split('?', 1)[0]).resolve()
            assert file.is_relative_to(SITE.resolve()), file
            if file.is_file():
                request.fulfill(path=str(file))
            else:
                request.fulfill(status=404)
        elif url == ACTIVE + '/api/waterresources/version':
            if fail() if callable(fail) else fail:
                request.abort('failed')
            else:
                request.fulfill(status=200, content_type='application/json',
                                headers={'Access-Control-Allow-Origin': '*'},
                                body=json.dumps({'success': True, 'version': VERSION, 'count': len(SAMPLE)}))
        elif url == ACTIVE + '/api/waterresources':
            if fail() if callable(fail) else fail:
                request.abort('failed')
            else:
                request.fulfill(status=200, content_type='application/json',
                                headers={'Access-Control-Allow-Origin': '*', 'ETag': VERSION},
                                body=json.dumps({'success': True, 'version': VERSION, 'count': len(SAMPLE), 'data': SAMPLE}))
        elif '/api/waterresources' in url:
            raise AssertionError('Unexpected dataset origin: ' + url)
        else:
            request.continue_()
    context.route('**/*', route)


def load(page):
    data = page.evaluate('WaterData.load()')
    return data, page.evaluate('window.__WATER_DATA_DIAGNOSTICS__')


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME)
        try:
            # A: fresh localhost and version optimization on the same origin.
            ctx = browser.new_context()
            calls = []
            fixture(ctx, requests=calls)
            page = ctx.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto('http://localhost:8888/index.html')
            data, diag = load(page)
            assert len(data) == len(SAMPLE) and diag['source'] == 'production-api-development', diag
            assert calls == [(ACTIVE + '/api/waterresources/version', 'GET'), (ACTIVE + '/api/waterresources', 'GET')], calls
            assert page.evaluate('WaterData.constants.DATA_ENDPOINT') == ACTIVE + '/api/waterresources'
            data, diag = load(page)
            assert diag['source'] == 'indexeddb-cache' and len(calls) == 3, (diag, calls)
            assert not errors, errors
            ctx.close()

            # B: a stale localhost cache with a matching version must not be trusted.
            ctx = browser.new_context()
            calls = []
            fixture(ctx, requests=calls)
            page = ctx.new_page()
            page.goto('http://localhost:8888/index.html')
            page.evaluate('''async () => { const db = await new Promise((resolve,reject) => {
                const r=indexedDB.open('water-resources-dashboard-cache',1);
                r.onupgradeneeded=()=>r.result.createObjectStore('state');
                r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
              }); const tx=db.transaction('state','readwrite');
              tx.objectStore('state').put({version:'"test-live-v1"',remoteOrigin:'http://localhost:8888',data:Array(1158).fill({id:1})},'waterresources');
              await new Promise(resolve=>tx.oncomplete=resolve); db.close(); }''')
            data, diag = load(page)
            assert len(data) == len(SAMPLE) and diag['source'] == 'production-api-development', diag
            assert len(calls) == 2, calls
            ctx.close()

            # C: an old account saved in localStorage does not redirect development.
            ctx = browser.new_context()
            ctx.add_init_script(f"localStorage.setItem('water-dashboard-production-origin','{OLD}')")
            calls = []
            fixture(ctx, requests=calls)
            page = ctx.new_page()
            page.goto('http://localhost:8888/index.html')
            data, diag = load(page)
            assert len(data) == len(SAMPLE) and diag['productionOrigin'] == ACTIVE, diag
            assert all(url.startswith(ACTIVE) for url, _ in calls), calls
            ctx.close()

            # File mode keeps the active default and ignores the retired stored URL.
            ctx = browser.new_context()
            ctx.add_init_script(f"localStorage.setItem('water-dashboard-production-origin','{OLD}'); window.WATER_DASHBOARD_CONFIG={{forceMode:'file'}}")
            fixture(ctx)
            page = ctx.new_page()
            page.goto('http://localhost:8888/index.html')
            assert page.evaluate('WaterDashboardRuntime.productionOrigin') == ACTIVE
            assert page.evaluate('WaterData.constants.DATA_ENDPOINT') == ACTIVE + '/api/waterresources'
            ctx.close()

            # D: failed remote reads use static bootstrap with an explicit warning.
            ctx = browser.new_context()
            fixture(ctx, fail=True)
            page = ctx.new_page()
            page.goto('http://localhost:8888/index.html')
            data, diag = load(page)
            assert len(data) == 1158 and diag['source'] == 'static-bootstrap' and diag['warning'], diag
            ctx.close()

            # A warm cache from this origin remains available offline and clears
            # its warning once the version API recovers.
            state = {'offline': False}
            ctx = browser.new_context()
            fixture(ctx, fail=lambda: state['offline'])
            page = ctx.new_page()
            page.goto('http://localhost:8888/index.html')
            load(page)
            state['offline'] = True
            data, diag = load(page)
            assert len(data) == len(SAMPLE) and diag['source'] == 'indexeddb-cache-offline' and diag['warning'], diag
            state['offline'] = False
            data, diag = load(page)
            assert diag['source'] == 'indexeddb-cache' and diag['warning'] is None, diag
            ctx.close()

            # E: hosted mode still builds same-origin URLs.
            ctx = browser.new_context()
            page = ctx.new_page()
            page.route('https://host.example/index.html', lambda route: route.fulfill(
                content_type='text/html', body='<script>' + (SITE/'assets/runtime-config.js').read_text(encoding='utf-8') + '</script>'))
            page.goto('https://host.example/index.html')
            assert page.evaluate("WaterDashboardRuntime.mode === 'hosted' && WaterDashboardRuntime.apiUrl('/api/waterresources') === '/api/waterresources'")
            ctx.close()

            # G: the full page selects Production on all required viewport sizes.
            full_html = (SITE / 'index.html').read_text(encoding='utf-8')
            for width, height in [(1440, 900), (360, 800), (390, 844), (412, 915)]:
                ctx = browser.new_context(viewport={'width': width, 'height': height})
                calls = []
                fixture(ctx, html=full_html, requests=calls)
                page = ctx.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto('http://localhost:8888/index.html', wait_until='domcontentloaded')
                page.wait_for_function("window.__WATER_DATA_DIAGNOSTICS__ && document.querySelector('#countNote').textContent.includes('2')", timeout=30000)
                diag = page.evaluate('window.__WATER_DATA_DIAGNOSTICS__')
                assert diag['source'] == 'production-api-development' and diag['count'] == len(SAMPLE), (width, diag)
                assert calls[:2] == [(ACTIVE + '/api/waterresources/version', 'GET'), (ACTIVE + '/api/waterresources', 'GET')], (width, calls)
                assert page.locator('#map.leaflet-container').count() == 1, width
                assert page.evaluate('typeof L.markerClusterGroup === "function"'), width
                assert page.locator('#execKpi .kpi-card .kv').first.inner_text().strip() == str(len(SAMPLE)), width
                if width == 1440:
                    page.select_option('#efType', SAMPLE[0]['type'])
                    page.locator('#efReset').click()
                    assert page.input_value('#efType') == ''
                    assert page.locator('#execKpi .kpi-card .kv').first.inner_text().strip() == str(len(SAMPLE))
                assert page.evaluate('document.documentElement.scrollWidth - innerWidth') <= 2, width
                assert not errors, (width, errors)
                ctx.close()
        finally:
            browser.close()
    print('development_data_source_playwright: PASS (A-E, G 1440/360/390/412, mocked API)')


if __name__ == '__main__':
    main()
