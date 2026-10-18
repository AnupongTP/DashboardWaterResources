"""Authority URL integration tests against local Netlify Dev and mocked Production GET APIs."""
import json
import os
import subprocess
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('AUTHORITY_TEST_BASE', 'http://localhost:8888').rstrip('/')
ACTIVE = 'https://dashboard-waterresources1.netlify.app'
CHROME = os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE')
VERSION = '"authority-fixture-v1"'
IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='


def master_fixture():
    # Select one valid Tambon/Moo for every canonical authority from the real rules.
    js = r"""const fs=require('fs'),vm=require('vm');const c={window:{}};
vm.runInNewContext(fs.readFileSync('site/assets/area-responsibility.js','utf8'),c);
vm.runInNewContext(fs.readFileSync('site/assets/authority-routes.js','utf8'),c);
const a=c.window.AreaResponsibility,r=c.window.AuthorityRoutes;
if(!r.masterIsValid||r.entries.length!==29)throw Error('Master mismatch');
const out=r.entries.map(e=>{for(const t of a.tambonsForAuthority(e.authority)){
  for(let moo=1;moo<=20;moo++)if(a.explicitAuthorityValidation(t,moo,e.authority).valid)
    return {authority:e.authority,slug:e.slug,tambon:t,moo,district:a.districtForTambon(t)};
}throw Error('No valid jurisdiction for '+e.authority)});
console.log(JSON.stringify(out));"""
    return json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT, text=True, encoding='utf-8'))


ENTRIES = master_fixture()


def record(id, name, authority, tambon, moo, *, problem='ใช้งานได้', image=None, volume=10):
    return dict(id=id, dt='2026-10-18 10:00', lat=19.0 + id * .000001,
                lng=99.8 + id * .000001, name=name, owner='ผู้ดูแลทดสอบ', phone=None,
                type='ฝาย', width=1, length=1, depth=1, depthnet=1,
                tambon=tambon, village='หมู่บ้านทดสอบ', moo=moo, problem=problem,
                imglink=image, volume=volume, note=None, status='ตรวจสอบแล้ว',
                localAuthority=authority)


DATA = [record(70001 + i, 'AUTH-' + entry['slug'], entry['authority'],
               entry['tambon'], entry['moo'], volume=100 + i)
        for i, entry in enumerate(ENTRIES)]
by_slug = {entry['slug']: entry for entry in ENTRIES}
DATA += [
    record(71001, 'MAEKA-DAMAGED', by_slug['tt-mae-ka']['authority'],
           by_slug['tt-mae-ka']['tambon'], by_slug['tt-mae-ka']['moo'],
           problem='ชำรุด', image=IMAGE, volume=40),
    record(71002, 'MAENA-DAMAGED', by_slug['obt-mae-na-ruea']['authority'],
           by_slug['obt-mae-na-ruea']['tambon'], by_slug['obt-mae-na-ruea']['moo'],
           problem='ชำรุด', image=IMAGE, volume=50),
    record(71003, 'SHARED-TM', 'ทม.ดอกคำใต้', 'ดอกคำใต้', 1, volume=60),
    record(71004, 'SHARED-OBT', 'อบต.ดอกคำใต้', 'ดอกคำใต้', 1, volume=70),
    record(71005, 'SHARED-AMBIGUOUS', None, 'ดอกคำใต้', 1, volume=80),
    record(71006, 'SHARED-INVALID', 'อบต.แม่อิง', 'ดอกคำใต้', 1, volume=90),
    record(71007, 'SHARED-NO-MOO', None, 'ดอกคำใต้', None, volume=100),
]
EXTRA_COUNTS = {'tt-mae-ka': 1, 'obt-mae-na-ruea': 1,
                'tm-dok-kham-tai': 1, 'obt-dok-kham-tai': 1}


def expected_count(slug):
    return 1 + EXTRA_COUNTS.get(slug, 0)


