"""Mae Ka original/Authority parity with deterministic data and mocked counters."""
import json
import os
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

from authority_locked_playwright import BASE, CHROME, by_slug, install_routes, record


ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path(os.environ.get('AUTHORITY_PARITY_SHOTS_DIR',
                            str(ROOT / 'docs' / 'maeka-authority-parity-screenshots')))
SHOTS.mkdir(parents=True, exist_ok=True)
ENTRY = by_slug['tt-mae-ka']
COUNTER = 'https://abacus.jasoncameron.dev/'
PREVIEW = 'https://deploy-preview-123--dashboard-waterresources1.netlify.app'
ACTIVE = 'https://dashboard-waterresources1.netlify.app'


def fixture():
    specs = [
        (81001, 'STRUCTURE-AND-WATER', 'ฝาย', 'ชำรุด,น้ำเน่าเสีย', 100, 10, 7),
        (81002, 'WEED', 'บ่อบาดาล', 'วัชพืชปกคลุม', 200, 4, 4),
        (81003, 'COLORED-WATER', 'สระน้ำ/บ่อน้ำ(มนุษย์สร้าง)', 'น้ำมีสี', 300, 5, 5),
        (81004, 'UNKNOWN-VOLUME', 'ฝาย', 'ใช้งานได้', 0, 0, 0),
        (81005, 'SECOND-STRUCTURE', 'ฝาย', 'ชำรุด', 400, 3, 3),
        (81006, 'SECOND-DEPTH', 'บ่อบาดาล', 'ใช้งานได้', 50, 8, 6),
    ]
    rows = []
    for rid, name, kind, problem, volume, depth, net in specs:
        row = record(rid, name, ENTRY['authority'], ENTRY['tambon'], ENTRY['moo'],
                     problem=problem, volume=volume)
        row.update(type=kind, depth=depth, depthnet=net, width=3 if volume else None,
                   length=4 if volume else None, village='ทดสอบแม่กา')
        rows.append(row)
    return rows


def install_counter_mock(context, requests, *, fail=False):
    def abacus(route):
        url = route.request.url
        requests.append(url)
        if fail:
            route.fulfill(status=503, content_type='application/json', body='{}')
            return
        count = 246 if url.endswith('/total-views') else 12 if url.endswith('/country-TH') else 0
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'value': count}))

    context.route(COUNTER + '**', abacus)
    context.route('https://ipwho.is/**', lambda route: route.fulfill(
        status=200, content_type='application/json', body='{"success":true,"country_code":"TH"}'))


def chart_data(page):
    return page.evaluate('''() => [chartType,chartVol,chartProb].map(chart=>({
      labels:[...chart.data.labels],values:[...chart.data.datasets[0].data]}))''')


def save(page, name):
    page.screenshot(path=str(SHOTS / name), full_page=True)


def install_virtual_host(context, host, data):
    """Serve current local files at a synthetic hosted origin, with a mocked same-origin API."""
    def handler(route):
        url = route.request.url
        if not url.startswith(host + '/'):
            if 'leaflet.markercluster.js' in url:
                route.fulfill(status=200, content_type='application/javascript',
                              body='L.markerClusterGroup = () => { const group=L.featureGroup(); '
                                   'group.addLayers=function(layers){layers.forEach(layer=>this.addLayer(layer));return this}; '
                                   'return group; };')
            elif url.startswith('https://cdnjs.cloudflare.com/'):
                route.continue_()
            else:
                route.abort()
            return
        path = urlparse(url).path
        if path == '/api/waterresources/version':
            route.fulfill(status=200, content_type='application/json', body=json.dumps({
                'success': True, 'initialized': True, 'version': '"parity-host-v1"',
                'count': len(data)}))
        elif path == '/api/waterresources':
            route.fulfill(status=200, content_type='application/json', body=json.dumps({
                'success': True, 'version': '"parity-host-v1"', 'count': len(data),
                'data': data}, ensure_ascii=False))
        else:
            asset = ROOT / 'site' / ('authority.html' if path.startswith('/authority/')
                                     else path.lstrip('/'))
            if asset.is_file() and asset.resolve().is_relative_to((ROOT / 'site').resolve()):
                kind = 'text/html' if asset.suffix == '.html' else 'application/javascript'
                route.fulfill(status=200, content_type=kind, body=asset.read_bytes())
            else:
                route.fulfill(status=404, body='not found')
    context.route('**/*', handler)


