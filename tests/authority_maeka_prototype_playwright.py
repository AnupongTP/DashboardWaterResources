"""Focused Chromium checks for the Maeka-based, authority-scoped prototype."""
import copy
import json
import os
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

from authority_locked_playwright import ACTIVE, BASE, CHROME, DATA, by_slug, install_routes, ready, record

IMAGE_ID = 'testAuthorityImage1234567890123'
IMAGE_URL = f'https://drive.google.com/uc?export=view&id={IMAGE_ID}'
PNG = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082')
SHOTS = Path(tempfile.mkdtemp(prefix='authority-maeka-prototype-'))


def fixture():
    data = copy.deepcopy(DATA)
    next(row for row in data if row['name'] == 'MAEKA-DAMAGED')['imglink'] = IMAGE_URL
    data.append(record(72001, 'MAEKA-NO-COORD', 'ทต.แม่กา', 'แม่กา',
                       by_slug['tt-mae-ka']['moo'], volume=0))
    data[-1]['lat'] = data[-1]['lng'] = None
    data[-1]['width'] = data[-1]['length'] = data[-1]['depthnet'] = None
    data[-1]['type'] = 'บ่อบาดาล'
    data.append(record(72002, 'OTHER-IN-MAEKA', 'อบต.แม่ใส', 'แม่กา',
                       by_slug['tt-mae-ka']['moo']))
    data.append(record(72003, 'AMBIGUOUS-OTHER', None, 'ดอกคำใต้', None))
    return data