def install_routes(context, *, data=DATA, fail_version=False, fail_data=False,
                   fail_bootstrap=False, declared_count=None, requests=None):
    def route_handler(route):
        url = route.request.url
        if url == ACTIVE + '/api/waterresources/version':
            if requests is not None:
                requests.append((url, route.request.method))
            if fail_version() if callable(fail_version) else fail_version:
                route.abort('failed')
            else:
                route.fulfill(status=200, content_type='application/json',
                              headers={'Access-Control-Allow-Origin': '*'},
                              body=json.dumps({'success': True, 'initialized': True,
                                               'version': VERSION, 'count': len(data)}))
        elif url == ACTIVE + '/api/waterresources':
            if requests is not None:
                requests.append((url, route.request.method))
            if fail_data() if callable(fail_data) else fail_data:
                route.abort('failed')
            else:
                route.fulfill(status=200, content_type='application/json',
                              headers={'Access-Control-Allow-Origin': '*', 'ETag': VERSION},
                              body=json.dumps({'success': True, 'version': VERSION,
                                               'count': len(data) if declared_count is None else declared_count,
                                               'data': data}, ensure_ascii=False))
        elif 'leaflet.markercluster.js' in url:
            # Offline fixture only; the existing map regressions exercise the real plugin.
            route.fulfill(status=200, content_type='application/javascript',
                          body='L.markerClusterGroup = () => L.featureGroup();')
        elif url.startswith('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/') or \
                url.startswith('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/'):
            # The Maeka-based prototype uses the same public visual libraries as maeka.html.
            route.continue_()
        elif fail_bootstrap and url.startswith(BASE + '/data/waterresources.initial.json'):
            route.abort('failed')
        elif url.startswith(BASE + '/'):
            route.continue_()
        else:
            route.abort()
    context.route('**/*', route_handler)


def ready(page, slug, count):
    if slug == 'tt-mae-ka':
        page.wait_for_function('([slug,count]) => window.__AUTHORITY_PAGE__ && '
                               'window.__AUTHORITY_PAGE__.slug === slug && '
                               'window.__AUTHORITY_PAGE__.count === count && '
                               'document.body.classList.contains("authority-ready") && '
                               'Number(document.querySelector("#statCount").textContent) === count',
                               arg=[slug, count], timeout=30000)
        return
    page.wait_for_function('([slug,count]) => window.__AUTHORITY_PAGE__ && '
                           'window.__AUTHORITY_PAGE__.slug === slug && '
                           'window.__AUTHORITY_PAGE__.count === count && '
                           'document.querySelector("#countNote").textContent.includes(count.toLocaleString("th-TH"))',
                           arg=[slug, count], timeout=30000)


def assert_locked(page, entry, count):
    if entry['slug'] == 'tt-mae-ka':
        state = page.evaluate('''() => ({page:window.__AUTHORITY_PAGE__,
            rows:[...document.querySelectorAll('#tblBody tr')].map(row=>row.textContent),
            count:Number(document.querySelector('#statCount').textContent),
            types:Number(document.querySelector('#statTypes').textContent),
            broken:Number(document.querySelector('#statBroken').textContent),
            scope:window.__AUTHORITY_DATA__.map(row=>row.name)})''')
        assert state['page']['authority'] == entry['authority'], state
        assert state['page']['count'] == count == state['count'], state
        assert len(state['scope']) == count, state
        assert state['types'] == 1 and state['broken'] == 1, state
        assert 'เทศบาลตำบลแม่กา' in page.locator('#authorityHeading').inner_text()
        assert page.locator('#fAuthority').count() == 0
        assert page.locator('#visitorCounter').is_hidden()
        assert 'AUTH-tt-mae-ka' in page.locator('#tblBody').inner_text()
        assert 'MAEKA-DAMAGED' in page.locator('#tblBody').inner_text()
        for other in ENTRIES:
            if other['slug'] != entry['slug']:
                assert 'AUTH-' + other['slug'] not in page.locator('#tblBody').inner_text()
        assert 'MAENA-DAMAGED' not in page.locator('#tblBody').inner_text()
        return
    state = page.evaluate('''() => ({page:window.__AUTHORITY_PAGE__,
        countText:document.querySelector('#countNote').textContent,
        execKpi:document.querySelector('#execKpi').textContent,
        district:document.querySelector('#efDistrict').value,
        authorities:['efAuthority','fAuthority','dfAuthority'].map(id=>{
            const el=document.getElementById(id);return {value:el.value,disabled:el.disabled,options:el.options.length};
        }),
        districts:['efDistrict','fDistrict','dfDistrict'].map(id=>document.getElementById(id).disabled),
        names:[...document.querySelectorAll('#tblBody tr')].map(row=>row.textContent)
    })''')
    assert state['page']['authority'] == entry['authority'], state
    assert state['page']['count'] == count and str(count) in state['countText'], state
    assert all(x['value'] == entry['authority'] and x['disabled'] and x['options'] == 1
               for x in state['authorities']), state
    assert all(state['districts']) and state['district'] == entry['district'], state
    assert '🔒' in page.locator('#authorityLockBadge').inner_text()
    assert page.locator('#visitorCounter').is_hidden()
    assert 'AUTH-' + entry['slug'] in page.locator('#tblBody').inner_text()
    for other in ENTRIES:
        if other['slug'] != entry['slug']:
            assert 'AUTH-' + other['slug'] not in page.locator('#tblBody').inner_text()
    expected_rows = [row for row in DATA if row['localAuthority'] == entry['authority']
                     and row['name'] != 'SHARED-INVALID']
    assert len(expected_rows) == count
    values = page.locator('#execKpi .kv').all_text_contents()
    assert int(values[0].replace(',', '')) == count, values
    assert int(values[1].replace(',', '')) == len({row['type'] for row in expected_rows}), values
    assert int(values[2].replace(',', '')) == len({row['tambon'] for row in expected_rows}), values
    avg_volume = int(sum(row['volume'] for row in expected_rows) / count + .5)
    assert str(avg_volume) in page.locator('#execKpi .kpi-card').nth(7).locator('.ks').inner_text()