def main():
    data = fixture()
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=CHROME)
        try:
            for width, height in ((1440, 900), (768, 1024), (412, 915), (390, 844), (360, 800)):
                context = browser.new_context(viewport={'width': width, 'height': height},
                                              is_mobile=width < 500, has_touch=width < 500)
                install_routes(context, data=data)
                counter_requests = []
                install_counter_mock(context, counter_requests)
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(BASE + '/authority/tt-mae-ka/', wait_until='domcontentloaded')
                page.wait_for_function('''() => document.body.classList.contains('authority-ready') &&
                  document.querySelector('#statCount')?.textContent==='6' ''')
                page.wait_for_function("() => document.querySelector('#vcTotal')?.textContent==='246'")
                assert not [url for url in counter_requests if '/hit/' in url], counter_requests
                assert page.locator('#visitorCounter').is_visible()
                assert page.locator('#fVillage').count() == 0
                assert page.locator('#lpVillageList input').count() == 1
                assert page.locator('#authorityContext').count() == 0
                assert page.locator('#statTypes').inner_text() == '3'
                assert page.locator('#statBroken').inner_text() == '2'
                assert page.locator('#statVol').inner_text() == '1.1K'
                assert page.locator('#statAvgVol').inner_text() == '210'
                assert page.locator('#tblBody tr').count() == 6
                charts = chart_data(page)
                assert dict(zip(charts[0]['labels'], charts[0]['values'])) == {
                    'ฝาย': 3, 'บ่อบาดาล': 2, 'สระน้ำ/บ่อน้ำ(มนุษย์สร้าง)': 1}
                assert dict(zip(charts[1]['labels'], charts[1]['values'])) == {
                    'ฝาย': 500, 'บ่อบาดาล': 250, 'สระน้ำ/บ่อน้ำ(มนุษย์สร้าง)': 300}
                assert dict(zip(charts[2]['labels'], charts[2]['values'])) == {
                    'ชำรุด': 2, 'น้ำเน่าเสีย': 1, 'วัชพืชปกคลุม': 1,
                    'น้ำมีสี': 1, 'ใช้งานได้': 2}
                dss = page.locator('#dssContent').inner_text()
                for fragment in ('ปัญหาผลกระทบที่ตรวจพบรวมในเขตคัดกรอง',
                                 'ข้อแนะนำยุทธศาสตร์การบริหารงบประมาณ',
                                 '2 จุด', '2 แห่ง', 'ยุทธศาสตร์เร่งด่วน',
                                 'จัดลำดับความสำคัญ', 'สัปดาห์สิ่งแวดล้อม',
                                 'ตรวจสอบพื้นที่อุตสาหกรรม'):
                    assert fragment in dss, (fragment, dss)
                assert '28 แห่ง' not in dss
                assert 'ข้อมูลสำรวจไม่ใช่ผลตรวจยืนยัน' not in dss
                if width == 1440:
                    save(page, '02-authority-overview-1440.png')
                    save(page, '03-authority-dss-overview-1440.png')
                page.locator('#vcToggle').click()
                page.wait_for_function("() => document.querySelector('#vcCountryCount')?.textContent==='1'")
                assert 'ไทย' in page.locator('#vcCountryList').inner_text()
                assert '12' in page.locator('#vcCountryList').inner_text()
                rect = page.locator('#vcPanel').bounding_box()
                assert rect and rect['x'] >= 0 and rect['x'] + rect['width'] <= width + 2, rect
                assert rect['y'] >= 0 and rect['y'] + rect['height'] <= height + 2, rect
                if width == 1440:
                    save(page, '07-authority-visitor-1440.png')
                    save(page, '08-authority-visitor-countries-1440.png')
                if width in (390, 360):
                    save(page, f'09-authority-mobile-{width}.png')
                page.locator('#vcToggle').click()
                page.locator('#tblBody tr[data-id="81001"]').click()
                specific = page.locator('#dssContent').inner_text()
                for fragment in ('ความจุลดลง 30%', 'โครงสร้างเสียหาย', 'วิกฤตคุณภาพน้ำ',
                                 'โครงการขุดลอก', 'ส่งวิศวกรท้องถิ่น', 'ตรวจสอบการระบายน้ำเสีย'):
                    assert fragment in specific, (fragment, specific)
                assert page.locator('#statCount').inner_text() == '6'
                assert page.locator('#tblBody tr').count() == 6
                assert chart_data(page) == charts
                if width == 1440:
                    save(page, '04-authority-dss-record-1440.png')
                page.locator('#tblBody tr[data-id="81002"]').click()
                assert 'วัชพืชหนาแน่น' in page.locator('#dssContent').inner_text()
                assert 'พื้นที่ราว 12 ตร.ม.' in page.locator('#dssContent').inner_text()
                if width == 1440:
                    save(page, '05-authority-popup-a-to-b-1440.png')
                page.evaluate('''() => {const r=document.querySelector('.leaflet-popup-close-button').getBoundingClientRect();
                  window.scrollTo(0, window.scrollY+r.top-150)}''')
                page.locator('.leaflet-popup-close-button').last.click()
                assert 'สารสนเทศวิเคราะห์ผลกระทบและข้อแนะนำ' in page.locator('#dssTitleText').inner_text()
                assert chart_data(page) == charts
                if width == 1440:
                    save(page, '06-authority-after-popup-close-1440.png')
                page.locator('#fType').select_option('ฝาย')
                assert page.locator('#statCount').inner_text() == '3'
                assert page.locator('#tblBody tr').count() == 3
                assert '1 แห่ง' in page.locator('#dssContent').inner_text()
                page.locator('.kpi[data-kpi="count"]').click()
                page.locator('.kpi[data-kpi="types"]').click()
                assert 'ประเภทที่มีมากที่สุด' in page.locator('#kpiInsight').inner_text()
                page.locator('.kpi[data-kpi="vol"]').click()
                assert 'ถือครองความจุมากที่สุด' in page.locator('#kpiInsight').inner_text()
                page.locator('.kpi[data-kpi="avg"]').click()
                assert 'มากกว่าค่าเฉลี่ย' in page.locator('#kpiInsight').inner_text()
                page.locator('.expand-btn[data-chart="type"]').click()
                assert page.locator('#chartModalBg').is_visible()
                page.locator('#chartModalClose').click()
                assert not page.locator('#chartModalBg').is_visible()
                if width == 1440:
                    page.locator('#tblBody tr[data-id="81003"]').click()
                    assert 'วิกฤตคุณภาพน้ำ' in page.locator('#dssContent').inner_text()
                    page.locator('#tblBody tr[data-id="81006"]').click()
                    assert 'ความจุลดลง 25%' in page.locator('#dssContent').inner_text()
                    page.locator('#tblBody tr[data-id="81004"]').click()
                    assert 'สมบูรณ์ดี' in page.locator('#dssContent').inner_text()
                    page.locator('#dssResetBtn').click()
                    page.locator('#legType span').first.click()
                    assert page.locator('#statCount').inner_text() == '3'
                    page.locator('.kpi[data-kpi="count"]').click()
                    page.locator('#fProblem').select_option('ชำรุด')
                    assert page.locator('#statCount').inner_text() == '2'
                    page.locator('.kpi[data-kpi="count"]').click()
                    page.locator('#txtSearch').fill('COLORED-WATER')
                    assert page.locator('#statCount').inner_text() == '1'
                    page.locator('#txtSearch').fill('NO-RESULT')
                    assert page.locator('#statCount').inner_text() == '0'
                    assert 'ไม่มีข้อมูลแหล่งน้ำให้ประมวลผล' in page.locator('#dssContent').inner_text()
                    page.locator('.kpi[data-kpi="count"]').click()
                    page.locator('.map-fullscreen-btn').click()
                    assert page.locator('.card.pseudo-fullscreen').count() == 1
                    page.keyboard.press('Escape')
                    assert page.locator('.card.pseudo-fullscreen').count() == 0
                assert page.evaluate('document.documentElement.scrollWidth - innerWidth') <= 2
                assert not errors, errors
                results.append(f'authority_parity_{width}')
                context.close()

            context = browser.new_context(viewport={'width': 1440, 'height': 900})
            install_routes(context, data=data)
            original_requests = []
            install_counter_mock(context, original_requests)
            page = context.new_page()
            page.goto(BASE + '/maeka.html', wait_until='domcontentloaded')
            page.wait_for_function("() => document.querySelector('#statCount')?.textContent==='6'")
            page.wait_for_function("() => document.querySelector('#vcTotal')?.textContent==='246'")
            assert page.locator('#visitorCounter').is_visible()
            assert any('/hit/pyo-water-maeka-dashboard/total-views' in url for url in original_requests)
            assert any('/hit/pyo-water-maeka-dashboard/country-TH' in url for url in original_requests)
            save(page, '01-original-maeka-1440.png')
            assert page.locator('#statTypes').inner_text() == '3'
            assert page.locator('#statBroken').inner_text() == '2'
            assert chart_data(page) == charts
            assert 'ปัญหาผลกระทบที่ตรวจพบรวมในเขตคัดกรอง' in page.locator('#dssContent').inner_text()
            results.append('original_reference_mocked_counter')
            context.close()

            context = browser.new_context()
            install_routes(context, data=data)
            failed = []
            install_counter_mock(context, failed, fail=True)
            page = context.new_page()
            page.goto(BASE + '/authority/tt-mae-ka/', wait_until='domcontentloaded')
            page.wait_for_function("() => document.querySelector('#vcTotal')?.textContent==='—'")
            assert 'ไม่สามารถโหลดข้อมูลผู้เข้าชม' in page.locator('#vcStatus').inner_text()
            assert not [url for url in failed if '/hit/' in url]
            results.append('counter_failure_no_hit')
            context.close()

            for host, expected_hits in ((PREVIEW, 0), (ACTIVE, 2)):
                context = browser.new_context()
                install_virtual_host(context, host, data)
                calls = []
                install_counter_mock(context, calls)
                page = context.new_page()
                page.goto(host + '/authority/tt-mae-ka/', wait_until='domcontentloaded')
                page.wait_for_function("() => document.body.classList.contains('authority-ready') && document.querySelector('#vcTotal')?.textContent==='246'")
                hits = [url for url in calls if '/hit/' in url]
                assert len(hits) == expected_hits, (host, hits)
                assert all('/pyo-water-maeka-dashboard/' in url for url in calls)
                page.reload(wait_until='domcontentloaded')
                page.wait_for_function("() => document.body.classList.contains('authority-ready') && document.querySelector('#vcTotal')?.textContent==='246'")
                hits_after_reload = [url for url in calls if '/hit/' in url]
                assert len(hits_after_reload) == expected_hits, (host, hits_after_reload)
                results.append(('preview_no_hit' if host == PREVIEW else 'mocked_live_host_daily_hits_only'))
                context.close()
        finally:
            browser.close()
    print(json.dumps({'ok': True, 'tests': results, 'screenshots': str(SHOTS)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