def main():
    results = []
    data = fixture()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME)
        try:
            for width, height in ((1440, 900), (768, 1024), (412, 915), (390, 844), (360, 800)):
                context = browser.new_context(viewport={'width': width, 'height': height},
                                              is_mobile=width < 500, has_touch=width < 500)
                install_routes(context, data=data)
                image_requests = []

                def image_route(route):
                    image_requests.append(route.request.url)
                    route.fulfill(status=200, content_type='image/png', body=PNG)

                context.route('https://lh3.googleusercontent.com/d/**', image_route)
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(BASE + '/authority/tt-mae-ka/', wait_until='domcontentloaded')
                try:
                    ready(page, 'tt-mae-ka', 3)
                except Exception:
                    print('BOOT_DEBUG', page.evaluate('''() => ({page:window.__AUTHORITY_PAGE__,
                        failure:document.querySelector('#authorityFailure')?.textContent,
                        diagnostics:window.__WATER_DATA_DIAGNOSTICS__,
                        names:window.__AUTHORITY_DATA__?.map(r=>r.name),
                        ready:document.body.classList.contains('authority-ready')})'''), errors)
                    raise
                assert page.locator('#statCount').inner_text() == '3'
                assert page.locator('#tblBody tr').count() == 3
                assert 'OTHER-IN-MAEKA' not in page.locator('#tblBody').inner_text()
                assert 'AMBIGUOUS-OTHER' not in page.locator('#tblBody').inner_text()
                assert page.locator('#mapbox .leaflet-marker-icon').count() == 2
                assert page.locator('#tblBody').get_by_text('MAEKA-NO-COORD').count() == 1
                assert page.locator('#tblBody').get_by_text('—').count() >= 1
                assert page.evaluate('document.documentElement.scrollWidth - innerWidth') <= 2
                page.screenshot(path=str(SHOTS / f'authority-{width}.png'), full_page=True)
                if width == 1440:
                    page.goto(BASE + '/maeka.html', wait_until='domcontentloaded')
                    page.wait_for_function('() => document.querySelector("#statCount").textContent !== "41"')
                    page.screenshot(path=str(SHOTS / 'original-maeka-1440.png'), full_page=True)
                    page.goto(BASE + '/authority/tt-mae-ka/', wait_until='domcontentloaded')
                    ready(page, 'tt-mae-ka', 3)
                    page.locator('#txtSearch').fill('NO-COORD')
                    assert page.locator('#statCount').inner_text() == '1'
                    page.locator('.kpi[data-kpi="count"]').click()
                    assert page.locator('#statCount').inner_text() == '3'
                    page.locator('#fStatus').select_option('ชำรุด')
                    assert page.locator('#statCount').inner_text() == '1'
                    page.locator('.kpi[data-kpi="count"]').click()
                    page.locator('#fType').select_option('ฝาย')
                    assert page.locator('#statCount').inner_text() == '2'
                    page.locator('#fProblem').select_option('ชำรุด')
                    assert page.locator('#statCount').inner_text() == '1'
                    page.locator('.kpi[data-kpi="count"]').click()
                    page.locator('#legType span').first.click()
                    assert page.locator('#statCount').inner_text() in ('1', '2')
                    page.locator('.kpi[data-kpi="count"]').click()
                    page.locator('#layerBtn').click()
                    page.locator('#lpVillageNone').click()
                    assert page.locator('#mapbox .leaflet-marker-icon').count() == 0
                    page.locator('#lpVillageAll').click()
                    assert page.locator('#mapbox .leaflet-marker-icon').count() == 2
                    page.locator('#tblBody tr').filter(has_text='MAEKA-NO-COORD').click()
                    assert 'MAEKA-NO-COORD' in page.locator('#dssTitleText').inner_text()
                    assert page.locator('#mapbox .leaflet-marker-icon').count() == 2
                    page.locator('#dssResetBtn').click()
                    page.locator('#tblBody tr').filter(has_text='MAEKA-DAMAGED').click()
                    assert page.locator('#dssTitleText').inner_text().find('MAEKA-DAMAGED') >= 0
                    assert page.locator('#tblBody tr.selected').count() == 1
                    popup_image = page.locator('#mapbox .leaflet-popup img[data-drive-id]')
                    popup_image.wait_for()
                    page.wait_for_function('''() => document.querySelector('#mapbox .leaflet-popup img[data-drive-id]')?.naturalWidth > 0''')
                    assert len(image_requests) == 1, image_requests
                    popup_image.click()
                    assert page.locator('#imgModalBg').is_visible()
                    assert page.locator('#imgModalImg').get_attribute('src') == popup_image.get_attribute('src')
                    page.locator('#imgModalClose').click()
                    page.locator('#dssResetBtn').click()
                    assert 'สรุปข้อมูลปัญหาตามตัวกรอง' in page.locator('#dssTitleText').inner_text()
                    assert page.locator('.dss-summary-card').count() == 4
                    page.locator('.expand-btn[data-chart="type"]').click()
                    assert page.locator('#chartModalBg').is_visible()
                    page.locator('#chartModalClose').click()
                    assert not page.locator('#chartModalBg').is_visible()
                    assert len(image_requests) == 1, image_requests
                    assert 'OTHER-IN-MAEKA' not in page.locator('body').inner_text()
                    assert not errors, errors
                    results.append('functional_scope_filters_map_dss_chart_image')
                    failed_requests = []

                    def failed_primary(route):
                        failed_requests.append(route.request.url)
                        route.fulfill(status=403, content_type='text/html', body='<html>denied</html>')

                    context.route('https://lh3.googleusercontent.com/d/**', failed_primary)
                    page.reload(wait_until='domcontentloaded')
                    ready(page, 'tt-mae-ka', 3)
                    page.locator('#tblBody tr').filter(has_text='MAEKA-DAMAGED').click()
                    placeholder = page.locator('#mapbox .leaflet-popup .authority-image-fallback')
                    placeholder.wait_for(state='visible')
                    assert len(failed_requests) == 1, failed_requests
                    assert placeholder.get_by_text('เปิดไฟล์ต้นฉบับ').get_attribute('href') == IMAGE_URL
                    page.evaluate('renderAll()')
                    page.locator('#tblBody tr').filter(has_text='MAEKA-DAMAGED').click()
                    assert len(failed_requests) == 1, failed_requests
                    backup_requests = []

                    def backup_image(route):
                        backup_requests.append(route.request.url)
                        route.fulfill(status=200, content_type='image/png', body=PNG)

                    context.route('https://drive.google.com/thumbnail**', backup_image)
                    page.locator('#mapbox .leaflet-popup:visible .authority-image-fallback button').last.click()
                    page.wait_for_function('''() => document.querySelector('#mapbox .leaflet-popup img[data-drive-id]')?.naturalWidth > 0''')
                    assert len(backup_requests) == 1, backup_requests
                    assert len(failed_requests) == 1, failed_requests
                    results.append('image_failure_placeholder_user_triggered_backup')
                else:
                    assert not errors, errors
                results.append(f'viewport_{width}')
                context.close()
            empty = [row for row in data if row.get('localAuthority') != 'ทต.แม่กา']
            context = browser.new_context()
            install_routes(context, data=empty)
            page = context.new_page()
            page.goto(BASE + '/authority/tt-mae-ka/', wait_until='domcontentloaded')
            ready(page, 'tt-mae-ka', 0)
            assert page.locator('#authorityZero').is_visible()
            assert page.locator('#authorityFailure').count() == 0
            assert page.locator('#mapbox .leaflet-marker-icon').count() == 0
            results.append('valid_current_dataset_zero_authority_records')
            context.close()
        finally:
            browser.close()
    print(json.dumps({'ok': True, 'tests': results, 'screenshots': str(SHOTS)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