def main():
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME)
        try:
            # All 29 direct routes and refreshes use the same full mock API dataset.
            context = browser.new_context(viewport={'width': 1440, 'height': 900})
            install_routes(context)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            for entry in ENTRIES[:int(os.environ.get('AUTHORITY_TEST_ROUTE_LIMIT', len(ENTRIES)))]:
                slug = entry['slug']
                page.goto(BASE + '/authority/' + slug + '/', wait_until='domcontentloaded')
                ready(page, slug, expected_count(slug))
                assert_locked(page, entry, expected_count(slug))
                page.reload(wait_until='domcontentloaded')
                ready(page, slug, expected_count(slug))
                assert_locked(page, entry, expected_count(slug))
                results.append('route_' + slug)
            assert not errors, errors

            # Root remains province-wide and retains switchable filters.
            page.goto(BASE + '/index.html', wait_until='domcontentloaded')
            page.wait_for_function('() => document.querySelector("#countNote").textContent.includes("' + str(len(DATA)) + '")')
            assert page.evaluate('window.__AUTHORITY_PAGE__ || null') is None
            assert not page.locator('#efAuthority').is_disabled()
            assert page.locator('#efAuthority option').count() == 30
            results.append('root_province_wide')
            api_response = context.request.get(BASE + '/api/waterresources/version')
            assert api_response.headers['content-type'].startswith('application/json')
            results.append('api_route_not_rewritten')
            page.goto(BASE + '/authority/tt-mae-ka/')
            ready(page, 'tt-mae-ka', 2)
            page.goto(BASE + '/authority/obt-mae-na-ruea/')
            ready(page, 'obt-mae-na-ruea', 2)
            page.go_back()
            ready(page, 'tt-mae-ka', 2)
            page.go_forward()
            ready(page, 'obt-mae-na-ruea', 2)
            shared_tab = context.new_page()
            shared_tab.goto(BASE + '/authority/tm-dok-kham-tai/')
            ready(shared_tab, 'tm-dok-kham-tai', 2)
            shared_tab.close()
            results.append('back_forward_and_new_tab')
            context.close()

            # Invalid and malformed paths must never initialize the dashboard.
            context = browser.new_context()
            install_routes(context)
            page = context.new_page()
            for path in ['/authority/no-such-office/', '/authority/tt-mae-ka/extra', '/authority/TT-MAE-KA/', '/authority/']:
                page.goto(BASE + path, wait_until='domcontentloaded')
                page.wait_for_selector('#authorityFailure')
                assert 'ไม่พบหน่วยงาน' in page.locator('#authorityFailure').inner_text()
                assert page.locator('#execKpi').count() == 0
            results.append('invalid_routes_fail_closed')
            context.close()

            # Current-version cache may render, but stale/offline and bootstrap may not.
            context = browser.new_context()
            flags = {'version': False, 'data': False}
            install_routes(context, fail_version=lambda: flags['version'], fail_data=lambda: flags['data'])
            page = context.new_page()
            path = BASE + '/authority/tt-mae-ka/'
            page.goto(path)
            ready(page, 'tt-mae-ka', 2)
            flags['data'] = True
            page.reload()
            ready(page, 'tt-mae-ka', 2)
            assert page.evaluate('window.__WATER_DATA_DIAGNOSTICS__.source') == 'indexeddb-cache'
            flags['version'] = True
            page.reload()
            page.wait_for_selector('#authorityFailure')
            assert page.locator('#authorityRetry').is_visible()
            assert page.locator('#execKpi').count() == 0
            flags['version'] = False
            flags['data'] = False
            page.locator('#authorityRetry').click()
            ready(page, 'tt-mae-ka', 2)
            results.append('validated_cache_offline_fail_closed_retry')
            context.close()

            context = browser.new_context()
            install_routes(context, fail_version=True, fail_data=True)
            page = context.new_page()
            page.goto(path)
            page.wait_for_selector('#authorityFailure')
            assert page.evaluate('window.__WATER_DATA_DIAGNOSTICS__.source') == 'static-bootstrap'
            assert page.locator('#countNote').count() == 0
            results.append('static_bootstrap_fail_closed')
            context.close()

            context = browser.new_context()
            install_routes(context, fail_version=True, fail_data=True, fail_bootstrap=True)
            page = context.new_page()
            page.goto(path)
            page.wait_for_selector('#authorityFailure')
            assert page.evaluate('window.__WATER_DATA_DIAGNOSTICS__.source') == 'empty-failsafe'
            results.append('all_sources_unavailable_fail_closed')
            context.close()

            context = browser.new_context()
            install_routes(context, data=DATA + [{'id': 'invalid', 'tambon': 'แม่กา'}])
            page = context.new_page()
            page.goto(path)
            page.wait_for_selector('#authorityFailure')
            results.append('malformed_dataset_fail_closed')
            context.close()

            context = browser.new_context()
            install_routes(context, declared_count=len(DATA) + 1)
            page = context.new_page()
            page.goto(path)
            page.wait_for_selector('#authorityFailure')
            assert page.locator('#execKpi').count() == 0
            results.append('incomplete_dataset_count_fail_closed')
            context.close()

            # A valid authority with no confirmed records is a genuine zero, not an API failure.
            zero_data = [row for row in DATA if row.get('localAuthority') != 'อบต.คือเวียง']
            context = browser.new_context()
            install_routes(context, data=zero_data)
            page = context.new_page()
            page.goto(BASE + '/authority/obt-khue-wiang/')
            ready(page, 'obt-khue-wiang', 0)
            assert page.locator('#authorityFailure').count() == 0
            assert 'ยังไม่มีรายการที่ยืนยัน' in page.locator('#authorityEmptyNotice').inner_text()
            results.append('valid_zero_records')
            context.close()

            # The Maeka-style prototype resets within its locked authority scope.
            context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
            install_routes(context)
            page = context.new_page()
            page.goto(path)
            ready(page, 'tt-mae-ka', 2)
            hero_markers = page.locator('#mapbox .leaflet-marker-icon').count()
            page.locator('#txtSearch').fill('MAEKA-DAMAGED')
            assert page.locator('#statCount').inner_text() == '1'
            page.locator('#fStatus').select_option('ชำรุด')
            assert page.locator('#statCount').inner_text() == '1'
            page.locator('.kpi[data-kpi="count"]').click()
            assert_locked(page, by_slug['tt-mae-ka'], 2)
            assert hero_markers == 2, hero_markers
            page.locator('#fStatus').select_option('ชำรุด')
            assert page.locator('#statCount').inner_text() == '1'
            assert 'MAEKA-DAMAGED' in page.locator('#tblBody').inner_text()
            assert 'MAENA-DAMAGED' not in page.locator('#tblBody').inner_text()
            page.locator('.kpi[data-kpi="count"]').click()
            assert_locked(page, by_slug['tt-mae-ka'], 2)
            overflow = page.evaluate('document.documentElement.scrollWidth - window.innerWidth')
            assert overflow <= 2, overflow
            results.append('maeka_resets_cross_authority_isolation_mobile_390')
            context.close()

            # Check the other required responsive widths with locked controls and no page errors.
            for width in (360, 412):
                context = browser.new_context(viewport={'width': width, 'height': 844}, is_mobile=True, has_touch=True)
                install_routes(context)
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(path)
                ready(page, 'tt-mae-ka', 2)
                assert_locked(page, by_slug['tt-mae-ka'], 2)
                assert page.evaluate('document.documentElement.scrollWidth - window.innerWidth') <= 2
                assert not errors, errors
                context.close()
                results.append('mobile_' + str(width))
        finally:
            browser.close()
    print(json.dumps({'ok': True, 'tests': results, 'allAuthorityRoutes': len(ENTRIES)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
